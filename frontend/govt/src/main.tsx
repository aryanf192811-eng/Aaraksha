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
import IncidentQueuePage from './pages/IncidentQueuePage'
import LiveMapPage from './pages/LiveMapPage'
import RiskOverviewPage from './pages/RiskOverviewPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CheckpointScanPage from './pages/CheckpointScanPage'
import VolunteersPage from './pages/VolunteersPage'
import { useAuthStore } from './store/auth.store'
import GovtLayout from './components/GovtLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// CHECKPOINT_OFFICER has no command-center API access at all (see
// COMMAND_CENTER_ROLES in the backend's govt.routes.js) — every request
// from the dashboard routes would just 403. Redirect at the router level
// instead of letting them land on a broken page full of failed fetches.
function CommandCenterRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const govtUser = useAuthStore(s => s.govtUser)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (govtUser?.role === 'CHECKPOINT_OFFICER') return <Navigate to="/checkpoint" replace />
  return <>{children}</>
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
          <Route path="/" element={<CommandCenterRoute><GovtLayout /></CommandCenterRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="sos" element={<SOSManagementPage />} />
            <Route path="incidents" element={<IncidentQueuePage />} />
            <Route path="volunteers" element={<VolunteersPage />} />
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
