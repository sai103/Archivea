import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createGenre, deleteDocument, deleteGenre, fetchDocuments, fetchGenres, patchDocumentGenre } from '../../api/documents';
import type { DocumentItem, GenreItem } from '../../api/documents';
import { fetchSettings, updateSettings } from '../../api/settings';
import './SettingsScreen.css';

/**
 * アプリケーション設定画面。
 * ジャンルの追加・削除とファイル保存先の管理を行う。
 */
export function SettingsScreen() {
  // ジャンル一覧。
  const [genres, setGenres] = useState<GenreItem[]>([]);
  // ジャンル一覧の読み込み中フラグ。
  const [genresLoading, setGenresLoading] = useState(true);
  // ジャンル操作のエラーメッセージ。
  const [genreError, setGenreError] = useState('');
  // 新規ジャンル入力欄の値。
  const [newGenreName, setNewGenreName] = useState('');
  // 追加中フラグ。
  const [adding, setAdding] = useState(false);
  // 追加入力欄への参照（追加後にフォーカスを戻す用）。
  const addInputRef = useRef<HTMLInputElement>(null);

  // 削除対象として選択中のジャンルID。
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | ''>('');
  // 削除確認モーダルの表示フラグ。
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // 削除処理中フラグ。
  const [deleting, setDeleting] = useState(false);

  // ジャンル変更セクション用の状態。
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  // 本の絞り込みテキスト。
  const [docFilter, setDocFilter] = useState('');
  // 変更対象として選択中のドキュメントID一覧（複数選択可）。
  const [changeDocId, setChangeDocId] = useState<number[]>([]);
  // 変更後ジャンルID（''は未分類）。
  const [changeGenreId, setChangeGenreId] = useState<number | ''>('');
  // ジャンル変更中フラグ。
  const [changing, setChanging] = useState(false);
  // ジャンル変更操作のエラーメッセージ。
  const [changeError, setChangeError] = useState('');
  // ジャンル変更操作の成功メッセージ。
  const [changeMessage, setChangeMessage] = useState('');
  // 本削除確認モーダルの表示フラグ。
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  // 本削除処理中フラグ。
  const [deletingDoc, setDeletingDoc] = useState(false);

  // ファイル保存先ディレクトリ。
  const [storageDir, setStorageDir] = useState('');
  // 保存先フォームの読み込み中フラグ。
  const [storageDirLoading, setStorageDirLoading] = useState(true);
  // 保存先フォームの保存中フラグ。
  const [storageDirSaving, setStorageDirSaving] = useState(false);
  // 保存先フォームのエラーメッセージ。
  const [storageDirError, setStorageDirError] = useState('');
  // 保存先フォームの成功メッセージ。
  const [storageDirMessage, setStorageDirMessage] = useState('');

  useEffect(() => {
    fetchGenres()
      .then(setGenres)
      .catch(() => setGenreError('ジャンル一覧を取得できませんでした'))
      .finally(() => setGenresLoading(false));

    fetchSettings()
      .then((s) => setStorageDir(s.storageDir))
      .catch(() => setStorageDirError('設定を取得できませんでした'))
      .finally(() => setStorageDirLoading(false));

    fetchDocuments()
      .then(setDocuments)
      .catch(() => { /* ドキュメント一覧取得失敗時は空のまま表示 */ })
      .finally(() => setDocumentsLoading(false));
  }, []);

  const handleAddGenre = async () => {
    const name = newGenreName.trim();
    if (name === '' || adding) return;
    setAdding(true);
    setGenreError('');
    try {
      const created = await createGenre(name);
      setGenres((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ja')));
      setNewGenreName('');
      addInputRef.current?.focus();
    } catch (error) {
      setGenreError(error instanceof Error ? error.message : 'ジャンルの追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  const handleAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleAddGenre();
    }
  };

  // 削除ボタン押下: モーダルを表示する。
  const handleDeleteRequest = () => {
    if (selectedDeleteId === '') return;
    setGenreError('');
    setShowDeleteModal(true);
  };

  // モーダルで「はい」を押下: 削除を実行する。
  const handleDeleteConfirm = async () => {
    if (selectedDeleteId === '' || deleting) return;
    setDeleting(true);
    setGenreError('');
    try {
      await deleteGenre(selectedDeleteId);
      setGenres((prev) => prev.filter((g) => g.id !== selectedDeleteId));
      setSelectedDeleteId('');
      setShowDeleteModal(false);
    } catch (error) {
      setGenreError(error instanceof Error ? error.message : 'ジャンルの削除に失敗しました');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  // モーダルで「いいえ」を押下: キャンセルする。
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleChangeGenre = async () => {
    if (changeDocId.length === 0 || changing) return;
    setChanging(true);
    setChangeError('');
    setChangeMessage('');
    try {
      const genreId = changeGenreId === '' ? null : changeGenreId;
      await Promise.all(changeDocId.map((id) => patchDocumentGenre(id, genreId)));
      const newGenreName = genres.find((g) => g.id === changeGenreId)?.name;
      setDocuments((prev) =>
        prev.map((d) =>
          changeDocId.includes(d.id) ? { ...d, genre: newGenreName } : d
        )
      );
      setChangeMessage(`${changeDocId.length}件を変更しました`);
    } catch (error) {
      setChangeError(error instanceof Error ? error.message : 'ジャンルの変更に失敗しました');
    } finally {
      setChanging(false);
    }
  };

  const handleDeleteDocRequest = () => {
    if (changeDocId.length === 0) return;
    setChangeError('');
    setShowDeleteDocModal(true);
  };

  const handleDeleteDocConfirm = async () => {
    if (changeDocId.length === 0 || deletingDoc) return;
    setDeletingDoc(true);
    setChangeError('');
    setChangeMessage('');
    try {
      await Promise.all(changeDocId.map((id) => deleteDocument(id)));
      setDocuments((prev) => prev.filter((d) => !changeDocId.includes(d.id)));
      const count = changeDocId.length;
      setChangeDocId([]);
      setShowDeleteDocModal(false);
      setChangeMessage(`${count}冊を削除しました`);
    } catch (error) {
      setChangeError(error instanceof Error ? error.message : '本の削除に失敗しました');
      setShowDeleteDocModal(false);
    } finally {
      setDeletingDoc(false);
    }
  };

  const handleStorageDirSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (storageDirSaving) return;
    setStorageDirSaving(true);
    setStorageDirError('');
    setStorageDirMessage('');
    try {
      await updateSettings({ storageDir });
      setStorageDirMessage('保存しました');
    } catch (error) {
      setStorageDirError(error instanceof Error ? error.message : '保存に失敗しました');
    } finally {
      setStorageDirSaving(false);
    }
  };

  const selectedGenreName = genres.find((g) => g.id === selectedDeleteId)?.name ?? '';

  const filteredDocuments = docFilter.trim() === ''
    ? documents
    : documents.filter((d) => d.title.toLowerCase().includes(docFilter.trim().toLowerCase()));

  return (
    <main className="settings-shell">
      <section className="settings-layout" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="settings-title">設定</h1>
          </div>
          <Link to="/menu" className="secondary-link">
            メニューへ戻る
          </Link>
        </header>

        {/* ジャンル管理 */}
        <section className="settings-section genre-section" aria-labelledby="genre-section-title">
          <h2 id="genre-section-title" className="settings-section-title">ジャンル</h2>

          {genreError && (
            <p className="settings-error" role="alert">{genreError}</p>
          )}

          {/* ジャンル削除: プルダウン選択 */}
          <div className="genre-delete-row">
            <label htmlFor="genre-delete-select" className="genre-row-label">削除するジャンル</label>
            {genresLoading ? (
              <p className="settings-loading">読み込み中...</p>
            ) : (
              <div className="genre-delete-controls">
                <select
                  id="genre-delete-select"
                  className="genre-select"
                  value={selectedDeleteId}
                  onChange={(e) => setSelectedDeleteId(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={deleting || genres.length === 0}
                >
                  <option value="">-- ジャンルを選択 --</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>{genre.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="genre-delete-button"
                  onClick={handleDeleteRequest}
                  disabled={selectedDeleteId === '' || deleting}
                >
                  {deleting ? '削除中...' : '削除'}
                </button>
              </div>
            )}
          </div>

          {/* ジャンル追加 */}
          <div className="genre-add-row">
            <label htmlFor="genre-add-input" className="genre-row-label">新しいジャンル</label>
            <div className="genre-delete-controls">
              <input
                id="genre-add-input"
                ref={addInputRef}
                type="text"
                className="genre-add-input"
                value={newGenreName}
                onChange={(event) => setNewGenreName(event.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="ジャンル名を入力"
                disabled={adding}
                aria-label="新しいジャンル名"
              />
              <button
                type="button"
                className="genre-add-button"
                onClick={() => void handleAddGenre()}
                disabled={newGenreName.trim() === '' || adding}
              >
                {adding ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </section>

        {/* 本の管理（ジャンル変更・削除） */}
        <section className="settings-section genre-section" aria-labelledby="genre-change-section-title">
          <h2 id="genre-change-section-title" className="settings-section-title">本の管理</h2>

          {changeError && (
            <p className="settings-error" role="alert">{changeError}</p>
          )}
          {changeMessage && (
            <p className="settings-message" role="status">{changeMessage}</p>
          )}

          <div className="genre-delete-row">
            <label htmlFor="change-doc-filter" className="genre-row-label">本</label>
            {documentsLoading ? (
              <p className="settings-loading">読み込み中...</p>
            ) : (
              <div className="doc-select-stack">
                <input
                  id="change-doc-filter"
                  type="text"
                  className="genre-add-input"
                  value={docFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDocFilter(val);
                    // 絞り込み変更で非表示になったIDを選択から除外する。
                    if (changeDocId.length > 0) {
                      const lower = val.trim().toLowerCase();
                      const still = changeDocId.filter((id) => {
                        const doc = documents.find((d) => d.id === id);
                        return doc && (lower === '' || doc.title.toLowerCase().includes(lower));
                      });
                      if (still.length !== changeDocId.length) {
                        setChangeDocId(still);
                        setChangeMessage('');
                      }
                    }
                  }}
                  placeholder="タイトルで絞り込み"
                  disabled={changing || documents.length === 0}
                  aria-label="本のタイトルで絞り込み"
                />
                <select
                  id="change-doc-select"
                  className="genre-select"
                  multiple
                  value={changeDocId.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                    setChangeDocId(selected);
                    setChangeMessage('');
                    // 1件のみ選択の場合は現在のジャンルを初期値にセットする。
                    if (selected.length === 1) {
                      const doc = documents.find((d) => d.id === selected[0]);
                      const currentGenre = genres.find((g) => g.name === doc?.genre);
                      setChangeGenreId(currentGenre ? currentGenre.id : '');
                    }
                  }}
                  disabled={changing || filteredDocuments.length === 0}
                  size={Math.min(filteredDocuments.length, 6) || 3}
                >
                  {filteredDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
                <p className="doc-select-hint">Ctrl（Mac: ⌘）を押しながらクリックで複数選択</p>
              </div>
            )}
          </div>

          <div className="genre-delete-row">
            <label htmlFor="change-genre-select" className="genre-row-label">ジャンル</label>
            <select
              id="change-genre-select"
              className="genre-select"
              value={changeGenreId}
              onChange={(e) => {
                setChangeGenreId(e.target.value === '' ? '' : Number(e.target.value));
                setChangeMessage('');
              }}
              disabled={changing || changeDocId.length === 0}
            >
              <option value="">なし</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteDocRequest}
              disabled={changeDocId.length === 0 || changing || deletingDoc}
            >
              削除
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleChangeGenre()}
              disabled={changeDocId.length === 0 || changing || deletingDoc}
            >
              {changing ? '変更中...' : 'ジャンル変更'}
            </button>
          </div>
        </section>

        {/* ファイル保存先 */}
        <form className="settings-form" onSubmit={(e) => void handleStorageDirSubmit(e)}>
          <fieldset className="settings-section">
            <legend>ストレージ</legend>
            <label className="settings-field">
              <span>ファイル保存先ディレクトリ</span>
              {storageDirLoading ? (
                <p className="settings-loading">読み込み中...</p>
              ) : (
                <input
                  type="text"
                  value={storageDir}
                  onChange={(event) => {
                    setStorageDir(event.target.value);
                    setStorageDirMessage('');
                  }}
                  placeholder="/path/to/uploads"
                  disabled={storageDirSaving}
                />
              )}
            </label>

            {storageDirError && (
              <p className="settings-error" role="alert">{storageDirError}</p>
            )}
            {storageDirMessage && (
              <p className="settings-message" role="status">{storageDirMessage}</p>
            )}
          </fieldset>

          <div className="settings-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={storageDirLoading || storageDirSaving}
            >
              {storageDirSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </section>

      {/* 本削除確認モーダル */}
      {showDeleteDocModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-doc-modal-title">
          <div className="modal-box">
            <h2 id="delete-doc-modal-title" className="modal-title">本の削除</h2>
            <p className="modal-message">
              選択した{changeDocId.length}冊を削除しますか？
            </p>
            <ul className="modal-doc-list">
              {changeDocId.map((id) => {
                const doc = documents.find((d) => d.id === id);
                return doc ? <li key={id}>{doc.title}</li> : null;
              })}
            </ul>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button modal-button--cancel"
                onClick={() => setShowDeleteDocModal(false)}
                disabled={deletingDoc}
              >
                いいえ
              </button>
              <button
                type="button"
                className="modal-button modal-button--confirm"
                onClick={() => void handleDeleteDocConfirm()}
                disabled={deletingDoc}
              >
                {deletingDoc ? '削除中...' : 'はい'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ジャンル削除確認モーダル */}
      {showDeleteModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-box">
            <h2 id="delete-modal-title" className="modal-title">ジャンルの削除</h2>
            <p className="modal-message">
              「{selectedGenreName}」を本当に削除しますか？
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button modal-button--cancel"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                いいえ
              </button>
              <button
                type="button"
                className="modal-button modal-button--confirm"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
              >
                {deleting ? '削除中...' : 'はい'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
