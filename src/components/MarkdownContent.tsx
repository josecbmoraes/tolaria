import { Children, memo, useMemo, type MouseEvent, type ReactNode } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { preprocessWikilinks, WIKILINK_SCHEME } from '../utils/chatWikilinks'
import { supportsModernRegexFeatures } from '../utils/regexCapabilities'
import { openExternalUrl } from '../utils/url'

const MODERN_REGEX_AVAILABLE = supportsModernRegexFeatures()
const REMARK_PLUGINS = MODERN_REGEX_AVAILABLE ? [remarkGfm] : []
const REHYPE_PLUGINS = MODERN_REGEX_AVAILABLE ? [rehypeHighlight] : []

function wikilinkUrlTransform(url: string): string {
  if (url.startsWith(WIKILINK_SCHEME)) return url
  return defaultUrlTransform(url)
}

function isExplicitWebUrl(href?: string): href is string {
  const lowerHref = href?.trim().toLowerCase() ?? ''
  return lowerHref.startsWith('http://') || lowerHref.startsWith('https://')
}

function openExplicitWebUrl(event: MouseEvent<HTMLAnchorElement>, href: string) {
  event.preventDefault()
  void openExternalUrl(href).catch((error) => {
    console.warn('[ai] Failed to open external link:', error)
  })
}

function renderSoftLineBreaks(children: ReactNode): ReactNode {
  const renderedChildren: ReactNode[] = []
  let textOffset = 0

  for (const child of Children.toArray(children)) {
    if (typeof child !== 'string') {
      renderedChildren.push(child)
      continue
    }

    let firstLine = true
    for (const line of child.split(/\r?\n/u)) {
      if (!firstLine) {
        renderedChildren.push(<br key={`soft-break-${textOffset}`} />)
        textOffset += 1
      }
      renderedChildren.push(line)
      textOffset += line.length
      firstLine = false
    }
  }

  return renderedChildren
}

interface MarkdownContentProps {
  content: string
  onWikilinkClick?: (target: string) => void
  preserveLineBreaks?: boolean
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  onWikilinkClick,
  preserveLineBreaks = false,
}: MarkdownContentProps) {
  const processedContent = useMemo(
    () => onWikilinkClick ? preprocessWikilinks(content) : content,
    [content, onWikilinkClick],
  )

  const components = useMemo(() => {
    return {
      p: ({ children }: { children?: ReactNode }) => (
        <p>{preserveLineBreaks ? renderSoftLineBreaks(children) : children}</p>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (onWikilinkClick && href?.startsWith(WIKILINK_SCHEME)) {
          const target = decodeURIComponent(href.slice(WIKILINK_SCHEME.length))
          return (
            <a
              ref={(node) => {
                node?.setAttribute('role', 'link')
                node?.setAttribute('tabindex', '0')
              }}
              href={href}
              className="chat-wikilink border-0 bg-transparent p-0"
              data-wikilink-target={target}
              onClick={(event) => {
                event.preventDefault()
                onWikilinkClick(target)
              }}
            >
              {children}
            </a>
          )
        }
        if (isExplicitWebUrl(href)) {
          return <a href={href} onClick={(event) => openExplicitWebUrl(event, href)}>{children}</a>
        }
        return <a href={href}>{children}</a>
      },
    }
  }, [onWikilinkClick, preserveLineBreaks])

  return (
    <div className="ai-markdown min-w-0 max-w-full overflow-hidden">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        urlTransform={onWikilinkClick ? wikilinkUrlTransform : undefined}
      >
        {processedContent}
      </Markdown>
    </div>
  )
})
