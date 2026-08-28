describe('import aliases', () => {
    it('resolves @loveable/shared with isValidAgent', () => {
        const shared = require('@loveable/shared');
        expect(typeof shared.isValidAgent).toBe('function');
    });

    it('resolves @loveable/agents subpath barrel (directory index)', () => {
        const security = require('@loveable/agents/core/security');
        expect(security.securityAgentIAgent).toBeDefined();
        expect(security.securityAgentIAgent.id).toBe('security-agent');
    });
});
