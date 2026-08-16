import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './store/auth.store'
import './index.css'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
