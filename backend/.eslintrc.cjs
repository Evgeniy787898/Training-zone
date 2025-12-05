module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  ignorePatterns: ['dist', 'node_modules'],
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
