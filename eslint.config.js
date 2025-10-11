// Flat config za ESLint (ESLint 9 preporučen; radi i na 8.57.x uz upozorenja)
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  // Ignori (zamjena za .eslintignore)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.vscode/**',
      '*.log',
      '*.css.d.ts',
    ],
  },

  // Bazni setovi pravila
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Glavni blok pravila za naše izvore
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React Hooks & Refresh
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Ne koristimo "unused-imports" plugin – ovo je dovoljno
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Strogoća – možeš privremeno sniziti na 'warn' dok ne središ kod
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Popuštanje za “teške” datoteke (privremeno olakšanje za any)
  {
    files: [
      'src/context/PixelStreamingContext.tsx',
      'src/context/InstanceManagementContext.tsx',
      'src/services/queuedUnreal.ts',
      'src/components/DebugOverlay/DebugOverlay.tsx',
      'src/components/SkinAccordion/SkinAccordion.tsx',
      'src/components/HairAccordion/HairAccordion.tsx',
      'src/components/ExtrasAccordion/ExtrasAccordion.tsx',
      'src/components/BodyAccordion/BodyAccordion.tsx',
      'src/pages/UnrealMeasurements.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Isključi “only-export-components” za kontekste (jer exportaju i helpere)
  {
    files: [
      'src/context/AuthDataContext.tsx',
      'src/context/AvatarConfigurationContext.tsx',
      'src/context/AvatarContext.tsx',
      'src/context/UserSettingsContext.tsx',
      'src/context/InstanceManagementContext.tsx',
      'src/context/PixelStreamingContext.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
