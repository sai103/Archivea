from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import UPLOAD_DIR, get_session
from app.models import AppSettings
from app.schemas import SettingsRead, SettingsUpdate

router = APIRouter()


def get_or_init_settings(session: Session) -> AppSettings:
    """settingsテーブルのシングルトン行を返す。存在しない場合はUPLOAD_DIRで初期化する。"""
    settings = session.get(AppSettings, 1)
    if settings is None:
        settings = AppSettings(storage_dir=str(UPLOAD_DIR))
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("/settings", response_model=SettingsRead)
def get_settings(session: Session = Depends(get_session)):
    """現在のアプリケーション設定を返す。"""
    return get_or_init_settings(session)


@router.put("/settings", response_model=SettingsRead)
def update_settings(body: SettingsUpdate, session: Session = Depends(get_session)):
    """アプリケーション設定を更新する。"""
    settings = get_or_init_settings(session)
    settings.storage_dir = body.storage_dir
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
