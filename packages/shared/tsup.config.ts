import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'db/schema/index': 'src/db/schema/index.ts',
    'types/index': 'src/types/index.ts',
    'auth/index': 'src/auth/index.ts',
    'db/client': 'src/db/client.ts',
    'services/index': 'src/services/index.ts',
    'utils/index': 'src/utils/index.ts',
    'constants/index': 'src/constants/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
