import os
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self._init_chat_model()

    def _init_chat_model(self):
        """Initialize the Chat Model based on available credentials."""
        gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        openai_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")

        if gemini_key:
            logger.info("Initializing ChatGoogleGenerativeAI (gemini-2.5-flash)")
            self.chat_model = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=gemini_key,
                temperature=0.2,
                convert_system_message_to_human=True
            )
            self.provider = "gemini"
        elif openai_key:
            logger.info("Initializing ChatOpenAI (gpt-4o-mini)")
            self.chat_model = ChatOpenAI(
                model="gpt-4o-mini",
                api_key=openai_key,
                temperature=0.2
            )
            self.provider = "openai"
        else:
            logger.warning("No API keys found for Chat Model. Please set GEMINI_API_KEY or OPENAI_API_KEY. LLM completion calls will be disabled.")
            self.chat_model = None
            self.provider = "mock"

    async def _ainvoke_with_retry(self, messages, max_retries: int = 5, base_delay: float = 3.0) -> str:
        """Helper to invoke LLM with robust retry and backoff, handling rate limit (429) errors."""
        import asyncio
        import re
        model = self.chat_model
        
        for attempt in range(max_retries):
            try:
                response = await model.ainvoke(messages)
                return response.content
            except Exception as e:
                error_msg = str(e)
                # Check for rate limit status (429) or quota exceeded error
                is_rate_limit = "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower() or "too many requests" in error_msg.lower()
                
                if is_rate_limit and attempt < max_retries - 1:
                    # Default exponential backoff
                    delay = base_delay * (2 ** attempt)
                    
                    # Try to parse retry delay from Gemini format
                    # e.g., retry_delay { seconds: 19 } or Please retry in 19.59s
                    delay_match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_msg)
                    if not delay_match:
                        delay_match = re.search(r"retry\s+in\s+([\d\.]+)\s*s", error_msg)
                    
                    if delay_match:
                        try:
                            # Add a small buffer of 1.5s to ensure the quota resets
                            delay = float(delay_match.group(1)) + 1.5
                        except Exception:
                            pass
                            
                    logger.warning(f"LLM API rate limit hit (429). Retrying in {delay:.2f} seconds (Attempt {attempt + 1}/{max_retries})...")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Error invoking LLM model (attempt {attempt + 1}/{max_retries}): {e}")
                    raise e

    async def generate_completion(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        """Send a prompt to the model and return the text response."""
        if not self.chat_model:
            raise ValueError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is set. Chat Model requires an active API key.")
            
        # Dynamically set temperature if needed
        model = self.chat_model
        if hasattr(model, 'temperature'):
            model.temperature = temperature
            
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        return await self._ainvoke_with_retry(messages)
            
    async def chat_with_docs(self, system_prompt: str, chat_history: list, new_message: str) -> str:
        """Process QA chat messages with context."""
        if not self.chat_model:
            raise ValueError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is set. Chat Model requires an active API key.")
            
        messages = [SystemMessage(content=system_prompt)]
        
        # Append message history (expecting list of dicts with role and content)
        for msg in chat_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(SystemMessage(content=msg["content"])) # or AIMessage
                
        # Append latest user message
        messages.append(HumanMessage(content=new_message))
        
        return await self._ainvoke_with_retry(messages)
