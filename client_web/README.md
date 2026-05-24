# Archivea Chrome Web

Archiveaの最初の提供対象となるChromeブラウザ向けWebフロントエンドです。React、TypeScript、Viteで構成し、バックエンドAPIと分離して開発します。

## セットアップ

```bash
cd client_web
npm install
npm run dev
```

Vite開発サーバーは`5173`番ポートで起動します。ブラウザからバックエンドAPIを利用する場合は、別途`backend/`のAPIを起動します。

## 実行コマンド

```bash
npm run dev
npm run build
npm run preview
```

- `npm run dev`: 開発サーバーを起動する
- `npm run build`: TypeScriptのビルド確認とViteビルドを実行する
- `npm run preview`: ビルド成果物をローカルでプレビューする

## プロジェクト固有情報

- 画面ソースは`src/pages/<画面名>/`を基本配置にする
- 現行の初期画面はログイン画面とメニュー画面を持つ
- API接続を追加する場合は、バックエンドのAPI契約を優先し、ZIP展開やページ順序のロジックをブラウザ側で重複実装しない
- ブラウザ向けAPIベースURLは`VITE_API_BASE_URL`で設定できる構成を前提にする

ReactとTypeScriptの実装規約は`../docs/typescript-react-coding-rules.md`を参照してください。
