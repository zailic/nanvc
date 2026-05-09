import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const examplesDir = join(process.cwd(), 'examples');

try {
    const dirs = readdirSync(examplesDir)
        .filter(
            (file) =>
                statSync(join(examplesDir, file)).isDirectory() &&
                existsSync(join(examplesDir, file, 'main.ts')) &&
                statSync(join(examplesDir, file, 'main.ts')).isFile(),
        )
        .sort();

    for (const example of dirs) {
        const exampleMainPath = join(examplesDir, example, 'main.ts');
        console.log(`\n🧪 Running: ${example}`);
        try {
            execSync(`npx tsx ${exampleMainPath}`, {
                stdio: 'inherit',
                env: { ...process.env, NANVC_LOG_LEVEL: 'debug' },
            });
        } catch (error) {
            console.error(`\n❌ ${example} failed: ${error.message}`);
            process.exit(1);
        }
    }
    console.log('\n✅ All examples completed successfully');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
