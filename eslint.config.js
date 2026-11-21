// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: ['app', 'ds'], style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: ['element', 'attribute'], prefix: ['app', 'ds'], style: 'kebab-case' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true, allowTypedFunctionExpressions: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'Three.js may only be imported in viewer-3d/infrastructure.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/features/viewer-3d/infrastructure/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Domain layers must stay framework-free.
    files: ['src/app/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@angular/*'], message: 'Domain code must not depend on Angular.' },
            { group: ['three', 'three/*'], message: 'Domain code must not depend on Three.js.' },
            { group: ['**/application/*', '**/infrastructure/*', '**/presentation/*'], message: 'Domain must not import outer layers.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
