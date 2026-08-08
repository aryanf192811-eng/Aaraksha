import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import './index.css'
import GovtLoginPage from './pages/GovtLoginPage'
import DashboardPage from './pages/DashboardPage'
import SOSManagementPage from './pages/SOSManagementPage'
import LiveMapPage from './pages/LiveMapPage'
import RiskOverviewPage from './pages/RiskOverviewPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CheckpointScanPage from './pages/CheckpointScanPage'
import { useAuthStore } from './store/auth.store'
import GovtLayout from './components/GovtLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GovtLoginPage />} />
          {/* Standalone — deliberately outside GovtLayout's desktop sidebar
              shell. A checkpoint officer opens this directly on a phone
              browser as a focused field tool, not the full ops dashboard. */}
          <Route path="/checkpoint" element={<ProtectedRoute><CheckpointScanPage /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><GovtLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="sos" element={<SOSManagementPage />} />
            <Route path="map" element={<LiveMapPage />} />
            <Route path="risk" element={<RiskOverviewPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
