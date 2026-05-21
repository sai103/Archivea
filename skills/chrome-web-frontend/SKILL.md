# Chrome Webフロントエンドスキル

## 使用する場面

ArchiveaのChromeブラウザ向けフロントエンドを作成、変更、実行、テストする場合にこのスキルを使います。

## 目的

Archiveaの最初の本番経路として、Chromeで快適に動作するWebフロントエンドを構築します。プロジェクト方針が変わらない限り、React、TypeScript、Viteを使います。

## コーディング規約

TypeScriptとReactの実装では、`docs/typescript-react-coding-rules.md` に従います。Reactのルールに反する実装を許容するために、コンポーネントの直接呼び出し、レンダー中の副作用、条件分岐内のHook呼び出しを追加しません。

## 想定スタック

- React `19.2.6`
- TypeScript `6.0.3`
- Vite `8.0.13`
- Vite Reactプラグイン `@vitejs/plugin-react` `6.0.2`
- Playwrightによるブラウザテスト
- VitestとReact Testing Libraryによる単体/コンポーネントテスト

React、TypeScript、Viteは最新の安定版を利用します。作業時点でnpm registryのlatestが変わっている場合は、ドキュメントと`client_web/package.json`を同時に更新します。

## 作成手順

`client_web/`が存在しない場合は、ViteのReact TypeScriptアプリとしてスキャフォールドします。フロントエンドは`backend/`から分離し、WebソースをFastAPIプロジェクト内に混在させません。

想定構成:

```text
client_web/
  src/
  public/
  package.json
  vite.config.ts
  tsconfig.json
```

## 画面作成

Chrome Webフロントエンドでは、次の画面を基本構成として作成します。

- ログイン画面: 認証情報を入力し、ログイン後にジャンル選択画面へ遷移する。
- ジャンル選択画面: 閲覧するジャンルを選択する。ジャンル選択後に該当ドキュメントの閲覧導線を出す。
- 設定画面: API接続先、表示モード、閲覧設定などを変更する。
- 画像表示画面: PDF、JPG/PNG/WebP、EPUB、ZIPページを表示する。ZIPでは1ページ/2ページ表示を扱う。

画面間の遷移は、後から認証やジャンルAPIを追加しやすいように、状態管理とAPI呼び出しを画面コンポーネントへ直接閉じ込めすぎない構成にします。

## API連携

バックエンドのベースURLは環境設定から読み込みます。ブラウザビルドでは`VITE_API_BASE_URL`を優先します。

フロントエンドは次のバックエンドエンドポイントを利用します。

- `GET /documents`
- `GET /documents/{id}/content`
- `GET /documents/{id}/pages`
- `GET /documents/{id}/pages/{page_index}/content`

ZIP展開やドキュメント順序のロジックをブラウザ側で重複実装しないでください。これらの振る舞いはバックエンドが責務を持ちます。

## ローカル実行

Docker対応前の開発フローは次を想定します。

```bash
cd client_web
npm install
npm run dev
```

Docker対応後は次を優先します。

```bash
docker compose up --build
```

## Chrome確認

変更はChrome、またはChromiumベースの自動ブラウザで確認します。ビューア作業では、デスクトップ幅と狭い幅の両方を確認します。

最低限の確認項目:

- ログイン画面が表示される。
- ジャンル選択画面へ遷移できる。
- 設定画面を開ける。
- ドキュメント一覧が表示される。
- PDFを開ける。
- JPG/PNG/WebPを開ける。
- EPUBを開ける。
- ZIPページがファイル名順で開ける。
- 実装後、広い画面幅でZIPの2ページ表示に対応できる。

## テスト

データ変換や状態管理には焦点を絞った単体テストを使います。ブラウザ表示や画面遷移の確認にはPlaywrightを使います。

ブラウザ確認が現実的に可能な場合、ビルドが通っただけでフロントエンド作業を完了扱いにしないでください。ビューア画面を実際に開いて確認します。
