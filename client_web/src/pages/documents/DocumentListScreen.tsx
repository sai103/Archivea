import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { fetchDocuments, fetchGenres, type DocumentItem, type GenreItem } from '../../api/documents';
import './DocumentListScreen.css';

// バイト数を KB / MB / GB の読みやすい文字列へ変換する。
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ドキュメント一覧画面の読み込み状態を表す。
type LoadState =
  // API取得中。
  | { status: 'loading' }
  // API取得成功。画面表示に使うドキュメント一覧とジャンル一覧を持つ。
  | { status: 'success'; documents: DocumentItem[]; genres: GenreItem[] }
  // API取得またはレスポンス変換に失敗。
  | { status: 'error'; message: string };

/**
 * 登録済みドキュメントを検索、絞り込みし、閲覧画面へ遷移する一覧画面。
 */
export function DocumentListScreen() {
  // ドキュメント一覧とジャンル一覧の取得状態。
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  // ジャンル選択フォームで現在選ばれている値。
  const [selectedGenre, setSelectedGenre] = useState('');
  // タイトル検索フォームへ入力中の文字列。
  const [nameInput, setNameInput] = useState('');

  // 初回表示時にバックエンドからドキュメント一覧とジャンル一覧を取得する。
  useEffect(() => {
    let isActive = true;

    Promise.all([fetchDocuments(), fetchGenres()])
      .then(([documents, genres]) => {
        if (isActive) {
          setLoadState({ status: 'success', documents, genres });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          const message = error instanceof Error ? error.message : 'ブック情報を取得できません';
          setLoadState({ status: 'error', message });
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  // 取得済みドキュメントを、入力中のジャンル条件とタイトル条件でリアルタイムに絞り込む。
  const filteredDocuments = useMemo(() => {
    if (loadState.status !== 'success') {
      return [];
    }

    const normalizedName = nameInput.trim().toLowerCase();

    return loadState.documents.filter((document) => {
      const genre = document.genre ?? '';
      const matchesGenre = selectedGenre.length === 0 || genre === selectedGenre;
      const matchesName =
        normalizedName.length === 0 || document.title.toLowerCase().includes(normalizedName);

      return matchesGenre && matchesName;
    });
  }, [selectedGenre, loadState, nameInput]);

  return (
    <main className="documents-shell">
      <section className="documents-layout" aria-labelledby="documents-title">
        <header className="documents-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="documents-title">閲覧メニュー</h1>
          </div>
          <Link to="/menu" className="documents-back-link">
            メニューへ戻る
          </Link>
        </header>

        <div className="documents-search">
          <label className="documents-field">
            <span>ジャンル</span>
            <select
              value={selectedGenre}
              onChange={(event) => setSelectedGenre(event.target.value)}
              disabled={loadState.status !== 'success'}
            >
              <option value="">すべて</option>
              {loadState.status === 'success' &&
                loadState.genres.map((genre) => (
                  <option key={genre.name} value={genre.name}>
                    {genre.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="documents-field">
            <span>名前</span>
            <input
              type="search"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="タイトルで検索"
            />
          </label>
        </div>

        {loadState.status === 'loading' && <p className="documents-status">読み込み中です</p>}

        {loadState.status === 'error' && (
          <p className="documents-status documents-status-error" role="alert">
            {loadState.message}
          </p>
        )}

        {loadState.status === 'success' && filteredDocuments.length === 0 && (
          <p className="documents-status">条件に一致するファイルがありません</p>
        )}

        {loadState.status === 'success' && filteredDocuments.length > 0 && (
          <nav className="documents-list" aria-label="閲覧ファイル">
            {filteredDocuments.map((document) => (
              <Link
                key={document.storedName}
                to={`/documents/${document.storedName}`}
                className="document-link"
              >
                <span className="document-title">{document.title}</span>
                {document.genre && <span className="document-genre">{document.genre}</span>}
                <span className="document-meta">
                  {document.mimeType}
                  {document.pageCount ? ` / ${document.pageCount}ページ` : ''}
                  {document.fileSize !== undefined ? ` / ${formatFileSize(document.fileSize)}` : ''}
                  {document.isSample && <span className="document-badge">仮データ</span>}
                </span>
              </Link>
            ))}
          </nav>
        )}
      </section>
    </main>
  );
}
