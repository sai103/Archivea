# Archivea Flutter Client

将来のiOS/Androidアプリ向けに維持するFlutterクライアントです。最初の提供対象は`client_web/`のChrome Webフロントエンドであり、このクライアントは同じバックエンドAPI契約を再利用します。

## セットアップ

```bash
cd client_flutter
flutter pub get
flutter run
```

## 確認コマンド

```bash
flutter analyze
flutter test
```

テストが存在しない段階でも、Flutterコードを変更した場合は`flutter analyze`を実行して静的解析を確認します。

## プロジェクト固有情報

- PDF、画像、EPUB、ZIPページの配信経路はバックエンドAPIと互換性を保つ
- APIモデルをFlutter側だけで独自に分岐させず、Chrome Webフロントエンドと共有するAPI契約を優先する
- Androidエミュレータからホスト側APIへ接続する場合は`http://10.0.2.2:8000`を利用する
- DockerはバックエンドとChrome Web開発の標準経路とし、Flutterのデバイス実行はネイティブ環境を前提にする
