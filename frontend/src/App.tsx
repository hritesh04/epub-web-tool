import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'

import Navbar from '@/components/layout/Navbar'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import Editor from '@/pages/Editor'
import Home from '@/pages/Home'

type User = {
  email: string
}

const DUMMY_CREDENTIALS = {
  email: 'reader@example.com',
  password: 'epub12345',
} as const

function AppShell({
  user,
  onSignOut,
}: {
  user: User | null
  onSignOut: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar user={user} onSignOut={onSignOut} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}

function AppRoutes() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  const handleAuthSuccess = (email: string) => {
    setUser({ email })
    navigate('/dashboard')
  }

  const handleSignOut = () => {
    setUser(null)
    navigate('/')
  }

  return (
    <Routes>
      <Route element={<AppShell user={user} onSignOut={handleSignOut} />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/signin"
          element={
            <Auth
              onSuccess={handleAuthSuccess}
              dummyEmail={DUMMY_CREDENTIALS.email}
              dummyPassword={DUMMY_CREDENTIALS.password}
            />
          }
        />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/signin" replace />}
        />
        <Route
          path="/editor"
          element={user ? <Editor /> : <Navigate to="/signin" replace />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
