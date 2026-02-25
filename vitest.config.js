import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        coverage: {
            reporter: ['text', 'html'],
            exclude: [
                'node_modules/',
                'functions/',
                'dist/',
                '**/*.test.js',
                '**/*.spec.js'
            ]
        },
        setupFiles: ['./src/__tests__/setup.js']
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
});
