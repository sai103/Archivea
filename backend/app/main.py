from fastapi import FastAPI
from sqlalchemy import text
from sqlmodel import SQLModel, Session

from app.database import engine
from fastapi import Depends

from app.routers import app_settings, auth, documents, genres, health, logs
from app.routers.auth import get_current_user
from app.services.seed import seed_startup_data


def create_app() -> FastAPI:
    """FastAPIアプリケーションを生成し、各ルーターを登録する。"""
    app = FastAPI(
        title="Archivea Reader API",
        description="PDF/JPG/PNG/WebP/EPUB/ZIP(画像集)ブックリーダー向けAPI。Chromeブラウザを最初の対象とし、将来のiOS/Android拡張を想定。",
        version="0.2.0",
    )

    # APIの責務ごとに分けたルーターをアプリケーションへ登録する。
    # health と auth は認証不要。それ以外は get_current_user で保護する。
    _auth_dep = [Depends(get_current_user)]
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(app_settings.router, dependencies=_auth_dep)
    app.include_router(genres.router, dependencies=_auth_dep)
    app.include_router(documents.router, dependencies=_auth_dep)
    app.include_router(logs.router, dependencies=_auth_dep)

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
            # settingsテーブルがid/storage_dir旧スキーマの場合、name/value新スキーマへ移行する。
            from app.database import UPLOAD_DIR as _upload_dir
            try:
                settings_cols = conn.execute(text("PRAGMA table_info(settings)")).fetchall()
                settings_col_names = [col[1] for col in settings_cols]
                if "id" in settings_col_names:
                    old_value = conn.execute(
                        text("SELECT storage_dir FROM settings WHERE id = 1")
                    ).fetchone()
                    migrated_value = old_value[0] if old_value else str(_upload_dir)
                    conn.execute(text("""
                        CREATE TABLE settings_new (
                            name TEXT PRIMARY KEY,
                            value TEXT NOT NULL
                        )
                    """))
                    conn.execute(
                        text("INSERT INTO settings_new (name, value) VALUES ('storage_dir', :v)"),
                        {"v": migrated_value},
                    )
                    conn.execute(text("DROP TABLE settings"))
                    conn.execute(text("ALTER TABLE settings_new RENAME TO settings"))
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
            # genreテーブルがid主キー旧スキーマの場合、name主キーへ移行する。
            try:
                genre_cols = conn.execute(text("PRAGMA table_info(genre)")).fetchall()
                genre_col_names = [col[1] for col in genre_cols]
                if "id" in genre_col_names:
                    conn.execute(text("""
                        CREATE TABLE genre_new (
                            name TEXT PRIMARY KEY
                        )
                    """))
                    conn.execute(text("INSERT INTO genre_new (name) SELECT name FROM genre"))
                    conn.execute(text("DROP TABLE genre"))
                    conn.execute(text("ALTER TABLE genre_new RENAME TO genre"))
                    conn.commit()
            except Exception:
                pass
            # documentテーブルのgenre_idカラムをgenre_nameへ移行する。
            try:
                doc_cols = conn.execute(text("PRAGMA table_info(document)")).fetchall()
                doc_col_names = [col[1] for col in doc_cols]
                if "genre_id" in doc_col_names and "genre_name" not in doc_col_names:
                    # genre_idの値からgenre名を解決して新カラムへ移行する。
                    conn.execute(text("""
                        CREATE TABLE document_genre_new AS
                        SELECT d.stored_name, g.name AS genre_name
                        FROM document d
                        LEFT JOIN genre g ON g.rowid = d.genre_id
                    """))
                    conn.execute(text("ALTER TABLE document ADD COLUMN genre_name TEXT REFERENCES genre(name)"))
                    conn.execute(text("""
                        UPDATE document SET genre_name = (
                            SELECT genre_name FROM document_genre_new
                            WHERE document_genre_new.stored_name = document.stored_name
                        )
                    """))
                    conn.execute(text("DROP TABLE document_genre_new"))
                    conn.commit()
            except Exception:
                pass
            # documentテーブルのgenre_idカラムを物理削除する（存在しない場合はスキップ）。
            try:
                doc_cols2 = conn.execute(text("PRAGMA table_info(document)")).fetchall()
                doc_col_names2 = [col[1] for col in doc_cols2]
                if "genre_id" in doc_col_names2:
                    conn.execute(text("""
                        CREATE TABLE document_new AS SELECT
                            stored_name, title, mime_type, extension,
                            created_at, genre_name,
                            COALESCE(is_deleted, 0) AS is_deleted
                        FROM document
                    """))
                    conn.execute(text("DROP TABLE document"))
                    conn.execute(text("ALTER TABLE document_new RENAME TO document"))
                    conn.commit()
            except Exception:
                pass
            # documentテーブルがid主キー旧スキーマの場合、stored_name主キーへ移行する。
            try:
                columns = conn.execute(text("PRAGMA table_info(document)")).fetchall()
                col_names = [col[1] for col in columns]
                if "id" in col_names:
                    conn.execute(text("""
                        CREATE TABLE document_new (
                            stored_name TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            mime_type TEXT NOT NULL,
                            extension TEXT NOT NULL,
                            created_at DATETIME NOT NULL,
                            genre_id INTEGER REFERENCES genre(id),
                            is_deleted INTEGER NOT NULL DEFAULT 0
                        )
                    """))
                    conn.execute(text("""
                        INSERT INTO document_new
                        SELECT stored_name, title, mime_type, extension, created_at, genre_id,
                               COALESCE(is_deleted, 0)
                        FROM document
                    """))
                    conn.execute(text("DROP TABLE document"))
                    conn.execute(text("ALTER TABLE document_new RENAME TO document"))
                    conn.commit()
            except Exception:
                pass
        with Session(engine) as session:
            seed_startup_data(session)
            session.commit()

    return app


# uvicorn app.main:app から参照されるFastAPIアプリケーションインスタンス。
app = create_app()
