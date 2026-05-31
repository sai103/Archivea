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

依存ライブラリは`requirements.txt`で管理します。別環境ではこのファイルを使って同じ依存を導入します。

リポジトリルートからバックエンドとWebフロントエンドをまとめて起動する場合は、PowerShellで次を実行します。

```powershell
.\scripts\dev.ps1
```

## ログ

ローカル開発時のAPIログ設定は`backend/config/logging.dev.json`で管理します。

- エラーログ: `backend/logs/archivea-api-error.log`
- アクセスログ: `backend/logs/archivea-api-access.log`
- ローテーション: 1日ごと
- 保持世代: 14日分

`scripts/dev.ps1`は起動時にログ設定ファイルを読み込み、必要なログディレクトリを作成してから、Uvicornへ`--log-config`として渡します。

過去に作成された`backend/uvicorn.out.log`と`backend/uvicorn.err.log`は現在の起動スクリプトでは使用しません。標準出力と標準エラーを単純にファイルへリダイレクトする方式ではなく、Uvicornのlogging設定でアクセスログとエラーログを分けて日次ローテーションします。

## ソース構成

バックエンドは責務ごとに次のファイルへ分割します。

- `app/main.py`: FastAPIアプリケーション生成、ルーター登録、起動時初期化。
- `app/database.py`: DB接続、SQLite設定、セッション生成、アップロード保存先。
- `app/models.py`: SQLModelのDBモデル。
- `app/schemas.py`: APIレスポンスモデル。
- `app/constants.py`: MIME type、対応拡張子、ローカル確認用シード定数。
- `app/routers/`: APIエンドポイント定義。
- `app/services/`: ZIP展開、画像ディレクトリコピー、EPUB解析、シード投入などの業務処理。

`main.py`には個別機能の実装を増やさず、APIや処理を追加する場合は`routers/`または`services/`へ配置します。

## エンドポイント
- `GET /health`
- `POST /documents?title=...` (multipart, `application/pdf` / `image/jpeg` / `image/png` / `image/webp` / `application/epub+zip` / `application/zip`)
- `GET /documents`
- `GET /genres`
- `GET /documents/{id}/content` (PDF/JPG/PNG/WebP/EPUB)
- `GET /documents/{id}/pages` (ZIP内画像のページ一覧)
- `GET /documents/{id}/pages/{page_index}/content` (ZIPページ本文)
- `GET /documents/{id}/epub/chapters` (EPUBのspine章一覧)
- `GET /documents/{id}/epub/chapters/{chapter_index}/content` (EPUB章本文をHTMLとして配信)

## ZIP仕様
- ZIP内の `.jpg` / `.jpeg` / `.png` / `.webp` が対象
- 表示順は **ファイル名昇順** で決定
- ネストされたフォルダ内の画像も抽出対象

## 画像ディレクトリ仕様
- ローカル確認用の画像ディレクトリは1ディレクトリを1冊として扱う
- 対象拡張子は `.jpg` / `.png` / `.webp` のみ
- 表示順はディレクトリからの相対パス昇順で決定する
- バックエンド起動時に`backend/uploads/`へページ画像をコピーし、ZIP画像本と同じページAPIで配信する

## EPUB仕様
- EPUB内の`META-INF/container.xml`からOPFを取得する
- OPFのspine順でXHTML章を配信する
- 現行ビューアは章単位の表示に対応し、ブラウザ表示用に章本文を`text/html`で配信する

## DB方針
- MVPではSQLiteを利用
- 最終的にはMySQLを利用する想定
- 設定値はDBに保存
- ファイル実体はファイルシステムに保存し、保存場所やMIME typeなどのメタデータをDBに保存
- ユーザー、ロール、ジャンル別閲覧権限、年齢制限はDBに保存
- ファイル登録は管理者ユーザーに限定し、一覧取得と本文配信はログイン中ユーザーの閲覧権限で制限

現行のローカル実装では、SQLite DBを`backend/library.db`に作成し、アップロードされた本文やZIP展開ページを`backend/uploads/`へ保存します。これらは生成データとして扱います。

ローカル確認用に`H:\test\pdf_test.pdf`が存在する場合、API起動時に`pdf_test`としてDBへ登録し、`GET /documents/{id}/content`から配信します。

ローカル確認用に`H:\test\jpg_zip_test.zip`が存在する場合、API起動時に`jpg_zip_test`としてDBへ登録し、ZIP内の画像ページを`backend/uploads/seed_jpg_zip_test/`へ展開します。展開されたページは`GET /documents/{id}/pages`と`GET /documents/{id}/pages/{page_index}/content`から配信します。

ローカル確認用に`H:\test\jpg_zip_test2`ディレクトリが存在する場合、API起動時に`jpg_zip_test2`としてDBへ登録し、ディレクトリ内の`.jpg` / `.png` / `.webp`を`backend/uploads/seed_jpg_zip_test2/`へコピーします。コピーされたページは`GET /documents/{id}/pages`と`GET /documents/{id}/pages/{page_index}/content`から配信します。

ローカル確認用に`H:\test\png_test.png`または`H:\test\epub_test.epub`が存在する場合、API起動時にそれぞれ`png_test`、`epub_test`としてDBへ登録し、`GET /documents/{id}/content`から配信します。

## 権限方針

- 管理者ユーザーはドキュメントの登録、メタデータ編集、ジャンル設定、年齢制限設定を行える。
- 一般ユーザーは許可されたジャンルだけを一覧、検索、閲覧できる。
- ジャンルには年齢制限または閲覧レベルを設定できる。
- 本文配信APIはURLを直接指定された場合でも閲覧権限を確認する。
- Chrome Webと将来のFlutterクライアントは同じ権限判定済みAPIを利用する。
