const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export interface AuthUser {
  username: string;
  role: number;
}

/**
 * バックエンドエラーレスポンスの detail フィールドを文字列として取り出す。
 */
async function extractErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    // ignore
  }
  return fallback;
}

/**
 * ユーザー名とパスワードでログインする。成功するとサーバーがCookieをセットする。
 */
export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(buildApiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });
  if (!response.ok) {
    const detail = await extractErrorDetail(response, 'ログインに失敗しました');
    throw new Error(detail);
  }
  return response.json() as Promise<AuthUser>;
}

/**
 * ログアウトする。サーバーがCookieを削除する。
 */
export async function logout(): Promise<void> {
  await fetch(buildApiUrl('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  });
}

/**
 * 現在のセッションが有効かを確認し、ログイン中のユーザー情報を返す。
 * 未ログインまたはセッション切れの場合はnullを返す。
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const response = await fetch(buildApiUrl('/auth/me'), {
    credentials: 'include',
  });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  return response.json() as Promise<AuthUser>;
}
