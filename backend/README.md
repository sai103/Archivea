# Archivea Reader API

Archiveaでドキュメントのアップロード、一覧取得、本文配信を担うFastAPIアプリケーションです。現行実装ではPDF、JPG、PNG、WebP、EPUB、画像ページを含むZIPを扱います。

## セットアップ

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

起動後は`GET /health`でAPIの起動状態を確認できます。

## エンドポイント
- `GET /health`
- `POST /documents?title=...` (multipart, `application/pdf` / `image/jpeg` / `image/png` / `image/webp` / `application/epub+zip` / `application/zip`)
- `GET /documents`
- `GET /documents/{id}/content` (PDF/JPG/PNG/WebP/EPUB)
- `GET /documents/{id}/pages` (ZIP内画像のページ一覧)
- `GET /documents/{id}/pages/{page_index}/content` (ZIPページ本文)

## ZIP仕様
- ZIP内の `.jpg` / `.jpeg` / `.png` / `.webp` が対象
- 表示順は **ファイル名昇順** で決定
- ネストされたフォルダ内の画像も抽出対象

## DB方針
- MVPではSQLiteを利用
- 最終的にはMySQLを利用する想定
- 設定値はDBに保存
- ファイル実体はファイルシステムに保存し、保存場所やMIME typeなどのメタデータをDBに保存
- ユーザー、ロール、ジャンル別閲覧権限、年齢制限はDBに保存
- ファイル登録は管理者ユーザーに限定し、一覧取得と本文配信はログイン中ユーザーの閲覧権限で制限

現行のローカル実装では、SQLite DBを`backend/library.db`に作成し、アップロードされた本文やZIP展開ページを`backend/uploads/`へ保存します。これらは生成データとして扱います。

## 権限方針

- 管理者ユーザーはドキュメントの登録、メタデータ編集、ジャンル設定、年齢制限設定を行える。
- 一般ユーザーは許可されたジャンルだけを一覧、検索、閲覧できる。
- ジャンルには年齢制限または閲覧レベルを設定できる。
- 本文配信APIはURLを直接指定された場合でも閲覧権限を確認する。
- Chrome Webと将来のFlutterクライアントは同じ権限判定済みAPIを利用する。
