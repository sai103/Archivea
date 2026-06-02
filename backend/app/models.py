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
    # settingsテーブルのstorage_dir配下のファイル名またはページディレクトリ名。
    stored_name: str
    # 登録日時。現行UIではアップロード日として表示する。
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # 紐づくジャンルのID。未分類の場合はNULL。
    genre_id: Optional[int] = Field(default=None, foreign_key="genre.id")
    # 論理削除フラグ。Trueの場合は一覧や配信APIから除外する。
    is_deleted: bool = Field(default=False)


class Genre(SQLModel, table=True):
    """ジャンル一覧を保存するDBモデル。"""

    # DB上の主キー。
    id: Optional[int] = Field(default=None, primary_key=True)
    # ジャンル名。一覧の絞り込み条件として使う。
    name: str = Field(index=True, unique=True)


class User(SQLModel, table=True):
    """ユーザーアカウントを保存するDBモデル。"""

    # ユーザー名を主キーとして使う。
    username: str = Field(primary_key=True)
    # 平文パスワード。将来的にはハッシュへ移行する。
    password: str
    # 権限レベルを数値で管理する。0=一般ユーザー、1=管理者など用途に応じて拡張する。
    role: int = Field(default=0)


class AppSettings(SQLModel, table=True):
    """アプリケーション設定を保存するDBモデル。レコードは常にid=1の1行のみ。"""

    __tablename__ = "settings"  # type: ignore[assignment]

    # シングルトン行の固定主キー。
    id: int = Field(default=1, primary_key=True)
    # アップロードファイルとページ画像の保存先ディレクトリの絶対パス。
    storage_dir: str
