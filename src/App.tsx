import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { LandingPage } from '@/components/Landing/LandingPage'
import { ResetPassword } from '@/components/Auth/ResetPassword'
import { ConfirmEmail } from '@/components/Auth/ConfirmEmail'
import { Dashboard } from '@/components/Dashboard/Dashboard'
import { DreamKeeper } from '@/components/Dashboard/DreamKeeper'
import { ShareTarget } from '@/components/ShareTarget'
import { ensureResetPasswordPath, isPasswordRecoveryUrl } from '@/lib/authUrl'

function AppContent() {
  const { isAuthenticated, loading, passwordRecovery } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const showResetPassword =
    passwordRecovery ||
    isPasswordRecoveryUrl() ||
    location.pathname === '/reset-password' ||
    location.pathname.endsWith('/reset-password')

  useEffect(() => {
    if (isPasswordRecoveryUrl() && !location.pathname.endsWith('/reset-password')) {
      ensureResetPasswordPath()
      navigate(`/reset-password${window.location.hash}${window.location.search}`, {
        replace: true,
      })
    }
  }, [location.pathname, navigate])

  // After Stripe checkout success, authenticated users go straight to the dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('checkout') === 'success' && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [location.search, isAuthenticated, navigate])

  // When a logged-out user arrives at /share, save the query params so we can
  // resume the share flow after they sign in.
  useEffect(() => {
    if (!loading && !isAuthenticated && location.pathname === '/share' && location.search) {
      sessionStorage.setItem('pendingShare', location.search)
    }
  }, [loading, isAuthenticated, location.pathname, location.search])

  // After login, check for a pending share and redirect to /share to complete it.
  useEffect(() => {
    if (isAuthenticated && !loading) {
      const pending = sessionStorage.getItem('pendingShare')
      if (pending) {
        sessionStorage.removeItem('pendingShare')
        navigate(`/share${pending}`, { replace: true })
      }
    }
  }, [isAuthenticated, loading, navigate])

  // Email confirmation landing — must render before any auth gate
  if (location.pathname === '/auth/confirm') {
    return <ConfirmEmail />
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-4">
        <img
          src="/icons/lokr-extension-144.png"
          alt="LnkLokr"
          className="w-24 h-24 object-contain animate-pulse drop-shadow-lg"
        />
        <p className="text-gray-700 font-semibold">Loading your workspace...</p>
      </div>
    )
  }

  if (showResetPassword) {
    return <ResetPassword />
  }

  // Stripe return without a session still needs the signup screen
  const checkoutSuccess = new URLSearchParams(location.search).get('checkout') === 'success'
  if (!isAuthenticated && checkoutSuccess) {
    return <LandingPage />
  }

  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/pricing" element={<LandingPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/share" element={<ShareTarget />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dreamkeeper/:id" element={<DreamKeeper />} />
      <Route path="/dreamkeeper" element={<DreamKeeper />} />
      {/* /upgrade is referenced in some modals — redirect to dashboard */}
      <Route path="/upgrade" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}
