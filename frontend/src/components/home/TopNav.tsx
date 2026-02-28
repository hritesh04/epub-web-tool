import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'

export default function TopNav() {
  return (
    <div className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <Sparkles className="h-4 w-4 text-foreground" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-semibold tracking-tight">EpubStudio</div>
            <div className="text-[11px] text-muted-foreground">Edit • Translate • Convert</div>
          </div>
        </div>

        <div className="hidden items-center gap-7 text-sm md:flex">
          <a className="text-muted-foreground hover:text-foreground" href="#features">
            Features
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#workflow">
            Workflow
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#faq">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button asChild className="group">
            <Link to="/signin">
              Start free
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

