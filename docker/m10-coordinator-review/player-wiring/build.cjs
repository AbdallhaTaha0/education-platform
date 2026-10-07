const { build } = require('/srv/client/node_modules/esbuild');
build({ entryPoints: ['/fixture/entry.tsx'], outfile: '/fixture/out/player.js', bundle: true, format: 'iife', jsx: 'automatic',
  nodePaths: ['/srv/client/node_modules'], alias: { dashjs: '/fixture/dash.ts' },
  plugins: [{ name: 'fixture-auth', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/\.\.\/(auth|i18n)$/ }, () => ({ path: '/fixture/auth.ts' }));
  } }],
}).catch(() => process.exit(1));
