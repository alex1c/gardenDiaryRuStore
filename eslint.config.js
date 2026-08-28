/**
 * ESLint flat config based on eslint-config-expo (SDK 57).
 */

const expoConfig = require('eslint-config-expo/flat');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'coverage/*',
      'android/*',
      'ios/*',
      'scripts/*',
      'jest.setup.js',
    ],
  },
];
