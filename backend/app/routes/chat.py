import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Integration, ChatMessage
from app.schemas import ChatMessageCreate, ChatMessageResponse
from app.services.rag import RAGPipeline
from app.services.llm import LLMService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["Chat"])

@router.get("/{id}/chat", response_model=list[ChatMessageResponse])
def get_chat_history(id: int, db: Session = Depends(get_db)):
    """Fetch all messages for an integration chat helper."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    return db.query(ChatMessage).filter(ChatMessage.integration_id == id).order_by(ChatMessage.created_at.asc()).all()

@router.post("/{id}/chat", response_model=ChatMessageResponse)
async def chat_assistant(id: int, payload: ChatMessageCreate, db: Session = Depends(get_db)):
    """Interact with the API assistant, using RAG context from the API documentation."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    # 1. Store user message in database
    user_msg = ChatMessage(integration_id=id, role="user", content=payload.message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    try:
        # 2. Retrieve context from ChromaDB
        rag = RAGPipeline()
        context_docs = rag.retrieve_context(id, query=payload.message, k=5)
        context_text = "\n---\n".join([doc.page_content for doc in context_docs])
        
        # 3. Retrieve chat history for prompt
        history_msgs = db.query(ChatMessage).filter(
            ChatMessage.integration_id == id,
            ChatMessage.id != user_msg.id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        chat_history = [{"role": msg.role, "content": msg.content} for msg in history_msgs]
        
        # 4. Formulate LLM response
        system_prompt = (
            "You are a helpful software engineer assistant. Answer questions about the third-party API documentation "
            "provided below. Keep your answers technical, accurate, and concise. Code examples are highly encouraged.\n\n"
            "CRITICAL: Base your answers ONLY on the provided API documentation context. If the documentation does not "
            "contain the information needed to answer, state clearly that the documentation does not provide that information. "
            "Do not hallucinate facts or URLs.\n\n"
            f"Documentation Context:\n{context_text}"
        )
        
        llm = LLMService()
        bot_response = await llm.chat_with_docs(
            system_prompt=system_prompt,
            chat_history=chat_history,
            new_message=payload.message
        )
        
        # 5. Store bot message in database
        bot_msg = ChatMessage(integration_id=id, role="assistant", content=bot_response)
        db.add(bot_msg)
        db.commit()
        db.refresh(bot_msg)
        
        return bot_msg
        
    except Exception as e:
        logger.error(f"Error in chat assistant router: {e}")
        # Delete user message if generation failed to keep chat in sync?
        # Or just raise
        raise HTTPException(status_code=500, detail=f"Assistant failed: {str(e)}")
