
import { runMigration } from '../src/infrastructure/database/convex-migration.js';

import fs from 'fs';
import path from 'path';

console.log('Starting migration script...');
runMigration()
    .then((result) => {
        console.log('Migration finished.');
        if (!result.success) {
            console.error(`Migration failed with ${result.errors.length} errors.`);
            const errorFile = path.resolve(process.cwd(), 'migration-errors.json');
            fs.writeFileSync(errorFile, JSON.stringify(result.errors, null, 2));
            console.log(`Errors written to ${errorFile}`);
            // Print first 5 errors
            console.log('First 5 errors:');
            result.errors.slice(0, 5).forEach(e => console.error(e));
            process.exit(1);
        }
        process.exit(0);
    })
    .catch((err) => {
        console.error('Fatal error running migration:', err);
        process.exit(1);
    });
