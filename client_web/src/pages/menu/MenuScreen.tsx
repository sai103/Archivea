import { Link } from 'react-router';
import './MenuScreen.css';

export function MenuScreen() {
  return (
    <main className="menu-shell">
      <section className="menu-layout" aria-labelledby="menu-title">
        <header className="menu-header">
          <p className="app-name">Archivea</p>
          <h1 id="menu-title">メニュー</h1>
        </header>

        <nav className="menu-nav" aria-label="主要機能">
          <Link to="/documents" className="menu-item">
            <span className="menu-item-title">閲覧</span>
            <span className="menu-item-text">登録済みファイルを検索して画像を開く</span>
          </Link>

          <Link to="/settings" className="menu-item">
            <span className="menu-item-title">設定</span>
            <span className="menu-item-text">API接続先、表示モード、閲覧設定</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
