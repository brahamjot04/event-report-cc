import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'; // <--- THIS IS CRITICAL
import "bootstrap-icons/font/bootstrap-icons.css"; // <--- THIS IS CRITICAL
import App from './App.jsx'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PwaProvider } from './context/PwaContext'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider } from './context/ThemeContext'

// Register Service Worker for PWA (Production only; unregister in development to prevent stale caching)
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          // Check if there's already a waiting worker
          if (registration.waiting) {
            window.dispatchEvent(
              new CustomEvent('pwa-update-available', {
                detail: { waitingWorker: registration.waiting }
              })
            );
          }

          // Listen for future updates found
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.dispatchEvent(
                    new CustomEvent('pwa-update-available', {
                      detail: { waitingWorker: newWorker }
                    })
                  );
                }
              });
            }
          });
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PwaProvider>
            <ToastProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </ToastProvider>
          </PwaProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)