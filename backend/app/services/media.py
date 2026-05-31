import posixpath
from pathlib import Path
from shutil import copyfile
from urllib.parse import unquote, urldefrag
import xml.etree.ElementTree as ET
from zipfile import ZipFile

from fastapi import HTTPException, UploadFile

from app.constants import (
    IMAGE_DIRECTORY_FILE_TYPES,
    IMAGE_FILE_TYPES,
    SUPPORTED_FILE_TYPES,
    SUPPORTED_MIME_TYPES,
    ZIP_MIME_TYPES,
)


def is_zip_upload(file: UploadFile) -> bool:
    """アップロードされたファイルがZIPとして扱えるかを判定する。"""
    suffix = Path(file.filename or "").suffix.lower()
    return file.content_type in ZIP_MIME_TYPES or suffix == ".zip"


def classify_upload(file: UploadFile) -> tuple[str, str] | None:
    """アップロードファイルの形式をMIME typeと保存拡張子へ正規化する。"""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix in SUPPORTED_FILE_TYPES:
        return SUPPORTED_FILE_TYPES[suffix]
    if is_zip_upload(file):
        return ("application/zip", ".zip")
    return SUPPORTED_MIME_TYPES.get(file.content_type or "")


def extract_zip_images(zip_path: Path, output_dir: Path) -> list[str]:
    """ZIP内の対応画像をファイル名順に展開し、ページ画像として保存する。"""
    with ZipFile(zip_path) as archive:
        # ディレクトリを除外し、JPG/PNG/WebPだけをページ候補にする。
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

        # ZIP内画像の表示順はファイル名昇順で固定する。
        sorted_members = sorted(candidates, key=lambda item: Path(item.filename).name.lower())
        original_names: list[str] = []

        for index, member in enumerate(sorted_members):
            # 配信時のページ順が分かるように0埋め連番で保存する。
            suffix = Path(member.filename).suffix.lower()
            page_suffix = ".jpg" if suffix == ".jpeg" else suffix
            page_name = f"{index:06d}{page_suffix}"
            target = output_dir / page_name
            with archive.open(member) as source, target.open("wb") as sink:
                sink.write(source.read())
            original_names.append(Path(member.filename).name)

    return original_names


def copy_image_directory_pages(source_dir: Path, output_dir: Path) -> list[str]:
    """画像ディレクトリ内のJPG/PNG/WebPを1冊分のページとしてコピーする。"""
    # 要件により画像ディレクトリ本ではjpg/png/webpだけを対象にする。
    candidates = [
        path
        for path in source_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_DIRECTORY_FILE_TYPES
    ]

    if not candidates:
        raise HTTPException(
            status_code=400,
            detail="Image directory must contain at least one JPG/PNG/WebP file",
        )

    # コピー先は元ディレクトリの現在状態に合わせるため、既存ページを一度削除する。
    output_dir.mkdir(parents=True, exist_ok=True)
    for existing_page in output_dir.iterdir():
        if existing_page.is_file() and existing_page.suffix.lower() in IMAGE_FILE_TYPES:
            existing_page.unlink()

    # ネストされたフォルダも含め、相対パス昇順でページ順を決める。
    sorted_paths = sorted(
        candidates,
        key=lambda item: item.relative_to(source_dir).as_posix().lower(),
    )
    original_names: list[str] = []
    for index, source_path in enumerate(sorted_paths):
        # ZIP展開ページと同じく0埋め連番で保存する。
        suffix = source_path.suffix.lower()
        page_name = f"{index:06d}{suffix}"
        copyfile(source_path, output_dir / page_name)
        original_names.append(source_path.name)

    return original_names


def list_page_files(pages_dir: Path) -> list[Path]:
    """ページディレクトリ内の配信可能な画像ページをファイル名順に返す。"""
    return sorted(
        [path for path in pages_dir.iterdir() if path.suffix.lower() in IMAGE_FILE_TYPES],
        key=lambda item: item.name,
    )


def normalize_epub_member(base_path: str, href: str) -> str:
    """EPUB内の相対hrefをZIPメンバー名へ正規化する。"""
    clean_href = unquote(urldefrag(href)[0])
    joined_path = posixpath.normpath(posixpath.join(posixpath.dirname(base_path), clean_href))
    if joined_path.startswith("../") or joined_path.startswith("/") or joined_path == "..":
        raise HTTPException(status_code=400, detail="Invalid EPUB member path")
    return joined_path


def read_epub_spine(epub_path: Path) -> list[tuple[str, str]]:
    """EPUBのcontainer.xmlとOPFを読み、spine順の章タイトルと本文パスを返す。"""
    try:
        with ZipFile(epub_path) as archive:
            # EPUB仕様上の入口であるcontainer.xmlからOPFの場所を取得する。
            container_xml = archive.read("META-INF/container.xml")
            container_root = ET.fromstring(container_xml)
            rootfile = container_root.find(
                ".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile"
            )
            if rootfile is None:
                raise HTTPException(status_code=400, detail="EPUB rootfile not found")

            opf_path = rootfile.attrib.get("full-path")
            if not opf_path:
                raise HTTPException(status_code=400, detail="EPUB package path not found")

            # OPF manifestはidからファイルhrefを引ける辞書として保持する。
            opf_root = ET.fromstring(archive.read(opf_path))
            manifest = {
                item.attrib["id"]: item.attrib
                for item in opf_root.findall(
                    ".//{http://www.idpf.org/2007/opf}manifest/{http://www.idpf.org/2007/opf}item"
                )
                if "id" in item.attrib and "href" in item.attrib
            }
            spine_items = opf_root.findall(
                ".//{http://www.idpf.org/2007/opf}spine/{http://www.idpf.org/2007/opf}itemref"
            )

            # spineのitemref順がEPUBの本文表示順になる。
            chapters: list[tuple[str, str]] = []
            for itemref in spine_items:
                idref = itemref.attrib.get("idref")
                manifest_item = manifest.get(idref or "")
                if manifest_item is None:
                    continue

                chapter_path = normalize_epub_member(opf_path, manifest_item["href"])
                title = Path(chapter_path).stem
                chapters.append((title, chapter_path))

            if not chapters:
                raise HTTPException(status_code=400, detail="EPUB spine is empty")

            return chapters
    except HTTPException:
        raise
    except KeyError as error:
        raise HTTPException(status_code=400, detail="Invalid EPUB manifest") from error
    except ET.ParseError as error:
        raise HTTPException(status_code=400, detail="Invalid EPUB XML") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Stored EPUB not found") from error
