import type { DependencyMap } from './types';

/** The coordination contract. One file to see the whole DAG. */
export const DEPENDENCIES: DependencyMap = {
    'analysis-agent': { dependsOn: [], timeoutMs: 120000, expectFiles: false },
    'database-agent': { dependsOn: ['analysis-agent'], timeoutMs: 60000 },
    'api-agent': { dependsOn: ['database-agent'], timeoutMs: 60000 },
    'auth-agent': { dependsOn: ['database-agent'], timeoutMs: 60000 },
    'security-agent': { dependsOn: ['api-agent', 'auth-agent'], timeoutMs: 60000 },
    'codegen-agent': { dependsOn: ['api-agent', 'auth-agent', 'security-agent'], timeoutMs: 90000 },
    'test-agent': { dependsOn: ['codegen-agent'], timeoutMs: 90000 },
    'monitoring-agent': { dependsOn: ['codegen-agent'], stub: true },
    'queue-agent': { dependsOn: ['codegen-agent'], stub: true },
    'cicd-agent': { dependsOn: ['codegen-agent'], stub: true },
    'infra-agent': { dependsOn: ['codegen-agent'], stub: true },
    'microservice-agent': { dependsOn: ['codegen-agent'], stub: true },
    'email-agent': { dependsOn: ['codegen-agent'], stub: true },
};
