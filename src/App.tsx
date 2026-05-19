import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { Login } from '@/components/Auth/Login'
import { SignUp } from '@/components/Auth/SignUp'
import { Dashboard } from '@/components/Dashboard/Dashboard'
import { DreamKeeper } from '@/components/Dashboard/DreamKeeper'

function AppContent() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-4">
        <img
          src="/icons/Lokr.png"
          alt="LnkLokr"
          className="w-24 h-24 object-contain animate-pulse drop-shadow-lg"
        />
        <p className="text-gray-700 font-semibold">Loading your workspace...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return authMode === 'login' ? (
      <Login onSignUpClick={() => setAuthMode('signup')} />
    ) : (
      <SignUp onLoginClick={() => setAuthMode('login')} />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dreamkeeper/:id" element={<DreamKeeper />} />
      <Route path="/dreamkeeper" element={<DreamKeeper />} />
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
