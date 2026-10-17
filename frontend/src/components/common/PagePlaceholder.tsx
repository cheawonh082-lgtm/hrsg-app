import type { LucideIcon } from 'lucide-react'

export function PagePlaceholder({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center">
        <Icon aria-hidden className="size-10 text-muted" />
        <p className="max-w-md text-muted">{description}</p>
      </div>
    </section>
  )
}
