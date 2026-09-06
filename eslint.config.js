import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * Law 4 of the spine: no screen talks to Supabase directly.
 *
 * Written here, not in a document, because a law that depends on goodwill is
 * not a law. It forbids both the package (the only way to build a client) and
 * the client files inside the repository, so it cannot be dodged with a
 * relative import.
 */
export const RESTRICTED_IMPORTS = [
  'error',
  {
    patterns: [
      {
        group: [
          '@supabase/*',
          '@supabase/*/**',
          '**/repository/supabase*',
          '*/repository/supabase*',
          './supabase*',
          '../**/repository/supabase*',
        ],
        message:
          'Law 4: the Supabase client is used only in src/repository/. ' +
          'Screens ask the repository and receive answers from it.',
      },
    ],
  },
]

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  // Application code.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      // The typescript-eslint variant, not the base rule: the base rule lets
      // `import type` through, and a type imported from the package is still
      // an import.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': RESTRICTED_IMPORTS,
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },

  // The only place allowed to touch Supabase.
  {
    files: ['src/repository/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  // The browser checkers: part of their code runs in Node and part inside the
  // page, so they see the globals of both.
  {
    files: [
      'scripts/check-layout.mjs',
      'scripts/check-cycle.mjs',
      'scripts/check-quick-actions-row.mjs',
      'scripts/lib/layout.mjs',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },

  // Configuration files and the checker scripts run in Node.
  {
    files: ['*.{js,ts,mjs}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
)
