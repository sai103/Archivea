from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Document, Genre
from app.schemas import GenreCreate, GenreRead

router = APIRouter()


@router.get("/genres", response_model=list[GenreRead])
def list_genres(session: Session = Depends(get_session)):
    """ジャンル一覧を名前順に返す。"""
    genres = session.exec(select(Genre).order_by(Genre.name)).all()
    return [GenreRead(id=genre.id, name=genre.name) for genre in genres]


@router.post("/genres", response_model=GenreRead, status_code=201)
def create_genre(body: GenreCreate, session: Session = Depends(get_session)):
    """新しいジャンルを登録する。同名ジャンルが存在する場合は409を返す。"""
    existing = session.exec(select(Genre).where(Genre.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=409, detail="同名のジャンルが既に存在します")
    genre = Genre(name=body.name)
    session.add(genre)
    session.commit()
    session.refresh(genre)
    return GenreRead(id=genre.id, name=genre.name)


@router.delete("/genres/{genre_id}", status_code=204)
def delete_genre(genre_id: int, session: Session = Depends(get_session)):
    """ジャンルを削除する。ドキュメントが紐づいている場合は409を返す。"""
    genre = session.get(Genre, genre_id)
    if not genre:
        raise HTTPException(status_code=404, detail="ジャンルが見つかりません")
    in_use = session.exec(select(Document).where(Document.genre_id == genre_id)).first()
    if in_use:
        raise HTTPException(status_code=409, detail="このジャンルは使用中のため削除できません")
    session.delete(genre)
    session.commit()
