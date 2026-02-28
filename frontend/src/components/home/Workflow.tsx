import { motion } from 'framer-motion'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fadeUp } from '@/components/home/animations'
import { cn } from '@/lib/utils'

export default function Workflow() {
  const steps = [
    {
      k: '01',
      title: 'Upload',
      desc: 'Drop an EPUB or PDF. We analyze structure and extract metadata.',
    },
    {
      k: '02',
      title: 'Edit & run tools',
      desc: 'Fix metadata, queue a translation, convert formats, and clean styles.',
    },
    {
      k: '03',
      title: 'Export',
      desc: 'Download the final EPUB/PDF. Keep a history so you can reproduce outputs.',
    },
  ]

  return (
    <section id="workflow" className="container pt-12 md:pt-16 lg:pt-20">
      <div className="grid items-start gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-120px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          >
            <motion.div variants={fadeUp} className="space-y-3">
              <Badge variant="outline" className="bg-background/60">
                Workflow
              </Badge>
              <h2 className="mt-4 text-pretty text-2xl font-semibold tracking-tight md:text-3xl">
                Three steps. Zero tool chaos.
              </h2>
              <p className="text-pretty text-muted-foreground">
                Translation can take hours for long books, so jobs keep running in the background with progress,
                retries, and notifications.
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="lg:col-span-7">
          <div className="grid gap-5">
            {steps.map((s) => (
              <Card key={s.k} className="relative overflow-hidden">
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 w-1',
                    s.k === '02' ? 'bg-primary/60' : 'bg-border',
                  )}
                />
                <CardHeader className="flex-row items-start justify-between gap-6">
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription className="mt-1">{s.desc}</CardDescription>
                  </div>
                  <div className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    {s.k}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

