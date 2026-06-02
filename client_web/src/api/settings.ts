/**
 * GET /settings のバックエンドレスポンス形。
 */
interface SettingsResponse {
  storage_dir: string;
}

/**
 * 画面で扱うアプリケーション設定。
 */
export interface AppSettings {
  storageDir: string;
}

// API接続先のベースURL。環境変数が無い場合はViteプロキシの/apiを使う。
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

/**
 * アプリケーション設定を取得する。
 */
export async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch(buildApiUrl('/settings'));
  if (!response.ok) {
    throw new Error(`設定を取得できませんでした: ${response.status}`);
  }
  const data = (await response.json()) as SettingsResponse;
  return { storageDir: data.storage_dir };
}

/**
 * アプリケーション設定を更新する。
 */
export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  const response = await fetch(buildApiUrl('/settings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_dir: settings.storageDir }),
  });
  if (!response.ok) {
    throw new Error(`設定の保存に失敗しました: ${response.status}`);
  }
  const data = (await response.json()) as SettingsResponse;
  return { storageDir: data.storage_dir };
}
