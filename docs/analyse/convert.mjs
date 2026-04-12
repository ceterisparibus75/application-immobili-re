import { readFileSync, writeFileSync, readdirSync } from "fs";
import { marked } from "marked";

const CSS = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Inter, -apple-system, sans-serif;
    background: #f4f6f8;
    color: #1a1a2e;
    line-height: 1.7;
    padding: 0;
  }
  .container {
    max-width: 960px;
    margin: 0 auto;
    background: #fff;
    padding: 48px 56px;
    min-height: 100vh;
    box-shadow: 0 0 40px rgba(0,0,0,0.06);
  }
  h1 {
    font-size: 2em;
    color: #0C2340;
    border-bottom: 3px solid #22B8CF;
    padding-bottom: 12px;
    margin-bottom: 32px;
  }
  h2 {
    font-size: 1.45em;
    color: #1B4F8A;
    margin-top: 40px;
    margin-bottom: 16px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  h3 {
    font-size: 1.15em;
    color: #0C2340;
    margin-top: 28px;
    margin-bottom: 10px;
  }
  h4 {
    font-size: 1.05em;
    color: #1B4F8A;
    margin-top: 20px;
    margin-bottom: 8px;
  }
  p { margin-bottom: 12px; }
  blockquote {
    background: #f0f9ff;
    border-left: 4px solid #22B8CF;
    padding: 14px 20px;
    margin: 16px 0 20px;
    border-radius: 0 8px 8px 0;
    color: #334155;
    font-size: 0.95em;
  }
  blockquote strong { color: #0C2340; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px;
    font-size: 0.9em;
  }
  thead th {
    background: #0C2340;
    color: #fff;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
  }
  tbody td {
    padding: 9px 14px;
    border-bottom: 1px solid #e8ecf0;
    vertical-align: top;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #eef6ff; }
  strong { color: #0C2340; }
  ul, ol { margin: 8px 0 16px 24px; }
  li { margin-bottom: 5px; }
  li ul, li ol { margin-top: 4px; margin-bottom: 4px; }
  code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.88em;
    color: #1B4F8A;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 18px 22px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 14px 0 20px;
    font-size: 0.85em;
    line-height: 1.6;
  }
  pre code {
    background: none;
    color: inherit;
    padding: 0;
  }
  hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 32px 0;
  }
  .nav {
    background: #0C2340;
    padding: 16px 0;
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .nav a {
    color: #22B8CF;
    text-decoration: none;
    margin: 0 12px;
    font-size: 0.85em;
    font-weight: 500;
  }
  .nav a:hover { color: #fff; }
  .nav a.active { color: #fff; border-bottom: 2px solid #22B8CF; padding-bottom: 2px; }
  @media print {
    body { background: #fff; }
    .container { box-shadow: none; padding: 20px; }
    .nav { display: none; }
    table { font-size: 0.8em; }
    h1 { font-size: 1.6em; }
  }
  @media (max-width: 700px) {
    .container { padding: 24px 20px; }
    table { font-size: 0.8em; }
    thead th, tbody td { padding: 6px 8px; }
  }
</style>
`;

const files = [
  { file: "01-audit-fonctionnel.md", title: "Audit fonctionnel", short: "01" },
  { file: "02-comparatif-concurrentiel.md", title: "Comparatif concurrentiel", short: "02" },
  { file: "03-pistes-amelioration.md", title: "Améliorations", short: "03" },
  { file: "04-scalabilite-infrastructure.md", title: "Scalabilité", short: "04" },
  { file: "05-strategie-marketing.md", title: "Marketing", short: "05" },
];

const dir = "/home/user/application-immobili-re/docs/analyse";

for (const f of files) {
  const md = readFileSync(`${dir}/${f.file}`, "utf-8");
  const body = marked.parse(md);

  const nav = files
    .map((n) => {
      const cls = n.short === f.short ? ' class="active"' : "";
      return `<a href="${n.file.replace(".md", ".html")}"${cls}>${n.title}</a>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyGestia - ${f.title}</title>
  ${CSS}
</head>
<body>
  <nav class="nav">${nav}</nav>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;

  const outFile = `${dir}/${f.file.replace(".md", ".html")}`;
  writeFileSync(outFile, html);
  console.log(`OK: ${outFile}`);
}
