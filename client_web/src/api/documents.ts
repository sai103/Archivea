/**
 * 画面内で扱うドキュメント一覧アイテム。
 * バックエンドのsnake_caseレスポンスをcamelCaseへ変換した後の形。
 */
export interface DocumentItem {
  // バックエンドDB上のドキュメントID。
  id: number;
  // 一覧と閲覧画面に表示するタイトル。
  title: string;
  // ドキュメント形式を判定するMIME type。
  mimeType: string;
  // バックエンドが登録した作成日時。現状はアップロード日相当として表示する。
  createdAt: string;
  // ドキュメントに紐づくジャンル名。未設定の場合はundefined。
  genre?: string;
  // サンプルデータ表示用の著者名。APIデータでは未使用。
  author?: string;
  // サンプルデータ表示用の説明文。APIデータでは未使用。
  summary?: string;
  // ページ数。サンプルデータや将来のAPI拡張で利用する。
  pageCount?: number;
  // API接続失敗時の仮データかどうかを示す。
  isSample?: boolean;
}

/**
 * ZIP画像本または画像ディレクトリ本の1ページを表す画面用データ。
 */
export interface ZipPageItem {
  // 0始まりのページ番号。
  index: number;
  // バックエンドが管理するページファイル名。
  filename: string;
  // ページ本文APIの相対URL。
  contentUrl: string;
}

/**
 * EPUB内のspine順に並ぶ章を表す画面用データ。
 */
export interface EpubChapterItem {
  // 0始まりの章番号。
  index: number;
  // 章タイトル。現状はEPUB内ファイル名由来。
  title: string;
  // 章本文APIの相対URL。
  contentUrl: string;
}

/**
 * ジャンル選択UIで扱うジャンル情報。
 */
export interface GenreItem {
  // バックエンドDB上のジャンルID。
  id: number;
  // 一覧や検索条件に表示するジャンル名。
  name: string;
}

/**
 * GET /documents のバックエンドレスポンス形。
 */
interface DocumentResponse {
  id: number;
  title: string;
  mime_type: string;
  created_at: string;
  genre?: string;
}

/**
 * GET /documents/{id}/pages のバックエンドレスポンス形。
 */
interface ZipPageResponse {
  index: number;
  filename: string;
  content_url: string;
}

/**
 * GET /documents/{id}/epub/chapters のバックエンドレスポンス形。
 */
interface EpubChapterResponse {
  index: number;
  title: string;
  content_url: string;
}

/**
 * GET /genres のバックエンドレスポンス形。
 */
interface GenreResponse {
  id: number;
  name: string;
}

// API接続先のベースURL。環境変数が無い場合はViteプロキシの/apiを使う。
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

// API接続に失敗した場合でも画面確認を続けるための仮ドキュメント一覧。
const sampleDocuments: DocumentItem[] = [
  {
    id: 9001,
    title: '設計資料サンプル PDF',
    mimeType: 'application/pdf',
    createdAt: '2026-05-20T10:30:00.000Z',
    genre: '技術資料',
    author: 'Archivea Sample',
    summary: 'PDF閲覧画面の余白、ページ操作、メタ情報の表示を確認するための仮データです。',
    pageCount: 5,
    isSample: true,
  },
  {
    id: 9002,
    title: '表紙画像サンプル PNG',
    mimeType: 'image/png',
    createdAt: '2026-05-19T12:15:00.000Z',
    genre: '画像',
    author: 'Archivea Sample',
    summary: '単一画像を開いた時の表示領域と情報パネルを確認するための仮データです。',
    pageCount: 1,
    isSample: true,
  },
  {
    id: 9003,
    title: '連番ページサンプル ZIP',
    mimeType: 'application/zip',
    createdAt: '2026-05-18T18:00:00.000Z',
    genre: 'コミック',
    author: 'Archivea Sample',
    summary: 'ZIP内画像ページの一覧、前後移動、1ページ/2ページ表示を確認するための仮データです。',
    pageCount: 8,
    isSample: true,
  },
  {
    id: 9004,
    title: '電子書籍サンプル EPUB',
    mimeType: 'application/epub+zip',
    createdAt: '2026-05-17T09:45:00.000Z',
    genre: '書籍',
    author: 'Archivea Sample',
    summary: 'EPUBビューア未実装状態でも、詳細情報と今後の閲覧画面を確認するための仮データです。',
    pageCount: 12,
    isSample: true,
  },
];

// 仮ZIPドキュメントに対応するページ一覧。
const sampleZipPages: ZipPageItem[] = Array.from({ length: 8 }, (_, index) => ({
  index,
  filename: `${String(index + 1).padStart(3, '0')}.png`,
  contentUrl: `/sample-documents/9003/pages/${index}/content`,
}));

// API接続に失敗した場合でも検索UIを確認するための仮ジャンル一覧。
const sampleGenres: GenreItem[] = [
  { id: 1, name: '技術資料' },
  { id: 2, name: '画像' },
  { id: 3, name: 'コミック' },
  { id: 4, name: '書籍' },
];

/**
 * APIベースURLと各エンドポイントのパスを連結する。
 */
function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

/**
 * unknown値がオブジェクトとして扱えるかを判定する型ガード。
 * APIレスポンス検証の入口として使う。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * バックエンドのドキュメントレスポンスを画面用DocumentItemへ変換する。
 * 必須項目が不足している場合は例外にして、壊れたAPIレスポンスを画面内部へ持ち込まない。
 */
