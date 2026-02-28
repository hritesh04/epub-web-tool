import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight, Lock, Mail } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'signin' | 'signup'

type AuthProps = {
  onSuccess?: (email: string) => void
  dummyEmail?: string
  dummyPassword?: string
}

export default function Auth({ onSuccess, dummyEmail, dummyPassword }: AuthProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState<string | null>(null)

  const title = mode === 'signin' ? 'Sign in to EpubStudio' : 'Create your account'
  const subtitle =
    mode === 'signin'
      ? 'Access your personal EPUB workspace from any device.'
      : 'One account for metadata editing, translations, and conversions.'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || !password) return

    if (email === dummyEmail && password === dummyPassword) {
      setError(null)
      onSuccess?.(email)
      return
    }

    setError('Use the demo credentials shown below to sign in.')
  }

  return (
    <div className="flex pt-36 flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-4 md:px-6">
        <div className="w-full max-w-md">
          <Card className="border bg-card/90 backdrop-blur">
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email" requiredMark>
                    Email
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" requiredMark>
                    Password
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      id="password"
                      type="password"
                      name="password"
                      required
                      autoComplete={
                        mode === 'signin' ? 'current-password' : 'new-password'
                      }
                      placeholder="••••••••"
                      className="pl-9"
                    />
                  </div>
                </div>

                {mode === 'signin' ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Only a valid email and password required.</span>
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline"
                      onClick={() => setMode('signup')}
                    >
                      Need an account?
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      For personal EPUB editing only. No publishing required.
                    </span>
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline"
                      onClick={() => setMode('signin')}
                    >
                      Already have one?
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  {mode === 'signin' ? (
                    <>
                      Continue
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {dummyEmail && dummyPassword ? (
                <div className="space-y-1 rounded-lg border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      Demo credentials
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                      For local testing only
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div>
                      <span className="mr-1 font-medium text-foreground">
                        Email:
                      </span>
                      <span>{dummyEmail}</span>
                    </div>
                    <div>
                      <span className="mr-1 font-medium text-foreground">
                        Password:
                      </span>
                      <span>{dummyPassword}</span>
                    </div>
                    {error ? (
                      <div className="mt-1 text-[11px] text-destructive">{error}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Secure by design. No social logins.</span>
                <Badge variant="outline" className="border-dashed px-2 py-0.5">
                  Personal use
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

