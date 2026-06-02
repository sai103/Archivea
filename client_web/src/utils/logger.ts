/**
 * フロントエンドのログユーティリティ。
 * ログエントリをバックエンドの POST /logs に送信する。
 * バックエンドが backend/logs/frontend.log へ日次ローテートで記録する。
 * 開発環境ではコンソールにも出力する。
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// API接続先のベースURL。環境変数が無い場合はViteプロキシの/apiを使う。
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function sendLog(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        context: context ?? null,
      }),
    });
  } catch {
    // ログ送信失敗はアプリの動作を止めない。
  }
}

export const logger = {
  info(message: string, context?: LogContext): void {
    if (import.meta.env.DEV) console.info(`[info] ${message}`, context);
    void sendLog('info', message, context);
  },
  warn(message: string, context?: LogContext): void {
    if (import.meta.env.DEV) console.warn(`[warn] ${message}`, context);
    void sendLog('warn', message, context);
  },
  error(message: string, context?: LogContext): void {
    console.error(`[error] ${message}`, context);
    void sendLog('error', message, context);
  },
};
