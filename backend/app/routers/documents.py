from uuid import uuid4
from zipfile import ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlmodel import Session, select

from app.constants import IMAGE_FILE_TYPES
from app.database import UPLOAD_DIR, get_session
from app.models import Document
from app.schemas import DocumentRead, EpubChapterRead, ZipPageRead
from app.services.media import (
    classify_upload,
    extract_zip_images,
    list_page_files,
    read_epub_spine,
)

router = APIRouter()


@router.post("/documents", response_model=DocumentRead)
async def upload_document(
    title: str = Query(..., description="一覧に表示するタイトル"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """ドキュメントをアップロードし、ファイル実体保存とDBメタデータ登録を行う。"""
    file_type = classify_upload(file)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="Only PDF/JPG/PNG/WebP/EPUB/ZIP(JPG/PNG/WebP) are supported",
        )

    mime_type, extension = file_type

    # UUIDを使い、ユーザー指定ファイル名と保存名を切り離す。
    stored_name = uuid4().hex
    target_prefix = UPLOAD_DIR / stored_name
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
    """登録済みドキュメント一覧を新しい順に返す。"""
    docs = session.exec(select(Document).order_by(Document.created_at.desc())).all()
    return [
        DocumentRead(
            id=doc.id,
            title=doc.title,
            mime_type=doc.mime_type,
            created_at=doc.created_at,
        )
        for doc in docs
    ]


@router.get("/documents/{document_id}/content")
def get_document_content(document_id: int, session: Session = Depends(get_session)):
    """PDF、単体画像、EPUBなど単一本文ファイルを配信する。"""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.mime_type == "application/zip":
        raise HTTPException(status_code=400, detail="ZIP content is paged. Use /pages endpoint")

    path = UPLOAD_DIR / doc.stored_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found")

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
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="Document is not ZIP")

    pages_dir = UPLOAD_DIR / doc.stored_name
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ZIP pages not found")

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
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="Document is not ZIP")

    pages_dir = UPLOAD_DIR / doc.stored_name
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ZIP pages not found")

    pages = list_page_files(pages_dir)
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=404, detail="Page not found")

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
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/epub+zip":
        raise HTTPException(status_code=400, detail="Document is not EPUB")

    epub_path = UPLOAD_DIR / doc.stored_name
    if not epub_path.exists():
        raise HTTPException(status_code=404, detail="Stored EPUB not found")

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
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/epub+zip":
        raise HTTPException(status_code=400, detail="Document is not EPUB")

    epub_path = UPLOAD_DIR / doc.stored_name
    if not epub_path.exists():
        raise HTTPException(status_code=404, detail="Stored EPUB not found")

    chapters = read_epub_spine(epub_path)
    if chapter_index < 0 or chapter_index >= len(chapters):
        raise HTTPException(status_code=404, detail="Chapter not found")

    _title, chapter_path = chapters[chapter_index]
    with ZipFile(epub_path) as archive:
        try:
            content = archive.read(chapter_path)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Chapter content not found") from error

    return Response(content=content, media_type="text/html; charset=utf-8")
