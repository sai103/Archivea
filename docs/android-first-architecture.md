# Androidスマホ向け + API の初期アーキテクチャ

## 目的
- まずは Android スマホ向けに PDF/JPG/ZIP内JPG を閲覧できるブックリーダーを提供。
- その後 iOS を追加しやすいように、モバイルは Flutter で構築する。

## 構成
- `client_flutter/`: Flutter クライアント（Android先行、同コードでiOS展開可能）
- `backend/`: FastAPI で作るドキュメント管理API

## 最低限の機能（MVP）
1. 管理者が PDF/JPG/ZIP(JPG集) を API にアップロード
2. モバイルアプリで一覧取得
3. タップで本文表示（PDFビューア / 画像ビューア / ZIPページビューア）

## API方針
- `POST /documents` でPDF/JPG/ZIP登録
- `GET /documents` で一覧取得
- `GET /documents/{id}/content` でPDF/JPG配信
- `GET /documents/{id}/pages` + `.../pages/{page_index}/content` でZIP内JPG配信

## ZIPページ順序
- ZIP内の `.jpg` / `.jpeg` を抽出対象とする
- 表示順はファイル名昇順（例: `001.jpg`, `002.jpg`, `010.jpg`）

## 画面サイズ対応
- ZIPビューアは画面幅が900px以上で2ページ表示に対応
- 1ページ/2ページ表示はアプリ画面上のボタンで切替可能
- 幅が狭い場合は自動的に1ページ表示にフォールバック

## Flutter採用理由
- Android/iOS の単一コードベース運用がしやすい
- PDF表示ライブラリが実用レベル
- 先に Android APK でリリースし、iOS は同一コードで順次展開できる

## 次フェーズ候補
- ユーザー認証（JWT + Refresh Token）
- フォルダやタグ管理
- オフラインキャッシュ
- ページ位置の同期
- タブレット向け2カラムUI
