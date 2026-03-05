import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

const faqs = [
  {
    q: "How secure are my uploaded books?",
    a: "We prioritize your privacy. Books are processed in an isolated environment and are never used for training models. You can delete your books at any time before 7 days after which your book is deleted automatically."
  },
  // {
  //   q: "What languages are supported for translation?",
  //   a: "We currently support 12+ major languages including English, Spanish, French, German, Japanese, and Chinese. Our translation engine preserves XHTML structure and styling, so the book looks the same, just in a different language."
  // },
  // {
  //   q: "Can I edit the raw XHTML code?",
  //   a: "Absolutely. Our editor gives you full access to content.opf, toc.ncx, and individual chapter XHTML files for fine-grained control over your ebook's structure and appearance."
  // },
  {
    q: "Is the service free to use?",
    a: "We offer a free tier that lets you translate and edit small ebooks to explore the platform. For larger books, faster processing, and advanced features, we provide affordable paid plans."
  },
  {
    q: "How long does translation take?",
    a: "Translation time depends on the number of chapter in your ebook. Small books are usually processed within minutes, while larger ebooks may take longer. You can monitor real-time progress from your dashboard."
  }
]
export default function FAQ() {
  return (
    <section id="faq" className="container px-4 py-24 mx-auto">
      <div className="max-w-3xl mx-auto mb-20">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h2 className="text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about EpubStudio and our advanced processing workflow.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mb-32">
        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`} className="border rounded-2xl px-6 bg-card/30 backdrop-blur-sm transition-all hover:border-primary/20">
              <AccordionTrigger className="text-left text-lg font-medium hover:no-underline py-6">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base pb-6 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* CTA Footer Section */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-[2.5rem] border bg-card p-8 md:p-16 lg:p-20 text-center"
      >
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Ready to Build Your <br />
            <span className="text-primary italic">Dream</span> Library?
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl">
            Join readers who use EpubStudio to keep their digital collections pristine.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-10 text-lg rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all w-full sm:w-auto">
              <Link to="/signin">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      <footer className="mt-24 pt-12 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
            E
          </div>
          <span className="font-semibold text-foreground">EpubStudio</span>
        </div>
        <div className="flex gap-8">
          {/* // after editor */}
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
          <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
        </div>
      </footer>
    </section>
  )
}
