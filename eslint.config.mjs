// eslint.config.mjs
import globals from 'globals';
import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  // Global ignores apply to all configurations
  {
    ignores: [
      'node_modules/',
      'dist/',
      'webpack.config.js',
      'eslint.config.mjs', // Ignore self
      '.prettierrc.js',   // Ignore Prettier config file
      '*.user.js',
    ],
  },

  // Base ESLint recommended rules
  eslintJs.configs.recommended,

  // TypeScript configurations
  {
    // Apply to all .ts files
    files: ['**/*.ts'],
    // This extends recommendedTypeChecked and sets up languageOptions for type-aware linting
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname, // For ES Modules
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Your specific rule overrides and additions for TypeScript files
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^', varsIgnorePattern: '^' },
      ],
      // Add other custom rules here
    },
  },

  // Prettier integration - should be last to override other styling rules
  eslintPluginPrettierRecommended
); 