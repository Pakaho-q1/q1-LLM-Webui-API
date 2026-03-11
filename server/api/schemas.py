from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field

class SessionCreateRequest(BaseModel):
    title: str = Field(default="New Chat", min_length=1, max_length=120)


OpenAIChatRole = Literal["system", "user", "assistant", "tool"]


class OpenAIImageUrl(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


class OpenAIContentPartText(BaseModel):
    type: Literal["text"]
    text: str = Field(min_length=1, max_length=100_000)


class OpenAIContentPartImage(BaseModel):
    type: Literal["image_url"]
    image_url: OpenAIImageUrl


OpenAIMessageContent = Union[
    str,
    List[Union[OpenAIContentPartText, OpenAIContentPartImage]],
]


class OpenAIChatMessage(BaseModel):
    role: OpenAIChatRole
    content: OpenAIMessageContent


class OpenAIChatCompletionRequest(BaseModel):
    model: str = Field(default="local-model", min_length=1, max_length=256)
    messages: List[OpenAIChatMessage] = Field(default_factory=list)
    stream: bool = False
    client_id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    conversation_id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    request_id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32768)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    stop: Optional[Any] = None
    params: Dict[str, Any] = Field(default_factory=dict)


class RAGQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=10_000)
    top_k: int = Field(default=6, ge=1, le=50)
    hybrid: bool = True
    rerank: bool = True
    score_threshold: float = Field(default=0.18, ge=0.0, le=1.0)


class RAGCitation(BaseModel):
    index: int
    chunk_id: str
    source: str
    score: float


class RAGRetrieveResponse(BaseModel):
    query: str
    context: str
    citations: List[RAGCitation] = Field(default_factory=list)
    should_answer: bool = True
    reason: Optional[str] = None
