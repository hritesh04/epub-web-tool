import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ColorMode = 'light' | 'dark'

export default function ThemeToggle() {
  const [mode, setMode] = useState<ColorMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = window.localStorage.getItem('epubstudio-theme')
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
    return 'dark'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = window.document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    window.localStorage.setItem('epubstudio-theme', mode)
  }, [mode])

  const isDark = mode === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative"
      onClick={() => setMode((current) => (current === 'dark' ? 'light' : 'dark'))}
    >
      <Sun
        className={cn(
          'h-4 w-4 rotate-0 scale-100 transition-all duration-200',
          isDark && '-rotate-90 scale-0',
        )}
      />
      <Moon
        className={cn(
          'pointer-events-none absolute h-4 w-4 rotate-90 scale-0 transition-all duration-200',
          isDark && 'rotate-0 scale-100',
        )}
      />
    </Button>
  )
}

