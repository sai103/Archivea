# DB仕様

## 目的

ArchiveaのDBは、ログインユーザーと権限制御、ドキュメントのメタデータ、画像ページの保存場所、ジャンルと閲覧条件、設定値を管理します。ファイル本体はDBへ保存せず、ファイルシステムに保存した実体の場所と属性をDBに保存します。

MVPではSQLiteを利用します。最終的にはMySQLへ移行する想定のため、SQLite固有の型、関数、暗黙の挙動に依存しすぎない設計を優先します。

## 基本方針

- DBにはファイル本体を保存しない。
- アップロードファイルの共通保存場所はDBで定義する。
- PDF、単体画像、EPUB、ZIP展開ページ、画像ディレクトリからコピーしたページはファイルシステムに保存する。
- DBには保存場所、MIME type、拡張子、ページ順、ジャンル、所有者、作成日時、更新日時などのメタデータを保存する。
- ドキュメント一覧APIと本文配信APIは、ログインユーザーの権限をDB情報から判定する。
- 管理画面で変更するジャンル、閲覧制限、設定値はDBに保存する。
- 生成データ、アップロードファイル、ローカルDBはGit管理に含めない。

## 必須テーブル

### `users`

ログインユーザーを保存します。

主なカラム:

- `id`: 主キー。
- `login_id`: ログインに使う一意なID。
- `display_name`: 画面表示名。
- `password_hash`: パスワードハッシュ。平文パスワードは保存しない。
- `role_id`: `roles.id`への参照。
- `max_age_rating`: ユーザーが閲覧できる年齢制限または閲覧レベル。
- `is_active`: ログイン可能なユーザーかどうか。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

### `roles`

ユーザーの基本ロールを保存します。

主なカラム:

- `id`: 主キー。
- `name`: `admin`、`user`などの一意なロール名。
- `can_upload_documents`: ドキュメント登録を許可するか。
- `can_manage_metadata`: タイトル、ジャンル、閲覧制限などの編集を許可するか。
- `can_manage_users`: ユーザーと権限設定の編集を許可するか。

MVPでは管理者ロールと一般ユーザーロールを最低限用意します。アップロード画面の表示可否とアップロードAPIの利用可否は、`can_upload_documents`を持つ管理者ロールで判定します。一般ユーザーにはアップロード画面への導線を表示せず、直接APIを呼び出された場合も拒否します。

### `genres`

ジャンルと閲覧条件を保存します。

主なカラム:

- `id`: 主キー。
- `name`: 一意なジャンル名。
- `description`: ジャンル説明。
- `age_rating`: 年齢制限または閲覧レベル。
- `is_restricted`: 制限付きジャンルかどうか。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

ジャンルはドキュメント一覧の絞り込みと、ユーザーごとの閲覧可否判定に利用します。

### `user_genre_permissions`

ユーザーごとの閲覧可能ジャンルを保存します。

主なカラム:

- `id`: 主キー。
- `user_id`: `users.id`への参照。
- `genre_id`: `genres.id`への参照。
- `can_view`: 対象ジャンルを閲覧できるか。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

`user_id`と`genre_id`の組み合わせは一意にします。

### `documents`

ドキュメント1冊分のメタデータを保存します。

主なカラム:

- `id`: 主キー。
- `title`: 一覧表示名。
- `document_type`: `pdf`、`image`、`epub`、`image_archive`などの種別。
- `mime_type`: 元ファイルまたは代表形式のMIME type。
- `extension`: 元ファイルまたは代表形式の拡張子。
- `storage_kind`: `file`、`directory`などの保存形態。
- `stored_name`: 保存先を特定する名前。実パス全体ではなく、アップロードルートからの相対識別子を基本にする。
- `genre_id`: `genres.id`への参照。
- `owner_user_id`: 登録ユーザーの`users.id`への参照。
- `age_rating`: ドキュメント単位の年齢制限。未設定の場合はジャンルの値を利用する。
- `page_count`: ページ数。ページ分割できる形式ではDBまたは生成処理で更新する。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

PDF、単体画像、EPUBは本文ファイルの保存場所を`stored_name`で示します。ZIPや画像ディレクトリのような複数ページ形式では、`stored_name`はページ群を保存したディレクトリを示します。

### `document_files`

ドキュメントに紐づく実ファイルまたはページファイルの保存場所と属性を保存します。

