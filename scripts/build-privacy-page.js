// Generates docs/privacy-policy.html from src/content/privacyPolicy.js (the in-app policy),
// so the hosted page for the Play Console always matches the app.
// Usage: node scripts/build-privacy-page.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

(async () => {
  const src = path.join(__dirname, '..', 'src', 'content', 'privacyPolicy.js');
  const tmp = path.join(os.tmpdir(), 'privacyPolicy.mjs');
  fs.copyFileSync(src, tmp);
  const { PRIVACY_SECTIONS, PRIVACY_UPDATED, PRIVACY_CONTACT } = await import(pathToFileURL(tmp).href);

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = PRIVACY_SECTIONS.map(s => {
    const items = s.title.startsWith('Permissions')
      ? `<ul>${s.body.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
      : s.body.map(b => `<p>${esc(b)}</p>`).join('');
    const linked = PRIVACY_CONTACT ? items.replace(esc(PRIVACY_CONTACT), `<a href="mailto:${esc(PRIVACY_CONTACT)}">${esc(PRIVACY_CONTACT)}</a>`) : items;
    return `<section><h2>${esc(s.title)}</h2>${linked}</section>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talking Reminder: Voice Alarm – Privacy Policy</title>
<style>
  :root { --ink:#2A3830; --deep:#1A4A40; --mid:#6B8880; --bg:#F8FAF9; --card:#fff; --line:#E8F4F0; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { background:linear-gradient(135deg,#0B2421,#1A4A40 60%,#2D6B5F); color:#fff; padding:48px 20px 40px; }
  header .wrap, main { max-width:720px; margin:0 auto; }
  h1 { font-family:Georgia, serif; font-size:32px; margin:0 0 6px; }
  header p { margin:0; opacity:.75; }
  main { padding:24px 20px 64px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:18px 22px; margin-top:14px; }
  h2 { font-size:18px; color:var(--deep); margin:0 0 8px; }
  p { margin:0 0 8px; } ul { margin:0; padding-left:20px; } li { margin-bottom:6px; }
  a { color:var(--deep); }
</style>
</head>
<body>
<header><div class="wrap"><h1>Privacy Policy</h1><p>Talking Reminder: Voice Alarm · Mati Labs · Last updated ${esc(PRIVACY_UPDATED)}</p></div></header>
<main>
${sections}

</main>
</body>
</html>
`;
  const out = path.join(__dirname, '..', 'docs', 'privacy-policy.html');
  fs.writeFileSync(out, html);
  console.log('Wrote', out);
})();
