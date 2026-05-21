import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { LoginScreen } from '../pages/login/LoginScreen';
import { MenuScreen } from '../pages/menu/MenuScreen';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
