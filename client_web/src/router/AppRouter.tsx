import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DocumentListScreen } from '../pages/documents/DocumentListScreen';
import { DocumentViewerScreen } from '../pages/documentViewer/DocumentViewerScreen';
import { LoginScreen } from '../pages/login/LoginScreen';
import { MenuScreen } from '../pages/menu/MenuScreen';
import { SettingsScreen } from '../pages/settings/SettingsScreen';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/documents" element={<DocumentListScreen />} />
        <Route path="/documents/:documentId" element={<DocumentViewerScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
