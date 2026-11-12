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

// 3. Ensure external CSN models are present in gen/srv/srv/external for cds.connect.to
const srvExternalSrc = path.join(rootDir, 'srv', 'external');
const srvExternalDest = path.join(rootDir, 'gen', 'srv', 'srv', 'external');
if (fs.existsSync(srvExternalSrc)) {
    fs.mkdirSync(srvExternalDest, { recursive: true });
    for (const f of fs.readdirSync(srvExternalSrc)) {
        if (f.endsWith('.csn')) {
            fs.copyFileSync(path.join(srvExternalSrc, f), path.join(srvExternalDest, f));
        }
    }
    console.log('[BUILD] Copied external CSN models into gen/srv/srv/external');
}

// 4. Sync static frontend assets into gen/srv/app for backend Express static fallback (excluding raw .cds files)
const genSrvAppDir = path.join(rootDir, 'gen', 'srv', 'app');
console.log(`[BUILD] Syncing static app directory to: ${genSrvAppDir}`);
if (fs.existsSync(genSrvAppDir)) {
    fs.rmSync(genSrvAppDir, { recursive: true, force: true });
}
fs.mkdirSync(genSrvAppDir, { recursive: true });
if (fs.existsSync(webappSrc)) {
    fs.cpSync(webappSrc, path.join(genSrvAppDir, 'webapp'), { recursive: true });
}
if (fs.existsSync(gateEntrySrc)) {
    fs.cpSync(gateEntrySrc, path.join(genSrvAppDir, 'gate-entry'), { recursive: true });
}
console.log('[BUILD] Copied static webapp and gate-entry to gen/srv/app (excluding raw .cds files)');

// 5. Ensure gen/db/package.json has valid engines configuration for Cloud Foundry HDI buildpack
const genDbPkgPath = path.join(rootDir, 'gen', 'db', 'package.json');
if (fs.existsSync(genDbPkgPath)) {
    const dbPkg = JSON.parse(fs.readFileSync(genDbPkgPath, 'utf8'));
    dbPkg.engines = { node: '^20 || ^22' };
    fs.writeFileSync(genDbPkgPath, JSON.stringify(dbPkg, null, 2), 'utf8');
    console.log('[BUILD] Configured gen/db/package.json engines to Node ^20 || ^22');
}

console.log('[BUILD] Production build and asset distribution completed successfully!');
