import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './components/ui.jsx';
import { LanguageProvider } from './i18n/index.jsx';
import './styles/app.css';
import './styles/modules.css';

// Restore the saved theme and language before first paint. Direction in
// particular has to be right on the first frame: a page that renders
// left-to-right and then flips is worse than a moment of blank.
try {
  const savedTheme = localStorage.getItem('autgrc-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  const savedLanguage = localStorage.getItem('autgrc-language');
  if (savedLanguage === 'ar' || savedLanguage === 'en') {
    document.documentElement.lang = savedLanguage;
    document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr';
  }
} catch { /* storage unavailable; the provider sets both on mount */ }

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
