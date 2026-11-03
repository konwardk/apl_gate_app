import cds from '@sap/cds';

export default cds.service.impl(async function () {
    const po = await cds.connect.to('CE_PURCHASEORDER_0001');

    this.on('READ', 'PurchaseOrders', async (req) => {
        try {
            const delegatedQuery = SELECT.from(po.entities.PurchaseOrder);
            if (req.query.SELECT.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query.SELECT.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query.SELECT.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query.SELECT.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query.SELECT.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await po.run(delegatedQuery);
        } catch (err) {
            console.error('[POService] Failed to query PurchaseOrders from remote service:', err.message);
            throw err;
        }
    });

    this.on('READ', 'PurchaseOrderItems', async (req) => {
        try {
            const delegatedQuery = SELECT.from(po.entities.PurchaseOrderItem);
            if (req.query.SELECT.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query.SELECT.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query.SELECT.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query.SELECT.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query.SELECT.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await po.run(delegatedQuery);
        } catch (err) {
            console.error('[POService] Failed to query PurchaseOrderItems from remote service:', err.message);
            throw err;
        }
    });
});