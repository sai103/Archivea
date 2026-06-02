import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, type AuthUser } from '../api/auth';

interface AuthContextValue {
  // 現在ログイン中のユーザー。未ログインはnull。
  user: AuthUser | null;
  // 初回セッション確認中はtrue。
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * アプリ全体に認証状態を提供するプロバイダー。
 * アプリ起動時に /auth/me を呼び出し、既存セッションを復元する。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // アプリ起動時に既存セッションを確認する。
  useEffect(() => {
    fetchMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const loggedIn = await apiLogin(username, password);
    setUser(loggedIn);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 認証コンテキストを取得するフック。AuthProvider の外では使用不可。
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth は AuthProvider の内部でのみ使用できます');
  }
  return ctx;
}
