import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DocumentListScreen } from '../pages/documents/DocumentListScreen';
import { DocumentViewerScreen } from '../pages/documentViewer/DocumentViewerScreen';
import { LoginScreen } from '../pages/login/LoginScreen';
import { MenuScreen } from '../pages/menu/MenuScreen';
import { SettingsScreen } from '../pages/settings/SettingsScreen';
import { UploadScreen } from '../pages/upload/UploadScreen';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * 画面URLとReact画面コンポーネントの対応を定義するルーター。
 * /login 以外は ProtectedRoute でラップし、未ログイン時はログイン画面へリダイレクトする。
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/menu" element={<ProtectedRoute><MenuScreen /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><DocumentListScreen /></ProtectedRoute>} />
        {/* storedNameはバックエンドのdocuments.stored_nameをURLパラメータとして受け取る。 */}
        <Route path="/documents/:storedName" element={<ProtectedRoute><DocumentViewerScreen /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadScreen /></ProtectedRoute>} />
        {/* 存在しないURLはログイン画面に戻す。 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
