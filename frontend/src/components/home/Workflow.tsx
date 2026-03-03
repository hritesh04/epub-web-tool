import { motion } from 'framer-motion'
import { CloudUpload, Cpu, Download } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  {
    k: '01',
    title: 'Instant Import',
    desc: 'Drop your EPUB. Our systems automatically extract metadata and analyze structure.',
    icon: CloudUpload,
    color: 'text-blue-500',
  },
  {
    k: '02',
    title: 'Intelligent Processing',
    // after editor
    // desc: 'Queue translations, batch-edit metadata, or normalize styles. We handle the heavy lifting in the background.',
    desc: 'Queue translation. We handle the heavy lifting in the background.',
    icon: Cpu,
    color: 'text-purple-500',
  },
  {
    k: '03',
    title: 'Clean Export',
    // after editor
    // desc: 'Download your polished book in multiple formats. Ready for any device.',
    desc: 'Download your polished book. Ready for any device.',
    icon: Download,
    color: 'text-emerald-500',
  },
]

export default function Workflow() {
  return (
    <section id="workflow" className="container px-4 py-20 mx-auto">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary">
            Step-by-Step
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Three steps to a <br />
            <span className="text-primary italic">Perfect</span> Library.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            We’ve eliminated the complexity of traditional ebook management. No local installs, no registry hacks—just a powerful, automated workflow in your browser.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>No software installation required</span>
            </div>
            {/* <div className="flex items-center gap-3 text-sm font-medium">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Real-time persistence across devices</span>
            </div> */}
          </div>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-[39px] top-8 bottom-8 w-px bg-gradient-to-b from-primary/50 via-border to-transparent hidden md:block" />
          
          <div className="grid gap-8">
            {steps.map((s, idx) => (
              <motion.div
                key={s.k}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
              >
                <Card className="relative overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm group hover:border-primary/30 transition-all">
                  <CardHeader className="flex-row items-start gap-6 space-y-0 p-6">
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background border shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary tracking-widest uppercase">{s.k}</span>
                        <CardTitle className="text-lg">{s.title}</CardTitle>
                      </div>
                      <CardDescription className="text-base text-muted-foreground">
                        {s.desc}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
