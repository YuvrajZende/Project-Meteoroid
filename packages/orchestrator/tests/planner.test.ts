import { planLevels, PipelinePlanError } from '../src/pipeline/planner';
import type { DependencyMap } from '../src/pipeline/types';
import { TEST_DEPS } from './helpers/test-deps';

describe('planLevels', () => {
    it('orders agents into levels respecting dependencies', () => {
        const levels = planLevels(TEST_DEPS);
        expect(levels[0]).toEqual(['analysis-agent']);
        expect(levels[1]).toEqual(['database-agent']);
        expect([...levels[2]].sort()).toEqual(['api-agent', 'auth-agent']);
        expect(levels[3]).toEqual(['security-agent']);
        expect(levels[4]).toEqual(['codegen-agent']);
        expect([...levels[5]].sort()).toEqual(
            ['cicd-agent', 'email-agent', 'infra-agent', 'microservice-agent', 'monitoring-agent', 'queue-agent', 'test-agent']
        );
    });

    it('throws on unknown dependency reference', () => {
        const bad = { a: { dependsOn: ['ghost' as never] } } as unknown as DependencyMap;
        expect(() => planLevels(bad)).toThrow(PipelinePlanError);
    });

    it('throws on dependency cycle', () => {
        const bad = {
            x: { dependsOn: ['y' as never] },
            y: { dependsOn: ['x' as never] },
        } as unknown as DependencyMap;
        expect(() => planLevels(bad)).toThrow(PipelinePlanError);
    });
});
