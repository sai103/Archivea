# Archivea

Chromeブラウザでの動作を最初の目標とするブックリーダー（PDF/JPG/PNG/WebP/EPUB/ZIP内画像） + API の初期実装です。Webフロントエンドは React + TypeScript + Vite を第一候補とし、将来のiOS/Androidアプリ展開では Flutter を利用する方針です。実行環境はインストールを容易にするため、Dockerでの動作を前提に整備します。

## READMEの役割

このREADMEはArchivea全体の概要と方針を扱います。各アプリケーションの起動方法、API仕様、クライアント固有の情報は、それぞれのREADMEを参照してください。

- `backend/README.md`: FastAPI APIの起動方法、エンドポイント、保存方針
- `client_web/README.md`: Chrome Webフロントエンドの起動方法、構成、実行コマンド
- `client_flutter/README.md`: 将来のモバイルアプリ向けFlutterクライアントの起動方法、API接続時の注意

## ディレクトリ
- `backend/`: FastAPI でのファイル管理API
- `client_web/`: Chromeブラウザ向けWebフロントエンド
- `client_flutter/`: Flutter モバイルアプリ（将来のiOS/Android向け）
- `docs/`: 概要、ハーネス設計、テスト戦略、構成方針
- `skills/`: Chrome Web と Flutter Mobile の作成・実行手順

## 開発方針
- まずはChromeブラウザでの動作を目指す
- Webフロントエンドは React + TypeScript + Vite を第一候補とする
- Flutterは将来のiOS/Androidアプリ利用を前提に扱う
- インストールと起動を容易にするため、Dockerでの実行環境を整備する

## ローカル開発起動

Docker整備前の現時点では、PowerShellで次を実行するとバックエンドとWebフロントエンドをまとめて起動できます。

```powershell
.\scripts\dev.ps1
```

このスクリプトは次を実行します。

- `backend/.venv` が無い場合は作成する
- `backend/requirements.txt` からPython依存をインストールする
- `client_web/package-lock.json` に従って `npm ci` を実行する
- FastAPIを `http://127.0.0.1:8000` で起動する
- Viteを `http://localhost:5173` で起動する

フロントエンドの依存ライブラリ（`pdfjs-dist`など）は、`client_web/package.json` と `client_web/package-lock.json` に記録されています。別環境では `npm ci` により同じ依存を再現します。バックエンド依存は `backend/requirements.txt` に記録されています。

## フロントエンド想定バージョン
- React: `19.2.6`
- TypeScript: `6.0.3`
- Vite: `8.0.13`
- Vite Reactプラグイン: `@vitejs/plugin-react` `6.0.2`

React、TypeScript、Viteは最新の安定版を利用します。バージョンを更新する場合は、`client_web/package.json` と `client_web/package-lock.json` も合わせて更新します。

## 関連ドキュメント
- `AGENTS.md`: エージェント向けの全体的な進め方
- `docs/overview.md`: プロジェクト概要
- `docs/android-first-architecture.md`: Chrome先行 + 将来モバイルの構成方針
- `docs/harness-design.md`: ハーネス設計の考え方
- `docs/test-strategy.md`: テスト戦略
- `skills/chrome-web-frontend/SKILL.md`: Chrome Webフロントエンドの作成・実行
- `skills/flutter-mobile/SKILL.md`: Flutterモバイルアプリの作成・実行

## ビューア機能
- PDF表示
- JPG/PNG/WebP表示
- EPUB表示（Chrome Webフロントエンドで対応予定）
- ZIP内JPG/PNG/WebP表示（ファイル名順）
- 画面幅が広い場合（900px以上）は、ZIPビューアで1ページ/2ページ表示を画面上のボタンで切替可能
