import Hero from '@/components/home/Hero'
import Features from '@/components/home/Features'
import Workflow from '@/components/home/Workflow'
import FAQ from '@/components/home/FAQ'
import ShellBackground from '@/components/home/ShellBackground'

export default function Home() {
  return (
    <>
    {/* <div className="relative flex h-10 flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-2 hidden h-[260px] dark:block"
      >
        <div className="h-full bg-[radial-gradient(900px_360px_at_top,hsl(var(--primary)/0.45),transparent_70%)]" />
      </div>
      </div> */}
    <div className="flex-1 flex flex-col">
      <ShellBackground />
      <main className="space-y-16 md:space-y-24 lg:space-y-28">
        <Hero />
        {/* // after editor */}
        {/* <Features /> */}
        <Workflow />
        <FAQ />
      </main>
    </div>
        </>
  )
}

