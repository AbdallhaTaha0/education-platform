const { build } = require('/srv/client/node_modules/esbuild');
build({ entryPoints: ['/integration/player-entry.tsx'], outfile: '/integration/out/dist/player-fixture.js', bundle: true, format: 'iife', jsx: 'automatic', nodePaths: ['/srv/client/node_modules'],
  alias: { dashjs: '/integration/player-dash.ts' }, plugins: [{ name: 'fixture-presentation', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/\.\.\/(auth|i18n)$/ }, () => ({ path: '/integration/player-auth.ts' }));
  } }],
}).catch(() => process.exit(1));
