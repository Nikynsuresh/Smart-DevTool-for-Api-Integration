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
        """Orchestrate documentation analysis, extraction, SDK verification, and code generation."""
        
        # 1. Analyze and extract Auth & Endpoints
        if progress_callback:
            await progress_callback(72, "Analyzing retrieved documentation for authentication and endpoints...")
        
        auth_and_endpoints = await self._analyze_auth_and_endpoints(integration_id, use_case, pages=pages)
        
        # 2. Check SDKs and recommend implementation strategy
        if progress_callback:
            await progress_callback(80, "Detecting existing SDKs and formulating integration recommendations...")
            
        sdk_recommendation = await self._detect_sdks(integration_id, language, pages=pages)
        
        # 3. Generate Code Wrapper, steps, and samples
        if progress_callback:
            await progress_callback(88, f"Generating ready-to-use {language} wrapper class and integration steps...")
            
        code_and_docs = await self._generate_wrapper_and_docs(
            integration_id=integration_id,
            url=url,
            use_case=use_case,
            language=language,
            auth_info=auth_and_endpoints["auth_summary"],
            endpoints=auth_and_endpoints["endpoints"]
        )
        
        # Combine all findings
        return {
            "auth_summary": auth_and_endpoints["auth_summary"],
            "endpoints_json": json.dumps(auth_and_endpoints["endpoints"]),
            "sdk_recommendation": sdk_recommendation,
            "integration_steps": code_and_docs["integration_steps"],
            "generated_code": code_and_docs["generated_code"],
            "sample_requests": code_and_docs["sample_requests"],
            "sample_responses": code_and_docs["sample_responses"]
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
        """Generate the final wrapper class, integration steps, and code samples in parallel."""
        import asyncio
        endpoints_context = json.dumps(endpoints, indent=2)
        
        system_prompt_code = (
            f"You are an expert software engineer generating code for integrations. You need to write a wrapper class in **{language}**.\n"
            "Ensure the generated code is clean, fully commented, robust, and production-ready. Include:\n"
            "- Proper authentication setup (API keys, tokens, loaded from env variables)\n"
            "- Proper error handling (try/catch block, catching connection timeouts, error status parsing)\n"
            "- Advanced retry logic (backoff, configurable max retries)\n"
            "- Env configurations and configuration structures\n\n"
            "You must output ONLY the complete wrapper class code enclosed inside <wrapper_code>...</wrapper_code> XML tags.\n"
            "CRITICAL: Do NOT generate mock implementation blocks containing `pass` or `TODO` for the wrapper methods. Use HTTP client requests targeting the real base URLs/paths identified in the endpoint schema."
        )
        
        system_prompt_steps = (
            f"You are an expert technical writer. Write a step-by-step markdown tutorial detailing how to use the generated {language} wrapper in a new project.\n"
            "Include:\n"
            "- How to install required packages/dependencies\n"
            "- How to configure environment variables\n"
            "- How to instantiate and configure the client class\n\n"
            "You must output ONLY the step-by-step markdown tutorial enclosed inside <integration_steps>...</integration_steps> XML tags."
        )
        
        system_prompt_samples = (
            f"You are an expert developer advocate. Write clean markdown code snippet examples of making requests and receiving responses using the generated {language} wrapper.\n"
            "Include:\n"
            "- Enclose code blocks in standard markdown code fences (e.g. ```python ... ```)\n"
            "- Show realistic request payloads and matching response JSON examples.\n\n"
            "You must output ONLY the snippets and examples enclosed inside <sample_requests_responses>...</sample_requests_responses> XML tags."
        )
        
        user_prompt = (
            f"Base Documentation Url: {url}\n"
            f"Use Case: {use_case}\n"
            f"Target Language: {language}\n\n"
            f"Authentication Summary:\n{auth_info}\n\n"
            f"Extracted Endpoints:\n{endpoints_context}"
        )
        
        # Concurrently request the code, steps, and sample payloads to optimize API response times
        res_code, res_steps, res_samples = await asyncio.gather(
            self.llm.generate_completion(system_prompt_code, user_prompt, temperature=0.1),
            self.llm.generate_completion(system_prompt_steps, user_prompt, temperature=0.2),
            self.llm.generate_completion(system_prompt_samples, user_prompt, temperature=0.2)
        )
        
        wrapper_match = re.search(r"<wrapper_code>(.*?)</wrapper_code>", res_code, re.DOTALL)
        wrapper_code = wrapper_match.group(1).strip() if wrapper_match else res_code.strip()
        
        steps_match = re.search(r"<integration_steps>(.*?)</integration_steps>", res_steps, re.DOTALL)
        integration_steps = steps_match.group(1).strip() if steps_match else res_steps.strip()
        
        samples_match = re.search(r"<sample_requests_responses>(.*?)</sample_requests_responses>", res_samples, re.DOTALL)
        samples_text = samples_match.group(1).strip() if samples_match else res_samples.strip()
        
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
