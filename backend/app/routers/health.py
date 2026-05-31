from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    """APIプロセスの起動確認用ヘルスチェック。"""
    return {"status": "ok"}
