export interface DocumentItem {
  id: number;
  title: string;
  mimeType: string;
  createdAt: string;
  genre?: string;
  author?: string;
  summary?: string;
  pageCount?: number;
  isSample?: boolean;
}

export interface ZipPageItem {
  index: number;
  filename: string;
  contentUrl: string;
}

export interface GenreItem {
  id: number;
  name: string;
}

interface DocumentResponse {
  id: number;
  title: string;
  mime_type: string;
  created_at: string;
  genre?: string;
}

interface ZipPageResponse {
  index: number;
  filename: string;
  content_url: string;
}

interface GenreResponse {
  id: number;
  name: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

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

const sampleZipPages: ZipPageItem[] = Array.from({ length: 8 }, (_, index) => ({
  index,
  filename: `${String(index + 1).padStart(3, '0')}.png`,
  contentUrl: `/sample-documents/9003/pages/${index}/content`,
}));

const sampleGenres: GenreItem[] = [
  { id: 1, name: '技術資料' },
  { id: 2, name: '画像' },
  { id: 3, name: 'コミック' },
  { id: 4, name: '書籍' },
];

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

export function getContentUrl(documentId: number) {
  return buildApiUrl(`/documents/${documentId}/content`);
}

export function getPageContentUrl(contentUrl: string) {
  return buildApiUrl(contentUrl);
}

export function isSampleDocument(document: DocumentItem) {
  return document.isSample === true;
}

export function getSampleDocuments() {
  return sampleDocuments;
}

export function getSampleZipPages(documentId: number) {
  if (documentId !== 9003) {
    return [];
  }

  return sampleZipPages;
}

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
