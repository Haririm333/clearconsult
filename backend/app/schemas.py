from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

FieldStatus = Literal["known", "unknown"]
ItemSource = Literal["patient said", "measured", "inferred"]

class ExtractedField(BaseModel):
    value: Optional[Any] = None
    status: FieldStatus
    evidence: Optional[str] = Field(
        default=None,
        description="The patient's exact words as evidence, or None if unknown"
    )
    source: ItemSource = "patient said"
    prompt_hint: Optional[str] = None
    severity_num: Optional[int] = None

class ExtractedFieldsContainer(BaseModel):
    chief_complaint: ExtractedField
    onset: ExtractedField
    duration: ExtractedField
    severity: ExtractedField
    associated_symptoms: ExtractedField
    relevant_negatives: ExtractedField
    medications: ExtractedField

class NextQuestion(BaseModel):
    field: str
    question: str
    question_en: Optional[str] = None

class NeedsAttentionItem(BaseModel):
    id: str
    name: str
    message: str
    source: str = "DRAFT - requires clinician review"
    severity_level: Literal["critical", "warning"] = "warning"

class ExtractRequest(BaseModel):
    session_id: str = "default_session"
    conversation_history: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of messages: [{'role': 'patient'|'system', 'text': '...'}]"
    )
    latest_input: str
    language: Literal["en", "ta", "hi"] = "en"
    skipped_fields: List[str] = Field(default_factory=list)

class ExtractResponse(BaseModel):
    session_id: str
    language: str
    extracted_fields: ExtractedFieldsContainer
    highest_priority_unknown: Optional[NextQuestion] = None
    needs_attention: List[NeedsAttentionItem] = Field(default_factory=list)
    emergency_alert: Optional[Dict[str, Any]] = None
    is_emergency: bool = False
    all_key_fields_known: bool = False
