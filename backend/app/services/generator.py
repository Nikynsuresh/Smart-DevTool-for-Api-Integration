import json
import logging
import re
from typing import Dict, Any, List
from app.services.rag import RAGPipeline
from app.services.llm import LLMService

logger = logging.getLogger(__name__)

class APIIntegrationGenerator:
    def __init__(self):
        self.rag = RAGPipeline()
        self.llm = LLMService()

    def _clean_json_response(self, text: str) -> str:
        """Strip markdown code blocks from LLM JSON response."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    async def generate_all(self, integration_id: int, url: str, use_case: str, language: str, progress_callback=None, pages=None) -> Dict[str, Any]:
        """Orchestrate documentation analysis, extraction, SDK verification, and code generation in a single optimized LLM call."""
        
        if progress_callback:
            await progress_callback(75, "Analyzing structure, detecting SDKs, and generating wrapper class...")
            
        # Gather all scraped documentation text
        if pages:
            combined_text = "\n\n".join([p["content"] for p in pages])
        else:
            try:
                vectorstore = self.rag._get_vectorstore()
                results = vectorstore._collection.get(where={"integration_id": integration_id})
                combined_text = "\n\n".join(results["documents"])
            except Exception as e:
                logger.error(f"Error fetching docs from Chroma: {e}")
                auth_docs = self.rag.retrieve_context(integration_id, "authentication auth credentials api key bearer token oauth header", k=4)
                endpoint_docs = self.rag.retrieve_context(integration_id, f"endpoints request path method parameters schema {use_case}", k=5)
                combined_text = "\n---\n".join([doc.page_content for doc in auth_docs + endpoint_docs])

        # Extract Candidate Endpoints & Auth via Python Regex for grounding
        from app.services.extractor import extract_endpoints_with_regex, detect_authentication
        regex_endpoints = extract_endpoints_with_regex(combined_text)
        detected_auth = detect_authentication(combined_text)

        system_prompt = (
            f"You are a Senior Solutions Architect and Expert Software Engineer. Analyze the provided API documentation context and use case, and generate the following six integration components in **{language}**:\n\n"
            "You MUST return your output enclosed in the specified XML tags:\n\n"
            "1. **Authentication Summary**:\n"
            "   - Format: Markdown text summarizing authentication protocols, headers, base URLs, and environment variables.\n"
            "   - Tag: Enclose inside <auth_summary>...</auth_summary> XML tags.\n\n"
            "2. **Relevant Endpoints**:\n"
            "   - Format: A valid JSON Array of only relevant endpoints matching the use case. Ignore unrelated ones.\n"
            "   - Structure exactly like this:\n"
            "     [\n"
            "       {\n"
            '         "path": "/v1/payments",\n'
            '         "method": "POST",\n'
            '         "description": "Create a new payment",\n'
            '         "parameters": [\n'
            '            {"name": "amount", "type": "integer", "required": true, "description": "The amount in cents"}\n'
            '         ],\n'
            '         "request_body_example": "{\\"amount\\": 1000, \\"currency\\": \\"usd\\"}",\n'
            '         "response_body_example": "{\\"id\\": \\"pay_123\\", \\"status\\": \\"succeeded\\"}"\n'
            "       }\n"
            "     ]\n"
            "   - Tag: Enclose inside <endpoints>...</endpoints> XML tags.\n\n"
            "3. **SDK Detection & Recommendation**:\n"
            "   - Format: Markdown text analyzing if official SDK libraries exist for {language}, and recommending if the developer should use an official SDK or standard REST calls.\n"
            "   - Tag: Enclose inside <sdk_recommendation>...</sdk_recommendation> XML tags.\n\n"
            "4. **Wrapper Client Class Code**:\n"
            "   - Format: Clean, fully commented, robust, production-ready class code.\n"
            "   - Include: authentication setup, error handling (connection timeouts, status parsing), advanced retry logic (backoff, max retries), env configurations.\n"
            "   - CRITICAL: Do NOT generate mock implementation blocks containing `pass` or `TODO` for the wrapper methods. Use HTTP client requests targeting the real base URLs/paths identified in the endpoint schema.\n"
            "   - Tag: Enclose inside <wrapper_code>...</wrapper_code> XML tags.\n\n"
            "5. **Step-by-Step Integration Steps**:\n"
            "   - Format: A markdown tutorial detailing how to use the generated wrapper in a new project (installing packages, configuring env variables, instantiating client).\n"
            "   - Tag: Enclose inside <integration_steps>...</integration_steps> XML tags.\n\n"
            "6. **Sample Requests & Responses**:\n"
            "   - Format: Clean markdown code snippet examples of making requests and receiving responses using the generated wrapper.\n"
            "   - Enclose code blocks in standard markdown code fences (e.g. ```python ... ```).\n"
            "   - Tag: Enclose inside <sample_requests_responses>...</sample_requests_responses> XML tags.\n"
        )

        user_prompt = (
            f"Base Documentation Url: {url}\n"
            f"Use Case: {use_case}\n"
            f"Target Language: {language}\n\n"
            f"Detected Authentication details (Regex/Heuristic):\n{detected_auth['json_summary']}\n\n"
            f"Candidate Endpoints Extracted via Regex:\n{json.dumps(regex_endpoints, indent=2)}\n\n"
            f"Reference Documentation Context (Truncated if large):\n{combined_text[:12000]}"
        )

        # Single LLM request to get all integration data
        response = await self.llm.generate_completion(system_prompt, user_prompt, temperature=0.1)

        # Parsing tags
        auth_match = re.search(r"<auth_summary>(.*?)</auth_summary>", response, re.DOTALL)
        auth_summary = auth_match.group(1).strip() if auth_match else f"Authentication Method: {detected_auth['auth_method']}"

        endpoints_match = re.search(r"<endpoints>(.*?)</endpoints>", response, re.DOTALL)
        endpoints = []
        if endpoints_match:
            try:
                endpoints_raw = self._clean_json_response(endpoints_match.group(1).strip())
                endpoints = json.loads(endpoints_raw)
            except Exception as e:
                logger.error(f"Failed to parse endpoints JSON from LLM: {e}")
                endpoints = regex_endpoints
        else:
            endpoints = regex_endpoints

        sdk_match = re.search(r"<sdk_recommendation>(.*?)</sdk_recommendation>", response, re.DOTALL)
        sdk_recommendation = sdk_match.group(1).strip() if sdk_match else "Use standard REST wrapper implementation."

        wrapper_match = re.search(r"<wrapper_code>(.*?)</wrapper_code>", response, re.DOTALL)
        wrapper_code = wrapper_match.group(1).strip() if wrapper_match else response.strip()

        steps_match = re.search(r"<integration_steps>(.*?)</integration_steps>", response, re.DOTALL)
        integration_steps = steps_match.group(1).strip() if steps_match else ""

        samples_match = re.search(r"<sample_requests_responses>(.*?)</sample_requests_responses>", response, re.DOTALL)
        samples_text = samples_match.group(1).strip() if samples_match else ""

        sample_requests = "No requests examples parsed."
        sample_responses = "No responses examples parsed."

        # Simple extraction of markdown blocks
        code_blocks = re.findall(r"```[a-zA-Z]*\n(.*?)\n```", samples_text, re.DOTALL)
        if len(code_blocks) >= 2:
            sample_requests = f"### Sample Request\n```\n{code_blocks[0]}\n```"
            sample_responses = f"### Sample Response\n```\n{code_blocks[1]}\n```"
        else:
            if "response" in samples_text.lower():
                parts = re.split(r"(?=response|Response|### Response)", samples_text, maxsplit=1)
                sample_requests = parts[0].strip()
                sample_responses = parts[1].strip() if len(parts) > 1 else "Response samples not separated."
            else:
                sample_requests = samples_text
                sample_responses = "Sample responses merged with requests above."

        if progress_callback:
            await progress_callback(95, "Assets compiled, finalize database transaction...")

        return {
            "auth_summary": auth_summary,
            "endpoints_json": json.dumps(endpoints),
            "sdk_recommendation": sdk_recommendation,
            "integration_steps": integration_steps,
            "generated_code": wrapper_code,
            "sample_requests": sample_requests,
            "sample_responses": sample_responses
        }

    async def _analyze_auth_and_endpoints(self, integration_id: int, use_case: str, pages=None) -> Dict[str, Any]:
        """Find authentication schemes and relevant endpoints matching the use case using Regex candidates and LLM mapping."""
        # 1. Gather all scraped documentation text
        if pages:
            combined_text = "\n\n".join([p["content"] for p in pages])
        else:
            try:
                vectorstore = self.rag._get_vectorstore()
                results = vectorstore._collection.get(where={"integration_id": integration_id})
                combined_text = "\n\n".join(results["documents"])
            except Exception as e:
                logger.error(f"Error fetching docs from Chroma: {e}")
                # Fallback: Query RAG for some documents
                auth_docs = self.rag.retrieve_context(integration_id, "authentication auth credentials api key bearer token oauth header", k=4)
                endpoint_docs = self.rag.retrieve_context(integration_id, f"endpoints request path method parameters schema {use_case}", k=5)
                combined_text = "\n---\n".join([doc.page_content for doc in auth_docs + endpoint_docs])

        # 2. Extract Candidate Endpoints & Auth via Python Regex
        from app.services.extractor import extract_endpoints_with_regex, detect_authentication
        regex_endpoints = extract_endpoints_with_regex(combined_text)
        detected_auth = detect_authentication(combined_text)

        # 3. LLM Refinement & Filtering
        system_prompt = (
            "You are a Senior Solutions Architect. Your task is to analyze the extracted API candidate endpoints and authentication methods and map them to the user's specific use case.\n"
            "You MUST return your output in the following XML tag format:\n"
            "<auth_summary>\n[Markdown summary of authentication protocols, parameters, headers, base URLs, environment configurations]\n</auth_summary>\n"
            "<endpoints>\n[JSON Array of only relevant endpoints]\n</endpoints>\n\n"
            "Each item in the JSON endpoints array must structure exactly like this:\n"
            "{\n"
            '  "path": "/v1/payments",\n'
            '  "method": "POST",\n'
            '  "description": "Create a new payment",\n'
            '  "parameters": [\n'
            '     {"name": "amount", "type": "integer", "required": true, "description": "The amount in cents"}\n'
            "  ],\n"
            '  "request_body_example": "{\\"amount\\": 1000, \\"currency\\": \\"usd\\"}",\n'
            '  "response_body_example": "{\\"id\\": \\"pay_123\\", \\"status\\": \\"succeeded\\"}"\n'
            "}\n\n"
            "CRITICAL: Filter and keep ONLY endpoints that are directly relevant to the user's use case. Ignore unrelated ones."
        )
        
        user_prompt = (
            f"Use Case: {use_case}\n\n"
            f"Detected Authentication details (Regex/Heuristic):\n{detected_auth['json_summary']}\n\n"
            f"Candidate Endpoints Extracted via Regex:\n{json.dumps(regex_endpoints, indent=2)}\n\n"
            f"Reference Documentation Context (Truncated if large):\n{combined_text[:15000]}"
        )
        
        response = await self.llm.generate_completion(system_prompt, user_prompt, temperature=0.1)
        
        # Parse output tags
        auth_match = re.search(r"<auth_summary>(.*?)</auth_summary>", response, re.DOTALL)
        endpoints_match = re.search(r"<endpoints>(.*?)</endpoints>", response, re.DOTALL)
        
        auth_summary = auth_match.group(1).strip() if auth_match else f"Authentication Method: {detected_auth['auth_method']}"
        
        endpoints = []
        if endpoints_match:
            try:
                endpoints_raw = self._clean_json_response(endpoints_match.group(1).strip())
                endpoints = json.loads(endpoints_raw)
            except Exception as e:
                logger.error(f"Failed to parse endpoints JSON from LLM output: {e}")
                # Fallback to Regex harvested endpoints that match use case keywords
                endpoints = [
                    ep for ep in regex_endpoints 
                    if any(kw in ep["path"].lower() or kw in ep["method"].lower() for kw in use_case.lower().split())
                ]
        else:
            # Fallback
            endpoints = regex_endpoints
                    
        return {
            "auth_summary": auth_summary,
            "endpoints": endpoints
        }

    async def _detect_sdks(self, integration_id: int, target_language: str, pages=None) -> str:
        """Search documentation for SDK links/references and give integration recommendations."""
        if pages:
            context = "\n---\n".join([p["content"] for p in pages[:4]])
        else:
            sdk_docs = self.rag.retrieve_context(integration_id, "sdk library python javascript typescript java go install github packages npm pip client", k=5)
            context = "\n---\n".join([doc.page_content for doc in sdk_docs])
        
        system_prompt = (
            "You are an API integration assistant. Analyze the documentation context and determine:\n"
            "1. Whether official SDK libraries exist for the following languages: Python, JavaScript/TypeScript, Go, Java, C#.\n"
            "2. Recommend whether the developer should use an official SDK or integrate using standard REST API calls in their preferred target language.\n"
            "Structure your analysis in Markdown. Include sections: 'Detected SDKs', 'Recommendation for Target Language', and 'Pros & Cons' of the recommendation."
        )
        
        user_prompt = (
            f"Target Language: {target_language}\n\n"
            f"Documentation Context:\n{context[:12000]}"
        )
        
        return await self.llm.generate_completion(system_prompt, user_prompt, temperature=0.2)

    async def _generate_wrapper_and_docs(self, integration_id: int, url: str, use_case: str, language: str, auth_info: str, endpoints: List[Dict[str, Any]]) -> Dict[str, str]:
        """Generate the final wrapper class, integration steps, and code samples in a single optimized LLM call."""
        endpoints_context = json.dumps(endpoints, indent=2)
        
        system_prompt = (
            f"You are a Senior Solutions Architect and Expert Software Engineer. Generate three components for an API integration in **{language}**:\n\n"
            "1. **Wrapper Client Class**:\n"
            "   - Clean, fully commented, robust, and production-ready code.\n"
            "   - Proper authentication setup (API keys, tokens, loaded from env variables).\n"
            "   - Proper error handling (try/catch block, catching connection timeouts, error status parsing).\n"
            "   - Advanced retry logic (backoff, configurable max retries).\n"
            "   - Env configurations and configuration structures.\n"
            "   - CRITICAL: Do NOT generate mock implementation blocks containing `pass` or `TODO` for the wrapper methods. Use HTTP client requests targeting the real base URLs/paths identified in the endpoint schema.\n"
            "   - Output this component enclosed inside <wrapper_code>...</wrapper_code> XML tags.\n\n"
            "2. **Step-by-Step Integration Steps**:\n"
            "   - A markdown tutorial detailing how to use the generated wrapper in a new project.\n"
            "   - Include: how to install required packages/dependencies, how to configure environment variables, and how to instantiate/configure the client class.\n"
            "   - Output this component enclosed inside <integration_steps>...</integration_steps> XML tags.\n\n"
            "3. **Sample Requests & Responses**:\n"
            "   - Clean markdown code snippet examples of making requests and receiving responses using the generated wrapper.\n"
            "   - Enclose code blocks in standard markdown code fences (e.g. ```python ... ```).\n"
            "   - Show realistic request payloads and matching response JSON examples.\n"
            "   - Output this component enclosed inside <sample_requests_responses>...</sample_requests_responses> XML tags."
        )
        
        user_prompt = (
            f"Base Documentation Url: {url}\n"
            f"Use Case: {use_case}\n"
            f"Target Language: {language}\n\n"
            f"Authentication Summary:\n{auth_info}\n\n"
            f"Extracted Endpoints:\n{endpoints_context}"
        )
        
        # Use a single LLM API call to avoid sequential rate-limiting and minimize latency
        response = await self.llm.generate_completion(system_prompt, user_prompt, temperature=0.1)
        
        wrapper_match = re.search(r"<wrapper_code>(.*?)</wrapper_code>", response, re.DOTALL)
        wrapper_code = wrapper_match.group(1).strip() if wrapper_match else response.strip()
        
        steps_match = re.search(r"<integration_steps>(.*?)</integration_steps>", response, re.DOTALL)
        integration_steps = steps_match.group(1).strip() if steps_match else ""
        
        samples_match = re.search(r"<sample_requests_responses>(.*?)</sample_requests_responses>", response, re.DOTALL)
        samples_text = samples_match.group(1).strip() if samples_match else ""
        
        sample_requests = "No requests examples parsed."
        sample_responses = "No responses examples parsed."
        
        # Simple extraction of markdown blocks
        code_blocks = re.findall(r"```[a-zA-Z]*\n(.*?)\n```", samples_text, re.DOTALL)
        if len(code_blocks) >= 2:
            sample_requests = f"### Sample Request\n```\n{code_blocks[0]}\n```"
            sample_responses = f"### Sample Response\n```\n{code_blocks[1]}\n```"
        else:
            if "response" in samples_text.lower():
                parts = re.split(r"(?=response|Response|### Response)", samples_text, maxsplit=1)
                sample_requests = parts[0].strip()
                sample_responses = parts[1].strip() if len(parts) > 1 else "Response samples not separated."
            else:
                sample_requests = samples_text
                sample_responses = "Sample responses merged with requests above."

        return {
            "generated_code": wrapper_code,
            "integration_steps": integration_steps,
            "sample_requests": sample_requests,
            "sample_responses": sample_responses
        }
