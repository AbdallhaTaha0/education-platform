const fs = require('node:fs');
const ts = require('/srv/client/node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { previewDocument } = require('/srv/client/src/features/ide/preview.ts');
fs.writeFileSync('/evidence/preview-fixture.html', previewDocument({ html: '<h1>Preview fixture</h1>', css: '', javascript: 'console.log("preview-fixture-ok")' }, 'audit-preview', 'auditfixture'));
