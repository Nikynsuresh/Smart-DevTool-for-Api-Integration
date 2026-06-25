from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import List, Dict, Any, Optional

class IntegrationCreate(BaseModel):
    url: str
    use_case: str
    language: str
    requires_subscription: Optional[bool] = False

class IntegrationResponse(BaseModel):
    id: int
    url: str
    use_case: str
    language: str
    status: str
    progress: int
    requires_subscription: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True

class IntegrationDetailResponse(BaseModel):
    id: int
    url: str
    use_case: str
    language: str
    status: str
    progress: int
    error_message: Optional[str] = None
    auth_summary: Optional[str] = None
    sdk_recommendation: Optional[str] = None
    integration_steps: Optional[str] = None
    generated_code: Optional[str] = None
    sample_requests: Optional[str] = None
    sample_responses: Optional[str] = None
    endpoints_json: Optional[str] = None
    requires_subscription: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True

class ChatMessageCreate(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
