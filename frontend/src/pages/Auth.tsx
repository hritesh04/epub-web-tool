import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Lock, Mail, Sparkles } from 'lucide-react'

import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'signin' | 'signup'

type AuthProps = {
  onSuccess?: (email: string) => void
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignIn = mode === 'signin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length > 128) {
      setError('Password must be less than 128 characters.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const endpoint = isSignIn ? '/signin' : '/signup'
      const response = await api.post(endpoint, { email, password })

      const nextEmail = (response.data && (response.data.email || response.data.user?.email)) || email
      onSuccess?.(String(nextEmail))
    } catch (err: any) {
      let message = 'Something went wrong. Please try again.'
      if (err.response?.data?.message) {
        message = err.response.data.message
      } else if (err.response?.status === 401) {
        message = 'Invalid email or password.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div className="absolute top-[10%] left-[5%] w-[30%] h-[30%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[5%] w-[30%] h-[30%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <CardHeader className="space-y-4 pt-8">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {isSignIn ? 'Welcome Back' : 'Join EpubStudio'}
              </CardTitle>
              <CardDescription className="text-muted-foreground px-4">
                {isSignIn 
                  ? 'Sign in to access your personal workspace and library.'
                  : 'Start your journey to a perfectly organized digital library today.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: isSignIn ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isSignIn ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
                onSubmit={handleSubmit}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="name@example.com"
                      className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {/* // after editor */}
                    {/* {isSignIn && (
                      <button type="button" className="text-xs text-primary hover:underline font-medium">
                        Forgot password?
                      </button>
                    )} */}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="password"
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-background/30 border-t-background animate-spin rounded-full" />
                      Just a second...
                    </span>
                  ) : (
                    <>
                      {isSignIn ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.form>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl flex items-center gap-2"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isSignIn ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                type="button"
                className="text-primary font-semibold hover:underline"
                onClick={() => {
                  setMode(isSignIn ? 'signup' : 'signin')
                  setError(null)
                }}
              >
                {isSignIn ? 'Sign up for free' : 'Sign in here'}
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="scale-75 origin-center border-dashed px-1.5 leading-none">Safe</Badge>
                No tracking
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="scale-75 origin-center border-dashed px-1.5 leading-none">Fast</Badge>
                Instant access
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
