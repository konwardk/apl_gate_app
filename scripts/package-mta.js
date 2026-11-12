import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Normalizes a relative path from mta.yaml to clean forward-slash format without leading './'.
 */
function normalizeRelPath(p) {
    return String(p || '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/+$/, '');
}

/**
 * Converts mta.yaml descriptor into Cloud Foundry deployment descriptor (mtad.yaml)
 * and extracts manifest entries for META-INF/MANIFEST.MF.
 */
function buildMtadAndManifest(mtaDoc) {
    const manifestBlocks = [
        [
            'Manifest-Version: 1.0',
            'Created-By: APL Node MTA Packager'
        ].join('\n')
    ];

    const filesToCopy = [];
    const dirsToPackage = [];

    const mtadModules = (mtaDoc.modules || []).map((mod) => {
        const modCopy = { ...mod };
        const builder = modCopy['build-parameters']?.builder;
        delete modCopy['build-parameters'];

        // Standard MBT mapping for approuter.nodejs -> javascript.nodejs
        if (modCopy.type === 'approuter.nodejs') {
            modCopy.type = 'javascript.nodejs';
        }

        const modPath = normalizeRelPath(modCopy.path || modCopy.name);
        modCopy.path = modPath;

        dirsToPackage.push({
            relPath: modPath,
            excludeNodeModules: builder === 'npm-ci'
        });

        manifestBlocks.push([
            `Name: ${modPath}`,
            `MTA-Module: ${modCopy.name}`,
            'Content-Type: text/directory'
        ].join('\n'));

        return modCopy;
    });

    for (const res of mtaDoc.resources || []) {
        const resPath = res?.parameters?.path;
        if (resPath) {
            const cleanPath = normalizeRelPath(resPath);
            filesToCopy.push(cleanPath);
            manifestBlocks.push([
                `Name: ${cleanPath}`,
                `MTA-Resource: ${res.name}`,
                'Content-Type: application/json'
            ].join('\n'));
        }
    }

    manifestBlocks.push([
        'Name: META-INF/mtad.yaml',
        'Content-Type: text/plain'
    ].join('\n'));

    const mtad = {
        '_schema-version': String(mtaDoc['_schema-version'] || '3.2'),
        ID: mtaDoc.ID,
        description: mtaDoc.description,
        version: mtaDoc.version,
        modules: mtadModules,
        resources: mtaDoc.resources || [],
        parameters: mtaDoc.parameters || {}
    };

    const manifestText = manifestBlocks.join('\n\n') + '\n\n';
    const mtadText = YAML.stringify(mtad);

    return { manifestText, mtadText, dirsToPackage, filesToCopy };
}

/**
 * Packages the built MTA modules and descriptors into mta_archives/<ID>_<version>.mtar
 * using Windows' built-in tar.exe (--format=zip), which writes explicit directory
 * entries and POSIX file permissions required by SAP BTP multiapps-controller.
 */
function createMtarWindows(outputMtar, tmpDir, dirsToPackage, filesToCopy) {
    for (const f of filesToCopy) {
        const abs = path.join(rootDir, f);
        if (!fs.existsSync(abs)) {
            throw new Error(`Required MTA resource file not found: ${abs}`);
        }
    }

    const excludeFlags = ['--exclude=.git'];
    for (const dirSpec of dirsToPackage) {
        const absDir = path.join(rootDir, dirSpec.relPath);
        if (!fs.existsSync(absDir)) {
            throw new Error(`Required MTA module directory not found: ${absDir}`);
        }
        if (dirSpec.excludeNodeModules) {
            excludeFlags.push(`--exclude=${dirSpec.relPath}/node_modules`);
        }
    }

    if (fs.existsSync(outputMtar)) {
        fs.rmSync(outputMtar, { force: true });
    }

    const args = [
        '--format=zip',
        ...excludeFlags,
        '-cf', outputMtar,
        '-C', tmpDir, 'META-INF',
        '-C', rootDir,
        ...filesToCopy,
        ...dirsToPackage.map((d) => d.relPath)
    ];

    execFileSync('tar.exe', args, { cwd: rootDir, stdio: 'inherit' });
}

function main() {
    console.log('[MTA] Starting MTA build & packaging...');

    // On non-Windows environments (Linux / BAS / CI), delegate to native mbt build if available
    if (process.platform !== 'win32') {
        try {
            execSync('mbt build', { cwd: rootDir, stdio: 'inherit' });
            return;
        } catch (err) {
            console.warn('[MTA] Native mbt build failed or unavailable, continuing with project build...');
        }
    }

    // 1. Run CAP + frontend production build
    execSync('node scripts/build.js', { cwd: rootDir, stdio: 'inherit' });

    // 2. Parse mta.yaml
    const mtaYamlPath = path.join(rootDir, 'mta.yaml');
    if (!fs.existsSync(mtaYamlPath)) {
        throw new Error('mta.yaml not found in project root.');
    }
    const mtaDoc = YAML.parse(fs.readFileSync(mtaYamlPath, 'utf8'));
    if (!mtaDoc?.ID || !mtaDoc?.version) {
        throw new Error('mta.yaml must define ID and version.');
    }

    // 3. Ensure approuter dependencies are installed so approuter/node_modules is packaged
    const approuterDir = path.join(rootDir, 'approuter');
    if (fs.existsSync(approuterDir) && !fs.existsSync(path.join(approuterDir, 'node_modules'))) {
        console.log('[MTA] Installing approuter dependencies...');
        execSync('npm ci --omit=dev', { cwd: approuterDir, stdio: 'inherit' });
    }

    // 4. Generate META-INF/MANIFEST.MF and META-INF/mtad.yaml
    const { manifestText, mtadText, dirsToPackage, filesToCopy } = buildMtadAndManifest(mtaDoc);
    const tmpDir = path.join(rootDir, '.mta_pkg_tmp');
    const metaInfDir = path.join(tmpDir, 'META-INF');
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(metaInfDir, { recursive: true });
    fs.writeFileSync(path.join(metaInfDir, 'MANIFEST.MF'), manifestText, 'utf8');
    fs.writeFileSync(path.join(metaInfDir, 'mtad.yaml'), mtadText, 'utf8');

    // 5. Output archive path: mta_archives/<ID>_<version>.mtar
    const archivesDir = path.join(rootDir, 'mta_archives');
    fs.mkdirSync(archivesDir, { recursive: true });
    const outputMtar = path.join(archivesDir, `${mtaDoc.ID}_${mtaDoc.version}.mtar`);

    try {
        console.log(`[MTA] Packaging archive: ${outputMtar}`);
        createMtarWindows(outputMtar, tmpDir, dirsToPackage, filesToCopy);
        const stats = fs.statSync(outputMtar);
        console.log(`[MTA] Archive created successfully: ${outputMtar} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    } finally {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
}

main();