function readDocument(value: unknown): DocumentItem {
  if (!isRecord(value)) {
    throw new Error('ドキュメント情報の形式が正しくありません');
  }

  const response = value as Partial<DocumentResponse>;
  if (
    typeof response.id !== 'number' ||
    typeof response.title !== 'string' ||
    typeof response.mime_type !== 'string' ||
    typeof response.created_at !== 'string'
  ) {
    throw new Error('ドキュメント情報の必須項目が不足しています');
  }

  return {
    id: response.id,
    title: response.title,
    mimeType: response.mime_type,
    createdAt: response.created_at,
    genre: typeof response.genre === 'string' ? response.genre : undefined,
  };
}

/**
 * バックエンドのZIPページレスポンスを画面用ZipPageItemへ変換する。
 */
function readZipPage(value: unknown): ZipPageItem {
  if (!isRecord(value)) {
    throw new Error('ページ情報の形式が正しくありません');
  }

  const response = value as Partial<ZipPageResponse>;
  if (
    typeof response.index !== 'number' ||
    typeof response.filename !== 'string' ||
    typeof response.content_url !== 'string'
  ) {
    throw new Error('ページ情報の必須項目が不足しています');
  }

  return {
    index: response.index,
    filename: response.filename,
    contentUrl: response.content_url,
  };
}

/**
 * バックエンドのEPUB章レスポンスを画面用EpubChapterItemへ変換する。
 */
function readEpubChapter(value: unknown): EpubChapterItem {
  if (!isRecord(value)) {
    throw new Error('EPUB章情報の形式が正しくありません');
  }

  const response = value as Partial<EpubChapterResponse>;
  if (
    typeof response.index !== 'number' ||
    typeof response.title !== 'string' ||
    typeof response.content_url !== 'string'
  ) {
    throw new Error('EPUB章情報の必須項目が不足しています');
  }

  return {
    index: response.index,
    title: response.title,
    contentUrl: response.content_url,
  };
}

/**
 * バックエンドのジャンルレスポンスを画面用GenreItemへ変換する。
 */
function readGenre(value: unknown): GenreItem {
  if (!isRecord(value)) {
    throw new Error('ジャンル情報の形式が正しくありません');
  }

  const response = value as Partial<GenreResponse>;
  if (typeof response.id !== 'number' || typeof response.name !== 'string') {
    throw new Error('ジャンル情報の必須項目が不足しています');
  }

  return {
    id: response.id,
    name: response.name,
  };
}

/**
 * PDF、単体画像、EPUB元ファイルなどの本文配信URLを組み立てる。
 */
export function getContentUrl(documentId: number) {
  return buildApiUrl(`/documents/${documentId}/content`);
}

/**
 * ZIP画像本または画像ディレクトリ本のページ本文URLを組み立てる。
 */
export function getPageContentUrl(contentUrl: string) {
  return buildApiUrl(contentUrl);
}

/**
 * EPUB章本文URLを組み立てる。
 */
export function getEpubChapterContentUrl(contentUrl: string) {
  return buildApiUrl(contentUrl);
}

/**
 * 対象ドキュメントがAPI接続失敗時の仮データかどうかを判定する。
 */
export function isSampleDocument(document: DocumentItem) {
  return document.isSample === true;
}

/**
 * 仮ドキュメント一覧を返す。
 */
export function getSampleDocuments() {
  return sampleDocuments;
}

/**
 * 仮ZIPドキュメントのページ一覧を返す。
 */
export function getSampleZipPages(documentId: number) {
  if (documentId !== 9003) {
    return [];
  }

  return sampleZipPages;
}

/**
 * ジャンル一覧を取得する。
 * APIに接続できない場合は画面確認を継続するため仮ジャンルを返す。
 */
export async function fetchGenres() {
  try {
    const response = await fetch(buildApiUrl('/genres'));
    if (!response.ok) {
      throw new Error(`ジャンル一覧を取得できませんでした: ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('ジャンル一覧の形式が正しくありません');
    }

    return data.map(readGenre);
  } catch (error) {
    console.warn('ジャンル一覧APIに接続できないため仮データを表示します', error);
    return sampleGenres;
  }
}

/**
 * ドキュメント一覧を取得する。
 * APIに接続できない場合は画面確認を継続するため仮ドキュメントを返す。
 */
export async function fetchDocuments() {
  try {
    const response = await fetch(buildApiUrl('/documents'));
    if (!response.ok) {
      throw new Error(`ドキュメント一覧を取得できませんでした: ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('ドキュメント一覧の形式が正しくありません');
    }

    return data.map(readDocument);
  } catch (error) {
    console.warn('ドキュメント一覧APIに接続できないため仮データを表示します', error);
    return sampleDocuments;
  }
}

/**
 * ZIP画像本または画像ディレクトリ本のページ一覧を取得する。
 */
export async function fetchZipPages(documentId: number) {
  if (documentId === 9003) {
    return sampleZipPages;
  }

  const response = await fetch(buildApiUrl(`/documents/${documentId}/pages`));
  if (!response.ok) {
    throw new Error(`ZIPページ一覧を取得できませんでした: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('ZIPページ一覧の形式が正しくありません');
  }

  return data.map(readZipPage);
}

/**
 * EPUBドキュメントの章一覧を取得する。
 */
export async function fetchEpubChapters(documentId: number) {
  const response = await fetch(buildApiUrl(`/documents/${documentId}/epub/chapters`));
  if (!response.ok) {
    throw new Error(`EPUB章一覧を取得できませんでした: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('EPUB章一覧の形式が正しくありません');
  }

  return data.map(readEpubChapter);
}
