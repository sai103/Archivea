import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Viteが提供するHTML上の#rootにReactアプリケーションをマウントする。
// StrictModeは開発時に副作用や非推奨APIの利用を検出しやすくするために使う。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
