from datetime import datetime

from sqlmodel import SQLModel


class DocumentRead(SQLModel):
    """GET /documentsやアップロード結果として返すドキュメントレスポンス。"""

    id: int
    title: str
    mime_type: str
    created_at: datetime


class GenreRead(SQLModel):
    """GET /genresで返すジャンルレスポンス。"""

    id: int
    name: str


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
