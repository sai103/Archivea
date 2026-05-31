from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Genre
from app.schemas import GenreRead

router = APIRouter()


@router.get("/genres", response_model=list[GenreRead])
def list_genres(session: Session = Depends(get_session)):
    """ジャンル一覧を名前順に返す。"""
    genres = session.exec(select(Genre).order_by(Genre.name)).all()
    return [GenreRead(id=genre.id, name=genre.name) for genre in genres]
