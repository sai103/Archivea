from fastapi import FastAPI
from sqlalchemy import text
from sqlmodel import SQLModel, Session

from app.database import engine
from app.routers import app_settings, documents, genres, health, logs
from app.services.seed import seed_startup_data


def create_app() -> FastAPI:
    """FastAPIアプリケーションを生成し、各ルーターを登録する。"""
    app = FastAPI(
        title="Archivea Reader API",
        description="PDF/JPG/PNG/WebP/EPUB/ZIP(画像集)ブックリーダー向けAPI。Chromeブラウザを最初の対象とし、将来のiOS/Android拡張を想定。",
        version="0.2.0",
    )

    # APIの責務ごとに分けたルーターをアプリケーションへ登録する。
    app.include_router(health.router)
    app.include_router(app_settings.router)
    app.include_router(genres.router)
    app.include_router(documents.router)
    app.include_router(logs.router)

    @app.on_event("startup")
    def on_startup():
        """アプリ起動時にDBテーブル作成とローカル確認用初期データ投入を行う。"""
        SQLModel.metadata.create_all(engine)
        # 既存DBにカラムが無い場合はALTER TABLEで追加する。
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE document ADD COLUMN genre_id INTEGER REFERENCES genre(id)"))
                conn.commit()
            except Exception:
                pass  # カラムが既に存在する場合はスキップ。
            # settingsテーブルにシングルトン行が無い場合はUPLOAD_DIRで初期化する。
            from app.database import UPLOAD_DIR as _upload_dir
            try:
                conn.execute(
                    text("INSERT OR IGNORE INTO settings (id, storage_dir) VALUES (1, :d)"),
                    {"d": str(_upload_dir)},
                )
                conn.commit()
            except Exception:
                pass  # テーブル未作成の場合はcreate_all後のseed_startup_dataで補完する。
            # documentテーブルのstorage_dirカラムを物理削除する（存在しない場合はスキップ）。
            try:
                conn.execute(text("ALTER TABLE document DROP COLUMN storage_dir"))
                conn.commit()
            except Exception:
                pass
            # documentテーブルにis_deletedカラムが無い場合は追加する。
            try:
                conn.execute(text("ALTER TABLE document ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"))
                conn.commit()
            except Exception:
                pass
        with Session(engine) as session:
            seed_startup_data(session)
            session.commit()

    return app


# uvicorn app.main:app から参照されるFastAPIアプリケーションインスタンス。
app = create_app()
