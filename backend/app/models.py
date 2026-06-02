from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Document(SQLModel, table=True):
    """ドキュメント1冊分のメタデータを保存するDBモデル。"""

    # UUIDベースのファイル名を自然キーとして主キーに使う。
    stored_name: str = Field(primary_key=True, index=True)
    # 一覧と閲覧画面に表示するタイトル。
    title: str
    # ファイル形式判定に使うMIME type。
    mime_type: str
    # ダウンロード名や保存名に使う拡張子。
    extension: str
    # 登録日時。現行UIではアップロード日として表示する。
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # 紐づくジャンル名。未分類の場合はNULL。
    genre_name: Optional[str] = Field(default=None, foreign_key="genre.name")
    # 論理削除フラグ。Trueの場合は一覧や配信APIから除外する。
    is_deleted: bool = Field(default=False)


class Genre(SQLModel, table=True):
    """ジャンル一覧を保存するDBモデル。"""

    # ジャンル名を自然キーとして主キーに使う。
    name: str = Field(primary_key=True, index=True)


class User(SQLModel, table=True):
    """ユーザーアカウントを保存するDBモデル。"""

    # ユーザー名を主キーとして使う。
    username: str = Field(primary_key=True, index=True)
    # 平文パスワード。将来的にはハッシュへ移行する。
    password: str
    # 権限レベルを数値で管理する。0=一般ユーザー、1=管理者など用途に応じて拡張する。
    role: int = Field(default=0)


class UserSession(SQLModel, table=True):
    """ログインセッションを保存するDBモデル。"""

    __tablename__ = "user_session"  # type: ignore[assignment]

    # UUIDトークンをセッションの自然キーとして主キーに使う。
    token: str = Field(primary_key=True, index=True)
    # セッションを所有するユーザー名。
    username: str = Field(foreign_key="user.username")
    # セッションの有効期限。この日時を過ぎたセッションは無効。
    expires_at: datetime


class AppSettings(SQLModel, table=True):
    """アプリケーション設定をキーバリュー形式で保存するDBモデル。"""

    __tablename__ = "settings"  # type: ignore[assignment]

    # 設定項目名を自然キーとして主キーに使う（例: 'storage_dir'）。
    name: str = Field(primary_key=True, index=True)
    # 設定値の文字列表現。
    value: str
