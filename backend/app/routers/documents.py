from pathlib import Path
from typing import List, Optional
from uuid import uuid4
from zipfile import ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlmodel import Session, select

from app.constants import IMAGE_FILE_TYPES
from app.database import UPLOAD_DIR, get_session
from app.models import AppSettings, Document, Genre
from app.schemas import DocumentPatch, DocumentRead, EpubChapterRead, ZipPageRead
from app.services.media import (
    classify_upload,
    extract_zip_images,
    list_page_files,
    read_epub_spine,
)

router = APIRouter()


def _get_storage_dir(session: Session) -> str:
    """settingsテーブルからファイル保存先ディレクトリを取得する。未設定時はUPLOAD_DIRを返す。"""
    settings = session.get(AppSettings, 1)
    if settings is None:
        return str(UPLOAD_DIR)
    return settings.storage_dir


def _stored_path(doc: Document, storage_dir: str) -> Path:
    """storage_dirとstored_nameからファイル実体のパスを返す。"""
    return Path(storage_dir) / doc.stored_name


def _document_file_size(doc: Document, storage_dir: str) -> int | None:
    """ドキュメントのファイルサイズをバイトで返す。
    ZIPはページ画像の合計サイズ、それ以外は単一ファイルのサイズを返す。
    ファイルが見つからない場合はNoneを返す。
    """
    stored = _stored_path(doc, storage_dir)
    if doc.mime_type == "application/zip":
        if not stored.is_dir():
            return None
        return sum(p.stat().st_size for p in stored.iterdir() if p.is_file())
    if stored.is_file():
        return stored.stat().st_size
    return None


