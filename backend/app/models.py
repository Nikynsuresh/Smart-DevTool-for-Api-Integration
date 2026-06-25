import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    use_case = Column(Text, nullable=False)
    language = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, scraping, vectorizing, generating, completed, failed
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Generated Outputs
    auth_summary = Column(Text, nullable=True)
    sdk_recommendation = Column(Text, nullable=True)
    integration_steps = Column(Text, nullable=True)
    generated_code = Column(Text, nullable=True)
    sample_requests = Column(Text, nullable=True)
    sample_responses = Column(Text, nullable=True)
    endpoints_json = Column(Text, nullable=True)  # JSON-serialized list of endpoints
    requires_subscription = Column(Boolean, default=False, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Chat relationship
    messages = relationship("ChatMessage", back_populates="integration", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    integration = relationship("Integration", back_populates="messages")
