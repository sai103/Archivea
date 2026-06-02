from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


class DocumentRead(SQLModel):
    """GET /documentsやアップロード結果として返すドキュメントレスポンス。"""

    # 旧URL互換用のSQLite rowid。新規コードではstored_nameを使う。
    id: Optional[int] = None
    stored_name: str
    title: str
    mime_type: str
    created_at: datetime
    # 紐づくジャンル名。未分類の場合はNone。
    genre: Optional[str] = None
    # ファイルサイズ（バイト）。ZIPは展開後ページ画像の合計。取得できない場合はNone。
    file_size: Optional[int] = None


class GenreRead(SQLModel):
    """GET /genresで返すジャンルレスポンス。"""

    name: str


class GenreCreate(SQLModel):
    """POST /genresで受け取るジャンル作成リクエスト。"""

    name: str


class DocumentPatch(SQLModel):
    """PATCH /documents/{stored_name}で受け取るドキュメント更新リクエスト。"""

    # Noneを指定するとジャンルを未分類に戻す。
    genre_name: Optional[str] = None


class SettingsRead(SQLModel):
    """GET /settingsで返す設定レスポンス。"""

    storage_dir: str


class SettingsUpdate(SQLModel):
    """PUT /settingsで受け取る設定更新リクエスト。"""

    storage_dir: str


class ZipPageRead(SQLModel):
    """ZIP画像本または画像ディレクトリ本の1ページを返すレスポンス。"""

    # 0始まりのページ番号。
    index: int
    # 配信用に保存されたページファイル名。
    filename: str
    # ページ本文APIの相対URL。
    content_url: str


class EpubChapterRead(SQLModel):
    """EPUBのspine順に並ぶ章情報を返すレスポンス。"""

    # 0始まりの章番号。
    index: int
    # 章タイトル。現行実装ではXHTMLファイル名由来。
    title: str
    # 章本文APIの相対URL。
    content_url: str
