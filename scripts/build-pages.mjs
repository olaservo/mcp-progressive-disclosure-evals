// Renders the long write-up from markdown to a page in the same style as explainer.html.
// The markdown is the source of truth: edit drafts/wg-findings-writeup.md, run `npm run pages:build`, commit both.
// The Google Doc copy is made by importing the same markdown into Docs by hand.
import { readFileSync, writeFileSync } from 'node:fs'
import { marked } from 'marked'

const SOURCE = 'drafts/wg-findings-writeup.md'
const TARGET = 'writeup.html'

const markdown = readFileSync(SOURCE, 'utf8')
const title = /^# (.+)$/m.exec(markdown)?.[1] ?? 'Write-up'
// The first paragraph is the drafting note; the page gets its own standfirst instead.
const body = markdown.replace(/^# .+\n\n[^\n]+\n\n/, '')
const html = marked.parse(body, { gfm: true })

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap" rel="stylesheet">
<title>${escapeHtml(title)}</title>
<style>
  :root { --ink: #1a1a18; --bg: #faf9f5; --border: #e2e0d8; --label: #52514E; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --ink: #e6e4dc; --bg: #17171a; --border: #3a3a3e; --label: #A6A49C; color-scheme: dark; }
  }
  :root[data-theme="dark"] { --ink: #e6e4dc; --bg: #17171a; --border: #3a3a3e; --label: #A6A49C; color-scheme: dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 2rem 1rem; color: var(--ink); background: var(--bg); }
  main { max-width: 820px; margin: 0 auto; }
  h1, h2, h3 { font-family: "Comic Sans MS", "Comic Sans", "Comic Neue", cursive; font-weight: 500; }
  h1 { font-size: 1.5rem; margin: 0; }
  h2 { font-size: 1.3rem; margin-top: 2.5rem; }
  h3 { font-size: 1.15rem; margin-top: 2rem; }
  .masthead { border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 2rem; }
  .masthead nav { font-size: 0.85rem; margin-top: 0.6rem; }
  p, ul, ol { line-height: 1.7; }
  li { margin: 0.3rem 0; }
  .tablewrap { overflow-x: auto; margin: 1.2rem 0; }
  table { border-collapse: collapse; font-size: 0.85rem; width: 100%; }
  th, td { text-align: left; padding: 0.35rem 0.6rem 0.35rem 0; border-bottom: 1px solid var(--border); vertical-align: top; white-space: nowrap; }
  td:first-child, th:first-child { white-space: normal; }
  th { font-weight: 500; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.85em; }
  pre { overflow-x: auto; padding: 0.8rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; }
  a { color: inherit; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.85rem; }
  footer p { margin: 0.3rem 0; }
  #theme-toggle { position: fixed; top: 1rem; right: 1rem; font: inherit; font-size: 0.85rem; padding: 0.3rem 0.7rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--ink); cursor: pointer; }
</style>
</head>
<body>
<button id="theme-toggle" type="button" aria-label="Toggle light and dark theme">theme</button>
<main>
<header class="masthead">
<h1>${escapeHtml(title)}</h1>
<p>The long form behind <a href="explainer.html">the one-page explainer</a>: every table, every accepted answer, every limit.</p>
<nav aria-label="Related pages">
  <a href="explainer.html">the explainer</a> &middot;
  <a href="https://github.com/olaservo/mcp-progressive-disclosure-evals" target="_blank">the demo repository</a> &middot;
  <a href="https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-08" target="_blank">the session traces</a> &middot;
  <a href="https://modelcontextprotocol.io/community/working-groups/progressive-disclosure" target="_blank">the working group's charter</a>
</nav>
</header>
${wrapTables(html)}
</main>
<footer>
<p>Rendered from <a href="https://github.com/olaservo/mcp-progressive-disclosure-evals/blob/main/drafts/wg-findings-writeup.md" target="_blank"><code>drafts/wg-findings-writeup.md</code></a> by <code>npm run pages:build</code>. The markdown is the source; edit it, not this file.</p>
<p>Written by Ola Hungerford. The views are mine, not the working group's.</p>
</footer>
<script>
  (function () {
    var root = document.documentElement, btn = document.getElementById('theme-toggle');
    try { var saved = localStorage.getItem('theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  })();
</script>
</body>
</html>
`

writeFileSync(TARGET, page)
console.log(`${SOURCE} -> ${TARGET} (${page.length.toLocaleString()} bytes)`)

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
/** Wide tables scroll inside a wrapper on narrow screens. */
function wrapTables(rendered) {
  return rendered.replace(/<table>/g, '<div class="tablewrap"><table>').replace(/<\/table>/g, '</table></div>')
}
