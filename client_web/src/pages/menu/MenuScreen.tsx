import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import './MenuScreen.css';

/**
 * ログイン後に表示する主要機能メニュー。
 * 閲覧画面と設定画面への導線を提供する。
 */
export function MenuScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // バックエンドのセッションとCookieを削除してからログイン画面へ遷移する。
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="menu-shell">
      <section className="menu-layout" aria-labelledby="menu-title">
        <header className="menu-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="menu-title">メニュー</h1>
          </div>
          <button type="button" className="menu-logout-button" onClick={() => void handleLogout()}>
            ログアウト
          </button>
        </header>

        <nav className="menu-nav" aria-label="主要機能">
          <Link to="/documents" className="menu-item">
            <span className="menu-item-title">閲覧</span>
            <span className="menu-item-text">登録済みファイルを検索して画像を開く</span>
          </Link>

          <Link to="/upload" className="menu-item">
            <span className="menu-item-title">アップロード</span>
            <span className="menu-item-text">PDF / 画像 / EPUB / ZIPを登録する</span>
          </Link>

          <Link to="/settings" className="menu-item">
            <span className="menu-item-title">設定</span>
            <span className="menu-item-text">API接続先</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
