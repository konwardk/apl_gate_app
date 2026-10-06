import cds from '@sap/cds';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cds.on('bootstrap', (app) => {
    // Suppress browser default HTTP Basic Auth popup modal on 401 responses
    app.use((req, res, next) => {
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = function (name, value) {
            if (typeof name === 'string' && name.toLowerCase() === 'www-authenticate') {
                // Do not send WWW-Authenticate header to prevent native browser login modal popup
                return this;
            }
            return origSetHeader(name, value);
        };

        const origWriteHead = res.writeHead.bind(res);
        res.writeHead = function (statusCode, ...args) {
            try {
                res.removeHeader('www-authenticate');
                res.removeHeader('WWW-Authenticate');
            } catch (_) {}
            return origWriteHead(statusCode, ...args);
        };

        next();
    });

    // Dynamic auth user resolver for incoming Basic Auth headers from S/4HANA Cloud
    app.use(async (req, res, next) => {
        const auth = req.headers['authorization'];
        if (auth && auth.startsWith('Basic ')) {
            try {
                const b64 = auth.slice(6).trim();
                const creds = Buffer.from(b64, 'base64').toString('utf8');
                const colonIdx = creds.indexOf(':');
                if (colonIdx > 0) {
                    const u = creds.slice(0, colonIdx).trim().toLowerCase();
                    const p = creds.slice(colonIdx + 1).trim();
                    if (u && (!cds.env?.requires?.auth?.users?.[u] || cds.env.requires.auth.users[u].password !== p)) {
                        try {
                            const s4Cbo = await cds.connect.to('YY1_API_CUSTOMUSER_0001');
                            const s4User = await s4Cbo.run(
                                SELECT.one.from(s4Cbo.entities.CustomUser).where({ username: u })
                            ) || await s4Cbo.run(
                                SELECT.one.from(s4Cbo.entities.CustomUser).where({ UserId: u })
                            );
                            if (s4User && s4User.active !== false && s4User.status !== 'INACTIVE' && s4User.password === p) {
                                cds.env.requires ??= {};
                                cds.env.requires.auth ??= { kind: 'mocked', users: {} };
                                const roleList = (s4User.assignedRoles || s4User.roleCode || 'MainGateUser').split(',').map(r => r.trim()).filter(Boolean);
                                const expRoles = [];
                                for (const r of roleList) {
                                    expRoles.push(r);
                                    if (r.toLowerCase() !== r) expRoles.push(r.toLowerCase());
                                }
                                cds.env.requires.auth.users[u] = new cds.User({
                                    id: u,
                                    password: s4User.password,
                                    roles: expRoles
                                });
                            }
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        next();
    });

    const webappDir = path.join(__dirname, 'app', 'webapp');
    app.use('/webapp', express.static(webappDir));
    app.use(express.static(webappDir));
    // Middleware to catch SAP flexibility & metrics requests without path-to-regexp issues
    app.use((req, res, next) => {
        res.setHeader('Permissions-Policy', 'unload=*');
        if (req.path.startsWith('/sap/bc/lrep/flex/settings')) {
            return res.json({
                isKeyUser: false,
                isAtoAvailable: false,
                isProductiveSystem: false
            });
        }
        if (req.path.startsWith('/sap/bc/lrep/flex/data')) {
            return res.json({
                changes: [],
                contexts: [],
                loadFlexData: {
                    changes: [],
                    contexts: []
                }
            });
        }
        if (req.path.startsWith('/sap/bc/lrep')) {
            return res.json({});
        }
        if (req.path.startsWith('/sap/bc/ui2/flp')) {
            return res.status(200).send('');
        }
        next();
    });
});

export default cds.server;
