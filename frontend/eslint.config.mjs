import pluginVue from 'eslint-plugin-vue';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**']
    },
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                sourceType: 'module',
                ecmaVersion: 'latest'
            }
        },
        plugins: {
            '@typescript-eslint': tsPlugin
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            'vue/no-v-html': 'error',
            // Disable rules that conflict with prettier or are too strict for now
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-unused-vars': 'warn',
            '@typescript-eslint/no-this-alias': 'warn',
            'vue/multi-word-component-names': 'warn'
        }
    }
];
