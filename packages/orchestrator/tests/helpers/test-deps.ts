import type { DependencyMap } from '../../src/pipeline/types';

export const TEST_DEPS: DependencyMap = {
    'analysis-agent': { dependsOn: [], expectFiles: false },
    'database-agent': { dependsOn: ['analysis-agent'] },
    'api-agent': { dependsOn: ['database-agent'] },
    'auth-agent': { dependsOn: ['database-agent'] },
    'security-agent': { dependsOn: ['api-agent', 'auth-agent'] },
    'codegen-agent': { dependsOn: ['api-agent', 'auth-agent', 'security-agent'] },
    'test-agent': { dependsOn: ['codegen-agent'] },
    'monitoring-agent': { dependsOn: ['codegen-agent'], stub: true },
    'queue-agent': { dependsOn: ['codegen-agent'], stub: true },
    'cicd-agent': { dependsOn: ['codegen-agent'], stub: true },
    'infra-agent': { dependsOn: ['codegen-agent'], stub: true },
    'microservice-agent': { dependsOn: ['codegen-agent'], stub: true },
    'email-agent': { dependsOn: ['codegen-agent'], stub: true },
};
