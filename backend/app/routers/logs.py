from typing import Any, Dict, Optional

from fastapi import APIRouter
from sqlmodel import SQLModel

from app.logging_config import get_frontend_logger

router = APIRouter()


class LogEntryRequest(SQLModel):
    """フロントエンドから受け取るログエントリ。"""

    level: str
    message: str
    timestamp: str
    context: Optional[Dict[str, Any]] = None


@router.post("/logs", status_code=204)
def receive_log(body: LogEntryRequest) -> None:
    """フロントエンドからのログエントリをファイルに記録する。"""
    _logger = get_frontend_logger()
    text = f"[{body.timestamp}] {body.message}"
    if body.context:
        text += f" | {body.context}"

    level = body.level.lower()
    if level == "error":
        _logger.error(text)
    elif level == "warn":
        _logger.warning(text)
    else:
        _logger.info(text)
