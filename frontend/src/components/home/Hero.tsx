import { motion } from 'framer-motion'
import { ArrowRight, Clock, Languages, Shield, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
}

const floatingVariants = {
  initial: { y: 0 },
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="container relative z-10 px-4 mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          {/* <motion.div variants={itemVariants} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-8">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">New: AI-Powered Batch Translation</span>
          </motion.div> */}

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70"
          >
            The Ultimate Toolkit for <span className="text-primary italic">Perfect</span> EPUBs
          </motion.h1>
          {/* // after editor */}
          {/* <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed"
          >
            Professional-grade metadata editing, seamless translations, and high-fidelity conversions. Everything your digital library needs, in one elegant interface.
          </motion.p> */}
          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed"
          >
            Seamless translation in one elegant interface.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Link to="/signin">
                Get Started for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full hover:bg-secondary/50 transition-colors">
              <a href="#faq" className="hover:text-primary transition-colors">
              How it Works
              </a>
            </Button>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-sm text-muted-foreground/80 border-t border-border pt-12 w-full max-w-3xl"
          >
            <div className="flex flex-col items-center gap-2">
              <Shield className="h-5 w-5 mb-1" />
              <span>Privately Processed</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-5 w-5 mb-1" />
              <span>Background Tasks</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Languages className="h-5 w-5 mb-1" />
              <span>12+ Languages</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="h-5 w-5 mb-1" />
              <span>One-Click Export</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Floating Abstract Element */}
        <motion.div
          variants={floatingVariants}
          initial="initial"
          animate="animate"
          className="absolute top-1/2 right-[5%] -z-10 hidden xl:block"
        >
          <div className="w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        </motion.div>
      </div>
    </section>
  )
}

