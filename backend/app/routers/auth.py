from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlmodel import Session, SQLModel, select

from app.database import get_session
from app.models import User, UserSession

router = APIRouter()

# セッションの有効期間。
_SESSION_DAYS = 7
# Cookieのキー名。
_COOKIE_KEY = "session_token"


class LoginRequest(SQLModel):
    """POST /auth/login で受け取るリクエスト。"""

    username: str
    password: str


class MeRead(SQLModel):
    """GET /auth/me で返す現在ユーザー情報。"""

    username: str
    role: int


def get_current_user(
    session_token: Optional[str] = Cookie(None, alias=_COOKIE_KEY),
    session: Session = Depends(get_session),
) -> User:
    """Cookieのセッショントークンを検証し、有効なUserを返す依存関数。"""
    if session_token is None:
        raise HTTPException(status_code=401, detail="ログインが必要です")
    user_session = session.get(UserSession, session_token)
    if user_session is None or user_session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="セッションが無効です。再ログインしてください")
    user = session.get(User, user_session.username)
    if user is None:
        raise HTTPException(status_code=401, detail="ユーザーが見つかりません")
    return user


@router.post("/auth/login", response_model=MeRead)
def login(
    body: LoginRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    """ユーザー名とパスワードを検証し、HttpOnly Cookieにセッショントークンをセットする。"""
    user = session.get(User, body.username)
    if user is None or user.password != body.password:
        raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが正しくありません")

    # 期限切れセッションをまとめて削除する。
    now = datetime.utcnow()
    expired = session.exec(
        select(UserSession).where(UserSession.expires_at < now)
    ).all()
    for s in expired:
        session.delete(s)

    token = uuid4().hex
    expires = datetime.utcnow() + timedelta(days=_SESSION_DAYS)
    user_session = UserSession(token=token, username=user.username, expires_at=expires)
    session.add(user_session)
    session.commit()

    response.set_cookie(
        key=_COOKIE_KEY,
        value=token,
        httponly=True,
        samesite="strict",
        max_age=_SESSION_DAYS * 24 * 60 * 60,
    )
    return MeRead(username=user.username, role=user.role)


@router.post("/auth/logout", status_code=204)
def logout(
    response: Response,
    session_token: Optional[str] = Cookie(None, alias=_COOKIE_KEY),
    session: Session = Depends(get_session),
):
    """セッションをDBから削除し、Cookieを消去する。"""
    if session_token is not None:
        user_session = session.get(UserSession, session_token)
        if user_session is not None:
            session.delete(user_session)
            session.commit()
    response.delete_cookie(key=_COOKIE_KEY, httponly=True, samesite="strict")


@router.get("/auth/me", response_model=MeRead)
def me(current_user: User = Depends(get_current_user)):
    """現在ログイン中のユーザー情報を返す。未ログイン時は401。"""
    return MeRead(username=current_user.username, role=current_user.role)
