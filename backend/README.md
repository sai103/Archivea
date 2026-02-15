# Archivea Reader API

## セットアップ

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## エンドポイント
- `GET /health`
- `POST /documents?title=...` (multipart, `application/pdf` / `image/jpeg` / `application/zip`)
- `GET /documents`
- `GET /documents/{id}/content` (PDF/JPG)
- `GET /documents/{id}/pages` (ZIP内JPGのページ一覧)
- `GET /documents/{id}/pages/{page_index}/content` (ZIPページ本文)

## ZIP仕様
- ZIP内の `.jpg` / `.jpeg` が対象
- 表示順は **ファイル名昇順** で決定
- ネストされたフォルダ内のJPGも抽出対象
