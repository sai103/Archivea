from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, create_engine

# バックエンドアプリケーションの基準ディレクトリ。現行ではbackend/を指す。
BASE_DIR = Path(__file__).resolve().parents[1]
# アップロード済みファイルや展開済みページ画像を保存するローカル保存先。
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
# MVP用SQLite DBファイルの保存場所。
DB_PATH = BASE_DIR / "library.db"
# SQLModel/SQLAlchemyが利用するDB接続エンジン。
engine = create_engine(f"sqlite:///{DB_PATH}")


@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, _connection_record):
    """SQLite接続時にローカル検証用の接続設定を適用する。"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=OFF")
    cursor.close()


def get_session():
    """FastAPIの依存性注入で使うDBセッションを生成する。"""
    with Session(engine) as session:
        yield session
