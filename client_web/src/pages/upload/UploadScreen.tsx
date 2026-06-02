import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { fetchGenres, uploadDirectory, uploadDocument } from '../../api/documents';
import type { GenreItem } from '../../api/documents';
import './UploadScreen.css';

// アップロード画面の送信状態を表す。
type SubmitState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'error'; message: string };

// アップロードモードを表す。
type UploadMode = 'file' | 'directory';

// アップロード対象として受け付けるファイル形式。
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.epub,.zip';

/**
 * ファイルをアップロードしてバックエンドDBに登録する画面。
 */
export function UploadScreen() {
  const navigate = useNavigate();

  // アップロードモード（ファイル単体 / ディレクトリ）。
  const [mode, setMode] = useState<UploadMode>('file');
  // 選択されたファイル（ファイルモード）。
  const [file, setFile] = useState<File | null>(null);
  // 選択されたファイル一覧（ディレクトリモード）。
  const [dirFiles, setDirFiles] = useState<File[]>([]);
  // タイトル入力欄の値。ファイル選択時にファイル名から自動設定される。
  const [title, setTitle] = useState('');
  // 選択されたジャンルID。未選択時はundefined。
  const [genreId, setGenreId] = useState<number | undefined>(undefined);
  // バックエンドから取得したジャンル一覧。
  const [genres, setGenres] = useState<GenreItem[]>([]);
  // 送信状態。
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  // ディレクトリ入力用のref（webkitdirectory属性をDOMに直接セットするため）。
  const dirInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {
      // ジャンル取得失敗時はドロップダウンを空にして続行する。
    });
  }, []);

  useEffect(() => {
    // ディレクトリ入力要素にwebkitdirectory属性を付与する（TypeScript型定義外のため直接操作）。
    if (dirInputRef.current) {
      dirInputRef.current.setAttribute('webkitdirectory', '');
    }
  }, []);

  const handleModeChange = (next: UploadMode) => {
    setMode(next);
    setFile(null);
    setDirFiles([]);
    setTitle('');
    setSubmitState({ status: 'idle' });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected !== null) {
      setTitle(selected.name.replace(/\.[^.]+$/, ''));
    }
    setSubmitState({ status: 'idle' });
  };

  const handleDirectoryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      setDirFiles([]);
      setTitle('');
      return;
    }
    const all = Array.from(fileList);
    setDirFiles(all);
    // webkitRelativePath の最初のセグメント（ディレクトリ名）をタイトルの初期値にする。
    const dirName = all[0].webkitRelativePath.split('/')[0];
    setTitle(dirName);
    setSubmitState({ status: 'idle' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState({ status: 'uploading' });
    try {
      if (mode === 'file') {
        if (file === null) return;
        await uploadDocument(title.trim() || file.name, file, genreId);
      } else {
        if (dirFiles.length === 0) return;
        await uploadDirectory(title.trim() || dirFiles[0].webkitRelativePath.split('/')[0], dirFiles, genreId);
      }
      navigate('/documents');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'アップロードに失敗しました';
      setSubmitState({ status: 'error', message });
    }
  };

  const canSubmit = mode === 'file' ? file !== null : dirFiles.length > 0;

  return (
    <main className="upload-shell">
      <section className="upload-layout" aria-labelledby="upload-title">
        <header className="upload-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="upload-title">アップロード</h1>
          </div>
          <Link to="/menu" className="upload-back-link">
            メニューへ戻る
          </Link>
        </header>

        <form className="upload-form" onSubmit={(e) => void handleSubmit(e)}>
          {/* モード切り替え */}
          <div className="upload-mode-toggle" role="group" aria-label="アップロード方法">
            <button
              type="button"
              className={`upload-mode-button${mode === 'file' ? ' upload-mode-button--active' : ''}`}
              onClick={() => handleModeChange('file')}
              disabled={submitState.status === 'uploading'}
            >
              ファイル
            </button>
            <button
              type="button"
              className={`upload-mode-button${mode === 'directory' ? ' upload-mode-button--active' : ''}`}
              onClick={() => handleModeChange('directory')}
              disabled={submitState.status === 'uploading'}
            >
              フォルダ
            </button>
          </div>

          {/* ファイル選択 */}
          {mode === 'file' ? (
            <label className="upload-field">
              <span>ファイル</span>
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileChange}
                disabled={submitState.status === 'uploading'}
              />
              <span className="upload-hint">PDF / JPG / PNG / WebP / EPUB / ZIP</span>
            </label>
          ) : (
            <label className="upload-field">
              <span>フォルダ</span>
              <input
                ref={dirInputRef}
                type="file"
                multiple
                onChange={handleDirectoryChange}
                disabled={submitState.status === 'uploading'}
              />
              {dirFiles.length > 0 && (
                <span className="upload-hint">{dirFiles.length}個のファイルを選択中</span>
              )}
              <span className="upload-hint">フォルダ内の JPG / PNG / WebP をページとして登録します</span>
            </label>
          )}

          <label className="upload-field">
            <span>タイトル</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ブックのタイトルを入力"
              disabled={submitState.status === 'uploading'}
            />
          </label>

          <label className="upload-field">
            <span>ジャンル</span>
            <select
              value={genreId ?? ''}
              onChange={(event) => {
                const val = event.target.value;
                setGenreId(val === '' ? undefined : Number(val));
              }}
              disabled={submitState.status === 'uploading'}
            >
              <option value="">未設定</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </label>

          {submitState.status === 'error' && (
            <p className="upload-error" role="alert">
              {submitState.message}
            </p>
          )}

          <button
            type="submit"
            className="upload-button"
            disabled={!canSubmit || submitState.status === 'uploading'}
          >
            {submitState.status === 'uploading' ? 'アップロード中...' : 'アップロード'}
          </button>
        </form>
      </section>
    </main>
  );
}
