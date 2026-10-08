const { build } = require('/srv/client/node_modules/esbuild');
const { readFileSync, writeFileSync } = require('node:fs');
const css = readFileSync('/evidence/dist/index.html', 'utf8').match(/href="\/assets\/(index-[^"]+\.css)"/)[1];
writeFileSync('/evidence/dist/review.html', `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/${css}"></head><body><div id="root"></div><script src="/review.js"></script></body></html>`);
build({ entryPoints: ['/fixture/entry.tsx'], outfile: '/evidence/dist/review.js', bundle: true, format: 'iife', jsx: 'automatic', nodePaths: ['/srv/client/node_modules'], define: { 'import.meta.env': '{}' } }).catch(() => process.exit(1));
