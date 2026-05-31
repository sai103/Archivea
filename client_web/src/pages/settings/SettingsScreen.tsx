import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import './SettingsScreen.css';

/**
 * アプリケーション設定画面。
 * 現行MVPではAPI接続先の表示と保存操作のUI確認を行う仮実装。
 */
export function SettingsScreen() {
  // 保存操作後にユーザーへ表示するステータスメッセージ。
  const [saveMessage, setSaveMessage] = useState('');

  /**
   * 設定フォーム送信時の処理。
   * 現時点では永続化せず、保存完了メッセージだけを表示する。
   */
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
