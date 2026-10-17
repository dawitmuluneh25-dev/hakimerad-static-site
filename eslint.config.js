/**
 * ESLint flat configuration (ESLint 9).
 *
 * This supersedes .eslintrc.json, which ESLint 9 no longer reads: from v9 the
 * default config file is eslint.config.js. The original ruleset is preserved —
 * eslint:recommended, the prettier plugin, and the same two warning-level rules.
 *
 * `globals` supplies the browser and Node global names so that eslint:recommended's
 * no-undef rule stays enabled without hand-maintaining a globals list.
 */
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

/* The ruleset carried over from .eslintrc.json, unchanged. */
const sharedRules = {
  ...js.configs.recommended.rules,
  // Last, so nothing in eslint:recommended fights Prettier's formatting.
  ...prettierConfig.rules,
  'prettier/prettier': 'error',
  'no-console': 'warn',
  'no-unused-vars': 'warn',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'fonts/**', 'images/**'],
  },
  {
    // Browser scripts. js/config.js, js/theme-boot.js and js/main.js are loaded
    // with plain <script> tags (theme-boot.js in <head>, the other two at the
    // end of <body>), so they are classic scripts, not modules.
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    plugins: { prettier },
    rules: sharedRules,
  },
  {
    // Build and dev-server tooling. Node ESM, and ES2022 is required for the
    // top-level `await main();` at the foot of scripts/build.mjs.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: { prettier },
    rules: sharedRules,
  },
];
