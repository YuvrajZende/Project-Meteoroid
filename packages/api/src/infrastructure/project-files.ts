/**
 * Project file layout rules shared by the file writer and orchestration services.
 */

/** Bare file names that belong at the project root, never under src/. */
const ROOT_FILE_NAMES = new Set([
    'package.json', 'package-lock.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
    'docker-compose.yaml', '.dockerignore', '.gitignore', '.env.example', 'README.md',
    'requirements.txt', 'pyproject.toml', 'go.mod', 'go.sum', 'Cargo.toml', 'pom.xml',
    'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', 'Makefile', 'CMakeLists.txt',
]);

/** True for a root-level config/manifest file (bare name, optionally "./"-prefixed). */
export function isProjectRootFile(filePath: string): boolean {
    const normalized = filePath.replace(/^\.\//, '');
    if (normalized.includes('/')) return false;
    return ROOT_FILE_NAMES.has(normalized)
        || /^tsconfig\..+\.json$/.test(normalized)
        || /^\.env(\..+)?$/.test(normalized)
        || /\.csproj$/.test(normalized);
}
