import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.dependencies import verify_api_key
from api.runtime import app_state
from api.schemas import SessionCreateRequest

router = APIRouter(dependencies=[Depends(verify_api_key)])


class SessionRenameRequest(BaseModel):
    title: str


class MessageEditRequest(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)


@router.get("/sessions")
async def list_sessions():
    loop = asyncio.get_running_loop()
    sessions = await loop.run_in_executor(app_state.executor, app_state.history_manager.get_all_sessions)
    return {"data": sessions}


@router.post("/sessions")
async def create_session(payload: SessionCreateRequest):
    loop = asyncio.get_running_loop()
    new_session = await loop.run_in_executor(app_state.executor, app_state.history_manager.create_session, payload.title)
    return {"data": new_session}


@router.patch("/sessions/{conversation_id}")
async def rename_session(conversation_id: str, payload: SessionRenameRequest):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.rename_session,
        conversation_id,
        payload.title,
    )
    return {
        "status": "ok",
        "data": {"id": conversation_id, "title": payload.title},
    }


@router.delete("/sessions/{conversation_id}")
async def delete_session(conversation_id: str):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.delete_session,
        conversation_id,
    )
    return {
        "status": "ok",
        "data": {"id": conversation_id},
    }


@router.get("/history/{conversation_id}")
async def get_history(conversation_id: str):
    loop = asyncio.get_running_loop()
    messages = await loop.run_in_executor(app_state.executor, app_state.history_manager.get_chat_history, conversation_id)
    return {"conversation_id": conversation_id, "data": messages}


@router.patch("/history/{conversation_id}/messages/{message_id}")
async def edit_history_message(conversation_id: str, message_id: str, payload: MessageEditRequest):
    loop = asyncio.get_running_loop()
    updated = await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.update_message_content,
        conversation_id,
        message_id,
        payload.content,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.sync_conversation_memory_index,
        conversation_id,
    )
    return {"status": "ok", "data": {"conversation_id": conversation_id, "message_id": message_id}}


@router.delete("/history/{conversation_id}/messages/{message_id}")
async def delete_history_message(conversation_id: str, message_id: str):
    loop = asyncio.get_running_loop()
    deleted = await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.delete_message,
        conversation_id,
        message_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Message not found")
    await loop.run_in_executor(
        app_state.executor,
        app_state.history_manager.sync_conversation_memory_index,
        conversation_id,
    )
    return {"status": "ok", "data": {"conversation_id": conversation_id, "message_id": message_id}}
