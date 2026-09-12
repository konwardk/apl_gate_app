import cds from '@sap/cds';

cds.on('bootstrap', (app) => {
    // Middleware to catch SAP flexibility & metrics requests without path-to-regexp issues
    app.use((req, res, next) => {
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
