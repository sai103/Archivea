import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import './SettingsScreen.css';

export function SettingsScreen() {
  const [saveMessage, setSaveMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage('設定を保存しました');
  };

  return (
    <main className="settings-shell">
      <section className="settings-layout" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="settings-title">設定</h1>
          </div>
          <Link to="/menu" className="secondary-link">
            メニューへ戻る
          </Link>
        </header>

        <form className="settings-form" onSubmit={handleSubmit}>
          <fieldset className="settings-section">
            <legend>接続</legend>
            <label className="settings-field">
              <span>API接続先</span>
              <input type="url" defaultValue="http://localhost:8000" />
            </label>
          </fieldset>

          <fieldset className="settings-section">
            <legend>表示</legend>
            <label className="settings-field">
              <span>表示モード</span>
              <select defaultValue="single">
                <option value="single">1ページ</option>
                <option value="spread">2ページ</option>
              </select>
            </label>

            <label className="settings-checkbox">
              <input type="checkbox" defaultChecked />
              <span>画像を画面幅に合わせる</span>
            </label>
          </fieldset>

          <fieldset className="settings-section">
            <legend>閲覧</legend>
            <label className="settings-field">
              <span>ページ送り</span>
              <select defaultValue="left-to-right">
                <option value="left-to-right">左から右</option>
                <option value="right-to-left">右から左</option>
              </select>
            </label>
          </fieldset>

          {saveMessage && (
            <p className="settings-message" role="status">
              {saveMessage}
            </p>
          )}

          <div className="settings-actions">
            <button type="submit" className="primary-button">
              保存
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
