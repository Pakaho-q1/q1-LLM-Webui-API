import asyncio
import os
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Optional

from managers.memory.chat_orchestrator import ChatOrchestrator
from managers.memory.history_manager import HistoryManager
from managers.memory.ingestion import IngestionService, LocalFileStore, MinioFileStore, S3FileStore
from managers.memory.retrieval import RetrievalService
from managers.model_manager import ModelManager
from managers.preset_manager import PresetManager
from managers.providers import create_llm_provider
from managers.providers.factory import create_provider_by_name

logger = logging.getLogger(__name__)


class AppState:
    """Centralized state/logic holder for API runtime dependencies."""

    def __init__(self) -> None:
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="worker_")
        self.sse_queue_maxsize = int(os.environ.get("SSE_QUEUE_MAXSIZE", "200"))

        project_root = Path(__file__).resolve().parent.parent
        self.models_dir = project_root / "models"

        self.llm_provider, self.local_llm_engine = create_llm_provider()
        self.provider_name = self.llm_provider.provider_name
        self.provider_runtime_config: Dict[str, Any] = {}
        # Backward compatibility alias while routes/services are fully migrated.
        self.llm_engine = self.llm_provider
        self.model_manager = ModelManager(models_dir=str(self.models_dir))
        self.preset_manager = PresetManager()

        self.history_manager = HistoryManager(
            engine=self.llm_provider,
            db_path="data/chat.db",
            n_ctx=self.llm_provider.n_ctx,
            tokenizer_fn=self.llm_provider.count_tokens,
        )

        self.retrieval_service = RetrievalService(db_path="data/rag.db")

        self.chat_orchestrator = ChatOrchestrator(
            self.llm_provider, self.history_manager, self.executor, self.retrieval_service
        )

        store_backend = os.environ.get("FILE_STORE_BACKEND", "local").lower()
        if store_backend == "s3":
            file_store = S3FileStore()
        elif store_backend == "minio":
            file_store = MinioFileStore()
        else:
            file_store = LocalFileStore("data/uploads")

        self.ingestion_service = IngestionService(
            retriever=self.retrieval_service,
            store=file_store,
        )

        self.sse_queues: Dict[str, asyncio.Queue] = {}
        self.sse_lock = asyncio.Lock()
        self.provider_lock = asyncio.Lock()

    async def switch_provider(
        self,
        provider_name: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        normalized = (provider_name or "").strip().lower()
        if normalized not in {"local", "ollama", "openai"}:
            raise ValueError("Unsupported provider. Allowed: local, ollama, openai")

        async with self.provider_lock:
            old_provider = self.llm_provider
            if old_provider.supports_local_model_lifecycle():
                try:
                    old_provider.unload_model()
                except Exception:
                    logger.warning("Failed to unload old provider cleanly", exc_info=True)

            next_provider, local_engine = create_provider_by_name(normalized, config=config or {})
            self.llm_provider = next_provider
            self.local_llm_engine = local_engine
            self.llm_engine = next_provider
            self.provider_name = normalized
            self.provider_runtime_config = dict(config or {})

            self.history_manager.engine = next_provider
            self.history_manager.tokenizer = next_provider.count_tokens
            self.history_manager.n_ctx = next_provider.n_ctx
            self.chat_orchestrator.engine = next_provider
            self.chat_orchestrator.unload_model()

            return {
                "provider": self.llm_provider.provider_name,
                "model": self.llm_provider.model_name or "",
                "supported_chat_params": self.llm_provider.supported_chat_params(),
            }

    async def register_sse_client(self, client_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=self.sse_queue_maxsize)
        async with self.sse_lock:
            self.sse_queues[client_id] = queue
        return queue

    async def unregister_sse_client(self, client_id: str) -> None:
        async with self.sse_lock:
            self.sse_queues.pop(client_id, None)

    async def get_sse_queue(self, client_id: str) -> Optional[asyncio.Queue]:
        async with self.sse_lock:
            return self.sse_queues.get(client_id)

    async def put_sse_message(self, client_id: str, message: Dict[str, Any]) -> None:
        queue = await self.get_sse_queue(client_id)
        if queue is None:
            return

        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except Exception:
                pass
            try:
                queue.put_nowait(message)
            except Exception:
                logger.exception("Failed to enqueue SSE message after dropping oldest event")
        except Exception:
            logger.exception("Failed to put SSE message")

    async def broadcast_sse_message(self, message: Dict[str, Any]) -> None:
        async with self.sse_lock:
            queues = list(self.sse_queues.items())

        for client_id, queue in queues:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                except Exception:
                    pass
                try:
                    queue.put_nowait(message)
                except Exception:
                    logger.exception("Failed to broadcast to %s after dropping oldest event", client_id)
            except Exception:
                logger.exception("Failed to broadcast to %s", client_id)

    def shutdown(self) -> None:
        self.executor.shutdown(wait=True)
