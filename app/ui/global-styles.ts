/**
 * App-owned design tokens and base styles. Inlined into the document head so
 * the first paint needs no extra request (≈2 KB compressed). Component styles
 * are generated with `css(...)` into the `rmx` layer.
 *
 * Only Baseline "widely available" features are used; there are no polyfills.
 */
export const globalStyles = /* css */ `
@layer base, rmx, app;

@layer base {
  :root {
    color-scheme: light dark;
    --bg: #f5f6f8;
    --surface: #ffffff;
    --surface-2: #eef1f5;
    --surface-3: #e3e8ef;
    --text: #151a21;
    --text-muted: #5a6472;
    --border: #dce1e8;
    --accent: #1d5bd6;
    --accent-soft: #e5edfd;
    --accent-text: #1647a8;
    --joker: #a55d00;
    --joker-soft: #fff1d6;
    --lonely: #0b7566;
    --lonely-soft: #daf4ee;
    --danger: #b3261e;
    --danger-soft: #fdecea;
    --focus: #1d5bd6;
    --shadow: 0 1px 2px rgb(16 24 40 / 0.06), 0 1px 3px rgb(16 24 40 / 0.08);
    --radius: 12px;
    --radius-sm: 8px;
    --page: min(100% - 2rem, 60rem);
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0e1115;
      --surface: #151a20;
      --surface-2: #1c222a;
      --surface-3: #262d37;
      --text: #e7eaee;
      --text-muted: #9ba5b2;
      --border: #2a313b;
      --accent: #7ea8ff;
      --accent-soft: #1a2944;
      --accent-text: #a8c4ff;
      --joker: #f2b64c;
      --joker-soft: #3a2a0d;
      --lonely: #55d3bf;
      --lonely-soft: #0f2f2a;
      --danger: #ff8a80;
      --danger-soft: #3b1614;
      --focus: #7ea8ff;
      --shadow: 0 1px 2px rgb(0 0 0 / 0.4);
    }
  }

  *, *::before, *::after { box-sizing: border-box; }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    scrollbar-gutter: stable;
  }

  body {
    margin: 0;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 1rem;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, p, dl, dd, figure { margin: 0; }
  ul, ol { margin: 0; padding: 0; list-style: none; }

  a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 0.2em; }

  button, input, select, textarea { font: inherit; color: inherit; }

  table { border-collapse: collapse; font-variant-numeric: tabular-nums; }

  :focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link {
    position: absolute;
    left: 1rem;
    top: 0.5rem;
    z-index: 100;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translateY(-200%);
  }
  .skip-link:focus-visible { transform: none; }

  @keyframes enter-up {
    from { opacity: 0; transform: translateY(8px); }
  }
  @keyframes enter-down {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  }
  @keyframes enter-fade {
    from { opacity: 0; }
  }

  @media (forced-colors: active) {
    :focus-visible { outline-color: Highlight; }
  }
}
`
