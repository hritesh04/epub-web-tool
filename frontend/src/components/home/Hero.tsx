import { motion } from 'framer-motion'
import { ArrowRight, Clock, FileDown, FileUp, Languages, Shield, Sparkles, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fadeUp } from '@/components/home/animations'

export default function Hero() {
  return (
    <section className="container pt-12 md:pt-18 lg:pt-20">
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
        className="grid items-center gap-10 md:grid-cols-12"
      >
        <motion.div variants={fadeUp} className="space-y-6 md:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-primary/20 bg-primary/10">Private by default</Badge>
            <Badge variant="outline" className="bg-background/60">
              EPUB ↔ PDF • Metadata • Translation
            </Badge>
          </div>

          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            The modern toolkit for polishing EPUBs—fast.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Edit metadata with confidence, translate entire books in the background, and convert between EPUB
            and PDF without juggling five different tools.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="group">
              <Link to="/signin">
                Upload a book
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline">
              See feature tour
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Local-first exports
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Long translations run in the background
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Clean outputs, consistent styles
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="md:col-span-5">
          <Card className="relative overflow-hidden border border-border/70 bg-card/95 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="absolute inset-0" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center justify-between">
                <span>Project</span>
                <Badge variant="outline" className="bg-background/60">
                  demo.epub
                </Badge>
              </CardTitle>
              <CardDescription>A quick preview of what you can do in minutes.</CardDescription>
            </CardHeader>
            <CardContent className="relative grid gap-3">
              <div className="rounded-lg border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md border bg-card">
                    <Tags className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Metadata editor</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Title, author, series, ISBN, language, cover, publisher.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md border bg-card">
                    <Languages className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Translation jobs</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Queued and resumable—some books take a few hours. We’ll notify you when it’s done.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileDown className="h-4 w-4" /> EPUB → PDF
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Print-ready layout.</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileUp className="h-4 w-4" /> PDF → EPUB
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Reflow-friendly export.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </section>
  )
}

