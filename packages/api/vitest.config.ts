import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        root: '.',
        include: ['src/tests/**/*.test.ts', 'src/repositories/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        setupFiles: ['./test/setup.ts'],
        transformMode: {
            ssr: true,
        },
        deps: {
            interopDefault: true,
        },
        experimentalVmThreads: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules', 'dist', 'src/tests/**'],
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
