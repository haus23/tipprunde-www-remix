import type { Handle, RemixNode } from 'remix/ui'
import { css, unsafeHTML } from 'remix/ui'
import { ImportMap } from 'remix/ui/server'

import type { ScriptEntry } from '../assets.ts'
import { globalStyles } from './global-styles.ts'

export interface DocumentProps {
  title: string
  entry: ScriptEntry
  description?: string
  children?: RemixNode
}

const DEFAULT_DESCRIPTION = 'Tabelle, Tipps und Spiele der Haus-23-Tipprunde.'

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, entry, description = DEFAULT_DESCRIPTION, children } = handle.props
    return (
      <html lang="de">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <meta name="theme-color" content="#f5f6f8" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#0e1115" media="(prefers-color-scheme: dark)" />
          <meta name="description" content={description} />
          <title>{title}</title>
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <style innerHTML={unsafeHTML(globalStyles)} />
          <ImportMap value={entry.importMap} />
          {entry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={entry.href}></script>
        </head>
        <body mix={bodyStyle}>{children}</body>
      </html>
    )
  }
}

const bodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
})
