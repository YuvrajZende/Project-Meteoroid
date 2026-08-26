/** Root Jest config for orchestrator pipeline tests */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/packages/orchestrator/tests'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^@loveable/shared$': '<rootDir>/packages/shared/src/index.ts',
        '^@loveable/agents$': '<rootDir>/agents/index.ts',
        '^@loveable/agents/(.*)$': '<rootDir>/agents/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
    },
};
