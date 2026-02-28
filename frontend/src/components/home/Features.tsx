import { motion } from 'framer-motion'
import { Check, FileDown, FileUp, Languages, Tags } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fadeUp } from '@/components/home/animations'

export default function Features() {
  const items = [
    {
      icon: Tags,
      title: 'Metadata editing that doesn’t fight you',
      desc: 'Bulk edits, consistent naming, and safe defaults—so your library stays tidy.',
      bullets: ['Title/author/series + language', 'Cover & publisher', 'Batch apply templates'],
    },
    {
      icon: Languages,
      title: 'Translation that runs in the background',
      desc: 'Start a job, close your laptop, come back later. We keep progress and notify you.',
      bullets: ['Queue + retries', 'Progress and ETA', 'Works even for long books (hours)'],
    },
    {
      icon: FileDown,
      title: 'EPUB → PDF conversion',
      desc: 'Generate clean, shareable PDFs with consistent typography and spacing.',
      bullets: ['Readable defaults', 'Page breaks + margins', 'Export presets'],
    },
    {
      icon: FileUp,
      title: 'PDF → EPUB conversion',
      desc: 'Turn PDFs into reflowable EPUBs—then refine them with the editor.',
      bullets: ['Reflow-first output', 'Structure cleanup', 'Fonts and style normalization'],
    },
  ] as const

  return (
    <section id="features" className="container pt-12 md:pt-16 lg:pt-20">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-120px' }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={fadeUp} className="max-w-2xl space-y-3">
          <h2 className="text-pretty text-2xl font-semibold tracking-tight md:text-3xl">
            Everything you need to take an EPUB from messy to organized.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Designed like a modern SaaS tool: clean layout, clear hierarchy, and delightful motion where it
            matters.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <Card className="h-full border border-border/70 bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border bg-background">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">{f.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-foreground/70" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

