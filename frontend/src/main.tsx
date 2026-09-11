import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@/app/store';
import { AuthProvider } from '@/contexts/AuthContent';
import { LangProvider } from '@/contexts/LangContext';
import App from '@/App';
import './styles/globals.css';
import { tr } from '@/lib/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <LangProvider>
            <Suspense fallback={<div>{tr('common.loading')}</div>}>
              <App />
            </Suspense>
          </LangProvider>
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
