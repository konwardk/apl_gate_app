import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[BUILD] Starting production build process...');

// 1. Run CDS production build
console.log('[BUILD] Running: cds build --production');
execSync('npx cds build --production', { cwd: rootDir, stdio: 'inherit' });

// 2. Prepare approuter/resources directory for standalone approuter static hosting
const approuterResourcesDir = path.join(rootDir, 'approuter', 'resources');
console.log(`[BUILD] Syncing static frontend assets to: ${approuterResourcesDir}`);

if (fs.existsSync(approuterResourcesDir)) {
    fs.rmSync(approuterResourcesDir, { recursive: true, force: true });
}
fs.mkdirSync(approuterResourcesDir, { recursive: true });

// Copy app/webapp contents into approuter/resources
const webappSrc = path.join(rootDir, 'app', 'webapp');
if (fs.existsSync(webappSrc)) {
    fs.cpSync(webappSrc, approuterResourcesDir, { recursive: true });
    // Also create webapp subfolder inside resources for backward compatibility with /webapp/index.html
    const webappSubfolder = path.join(approuterResourcesDir, 'webapp');
    fs.mkdirSync(webappSubfolder, { recursive: true });
    fs.cpSync(webappSrc, webappSubfolder, { recursive: true });
    console.log('[BUILD] Copied app/webapp -> approuter/resources and approuter/resources/webapp');
}

// Copy app/gate-entry into approuter/resources/gate-entry
const gateEntrySrc = path.join(rootDir, 'app', 'gate-entry');
if (fs.existsSync(gateEntrySrc)) {
    const gateEntryDest = path.join(approuterResourcesDir, 'gate-entry');
    fs.cpSync(gateEntrySrc, gateEntryDest, { recursive: true });
    console.log('[BUILD] Copied app/gate-entry -> approuter/resources/gate-entry');
}

// 3. Sync app directory into gen/srv/app for backend Express static fallback
const genSrvAppDir = path.join(rootDir, 'gen', 'srv', 'app');
console.log(`[BUILD] Syncing app directory to: ${genSrvAppDir}`);
fs.mkdirSync(genSrvAppDir, { recursive: true });
fs.cpSync(path.join(rootDir, 'app'), genSrvAppDir, { recursive: true });

// 4. Ensure gen/db/package.json has valid engines configuration for Cloud Foundry HDI buildpack
const genDbPkgPath = path.join(rootDir, 'gen', 'db', 'package.json');
if (fs.existsSync(genDbPkgPath)) {
    const dbPkg = JSON.parse(fs.readFileSync(genDbPkgPath, 'utf8'));
    dbPkg.engines = { node: '^20 || ^22' };
    fs.writeFileSync(genDbPkgPath, JSON.stringify(dbPkg, null, 2), 'utf8');
    console.log('[BUILD] Configured gen/db/package.json engines to Node ^20 || ^22');
}

console.log('[BUILD] Production build and asset distribution completed successfully!');