主なカラム:

- `id`: 主キー。
- `document_id`: `documents.id`への参照。
- `file_role`: `original`、`page`、`cover`などの役割。
- `page_index`: ページ順。ページファイルでは0始まりの整数にする。
- `original_filename`: 元ファイル名。
- `stored_path`: アップロードルートからの相対パス。
- `mime_type`: ファイルのMIME type。
- `extension`: 拡張子。
- `size_bytes`: ファイルサイズ。
- `created_at`: 作成日時。

画像ページを含むZIP、画像ディレクトリ、将来のEPUB内画像など、複数ファイルを持つ形式ではこのテーブルを使ってページ順と保存場所を管理します。

### `storage_locations`

アップロードファイルの共通保存場所を保存します。

主なカラム:

- `id`: 主キー。
- `name`: `default_uploads`などの一意な保存場所名。
- `base_path`: ファイル実体を保存する共通ルートパス。
- `is_active`: 現在利用する保存場所かどうか。
- `description`: 保存場所の説明。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

MVPでは通常、`is_active=true`の保存場所を1つだけ利用します。将来、保存先を追加する場合でも、ドキュメントやページファイルは`document_files.stored_path`に共通ルートからの相対パスを保存し、共通ルートそのものは`storage_locations.base_path`で管理します。

アプリケーション起動に最低限必要な初期値として、ローカル実行では`backend/uploads/`相当の保存場所を登録します。Dockerや本番環境では、同じテーブルの`base_path`を環境に合わせて設定します。

### `app_settings`

設定画面で扱うアプリケーション設定を保存します。

主なカラム:

- `id`: 主キー。
- `key`: 一意な設定キー。
- `value`: 設定値。文字列として保存し、必要に応じてアプリケーション側で型変換する。
- `value_type`: `string`、`number`、`boolean`、`json`など。
- `updated_by_user_id`: 最終更新ユーザーの`users.id`への参照。
- `created_at`: 作成日時。
- `updated_at`: 更新日時。

環境変数は実行環境ごとの差分に限定します。ユーザーが設定画面で変更する値はこのテーブルに保存します。

## 権限制御の判定

ドキュメント一覧APIと本文配信APIは、少なくとも次を確認します。

1. ユーザーが有効でログイン済みであること。
2. 管理者以外のユーザーでは、`user_genre_permissions`で対象ジャンルの閲覧が許可されていること。
3. ユーザーの`max_age_rating`が、ジャンルまたはドキュメントの`age_rating`を満たすこと。
4. ファイル登録、メタデータ編集、ユーザー管理では`roles`の管理権限を満たすこと。
5. アップロード画面の表示とアップロードAPIの実行では、`roles.can_upload_documents`を満たすこと。

一覧APIだけでなく、本文配信APIとページ配信APIでも同じ権限判定を行います。URLを直接指定された場合でも権限外の本文は返しません。

## ファイル保存場所

ファイル実体は、`storage_locations`で定義した共通保存場所の配下に保存します。ローカル実装では現時点で`backend/uploads/`を使っていますが、この場所もDB上の保存場所定義として扱います。Docker対応後は、初期データまたは管理画面から環境に応じた共通保存場所を設定できるようにします。

`documents`や`document_files`には、原則として共通保存場所からの相対パスまたは相対識別子を保存します。共通保存場所そのものは`storage_locations.base_path`に保存します。これにより、Dockerボリューム、ローカル実行、本番環境で保存ルートが変わっても、保存場所定義を更新することでDB内容を移行しやすくします。

## インデックスと一意制約

最低限、次を設定します。

- `users.login_id`は一意。
- `roles.name`は一意。
- `genres.name`は一意。
- `user_genre_permissions`の`user_id`と`genre_id`の組み合わせは一意。
- `documents.genre_id`、`documents.created_at`には一覧取得用のインデックスを検討する。
- `document_files.document_id`と`document_files.page_index`にはページ取得用のインデックスを設定する。
- `storage_locations.name`は一意。
- `storage_locations.is_active`は有効な保存場所取得用のインデックスを検討する。
- `app_settings.key`は一意。

## 今後の移行

現行実装には簡易的な`documents`と`genres`があります。今後、ログイン、権限制御、管理画面、アップロード機能を拡張するタイミングで、この仕様に沿ってテーブルを追加・移行します。
