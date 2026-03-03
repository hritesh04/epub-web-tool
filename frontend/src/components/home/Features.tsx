import { motion } from 'framer-motion'
import { Check, FileDown, FileUp, Languages, Tags, Zap } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function Features() {
  const items = [
    {
      icon: Tags,
      title: 'Effortless Metadata',
      desc: 'Bulk edit titles, authors, and series with intelligent defaults and safe-undo caps.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Languages,
      title: 'Background Authored',
      desc: 'Heavy translations run completely in the background. Close your lid; we’ll be here.',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Zap,
      title: 'Real-time Preview',
      desc: 'See exactly how your changes affect the book layout with our live-refreshing reader.',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: FileDown,
      title: 'High-Fidelity PDF',
      desc: 'Convert complex EPUB layouts to print-ready PDFs with professional typography.',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: FileUp,
      title: 'Intelligent Import',
      desc: 'Our reflow engine extracts meaningful structure even from the messiest PDF files.',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: Check,
      title: 'DRM-Free Export',
      desc: 'Your books remain yours. Every export is clean, standards-compliant, and unlocked.',
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
  ] as const

  return (
    <section id="features" className="container px-4 py-20 mx-auto">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
      >
        <div className="flex flex-col items-center text-center mb-16">
          <motion.div variants={itemVariants} className="text-primary font-semibold tracking-wide uppercase text-sm mb-4">
            Capabilities
          </motion.div>
          <motion.h2 variants={itemVariants} className="text-3xl md:text-5xl font-bold mb-6">
            Everything You Need <br className="hidden md:block" /> for a Modern Library
          </motion.h2>
          <motion.p variants={itemVariants} className="text-muted-foreground max-w-2xl">
            Designed like a modern engineering tool: clean hierarchies, clear status, and high-performance operations that don't block your workflow.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((f) => (
            <motion.div key={f.title} variants={itemVariants}>
              <Card className="group h-full border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-2xl ${f.bgColor} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                    <f.icon className={`h-6 w-6 ${f.color}`} />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{f.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed mt-2">
                    {f.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
