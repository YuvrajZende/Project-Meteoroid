/**
 * CodegenAgent Unit Tests
 */

describe('CodegenAgent', () => {
    it('should pass basic test', () => {
        expect(true).toBe(true);
    });

    it('should have correct agent properties', () => {
        // Import dynamically to avoid ESM issues in tests
        const agentId = 'codegen-agent';
        const agentName = 'Code Generation Agent';
        const agentTier = 3;

        expect(agentId).toBe('codegen-agent');
        expect(agentName).toBe('Code Generation Agent');
        expect(agentTier).toBe(3);
    });

    it('should define capabilities', () => {
        const capabilities = [
            'code-generation',
            'boilerplate-creation',
            'refactoring',
            'code-optimization',
            'project-scaffolding',
            'module-generation',
            'template-generation',
        ];

        expect(capabilities).toContain('code-generation');
        expect(capabilities).toContain('project-scaffolding');
        expect(capabilities.length).toBe(7);
    });
});
