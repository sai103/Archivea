from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4
from zipfile import ZipFile

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Field, Session, SQLModel, create_engine, select

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = BASE_DIR / "library.db"
engine = create_engine(f"sqlite:///{DB_PATH}")
ZIP_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "multipart/x-zip",
}


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    mime_type: str
    extension: str
    stored_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentRead(SQLModel):
    id: int
    title: str
    mime_type: str
    created_at: datetime


class ZipPageRead(SQLModel):
    index: int
    filename: str
    content_url: str


app = FastAPI(
    title="Archivea Reader API",
    description="PDF/JPG/ZIP(JPG集)ブックリーダー向けAPI。AndroidファーストでiOS拡張を想定。",
    version="0.2.0",
)


def get_session():
    with Session(engine) as session:
        yield session


def is_zip_upload(file: UploadFile) -> bool:
    suffix = Path(file.filename or "").suffix.lower()
    return file.content_type in ZIP_MIME_TYPES or suffix == ".zip"


def extract_zip_jpgs(zip_path: Path, output_dir: Path) -> list[str]:
    with ZipFile(zip_path) as archive:
        candidates = [
            info
            for info in archive.infolist()
            if not info.is_dir() and Path(info.filename).suffix.lower() in {".jpg", ".jpeg"}
        ]

        if not candidates:
            raise HTTPException(status_code=400, detail="ZIP must contain at least one JPG file")

        sorted_members = sorted(candidates, key=lambda item: Path(item.filename).name.lower())
        original_names: list[str] = []

        for index, member in enumerate(sorted_members):
            page_name = f"{index:06d}.jpg"
            target = output_dir / page_name
            with archive.open(member) as source, target.open("wb") as sink:
                sink.write(source.read())
            original_names.append(Path(member.filename).name)

    return original_names


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/documents", response_model=DocumentRead)
async def upload_document(
    title: str = Query(..., description="一覧に表示するタイトル"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if file.content_type not in {"application/pdf", "image/jpeg", *ZIP_MIME_TYPES} and not is_zip_upload(file):
        raise HTTPException(status_code=400, detail="Only PDF/JPG/ZIP(JPG) are supported")

    stored_name = uuid4().hex
    target_prefix = UPLOAD_DIR / stored_name
    content = await file.read()

    if is_zip_upload(file):
        zip_path = target_prefix.with_suffix(".zip")
        zip_path.write_bytes(content)
        pages_dir = target_prefix
        pages_dir.mkdir(parents=True, exist_ok=True)
        try:
            extract_zip_jpgs(zip_path=zip_path, output_dir=pages_dir)
        finally:
            zip_path.unlink(missing_ok=True)
        mime_type = "application/zip"
        extension = ".zip"
    elif file.content_type == "application/pdf":
        target = target_prefix.with_suffix(".pdf")
        target.write_bytes(content)
        mime_type = "application/pdf"
        extension = ".pdf"
        stored_name = target.name
    else:
        target = target_prefix.with_suffix(".jpg")
        target.write_bytes(content)
        mime_type = "image/jpeg"
        extension = ".jpg"
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

    return FileResponse(path=path, media_type=doc.mime_type, filename=f"{doc.title}{doc.extension}")


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

    pages = sorted(pages_dir.glob("*.jpg"), key=lambda item: item.name)
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
    pages = sorted(pages_dir.glob("*.jpg"), key=lambda item: item.name)
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=404, detail="Page not found")

    return FileResponse(path=pages[page_index], media_type="image/jpeg", filename=pages[page_index].name)
