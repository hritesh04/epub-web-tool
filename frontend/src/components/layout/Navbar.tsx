import { ArrowRight, LayoutDashboard, PenSquare, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'

type NavbarUser = {
  email: string
} | null

type NavbarProps = {
  user: NavbarUser
  onSignOut?: () => void
}

export default function Navbar({ user, onSignOut }: NavbarProps) {
  const location = useLocation()
  const isAuthed = Boolean(user)

  return (
    <div className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl dark:border-primary/10 dark:bg-card/50">
      <div className="px-20 flex h-20 items-center justify-between gap-4 md:h-20">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card shadow-sm md:h-9 md:w-9 dark:border-primary/20 dark:bg-primary-subtle">
              <Sparkles className="h-4 w-4 text-primary dark:text-primary" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-tight">EpubStudio</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                Edit • Translate • Convert
              </div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {isAuthed ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/editor"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <PenSquare className="h-3.5 w-3.5" />
                <span>Editor</span>
              </Link>
            </>
          ) : (
            <>
              <a className="text-muted-foreground hover:text-foreground" href="#features">
                Features
              </a>
              <a className="text-muted-foreground hover:text-foreground" href="#workflow">
                Workflow
              </a>
              <a className="text-muted-foreground hover:text-foreground" href="#faq">
                FAQ
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {isAuthed ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[11px] text-muted-foreground md:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Signed in as</span>
                <span className="font-medium text-foreground">{user?.email}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onSignOut}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              {location.pathname !== '/signin' && (
                <Button asChild variant="ghost" className="hidden md:inline-flex">
                  <Link to="/signin">Sign in</Link>
                </Button>
              )}
              <Button asChild className="group">
                <Link to="/signin">
                  Start free
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

