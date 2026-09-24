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
