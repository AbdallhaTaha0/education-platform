// Only mounted into a disposable CLI container to exercise the overridden merger.
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: { path: './prisma/migrations', seed: 'node -e "process.exit(0)"' },
});
