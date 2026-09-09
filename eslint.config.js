import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import a11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'

/* The rules worth failing a build over on this app.

   It holds controlled records, so the ones that matter most are not
   style: a constant condition, an unused branch or a hook called out of
   order is how `f.adminOnly && false` sat in the form engine disabling
   nothing at all. Those are errors here. Formatting is not linted —
   there is no formatter in this project and inventing one now would bury
   the findings that matter in a diff of quote marks. */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'scripts/gen-*.mjs'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      // 'latest', not a year: jobOrders.js imports JSON with an import
      // attribute, which older parser targets reject outright.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': a11y, react },
    settings: { react: { version: '18.3' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...a11y.flatConfigs.recommended.rules,
      // Without these two, every component and icon imported for JSX
      // reads as an unused variable — 236 of the first run's 312 errors.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',

      // The class of defect this app actually shipped.
      'no-constant-binary-expression': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-dupe-else-if': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'require-atomic-updates': 'error',

      // An unused name is usually a rename that did not finish. The
      // deliberate ones are prefixed, and withoutOpenReturn destructures
      // three keys precisely to drop them.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Nothing here should reach for a native dialog: they cannot be
      // styled, cannot carry a reason field, and block the whole tab.
      'no-alert': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/label-has-associated-control': 'off',

      /* Warnings, not errors, and the difference is deliberate.

         The 46 click-without-key findings are a real backlog — the audit
         names keyboard access to divs acting as buttons as an open risk
         — but they are a design change across a dozen screens, not
         something to fix in the same pass that stops evidence being
         deleted. Failing the build on them would mean turning the gate
         off on the day it was installed, which is how a gate stops
         meaning anything. They are counted, reported, and next. */
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',

      /* The React Compiler's rules, which this codebase predates. Each
         one flags a working pattern the compiler cannot prove safe — a
         ref read during render to compare against the last saved value,
         a cursor mutated inside a map, Date.now() inside a handler
         declared in the body. They are worth seeing and none of them
         ships a bug today. */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    files: ['**/*.test.{js,jsx}', 'tests/**/*.{js,jsx,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
]
