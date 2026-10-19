import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '.agent',
      '.agents',
      '.claude',
      '.github/skills',
      '.kiro/skills',
      '.impeccable/.kiro/skills'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: { 'react/prop-types': 'off' }
  },
  {
    files: ['src/shared/email-delivery/{index,domain/**/*,ports/**/*,application/**/*}.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['resend', 'electron', 'typeorm', 'node:*', '**/providers/**', '@shared/*'],
              message: 'El núcleo de email-delivery no depende de SDKs, Node ni de otros módulos.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'src/shared/email-delivery/**',
      'src/main/email.ts',
      'src/main/test/**',
      'src/test/**',
      'workers/leads-hub/src/index.ts',
      'workers/leads-hub/src/*.test.ts',
      'services/cloud/src/app.module.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['resend', '**/email-delivery/providers/**'],
              message:
                'Usa @shared/email-delivery. Solo las raíces de composición crean proveedores.'
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
