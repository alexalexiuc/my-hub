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
  // tsup's DTS build injects `baseUrl`, which TypeScript 6 deprecates. Our own
  // tsconfigs don't use it, so silence the deprecation for the DTS pass only.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: true,
});
