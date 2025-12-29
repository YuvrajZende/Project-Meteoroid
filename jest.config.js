module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                moduleResolution: 'node',
                skipLibCheck: true,
                strict: false,
                noImplicitAny: false,
            }
        }]
    },
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))'
    ],
    collectCoverageFrom: [
        'packages/**/*.ts',
        'agents/**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**'
    ],
};
