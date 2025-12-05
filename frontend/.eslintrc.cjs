module.exports = {
  root: true,
  env: {
    es2021: true,
    browser: true,
  },
  ignorePatterns: ['dist', 'node_modules', 'public', 'coverage'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {},
    },
  ],
};
