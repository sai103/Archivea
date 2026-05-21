import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import './LoginScreen.css';

export function LoginScreen() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
