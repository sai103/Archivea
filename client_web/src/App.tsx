import { AppRouter } from './router/AppRouter';

/**
 * Archivea Webアプリケーションの最上位コンポーネント。
 * 現時点ではルーティング定義を持つAppRouterへ処理を委譲する。
 */
export function App() {
  return <AppRouter />;
}
