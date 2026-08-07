import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './store/auth.store'
import { useOfflineSync } from './hooks/useOfflineSync'
import { useSOSStatusListener } from './hooks/useSOSStatusListener'
import './index.css'
// Pages
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/auth/AuthPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import TripListPage from './pages/trips/TripListPage'
import CreateTripPage from './pages/trips/CreateTripPage'
import TripDetailPage from './pages/trips/TripDetailPage'
import SOSPage from './pages/safety/SOSPage'
import CheckinPage from './pages/safety/CheckinPage'
import AdvisoryPage from './pages/safety/AdvisoryPage'
import CommunityPage from './pages/community/CommunityPage'
import ProfilePage from './pages/profile/ProfilePage'
import ProfileEditPage from './pages/profile/ProfileEditPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />
}

function AppWithSync() {
  useOfflineSync()        // Register online/offline listeners
  useSOSStatusListener()  // Notify when a sent SOS is assigned or resolved
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWithSync />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/trips" element={<PrivateRoute><TripListPage /></PrivateRoute>} />
          <Route path="/trips/new" element={<PrivateRoute><CreateTripPage /></PrivateRoute>} />
          <Route path="/trips/:id" element={<PrivateRoute><TripDetailPage /></PrivateRoute>} />
          <Route path="/sos" element={<PrivateRoute><SOSPage /></PrivateRoute>} />
          <Route path="/checkin" element={<PrivateRoute><CheckinPage /></PrivateRoute>} />
          <Route path="/advisory" element={<PrivateRoute><AdvisoryPage /></PrivateRoute>} />
          <Route path="/community" element={<PrivateRoute><CommunityPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/profile/edit" element={<PrivateRoute><ProfileEditPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-center" closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
