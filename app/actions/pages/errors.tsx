import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from '../../routes.ts'
import { EmptyState, PageHeader } from '../../ui/components.tsx'
import { Layout, type ShellData } from '../../ui/layout.tsx'

export function NotFoundPage(handle: Handle<{ shell: ShellData; what?: string }>) {
  return () => (
    <Layout shell={handle.props.shell} title="Nicht gefunden">
      <PageHeader eyebrow="Fehler 404" title="Hoppla, so etwas gibt es bei uns nicht!" />
      <EmptyState title={handle.props.what ?? 'Diese Seite existiert nicht.'}>
        <p>
          Zur <a href={routes.current.ranking.href()}>aktuellen Tabelle</a> oder oben ein anderes Turnier wählen.
        </p>
      </EmptyState>
    </Layout>
  )
}

export function NoChampionshipsPage(handle: Handle<{ shell: ShellData }>) {
  return () => (
    <Layout shell={handle.props.shell} title="Tipprunde">
      <PageHeader title="Tipprunde" />
      <EmptyState title="Noch keine Turniere veröffentlicht.">
        <p>Sobald ein Turnier freigegeben ist, erscheint hier die Tabelle.</p>
      </EmptyState>
    </Layout>
  )
}

export function ErrorPage(handle: Handle<{ shell: ShellData; status: number; title: string; message: string }>) {
  return () => {
    let { shell, status, title, message } = handle.props
    return (
      <Layout shell={shell} title={title}>
        <PageHeader eyebrow={`Fehler ${status}`} title={title} />
        <div mix={boxStyle} role="alert">
          <p>{message}</p>
          <p>
            <a href="">Seite neu laden</a> · <a href={routes.current.ranking.href()}>zur aktuellen Tabelle</a>
          </p>
        </div>
      </Layout>
    )
  }
}

const boxStyle = css({
  display: 'grid',
  gap: '0.5rem',
  padding: '1.25rem 1.5rem',
  borderRadius: 'var(--radius)',
  background: 'var(--danger-soft)',
})
