from pathlib import Path

# ZIPアップロードとして扱うContent-Type候補。
ZIP_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "multipart/x-zip",
}

# ZIP内ページや配信対象ページとして扱う画像拡張子とMIME type。
IMAGE_FILE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

# 画像ディレクトリ本でページとして取り込む拡張子。要件によりjpegは含めない。
IMAGE_DIRECTORY_FILE_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

# ファイル拡張子から正規化後のMIME typeと保存拡張子を決める対応表。
SUPPORTED_FILE_TYPES = {
    ".pdf": ("application/pdf", ".pdf"),
    ".jpg": ("image/jpeg", ".jpg"),
    ".jpeg": ("image/jpeg", ".jpg"),
    ".png": ("image/png", ".png"),
    ".webp": ("image/webp", ".webp"),
    ".epub": ("application/epub+zip", ".epub"),
}

# Content-Typeから正規化後のMIME typeと保存拡張子を決める対応表。
SUPPORTED_MIME_TYPES = {
    "application/pdf": ("application/pdf", ".pdf"),
    "image/jpeg": ("image/jpeg", ".jpg"),
    "image/png": ("image/png", ".png"),
    "image/webp": ("image/webp", ".webp"),
    "application/epub+zip": ("application/epub+zip", ".epub"),
}

# 起動時に登録する初期ジャンル。
DEFAULT_GENRES = ["技術資料", "画像", "コミック", "書籍"]

# ローカル確認用PDFの元ファイルパス。
TEST_PDF_PATH = Path("H:/test/pdf_test.pdf")
# PDFシードをアップロード保存先にコピーする時の保存名。
TEST_PDF_STORED_NAME = "seed_pdf_test.pdf"
# PDFシードの一覧表示タイトル。
TEST_PDF_TITLE = "pdf_test"

# ローカル確認用ZIP画像本の元ファイルパス。
TEST_ZIP_PATH = Path("H:/test/jpg_zip_test.zip")
# ZIPシードから展開したページを置くディレクトリ名。
TEST_ZIP_STORED_NAME = "seed_jpg_zip_test"
# ZIPシードの一覧表示タイトル。
TEST_ZIP_TITLE = "jpg_zip_test"

# ローカル確認用画像ディレクトリ本の元ディレクトリ。
TEST_IMAGE_DIRECTORY_PATH = Path("H:/test/jpg_zip_test2")
# 画像ディレクトリ本をアップロード保存先にコピーする時の保存ディレクトリ名。
TEST_IMAGE_DIRECTORY_STORED_NAME = "seed_jpg_zip_test2"
# 画像ディレクトリ本の一覧表示タイトル。
TEST_IMAGE_DIRECTORY_TITLE = "jpg_zip_test2"

# ローカル確認用PNGの元ファイルパス。
TEST_PNG_PATH = Path("H:/test/png_test.png")
# PNGシードをアップロード保存先にコピーする時の保存名。
TEST_PNG_STORED_NAME = "seed_png_test.png"
# PNGシードの一覧表示タイトル。
TEST_PNG_TITLE = "png_test"

# ローカル確認用EPUBの元ファイルパス。
TEST_EPUB_PATH = Path("H:/test/epub_test.epub")
# EPUBシードをアップロード保存先にコピーする時の保存名。
TEST_EPUB_STORED_NAME = "seed_epub_test.epub"
# EPUBシードの一覧表示タイトル。
TEST_EPUB_TITLE = "epub_test"
