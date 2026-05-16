import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { BookOpen, Copy, Check } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

interface MarkdownViewerProps {
  content: string
  title?: string | null
}

interface Frontmatter {
  name?: string
  description?: string
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter | null; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: raw }

  const fm: Frontmatter = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      const val = kv[2].replace(/^["']|["']$/g, '')
      if (kv[1] === 'name') fm.name = val
      if (kv[1] === 'description') fm.description = val
    }
  }
  return { frontmatter: fm, body: match[2] }
}

const markdownComponents = {
  code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
    const isInline = !className
    return isInline ? (
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={cn('text-xs leading-relaxed', className)} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="text-xs bg-muted/60 p-3 rounded-lg overflow-x-auto border border-border/50 font-mono leading-relaxed my-2">
      {children}
    </pre>
  ),
  h1: ({ children }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-base font-bold text-foreground mt-4 mb-3 pb-2 border-b border-border">
      {children}
    </h1>
  ),
  h2: ({ children }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-sm font-semibold text-foreground mt-4 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-xs font-semibold text-muted-foreground mt-3 mb-1.5">
      {children}
    </h3>
  ),
  p: ({ children }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="text-xs leading-relaxed text-foreground/85 my-1.5">
      {children}
    </p>
  ),
  ul: ({ children }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="text-xs text-foreground/85 space-y-0.5 my-1.5 pl-4 list-disc [&_li::marker]:text-primary">
      {children}
    </ul>
  ),
  ol: ({ children }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="text-xs text-foreground/85 space-y-0.5 my-1.5 pl-4 [&_li::marker]:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  blockquote: ({ children }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-xs text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} className="text-primary hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

export function MarkdownViewer({ content, title }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false)
  const { frontmatter, body } = useMemo(() => parseFrontmatter(content), [content])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="bg-gradient-to-r from-card via-primary/5 to-card/80 px-4 py-3 border-b border-border flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center shrink-0 shadow-sm">
          <BookOpen size={18} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {title ?? frontmatter?.name ?? 'Markdown'}
          </div>
          {frontmatter?.description && (
            <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
              {frontmatter.description}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy() }}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="px-4 py-3 max-h-[420px] overflow-y-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  )
}
