export interface DocumentItem {
  id: number;
  title: string;
  mimeType: string;
  createdAt: string;
  genre?: string;
}

export interface ZipPageItem {
  index: number;
  filename: string;
  contentUrl: string;
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

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

export function getContentUrl(documentId: number) {
  return buildApiUrl(`/documents/${documentId}/content`);
}

export function getPageContentUrl(contentUrl: string) {
  return buildApiUrl(contentUrl);
}

export async function fetchDocuments() {
  const response = await fetch(buildApiUrl('/documents'));
  if (!response.ok) {
    throw new Error(`ドキュメント一覧を取得できませんでした: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('ドキュメント一覧の形式が正しくありません');
  }

  return data.map(readDocument);
}

export async function fetchZipPages(documentId: number) {
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
