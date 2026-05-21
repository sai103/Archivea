# Flutterモバイルスキル

## 使用する場面

ArchiveaのFlutterモバイルアプリを作成、変更、実行、テストする場合にこのスキルを使います。

## 目的

Flutterは将来のiOS/Androidアプリ向け経路として維持します。Chromeブラウザ対応は`client_web/`で扱い、Flutterを主なChromeフロントエンドにはしません。

## 想定スタック

- Flutter
- Dart
- 既存バックエンドAPI
- Android先行、iOSは後続

## プロジェクト場所

Flutterソースは次に置きます。

```text
client_flutter/
```

Flutterコードを`client_web/`やバックエンドディレクトリに移動しないでください。

## 画面作成

Flutterモバイルアプリでも、Chrome Webフロントエンドと同じ画面概念を維持します。

- ログイン画面: 認証情報を入力し、ログイン後にジャンル選択画面へ進む。
- ジャンル選択画面: 閲覧するジャンルを選択する。
- 設定画面: API接続先、表示モード、閲覧設定などを変更する。
- 画像表示画面: PDF、JPG/PNG/WebP、EPUB、ZIPページを表示する。

モバイルでは画面サイズとタッチ操作を優先しつつ、画面名と役割はChrome Webフロントエンドと揃えます。

## API連携

FlutterはChromeフロントエンドと同じバックエンドAPI契約を利用します。

- `GET /documents`
- `GET /documents/{id}/content`
- `GET /documents/{id}/pages`
- `GET /documents/{id}/pages/{page_index}/content`

Androidエミュレータからホスト側バックエンドへ接続する場合は、`http://10.0.2.2:8000`を使います。Dockerや実機で実行する場合に備え、ベースURLは永続的に1つの環境へハードコードせず、設定可能にします。

## ローカル実行

想定するローカルコマンド:

```bash
cd client_flutter
flutter pub get
flutter run
```

Flutter変更を完了する前に静的解析を実行します。

```bash
cd client_flutter
flutter analyze
```

テストが存在する場合はテストも実行します。

```bash
cd client_flutter
flutter test
```

## Dockerでの位置づけ

DockerはバックエンドとChrome Web開発の標準ハーネスです。Flutterは将来CIやツール用途でDockerを使う可能性がありますが、デバイスやエミュレータのワークフローは実用性を優先してネイティブ実行のままでも構いません。

## 確認項目

Flutterのビューア変更では次を確認します。

- ログイン画面。
- ジャンル選択画面。
- 設定画面。
- ドキュメント一覧の読み込み。
- PDFビューア経路。
- JPG/PNG/WebPビューア経路。
- EPUBビューア経路。
- ZIPページビューア経路。
- AndroidエミュレータからのAPI接続。

明確なモバイル専用UX判断が文書化されていない限り、Flutterの振る舞いはChromeフロントエンドと揃えます。
