import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { fetchDocuments, fetchGenres, type DocumentItem, type GenreItem } from '../../api/documents';
import './DocumentListScreen.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'success'; documents: DocumentItem[]; genres: GenreItem[] }
  | { status: 'error'; message: string };

export function DocumentListScreen() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [selectedGenre, setSelectedGenre] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [genreQuery, setGenreQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');

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
