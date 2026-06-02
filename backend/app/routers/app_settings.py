from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import UPLOAD_DIR, get_session
from app.models import AppSettings
from app.schemas import SettingsRead, SettingsUpdate

router = APIRouter()

# storage_dir設定のキー名。
_STORAGE_DIR_KEY = "storage_dir"


def get_or_init_storage_dir(session: Session) -> AppSettings:
    """storage_dir設定レコードを返す。存在しない場合はUPLOAD_DIRで初期化する。"""
    settings = session.get(AppSettings, _STORAGE_DIR_KEY)
    if settings is None:
        settings = AppSettings(name=_STORAGE_DIR_KEY, value=str(UPLOAD_DIR))
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("/settings", response_model=SettingsRead)
def get_settings(session: Session = Depends(get_session)):
    """現在のアプリケーション設定を返す。"""
    settings = get_or_init_storage_dir(session)
    return SettingsRead(storage_dir=settings.value)


@router.put("/settings", response_model=SettingsRead)
def update_settings(body: SettingsUpdate, session: Session = Depends(get_session)):
    """アプリケーション設定を更新する。"""
    settings = get_or_init_storage_dir(session)
    settings.value = body.storage_dir
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return SettingsRead(storage_dir=settings.value)
