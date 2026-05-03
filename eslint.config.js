import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Surface `any` uses as a nag, not a build-breaking error.
      // External boundaries (Supabase rows, untyped API responses) legitimately
      // need `any` and fighting it with `unknown` + type guards usually costs
      // more than the safety gained. If tightened later, do it file-by-file.
      '@typescript-eslint/no-explicit-any': 'warn',

      // React Compiler-aware rules from eslint-plugin-react-hooks@7. They flag
      // patterns that would prevent the Compiler's auto-memoization from
      // working — aspirational for codebases using babel-plugin-react-compiler,
      // but not bugs in classic React (which this codebase uses). Keep them as
      // visible warnings so we can adopt Compiler cleanly later.
      //
      // The two classic rules (rules-of-hooks + exhaustive-deps) are NOT
      // downgraded — those flag real render-correctness bugs in any React app.
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // Honor the `_`-prefix convention for intentionally-unused args/vars.
      // Catch signature-required params (e.g., Vercel handler `ctx`) and
      // placeholder destructure slots without failing the build.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
])
