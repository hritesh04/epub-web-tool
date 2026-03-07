import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import Navbar from '@/components/layout/Navbar'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import Editor from '@/pages/Editor'
import Home from '@/pages/Home'

type User = {
  email: string
}

function AppShell({
  user,
  onSignOut,
}: {
  user: User | null
  onSignOut: () => void
}) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

function AppRoutes() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth',{timeout:200})
      if (response.data.success) {
        setUser(response.data.data)
      }
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      if (window.location.pathname !== '/signin' && window.location.pathname !== '/') {
        navigate('/signin')
      }
    }

    window.addEventListener('auth-unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized)
  }, [navigate])

  const handleAuthSuccess = (email: string) => {
    setUser({ email })
    navigate('/dashboard')
  }

  const handleSignOut = async () => {
    try {
      await api.post('/signout')
    } catch (err) {
      console.error('Sign out failed:', err)
    } finally {
      setUser(null)
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell user={user} onSignOut={handleSignOut} />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/signin"
          element={
            user ? <Navigate to="/dashboard" replace /> : <Auth onSuccess={handleAuthSuccess} />
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
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  )
}
