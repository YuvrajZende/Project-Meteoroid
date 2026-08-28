import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DetailsGenerator } from '@loveable/agents/core/analysis/details-generator';
import { analysisLoaderAgent } from '@loveable/agents/core/analysis/analysis-loader-agent';
import { DEMO_ANALYSIS } from '../../src/pipeline/demo-analysis';

function makeGenerator(analysis = DEMO_ANALYSIS, outDir = ''): DetailsGenerator {
    return new DetailsGenerator({
        analysisResult: analysis,
        outputDir: outDir,
        includeJsonReport: true,
    });
}

describe('DetailsGenerator JSON report contract', () => {
    let outDir: string;

    beforeEach(async () => {
        outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-details-'));
    });

    it('emits suggestions so the analysis loader re-ingests the report', async () => {
        const { jsonReportPath } = await makeGenerator(DEMO_ANALYSIS, outDir).generate();
        expect(jsonReportPath).toBeTruthy();

        const report = JSON.parse(await fs.readFile(jsonReportPath!, 'utf8'));
        expect(report.suggestions).toEqual({
            recommendedDatabase: 'postgresql',
            recommendedOrm: 'prisma',
            recommendedAuth: 'clerk',
            apiStyle: 'rest',
        });

        const out = await analysisLoaderAgent.execute({ task: 'x', context: { analysisJson: report } });
        expect(out.success).toBe(true);
    });

    it('keeps primaryKey and relationships for the database wrapper', async () => {
        const { jsonReportPath } = await makeGenerator(DEMO_ANALYSIS, outDir).generate();
        const report = JSON.parse(await fs.readFile(jsonReportPath!, 'utf8'));

        const product = report.dataModels.find((m: { name: string }) => m.name === 'Product');
        expect(product.primaryKey).toBe('id');
        expect(product.relationships).toEqual([
            { targetModel: 'Order', type: 'one-to-many', fieldName: 'orders' },
        ]);
    });

    it('copies analyzer suggestions verbatim instead of re-deriving them', async () => {
        const analysis = JSON.parse(JSON.stringify(DEMO_ANALYSIS));
        analysis.authStrategy.provider = 'none';

        const { jsonReportPath } = await makeGenerator(analysis, outDir).generate();
        const report = JSON.parse(await fs.readFile(jsonReportPath!, 'utf8'));
        // The analyzer (frontend-analyzer.generateSuggestions) decides the auth
        // recommendation; the report must carry it through unchanged.
        expect(report.suggestions).toEqual(analysis.suggestions);
    });
});
