import logging
from logging.handlers import TimedRotatingFileHandler

from app.database import BASE_DIR

# ログ出力先ディレクトリ。backend/logs/ を使用する。
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


def get_frontend_logger() -> logging.Logger:
    """フロントエンドログ用のロガーを返す。
    日次ローテート・14日保持。初回呼び出し時にハンドラを登録する。
    """
    logger = logging.getLogger("archivea.frontend")
    if logger.handlers:
        return logger

    handler = TimedRotatingFileHandler(
        LOG_DIR / "frontend.log",
        when="midnight",
        backupCount=14,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(asctime)s\t%(message)s"))
    logger.setLevel(logging.DEBUG)
    logger.addHandler(handler)
    # uvicornのルートロガーへの伝播を止め、重複出力を防ぐ。
    logger.propagate = False
    return logger
