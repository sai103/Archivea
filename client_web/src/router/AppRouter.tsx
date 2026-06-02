import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DocumentListScreen } from '../pages/documents/DocumentListScreen';
import { DocumentViewerScreen } from '../pages/documentViewer/DocumentViewerScreen';
import { LoginScreen } from '../pages/login/LoginScreen';
import { MenuScreen } from '../pages/menu/MenuScreen';
import { SettingsScreen } from '../pages/settings/SettingsScreen';
import { UploadScreen } from '../pages/upload/UploadScreen';

/**
 * 画面URLとReact画面コンポーネントの対応を定義するルーター。
 * 未定義URLはログイン画面へ戻し、アプリ内の入口を固定する。
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 初期アクセス時はログイン画面から開始する。 */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/documents" element={<DocumentListScreen />} />
        {/* documentIdはバックエンドのdocuments.idをURLパラメータとして受け取る。 */}
        <Route path="/documents/:documentId" element={<DocumentViewerScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/upload" element={<UploadScreen />} />
        {/* 存在しないURLはログイン画面に戻す。 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
