export default function ShellBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_500px_at_50%_-10%,hsl(var(--primary)/0.08),transparent_70%)] dark:bg-[radial-gradient(1200px_500px_at_50%_-10%,hsl(var(--primary)/0.28),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_400px_at_10%_15%,rgba(255,255,255,0.85),transparent_60%)] dark:bg-[radial-gradient(900px_400px_at_10%_15%,rgba(255,255,255,0.04),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.03))] dark:bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.4))]" />
      <div className="absolute left-1/2 top-[-18rem] h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,hsl(var(--primary)/0.06),transparent_25%,transparent_55%,hsl(var(--primary)/0.04),transparent_85%)] dark:bg-[conic-gradient(from_180deg_at_50%_50%,hsl(var(--primary)/0.22),transparent_25%,transparent_55%,hsl(var(--primary)/0.14),transparent_85%)] blur-3xl" />
    </div>
  )
}

