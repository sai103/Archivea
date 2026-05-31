from fastapi import FastAPI
from sqlmodel import SQLModel, Session

from app.database import engine
from app.routers import documents, genres, health
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
    app.include_router(genres.router)
    app.include_router(documents.router)

    @app.on_event("startup")
    def on_startup():
        """アプリ起動時にDBテーブル作成とローカル確認用初期データ投入を行う。"""
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            seed_startup_data(session)
            session.commit()

    return app


# uvicorn app.main:app から参照されるFastAPIアプリケーションインスタンス。
app = create_app()
