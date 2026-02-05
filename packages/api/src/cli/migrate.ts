/**
 * Migration CLI
 * Command-line interface for database migration
 *
 * Usage:
 *   npm run migrate:status     - Check migration status
 *   npm run migrate:export     - Export data from Supabase
 *   npm run migrate:import     - Import data to Convex
 *   npm run migrate:run        - Run full migration
 *   npm run migrate:validate   - Validate migration
 */

// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the root directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { runMigration, exportFromSupabase, validateMigration } from '../infrastructure/database/convex-migration.js';

const command = process.argv[2];

async function main() {
    switch (command) {
        case 'status':
            await checkStatus();
            break;
        case 'export':
            await exportData();
            break;
        case 'import':
            await importData();
            break;
        case 'run':
            await migrate();
            break;
        case 'validate':
            await validate();
            break;
        default:
            showUsage();
    }
}

function showUsage() {
    console.log(`
Migration CLI - Supabase to Convex Migration Tool

Usage:
  npm run migrate:status     Check migration status
  npm run migrate:export     Export data from Supabase
  npm run migrate:import     Import data to Convex
  npm run migrate:run        Run full migration
  npm run migrate:validate   Validate migration

Environment Variables Required:
  SUPABASE_URL              - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
  CONVEX_URL                - Convex deployment URL
    `);
}

async function checkStatus() {
    console.log('[MIGRATION] Checking migration status...\n');

    // Check Supabase connection
    console.log('Supabase Status:');
    const { checkSupabaseConnection } = await import('../infrastructure/database/database-client.js');
    const supabaseStatus = await checkSupabaseConnection();
    console.log(`  Status: ${supabaseStatus.connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`  Message: ${supabaseStatus.message}`);
    if (supabaseStatus.latency) {
        console.log(`  Latency: ${supabaseStatus.latency}ms`);
    }

    console.log('\nConvex Status:');
    const { checkConvexConnection } = await import('../infrastructure/database/database-client.js');
    const convexStatus = await checkConvexConnection();
    console.log(`  Status: ${convexStatus.connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`  Message: ${convexStatus.message}`);
    if (convexStatus.latency) {
        console.log(`  Latency: ${convexStatus.latency}ms`);
    }

    console.log('\nData Counts:');
    const data = await exportFromSupabase();
    console.log(`  Users: ${data.users.length}`);
    console.log(`  Projects: ${data.projects.length}`);
    console.log(`  Tasks: ${data.tasks.length}`);
    console.log(`  Generated Files: ${data.generatedFiles.length}`);
    console.log(`  Connections: ${data.connections.length}`);
    console.log(`  Deployments: ${data.deployments.length}`);
    console.log(`  Audit Logs: ${data.auditLogs.length}`);
    console.log(`  Learning Contexts: ${data.learningContexts.length}`);
    console.log(`  Benchmarks: ${data.benchmarks.length}`);
    console.log(`  Knowledge Embeddings (Vectors): ${data.knowledgeEmbeddings.length}`);
}

async function exportData() {
    console.log('[MIGRATION] Exporting data from Supabase...\n');

    const data = await exportFromSupabase();

    const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`✅ Export complete!`);
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Projects: ${data.projects.length}`);
    console.log(`   Tasks: ${data.tasks.length}`);
    console.log(`   Generated Files: ${data.generatedFiles.length}`);
    console.log(`   Connections: ${data.connections.length}`);
    console.log(`   Deployments: ${data.deployments.length}`);
    console.log(`   Audit Logs: ${data.auditLogs.length}`);
    console.log(`   Learning Contexts: ${data.learningContexts.length}`);
    console.log(`   Benchmarks: ${data.benchmarks.length}`);
    console.log(`   Knowledge Embeddings (Vectors): ${data.knowledgeEmbeddings.length}`);
}

async function importData() {
    console.log('[MIGRATION] Importing data to Convex...\n');
    console.log('Note: Import requires deployed Convex functions.');
    console.log('Run: npx convex dev first to deploy your schema.\n');

    // First export, then import
    const data = await exportFromSupabase();

    const { importToConvex } = await import('../infrastructure/database/convex-migration.js');
    const result = await importToConvex(data);

    if (result.success) {
        console.log('✅ Import complete!');
        result.stats.forEach((stat) => {
            console.log(`   ${stat.table}: ${stat.imported}/${stat.exported} imported`);
        });
    } else {
        console.log('❌ Import failed!');
        result.errors.forEach((error) => {
            console.log(`   Error: ${error}`);
        });
    }
}

async function migrate() {
    console.log('[MIGRATION] Running full migration...\n');

    const result = await runMigration();

    if (result.success) {
        console.log('✅ Migration complete!');
        result.stats.forEach((stat) => {
            console.log(`   ${stat.table}: ${stat.imported}/${stat.exported} imported`);
        });
    } else {
        console.log('❌ Migration failed!');
        result.errors.forEach((error) => {
            console.log(`   Error: ${error}`);
        });
    }
}

async function validate() {
    console.log('[MIGRATION] Validating migration...\n');

    const result = await validateMigration();

    if (result.valid) {
        console.log('✅ Validation passed!');
    } else {
        console.log('❌ Validation failed!');
        result.differences.forEach((diff) => {
            console.log(`   ${diff.table}: Supabase=${diff.supabase}, Convex=${diff.convex}`);
        });
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
