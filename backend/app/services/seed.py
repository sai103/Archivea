from pathlib import Path
from shutil import copyfile

from sqlmodel import Session, select

from app.constants import (
    DEFAULT_GENRES,
    IMAGE_FILE_TYPES,
    TEST_EPUB_PATH,
    TEST_EPUB_STORED_NAME,
    TEST_EPUB_TITLE,
    TEST_IMAGE_DIRECTORY_PATH,
    TEST_IMAGE_DIRECTORY_STORED_NAME,
    TEST_IMAGE_DIRECTORY_TITLE,
    TEST_PDF_PATH,
    TEST_PDF_STORED_NAME,
    TEST_PDF_TITLE,
    TEST_PNG_PATH,
    TEST_PNG_STORED_NAME,
    TEST_PNG_TITLE,
    TEST_ZIP_PATH,
    TEST_ZIP_STORED_NAME,
    TEST_ZIP_TITLE,
)
from app.database import UPLOAD_DIR
from app.models import AppSettings, Document, Genre, User
from app.services.media import copy_image_directory_pages, extract_zip_images


def seed_test_pdf(session: Session):
    """ローカル確認用PDFをUPLOAD_DIRへコピーし、DBへ登録する。"""
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


def seed_test_file(
    session: Session,
    source_path: Path,
    stored_name: str,
    title: str,
    mime_type: str,
    extension: str,
):
    """単一ファイル形式のローカル確認データをUPLOAD_DIRへコピーし、DBへ登録する。"""
    if not source_path.exists():
        return

    target = UPLOAD_DIR / stored_name
    copyfile(source_path, target)

    existing_document = session.exec(
        select(Document).where(Document.stored_name == stored_name)
    ).first()
    if existing_document:
        return

    session.add(
        Document(
            title=title,
            mime_type=mime_type,
            extension=extension,
            stored_name=stored_name,
        )
    )


def seed_test_zip(session: Session):
    """ローカル確認用ZIPをページ画像へ展開し、DBへ登録する。"""
    if not TEST_ZIP_PATH.exists():
        return

    pages_dir = UPLOAD_DIR / TEST_ZIP_STORED_NAME
    pages_dir.mkdir(parents=True, exist_ok=True)

    existing_pages = [
        path for path in pages_dir.iterdir() if path.suffix.lower() in IMAGE_FILE_TYPES
    ]
    if not existing_pages:
        extract_zip_images(zip_path=TEST_ZIP_PATH, output_dir=pages_dir)

    existing_document = session.exec(
        select(Document).where(Document.stored_name == TEST_ZIP_STORED_NAME)
    ).first()
    if existing_document:
        return

    session.add(
        Document(
            title=TEST_ZIP_TITLE,
            mime_type="application/zip",
            extension=".zip",
            stored_name=TEST_ZIP_STORED_NAME,
        )
    )


def seed_test_image_directory(session: Session):
    """ローカル確認用画像ディレクトリをページ画像としてコピーし、DBへ登録する。"""
    if not TEST_IMAGE_DIRECTORY_PATH.exists() or not TEST_IMAGE_DIRECTORY_PATH.is_dir():
        return

    pages_dir = UPLOAD_DIR / TEST_IMAGE_DIRECTORY_STORED_NAME
    copy_image_directory_pages(source_dir=TEST_IMAGE_DIRECTORY_PATH, output_dir=pages_dir)

    existing_document = session.exec(
        select(Document).where(Document.stored_name == TEST_IMAGE_DIRECTORY_STORED_NAME)
    ).first()
    if existing_document:
        return

    session.add(
        Document(
            title=TEST_IMAGE_DIRECTORY_TITLE,
            mime_type="application/zip",
            extension=".zip",
            stored_name=TEST_IMAGE_DIRECTORY_STORED_NAME,
        )
    )


def seed_default_user(session: Session):
    """ローカル確認用の初期ユーザーが存在しない場合に作成する。"""
    if session.get(User, "admin") is None:
        session.add(User(username="admin", password="admin", role=1))


def seed_settings(session: Session):
    """storage_dir設定レコードが未存在の場合にUPLOAD_DIRで初期化する。"""
    if session.get(AppSettings, "storage_dir") is None:
        session.add(AppSettings(name="storage_dir", value=str(UPLOAD_DIR)))


def seed_startup_data(session: Session):
    """アプリ起動時に必要な初期ジャンルとローカル確認用データを投入する。"""
    existing_names = set(session.exec(select(Genre.name)).all())
    for name in DEFAULT_GENRES:
        if name not in existing_names:
            session.add(Genre(name=name))
    session.flush()

    seed_default_user(session)
    seed_settings(session)
    seed_test_pdf(session)
    seed_test_file(
        session=session,
        source_path=TEST_PNG_PATH,
        stored_name=TEST_PNG_STORED_NAME,
        title=TEST_PNG_TITLE,
        mime_type="image/png",
        extension=".png",
    )
    seed_test_file(
        session=session,
        source_path=TEST_EPUB_PATH,
        stored_name=TEST_EPUB_STORED_NAME,
        title=TEST_EPUB_TITLE,
        mime_type="application/epub+zip",
        extension=".epub",
    )
    seed_test_zip(session)
    seed_test_image_directory(session)

    # シードドキュメントにジャンルが未設定の場合は仮割り当てを行う。
    seed_genre_map = {
        TEST_PDF_STORED_NAME: "技術資料",
        TEST_PNG_STORED_NAME: "画像",
        TEST_EPUB_STORED_NAME: "書籍",
        TEST_ZIP_STORED_NAME: "コミック",
        TEST_IMAGE_DIRECTORY_STORED_NAME: "コミック",
    }
    for stored_name, genre_name in seed_genre_map.items():
        doc = session.exec(select(Document).where(Document.stored_name == stored_name)).first()
        if doc is not None and doc.genre_name is None:
            doc.genre_name = genre_name
            session.add(doc)
