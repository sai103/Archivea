# Archivea

Androidスマホ向けブックリーダー（PDF/JPG/ZIP内JPG） + API の初期実装です。将来のiOS展開を見据えて、モバイルは Flutter を採用しています。

## ディレクトリ
- `backend/`: FastAPI でのファイル管理API
- `client_flutter/`: Flutter モバイルアプリ（Android先行）
- `docs/android-first-architecture.md`: 構成と方針

## ビューア機能
- PDF表示
- JPG表示
- ZIP内JPG表示（ファイル名順）
- 画面幅が広い場合（900px以上）は、ZIPビューアで1ページ/2ページ表示を画面上のボタンで切替可能

## 起動手順（API）
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 起動手順（Flutter）
```bash
cd client_flutter
flutter pub get
flutter run
```

Android エミュレータから API に接続する場合、`10.0.2.2:8000` を利用してください。
