# Archivea エージェントガイド

## プロジェクト方針

Archivea は、PDF、JPG、PNG、WebP、EPUB、画像ページを含むZIPアーカイブを閲覧するためのブックリーダーです。最初の提供対象はChromeブラウザです。モバイルアプリは将来対象とし、FlutterはiOS/Android向けコードベースとして扱います。

## 現在の優先事項

1. React + TypeScript + ViteでChromeブラウザ向けフロントエンドを構築する。
2. ドキュメントのアップロード、一覧取得、本文配信APIとしてFastAPIを維持する。
3. 設定値と画像ファイルの保存場所はDBで管理する。
4. MVPではSQLiteを利用し、最終的にはMySQLへ移行できる設計にする。
5. ローカルセットアップをDockerで再現可能にする。
6. Flutterは将来のモバイルアプリ向けとして維持する。

## ハーネス優先

ハーネスは後付けの補助ではなく、プロジェクト本体の一部として扱います。有用なハーネスは、次の操作を予測可能にします。

- 1つのDockerコマンドでローカル環境全体を起動できる。
- バックエンド、Webフロントエンド、将来のFlutterチェックを文書化されたコマンドで実行できる。
- 手動確認と自動テスト用にサンプルPDF/JPG/PNG/WebP/EPUB/ZIPを投入できる。
- ChromeとFlutterクライアントが利用する同じAPI経路を検証できる。
- 生成データ、アップロードファイル、ローカルDBをソース管理に含めない。

## データ永続化

- MVPではSQLiteを利用する。
- 最終的な運用ではMySQLを利用する想定で設計する。
- 設定画面で扱う設定値はDBに保存する。
- アップロードされた画像ファイルや展開済みZIPページの実体はファイルシステムに保存し、その保存場所、MIME type、拡張子、並び順などのメタデータをDBに保存する。
- SQLite固有の実装に寄せすぎず、MySQL移行時にモデルとクエリを流用しやすい形を優先する。

## 想定するリポジトリ構成

- `backend/`: FastAPIアプリケーションとバックエンドテスト。
- `client_web/`: Chrome先行のWebフロントエンド。React + TypeScript + Viteを想定。
- `client_flutter/`: 将来のiOS/Android向けFlutterアプリケーション。
- `docs/`: プロジェクト概要、ハーネス設計、テスト戦略。
- `skills/`: 各クライアント領域で作業するエージェント向けの反復可能な手順。
- `docker-compose.yml`: 今後追加するローカル実行ハーネスの入口。

## エンジニアリングルール

- 大きな書き換えより、小さくテストしやすい変更を優先する。
- クライアント側にロジックを重複させる前に、API契約を明確にする。
- 振る舞いを変更した場所の近くにテストを追加する。
- ハーネス整備後は、Dockerを標準のセットアップ経路にする。
- Chromeが主対象の間もFlutterアプリは削除しない。プロジェクト方針が変わらない限り、Flutterはモバイル向け経路として維持する。

## Chrome Web作業

Chromeフロントエンドを扱う場合は、`skills/chrome-web-frontend/SKILL.md` に従います。Webフロントエンドは開発時にFastAPIを直接利用し、標準セットアップではDocker内で動作できるようにします。
React、TypeScript、Viteは最新の安定版を利用します。現時点の想定バージョンは、React `19.2.6`、TypeScript `6.0.3`、Vite `8.0.13`、`@vitejs/plugin-react` `6.0.2` です。

TypeScriptとReactの実装では、`docs/typescript-react-coding-rules.md` を規約として扱います。Reactの純粋性、Hookの呼び出し規則、props/stateの不変性を崩さず、TypeScriptの命名、型設計、`null`/`undefined`、書式規約を新規コードと変更コードで守ります。

Chrome Webの画面ソースは`client_web/src/pages/<画面名>/`に画面単位で配置します。画面固有のコンポーネント、Hook、スタイルは対応するページフォルダの近くに置きます。

## Flutter作業

Flutterモバイルアプリを扱う場合は、`skills/flutter-mobile/SKILL.md` に従います。FlutterはバックエンドAPIと互換性を保ち、APIが進化しない限り独自のドキュメントモデルを定義しないようにします。

## ドキュメント更新

アーキテクチャが変わった場合は、関連するドキュメントを更新します。
ドキュメント類は原則としてすべて日本語で作成・更新します。英語表記は、技術名、コマンド名、ライブラリ名、API名などの固有名詞に限ります。

- `docs/overview.md`: プロジェクト範囲と対象プラットフォーム。
- `docs/harness-design.md`: Docker、サービス、データ、実行コマンド。
- `docs/test-strategy.md`: 自動確認と手動確認の戦略。
