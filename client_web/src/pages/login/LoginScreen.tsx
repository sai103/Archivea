import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import './LoginScreen.css';

/**
 * ログイン画面。
 * 現行MVPでは固定ID/パスワードで画面遷移を確認する仮実装。
 */
export function LoginScreen() {
  // ログイン成功時にメニュー画面へ遷移するためのReact Router関数。
  const navigate = useNavigate();
  // 入力中のユーザーID。
  const [userId, setUserId] = useState('');
  // 入力中のパスワード。
  const [password, setPassword] = useState('');
  // ログイン失敗時に画面へ表示するエラーメッセージ。
  const [error, setError] = useState('');

  /**
   * ログインフォーム送信時の処理。
   * フォームの標準送信を止め、仮認証に成功した場合はメニューへ遷移する。
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (userId === 'test' && password === 'test') {
      setError('');
      navigate('/menu');
      return;
    }

    setError('IDまたはパスワードが正しくありません');
  };

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <p className="app-name">Archivea</p>
          <h1 id="login-title">ログイン</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>ID</span>
            <input
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-button">
            ログイン
          </button>
        </form>
      </section>
    </main>
  );
}
