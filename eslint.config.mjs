import js from '@eslint/js';
import gitignore from 'eslint-config-flat-gitignore';
import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,tsx}'];
const tsFiles = ['**/*.{ts,tsx}'];
const hub = ['packages/hub/**/*.{js,mjs,cjs,ts,tsx}'];
const serverFiles = ['packages/mcp-server/**/*.{js,mjs,cjs,ts,tsx}'];
const sharedFiles = ['packages/shared/**/*.{js,mjs,cjs,ts,tsx}'];
const testFiles = ['**/*.{test,spec}.{js,mjs,cjs,ts,tsx}'];

export default [
  gitignore(),
  {
    ignores: ['**/.next/**', '**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-undef': 'off',
    },
  },
  {
    files: hub,
    plugins: {
      '@next/next': nextPlugin,
    },
    settings: {
      next: {
        rootDir: 'packages/hub',
      },
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: [...serverFiles, ...sharedFiles],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: testFiles,
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        test: 'readonly',
      },
    },
  },
  {
    files: sourceFiles,
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'error',
    },
  },
];
