from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Document(SQLModel, table=True):
    """ドキュメント1冊分のメタデータを保存するDBモデル。"""

    # DB上の主キー。
    id: Optional[int] = Field(default=None, primary_key=True)
    # 一覧と閲覧画面に表示するタイトル。
    title: str
    # ファイル形式判定に使うMIME type。
    mime_type: str
    # ダウンロード名や保存名に使う拡張子。
    extension: str
    # UPLOAD_DIR配下のファイル名またはページディレクトリ名。
    stored_name: str
    # 登録日時。現行UIではアップロード日として表示する。
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Genre(SQLModel, table=True):
    """ジャンル一覧を保存するDBモデル。"""

    # DB上の主キー。
    id: Optional[int] = Field(default=None, primary_key=True)
    # ジャンル名。一覧の絞り込み条件として使う。
    name: str = Field(index=True, unique=True)
