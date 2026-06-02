import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router/AppRouter';

/**
 * Archivea Webアプリケーションの最上位コンポーネント。
 * AuthProvider で認証状態を全体に提供し、AppRouter でルーティングを管理する。
 */
export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
