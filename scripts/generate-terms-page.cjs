const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/constants/policies.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const context = { exports: {} };
vm.runInNewContext(compiled.outputText, context);
const { TERMS_VERSION, TERMS_SECTIONS } = context.exports;
const escape = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const html = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Terms of Use - Varta</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111110; background: #f8f7f4; line-height: 1.65; }
    main { max-width: 760px; margin: auto; padding: 48px 24px; overflow-wrap: anywhere; }
    h1 { font-size: 32px; line-height: 1.2; } h2 { font-size: 20px; margin-top: 32px; }
    p { color: #444; } a { color: #111110; } nav { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 32px; }
  </style>
</head><body><main>
  <h1>Varta Terms of Use</h1>
  <p>Version ${escape(TERMS_VERSION)}</p>
  ${TERMS_SECTIONS.map(({ title, text }) => `<section><h2>${escape(title)}</h2><p>${escape(text)}</p></section>`).join('\n  ')}
  <nav aria-label="Policies"><a href="../">Varta</a><a href="../privacy-policy/">Privacy Policy</a><a href="../account-deletion/">Account Deletion</a><a href="../child-safety/">Child Safety Standards</a></nav>
</main></body></html>
`;
const target = path.join(root, 'docs/terms/index.html');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, html, 'utf8');
console.log('Generated docs/terms/index.html');
