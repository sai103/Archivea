import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { fetchDocuments, fetchGenres, type DocumentItem, type GenreItem } from '../../api/documents';
import './DocumentListScreen.css';

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
  // 検索実行後に適用されるジャンル条件。
  const [genreQuery, setGenreQuery] = useState('');
  // 検索実行後に適用されるタイトル条件。
  const [nameQuery, setNameQuery] = useState('');

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
          const message = error instanceof Error ? error.message : '一覧を取得できませんでした';
          setLoadState({ status: 'error', message });
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  // 取得済みドキュメントを、検索実行済みのジャンル条件とタイトル条件で絞り込む。
  const filteredDocuments = useMemo(() => {
    if (loadState.status !== 'success') {
      return [];
    }

    const normalizedName = nameQuery.trim().toLowerCase();

    return loadState.documents.filter((document) => {
      const genre = document.genre ?? '';
      const matchesGenre = genreQuery.length === 0 || genre === genreQuery;
      const matchesName =
        normalizedName.length === 0 || document.title.toLowerCase().includes(normalizedName);

      return matchesGenre && matchesName;
    });
  }, [genreQuery, loadState, nameQuery]);

  /**
   * 検索フォーム送信時の処理。
   * 入力中の値を検索条件として確定させ、filteredDocumentsの再計算を発生させる。
   */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGenreQuery(selectedGenre);
    setNameQuery(nameInput);
  };

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

        <form className="documents-search" onSubmit={handleSearch}>
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
                  <option key={genre.id} value={genre.name}>
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

          <button type="submit" className="documents-search-button">
            検索
          </button>
        </form>

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
                key={document.id}
                to={`/documents/${document.id}`}
                className="document-link"
              >
                <span className="document-title">{document.title}</span>
                <span className="document-meta">
                  {document.genre ? `${document.genre} / ` : ''}
                  {document.mimeType}
                  {document.pageCount ? ` / ${document.pageCount}ページ` : ''}
                </span>
                {document.isSample && <span className="document-badge">仮データ</span>}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </main>
  );
}
