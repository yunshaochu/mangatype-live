import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tempDir = path.join(repoRoot, '.tmp-provider-settings-tests');
const esbuildEntry = path.join(repoRoot, 'node_modules', 'esbuild', 'bin', 'esbuild');

const testFiles = [
  'services/aiConfigStorage.test.ts',
  'services/endpointModelCache.test.ts',
  'services/providerModelFilter.test.ts',
  'services/providerEndpointSections.test.ts',
  'services/endpointTestService.test.ts',
  'services/geminiServiceOpenAIRequestModes.test.ts',
];

mkdirSync(tempDir, { recursive: true });

try {
  for (const testFile of testFiles) {
    const outputFile = path.join(tempDir, `${path.basename(testFile, '.ts')}.cjs`);
    execFileSync(process.execPath, [
      esbuildEntry,
      testFile,
      '--bundle',
      '--platform=node',
      '--format=cjs',
      `--outfile=${outputFile}`,
    ], { cwd: repoRoot, stdio: 'inherit' });
    execFileSync('node', [outputFile], { cwd: repoRoot, stdio: 'inherit' });
  }

  console.log('provider settings regression checks passed');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