@router.post("/documents", response_model=DocumentRead)
async def upload_document(
    title: str = Query(..., description="一覧に表示するタイトル"),
    genre_id: Optional[int] = Query(None, description="ジャンルID。省略時は未設定。"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """ドキュメントをアップロードし、ファイル実体保存とDBメタデータ登録を行う。"""
    file_type = classify_upload(file)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="PDF・JPG・PNG・WebP・EPUB・ZIP（JPG/PNG/WebP含む）のみ対応しています",
        )

    mime_type, extension = file_type

    storage_dir = _get_storage_dir(session)
    upload_dir = Path(storage_dir)

    # UUIDを使い、ユーザー指定ファイル名と保存名を切り離す。
    stored_name = uuid4().hex
    target_prefix = upload_dir / stored_name
    content = await file.read()

    if mime_type == "application/zip":
        # ZIPは元ZIPを一時保存して画像ページへ展開し、展開後に元ZIPを削除する。
        zip_path = target_prefix.with_suffix(".zip")
        zip_path.write_bytes(content)
        pages_dir = target_prefix
        pages_dir.mkdir(parents=True, exist_ok=True)
        try:
            extract_zip_images(zip_path=zip_path, output_dir=pages_dir)
        finally:
            zip_path.unlink(missing_ok=True)
        stored_name = target_prefix.name
    else:
        # PDF、単体画像、EPUBは本文ファイルとしてそのまま保存する。
        target = target_prefix.with_suffix(extension)
        target.write_bytes(content)
        stored_name = target.name

    doc = Document(
        title=title,
        mime_type=mime_type,
        extension=extension,
        stored_name=stored_name,
        genre_id=genre_id,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    return DocumentRead(
        id=doc.id,
        title=doc.title,
        mime_type=doc.mime_type,
        created_at=doc.created_at,
    )


@router.get("/documents", response_model=list[DocumentRead])
def list_documents(session: Session = Depends(get_session)):
    """登録済みドキュメント一覧をジャンル名付きで新しい順に返す。論理削除済みは除外する。"""
    storage_dir = _get_storage_dir(session)
    rows = session.exec(
        select(Document, Genre)
        .outerjoin(Genre, Document.genre_id == Genre.id)
        .where(Document.is_deleted == False)  # noqa: E712
        .order_by(Document.created_at.desc())
    ).all()
    return [
        DocumentRead(
            id=doc.id,
            title=doc.title,
            mime_type=doc.mime_type,
            created_at=doc.created_at,
            genre=genre.name if genre else None,
            file_size=_document_file_size(doc, storage_dir),
        )
        for doc, genre in rows
    ]


@router.post("/documents/directory", response_model=DocumentRead)
async def upload_document_directory(
    title: str = Query(..., description="一覧に表示するタイトル"),
    genre_id: Optional[int] = Query(None, description="ジャンルID。省略時は未設定。"),
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    """複数の画像ファイルをディレクトリとして受け取り、1冊のページ本として登録する。
    ファイル名昇順をページ順とし、ZIP展開ページと同じ保存構造に変換する。
    """
    image_files = [f for f in files if Path(f.filename or "").suffix.lower() in IMAGE_FILE_TYPES]
    if not image_files:
        raise HTTPException(status_code=400, detail="JPG・PNG・WebP のファイルが1枚以上必要です")

    # ファイル名昇順でページ順を固定する。
    sorted_files = sorted(image_files, key=lambda f: Path(f.filename or "").name.lower())

    storage_dir = _get_storage_dir(session)
    upload_dir = Path(storage_dir)
    stored_name = uuid4().hex
    pages_dir = upload_dir / stored_name
    pages_dir.mkdir(parents=True, exist_ok=True)

    for index, upload_file in enumerate(sorted_files):
        suffix = Path(upload_file.filename or "").suffix.lower()
        page_suffix = ".jpg" if suffix == ".jpeg" else suffix
        page_name = f"{index:06d}{page_suffix}"
        content = await upload_file.read()
        (pages_dir / page_name).write_bytes(content)

    doc = Document(
        title=title,
        mime_type="application/zip",
        extension="",
        stored_name=stored_name,
        genre_id=genre_id,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    return DocumentRead(
        id=doc.id,
        title=doc.title,
        mime_type=doc.mime_type,
        created_at=doc.created_at,
    )


@router.patch("/documents/{document_id}", response_model=DocumentRead)
def patch_document(
    document_id: int,
    body: DocumentPatch,
    session: Session = Depends(get_session),
):
    """ドキュメントのジャンルを変更する。genre_idにNoneを指定すると未分類に戻す。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    if body.genre_id is not None:
        genre = session.get(Genre, body.genre_id)
        if not genre:
            raise HTTPException(status_code=404, detail="ジャンルが見つかりません")
    doc.genre_id = body.genre_id
    session.add(doc)
    session.commit()
    session.refresh(doc)
    genre_name: Optional[str] = None
    if doc.genre_id is not None:
        linked = session.get(Genre, doc.genre_id)
        genre_name = linked.name if linked else None
    return DocumentRead(
        id=doc.id,
        title=doc.title,
        mime_type=doc.mime_type,
        created_at=doc.created_at,
        genre=genre_name,
    )


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: int, session: Session = Depends(get_session)):
    """ドキュメントを論理削除する。is_deletedをTrueにセットし一覧・配信から除外する。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    doc.is_deleted = True
    session.add(doc)
    session.commit()


@router.get("/documents/{document_id}/content")
def get_document_content(document_id: int, session: Session = Depends(get_session)):
    """PDF、単体画像、EPUBなど単一本文ファイルを配信する。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")

    if doc.mime_type == "application/zip":
        raise HTTPException(status_code=400, detail="このドキュメントはページ形式です。/pages エンドポイントを使用してください")

    path = _stored_path(doc, _get_storage_dir(session))
    if not path.exists():
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    return FileResponse(
        path=path,
        media_type=doc.mime_type,
        filename=f"{doc.title}{doc.extension}",
        content_disposition_type="inline",
    )


@router.get("/documents/{document_id}/pages", response_model=list[ZipPageRead])
def list_zip_pages(document_id: int, session: Session = Depends(get_session)):
    """ZIP画像本または画像ディレクトリ本のページ一覧を返す。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="このドキュメントはZIP形式ではありません")

    pages_dir = _stored_path(doc, _get_storage_dir(session))
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ページデータが見つかりません")

    pages = list_page_files(pages_dir)
    return [
        ZipPageRead(
            index=index,
            filename=path.name,
            content_url=f"/documents/{document_id}/pages/{index}/content",
        )
        for index, path in enumerate(pages)
    ]


@router.get("/documents/{document_id}/pages/{page_index}/content")
def get_zip_page_content(document_id: int, page_index: int, session: Session = Depends(get_session)):
    """ZIP画像本または画像ディレクトリ本の指定ページ画像を配信する。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="このドキュメントはZIP形式ではありません")

    pages_dir = _stored_path(doc, _get_storage_dir(session))
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ページデータが見つかりません")

    pages = list_page_files(pages_dir)
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=404, detail="ページが見つかりません")

    page = pages[page_index]
    media_type = IMAGE_FILE_TYPES.get(page.suffix.lower(), "application/octet-stream")
    return FileResponse(
        path=page,
        media_type=media_type,
        filename=page.name,
        content_disposition_type="inline",
    )


@router.get("/documents/{document_id}/epub/chapters", response_model=list[EpubChapterRead])
def list_epub_chapters(document_id: int, session: Session = Depends(get_session)):
    """EPUBのspine順に章一覧を返す。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    if doc.mime_type != "application/epub+zip":
        raise HTTPException(status_code=400, detail="このドキュメントはEPUB形式ではありません")

    epub_path = _stored_path(doc, _get_storage_dir(session))
    if not epub_path.exists():
        raise HTTPException(status_code=404, detail="EPUBファイルが見つかりません")

    chapters = read_epub_spine(epub_path)
    return [
        EpubChapterRead(
            index=index,
            title=title,
            content_url=f"/documents/{document_id}/epub/chapters/{index}/content",
        )
        for index, (title, _chapter_path) in enumerate(chapters)
    ]


@router.get("/documents/{document_id}/epub/chapters/{chapter_index}/content")
def get_epub_chapter_content(
    document_id: int,
    chapter_index: int,
    session: Session = Depends(get_session),
):
    """EPUBの指定章本文をブラウザ表示用HTMLとして配信する。"""
    doc = session.get(Document, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="ドキュメントが見つかりません")
    if doc.mime_type != "application/epub+zip":
        raise HTTPException(status_code=400, detail="このドキュメントはEPUB形式ではありません")

    epub_path = _stored_path(doc, _get_storage_dir(session))
    if not epub_path.exists():
        raise HTTPException(status_code=404, detail="EPUBファイルが見つかりません")

    chapters = read_epub_spine(epub_path)
    if chapter_index < 0 or chapter_index >= len(chapters):
        raise HTTPException(status_code=404, detail="章が見つかりません")

    _title, chapter_path = chapters[chapter_index]
    with ZipFile(epub_path) as archive:
        try:
            content = archive.read(chapter_path)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="章のコンテンツが見つかりません") from error

    return Response(content=content, media_type="text/html; charset=utf-8")
