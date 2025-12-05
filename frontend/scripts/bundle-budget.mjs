import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
    console.error('Bundle budget check failed: dist/manifest.json is missing. Run `npm run build` first.');
    process.exitCode = 1;
    process.exit();
}

const budgetKb = Number(process.env.VITE_BUNDLE_BUDGET_KB ?? '900');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const seenFiles = new Set();
let totalBytes = 0;

Object.values(manifest).forEach((entry) => {
    const files = [...(entry?.file ? [entry.file] : []), ...(entry?.css ?? []), ...(entry?.assets ?? [])];
    files.forEach((file) => {
        const absolute = path.join(distDir, file);
        if (!seenFiles.has(absolute) && fs.existsSync(absolute)) {
            const stats = fs.statSync(absolute);
            seenFiles.add(absolute);
            totalBytes += stats.size;
        }
    });
});

const totalKb = Math.round((totalBytes / 1024) * 100) / 100;
const budgetExceeded = totalKb > budgetKb;

console.info(`Bundle size: ${totalKb} KB (budget: ${budgetKb} KB)`);
if (budgetExceeded) {
    console.error('Bundle budget exceeded. Consider reducing dependencies or enabling VITE_DROP_CONSOLE=false for debugging only.');
    process.exitCode = 1;
}
