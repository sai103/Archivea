from datetime import datetime
from pathlib import Path
from shutil import copyfile
from typing import Optional
from uuid import uuid4
from zipfile import ZipFile

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import event
from sqlmodel import Field, Session, SQLModel, create_engine, select

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = BASE_DIR / "library.db"
engine = create_engine(f"sqlite:///{DB_PATH}")


@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=OFF")
    cursor.close()


ZIP_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "multipart/x-zip",
}
IMAGE_FILE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
SUPPORTED_FILE_TYPES = {
    ".pdf": ("application/pdf", ".pdf"),
    ".jpg": ("image/jpeg", ".jpg"),
    ".jpeg": ("image/jpeg", ".jpg"),
    ".png": ("image/png", ".png"),
    ".webp": ("image/webp", ".webp"),
    ".epub": ("application/epub+zip", ".epub"),
}
SUPPORTED_MIME_TYPES = {
    "application/pdf": ("application/pdf", ".pdf"),
    "image/jpeg": ("image/jpeg", ".jpg"),
    "image/png": ("image/png", ".png"),
    "image/webp": ("image/webp", ".webp"),
    "application/epub+zip": ("application/epub+zip", ".epub"),
}


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    mime_type: str
    extension: str
    stored_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Genre(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)


class DocumentRead(SQLModel):
    id: int
    title: str
    mime_type: str
    created_at: datetime


class GenreRead(SQLModel):
    id: int
    name: str


class ZipPageRead(SQLModel):
    index: int
    filename: str
    content_url: str


app = FastAPI(
    title="Archivea Reader API",
    description="PDF/JPG/PNG/WebP/EPUB/ZIP(画像集)ブックリーダー向けAPI。Chromeブラウザを最初の対象とし、将来のiOS/Android拡張を想定。",
    version="0.2.0",
)

DEFAULT_GENRES = ["技術資料", "画像", "コミック", "書籍"]
TEST_PDF_PATH = Path("H:/test/pdf_test.pdf")
TEST_PDF_STORED_NAME = "seed_pdf_test.pdf"
TEST_PDF_TITLE = "pdf_test"


def get_session():
    with Session(engine) as session:
        yield session


def is_zip_upload(file: UploadFile) -> bool:
    suffix = Path(file.filename or "").suffix.lower()
    return file.content_type in ZIP_MIME_TYPES or suffix == ".zip"


def classify_upload(file: UploadFile) -> Optional[tuple[str, str]]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix in SUPPORTED_FILE_TYPES:
        return SUPPORTED_FILE_TYPES[suffix]
    if is_zip_upload(file):
        return ("application/zip", ".zip")
    return SUPPORTED_MIME_TYPES.get(file.content_type or "")


def extract_zip_images(zip_path: Path, output_dir: Path) -> list[str]:
    with ZipFile(zip_path) as archive:
        candidates = [
            info
            for info in archive.infolist()
            if not info.is_dir() and Path(info.filename).suffix.lower() in IMAGE_FILE_TYPES
        ]

        if not candidates:
            raise HTTPException(
                status_code=400,
                detail="ZIP must contain at least one JPG/PNG/WebP file",
            )

        sorted_members = sorted(candidates, key=lambda item: Path(item.filename).name.lower())
        original_names: list[str] = []

        for index, member in enumerate(sorted_members):
            suffix = Path(member.filename).suffix.lower()
            page_suffix = ".jpg" if suffix == ".jpeg" else suffix
            page_name = f"{index:06d}{page_suffix}"
            target = output_dir / page_name
            with archive.open(member) as source, target.open("wb") as sink:
                sink.write(source.read())
            original_names.append(Path(member.filename).name)

    return original_names


def seed_test_pdf(session: Session):
    if not TEST_PDF_PATH.exists():
        return

    target = UPLOAD_DIR / TEST_PDF_STORED_NAME
    copyfile(TEST_PDF_PATH, target)

    existing_document = session.exec(
        select(Document).where(Document.stored_name == TEST_PDF_STORED_NAME)
    ).first()
    if existing_document:
        return

    session.add(
        Document(
            title=TEST_PDF_TITLE,
            mime_type="application/pdf",
            extension=".pdf",
            stored_name=TEST_PDF_STORED_NAME,
        )
    )


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        existing_names = set(session.exec(select(Genre.name)).all())
        for name in DEFAULT_GENRES:
            if name not in existing_names:
                session.add(Genre(name=name))
        seed_test_pdf(session)
        session.commit()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/documents", response_model=DocumentRead)
async def upload_document(
    title: str = Query(..., description="一覧に表示するタイトル"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    file_type = classify_upload(file)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="Only PDF/JPG/PNG/WebP/EPUB/ZIP(JPG/PNG/WebP) are supported",
        )

    mime_type, extension = file_type

    stored_name = uuid4().hex
    target_prefix = UPLOAD_DIR / stored_name
    content = await file.read()

    if mime_type == "application/zip":
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


@app.get("/documents", response_model=list[DocumentRead])
def list_documents(session: Session = Depends(get_session)):
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


@app.get("/genres", response_model=list[GenreRead])
def list_genres(session: Session = Depends(get_session)):
    genres = session.exec(select(Genre).order_by(Genre.name)).all()
    return [GenreRead(id=genre.id, name=genre.name) for genre in genres]


@app.get("/documents/{document_id}/content")
def get_document_content(document_id: int, session: Session = Depends(get_session)):
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


@app.get("/documents/{document_id}/pages", response_model=list[ZipPageRead])
def list_zip_pages(document_id: int, session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="Document is not ZIP")

    pages_dir = UPLOAD_DIR / doc.stored_name
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ZIP pages not found")

    pages = sorted(
        [path for path in pages_dir.iterdir() if path.suffix.lower() in IMAGE_FILE_TYPES],
        key=lambda item: item.name,
    )
    return [
        ZipPageRead(
            index=index,
            filename=path.name,
            content_url=f"/documents/{document_id}/pages/{index}/content",
        )
        for index, path in enumerate(pages)
    ]


@app.get("/documents/{document_id}/pages/{page_index}/content")
def get_zip_page_content(document_id: int, page_index: int, session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.mime_type != "application/zip":
        raise HTTPException(status_code=400, detail="Document is not ZIP")

    pages_dir = UPLOAD_DIR / doc.stored_name
    if not pages_dir.exists() or not pages_dir.is_dir():
        raise HTTPException(status_code=404, detail="ZIP pages not found")

    pages = sorted(
        [path for path in pages_dir.iterdir() if path.suffix.lower() in IMAGE_FILE_TYPES],
        key=lambda item: item.name,
    )
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
