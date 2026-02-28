import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function FAQ() {
  return (
    <section id="faq" className="container pb-20 pt-14 md:pb-24 md:pt-20">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="text-pretty text-2xl font-semibold tracking-tight md:text-3xl">
            Questions, answered.
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Short, clear answers—so you can stay focused on reading instead of hunting settings.
          </p>
        </div>

        <div className="lg:col-span-7">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="t1">
              <AccordionTrigger>Why can translation take hours?</AccordionTrigger>
              <AccordionContent>
                Long books have lots of text and formatting to preserve. We queue jobs, keep progress, and
                finish in the background so your browser doesn’t need to stay open.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="t2">
              <AccordionTrigger>Do you keep my files?</AccordionTrigger>
              <AccordionContent>
                Outputs are designed for easy export. In a production setup you can configure retention (e.g.,
                auto-delete after N days) so your storage stays clean.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="t3">
              <AccordionTrigger>Can I convert both ways (EPUB ↔ PDF)?</AccordionTrigger>
              <AccordionContent>
                Yes—EPUB → PDF for sharing/printing, and PDF → EPUB when you need a reflowable version you can
                edit and polish.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="t4">
              <AccordionTrigger>Does it handle messy EPUBs?</AccordionTrigger>
              <AccordionContent>
                That’s the point: cleanup tools normalize structure, reduce inline clutter, and help you
                validate before exporting.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="mt-16 rounded-2xl border bg-card p-8 md:p-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="text-xl font-semibold tracking-tight">Ready to tidy up your EPUB library?</div>
            <div className="mt-2 text-muted-foreground">
              Upload a book, run the tools you need, and keep your personal collection in order.
            </div>
          </div>
          <Button asChild size="lg" className="group">
            <Link to="/signin">
              Start free
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      <footer className="mt-10 pb-6 pt-10 text-sm text-muted-foreground">
        <div className="container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl border bg-card">
              <Sparkles className="h-4 w-4" />
            </div>
            <span>© {new Date().getFullYear()} EpubStudio</span>
          </div> */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a className="hover:text-foreground" href="#features">
              Features
            </a>
            <a className="hover:text-foreground" href="#faq">
              FAQ
            </a>
            <a className="hover:text-foreground" href="#">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </section>
  )
}

