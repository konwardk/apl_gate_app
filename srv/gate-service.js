// const cds = require('@sap/cds');
import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const {
        GateTransactions,
        SecurityGateEntries,
        SecurityGateExits,
        DeliveryDetails,
        PickupDetails,
        WeighbridgeTransactions,
        FactoryGateEntries,
        FactoryGateEvents,
        GateAuditLogs,
        Vehicles,
        Drivers,
        Transporters,
        Suppliers,
        PurchaseOrders
    } = this.entities;


    /*
     * ============================================================
     * CRUD: MAIN GATE TRANSACTIONS (GateTransactions)
     * ============================================================
     */

    // 1. DRAFT INITIALIZATION: When creating a new draft in Fiori Elements
    this.before('NEW', 'GateTransactions.drafts', async (req) => {
        if (!req.data.status) req.data.status = 'GATE_IN';
        if (!req.data.currentStage) req.data.currentStage = 'MAIN_GATE_IN';
        if (!req.data.vehicleType) req.data.vehicleType = 'TRUCK';
        if (!req.data.purpose) req.data.purpose = 'DELIVERY';
        if (!req.data.gateInDateTime) req.data.gateInDateTime = new Date();
        if (!req.data.gateInOperator) req.data.gateInOperator = req.user?.id || 'SYSTEM';
    });

    async function handleCreate(req) {
        req._isCreate = true;

        // Vehicle Reg No is mandatory
        if (!req.data.vehicleRegNo) {
            return req.reject(400, 'Vehicle Registration Number is mandatory.', 'in/vehicleRegNo');
        }
        req.data.vehicleRegNo = req.data.vehicleRegNo.trim().toUpperCase();

        const vehicleRegex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
        if (!vehicleRegex.test(req.data.vehicleRegNo)) {
            return req.reject(
                400,
                `Invalid Vehicle Registration Number format '${req.data.vehicleRegNo}'. Format must be like AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-1234).`,
                'in/vehicleRegNo'
            );
        }

        // Purpose of Visit is mandatory
        if (!req.data.purpose) {
            return req.error(400, 'Purpose of Visit is mandatory.', 'in/purpose');
        }
        if (!['DELIVERY', 'PICKUP'].includes(req.data.purpose)) {
            return req.error(400, `Invalid visit purpose '${req.data.purpose}'. Allowed values: DELIVERY, PICKUP.`, 'in/purpose');
        }

        // Active vehicle validation: No duplicate active gate transaction for same vehicle
        const activeTx = await SELECT.one
            .from(GateTransactions)
            .where({
                vehicleRegNo: req.data.vehicleRegNo,
                status: {
                    in: [
                        'GATE_IN',
                        'SECURITY_IN',
                        'WEIGHBRIDGE_IN',
                        'FACTORY_IN',
                        'FACTORY_OUT',
                        'WEIGHBRIDGE_OUT',
                        'SECURITY_OUT'
                    ]
                },
                ID: { '!=': req.data.ID || '' }
            });

        if (activeTx) {
            return req.error(
                400,
                `Vehicle ${req.data.vehicleRegNo} already has an active Gate IN transaction (${activeTx.gateInNumber}).`,
                'in/vehicleRegNo'
            );
        }

        // Auto-generate UUID ID if missing
        if (!req.data.ID) {
            req.data.ID = cds.utils.uuid();
        }

        // Auto-generate Gate IN Number if missing
        if (!req.data.gateInNumber) {
            req.data.gateInNumber = await generateGateInNumber();
        }

        // Ensure defaults
        if (!req.data.vehicleType) req.data.vehicleType = 'TRUCK';
        if (!req.data.status) req.data.status = 'GATE_IN';
        if (!req.data.currentStage) req.data.currentStage = 'MAIN_GATE_IN';
        if (!req.data.gateInDateTime) req.data.gateInDateTime = new Date();
        if (!req.data.gateInOperator) req.data.gateInOperator = req.user?.id || 'SYSTEM';

        // Auto-link vehicle master if exists
        if (!req.data.vehicle_ID) {
            const v = await SELECT.one.from(Vehicles).where({ vehicleRegNo: req.data.vehicleRegNo });
            if (v) {
                req.data.vehicle_ID = v.ID;
                if (!req.data.transporter_ID && v.transporter_ID) {
                    req.data.transporter_ID = v.transporter_ID;
                }
            }
        }
    }

    async function handleUpdate(req, existing) {
        // Disallow modifying business identifier gateInNumber
        if (req.data.gateInNumber && req.data.gateInNumber !== existing.gateInNumber) {
            return req.error(400, 'Gate IN Number is immutable and cannot be modified.', 'in/gateInNumber');
        }

        // Closed transaction protection
        const isAdmin = req.user?.is('Admin') || req.user?.is('Superadmin');
        if (!isAdmin && (existing.status === 'COMPLETED' || existing.status === 'CANCELLED')) {
            return req.error(400, `Cannot modify transaction in '${existing.status}' status. Only Admin can make corrections.`);
        }

        // If vehicle registration is updated, verify format and conflict
        if (req.data.vehicleRegNo && req.data.vehicleRegNo.toUpperCase() !== existing.vehicleRegNo) {
            const newReg = req.data.vehicleRegNo.trim().toUpperCase();
            const vehicleRegex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
            if (!vehicleRegex.test(newReg)) {
                return req.reject(
                    400,
                    `Invalid Vehicle Registration Number format '${newReg}'. Format must be like AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-1234).`,
                    'in/vehicleRegNo'
                );
            }
            req.data.vehicleRegNo = newReg;
            const conflict = await SELECT.one.from(GateTransactions).where({
                vehicleRegNo: newReg,
                status: {
                    in: [
                        'GATE_IN',
                        'SECURITY_IN',
                        'WEIGHBRIDGE_IN',
                        'FACTORY_IN',
                        'FACTORY_OUT',
                        'WEIGHBRIDGE_OUT',
                        'SECURITY_OUT'
                    ]
                },
                ID: { '!=': existing.ID }
            });
            if (conflict) {
                return req.error(400, `Vehicle ${newReg} already has an active Gate IN transaction (${conflict.gateInNumber}).`, 'in/vehicleRegNo');
            }
        }

        // If completing transaction via update
        if (req.data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
            if (!req.data.gateOutDateTime) req.data.gateOutDateTime = new Date();
            if (!req.data.gateOutOperator) req.data.gateOutOperator = req.user?.id || 'SYSTEM';
            req.data.currentStage = 'COMPLETED';
        }

        req._previousTx = existing;
    }

    function getTransactionId(req) {
        if (req.data?.ID) return req.data.ID;
        if (req.params && req.params.length) {
            for (const p of req.params) {
                if (typeof p === 'object' && p?.ID) return p.ID;
                if (typeof p === 'string') return p;
            }
        }
        const where = req.query?.UPDATE?.where || req.query?.DELETE?.where || req.query?.SELECT?.where;
        if (Array.isArray(where)) {
            for (let i = 0; i < where.length; i++) {
                if (where[i]?.ref && where[i].ref[0] === 'ID' && where[i + 2]?.val) {
                    return where[i + 2].val;
                }
            }
        }
        return null;
    }

    // 2. CREATE & DRAFT ACTIVATION: Validation, Auto-numbering, Defaults
    this.before('CREATE', 'GateTransactions', async (req) => {
        await handleCreate(req);
    });

    this.before('SAVE', 'GateTransactions', async (req) => {
        const txId = getTransactionId(req);
        const existing = txId ? await SELECT.one.from(GateTransactions).where({ ID: txId }) : null;
        if (!existing) {
            await handleCreate(req);
        } else {
            await handleUpdate(req, existing);
        }
    });

    // 3. AFTER CREATE: Audit Trail Recording
    this.after('CREATE', 'GateTransactions', async (data, req) => {
        const txId = (data && data.ID) || getTransactionId(req);
        if (!txId) return;

        const regNo = (data && data.vehicleRegNo) || req.data?.vehicleRegNo || '';
        const gateInNum = (data && data.gateInNumber) || req.data?.gateInNumber || '';
        const status = (data && data.status) || req.data?.status || 'GATE_IN';
        const stage = (data && data.currentStage) || req.data?.currentStage || 'MAIN_GATE_IN';

        const existingAudit = await SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: txId,
            action: 'GATE_IN_CREATED'
        });

        if (!existingAudit) {
            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: txId,
                action: 'GATE_IN_CREATED',
                oldStatus: null,
                newStatus: status,
                oldStage: null,
                newStage: stage,
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: req.user?.id || 'SYSTEM',
                remarks: `Main Gate Entry created for vehicle ${regNo} (${gateInNum})`
            });
        }
    });

    // 4. UPDATE: Validation, Immutability & Status Transition
    this.before('UPDATE', 'GateTransactions', async (req) => {
        const txId = getTransactionId(req);
        if (!txId) return;

        const existing = await SELECT.one.from(GateTransactions).where({ ID: txId });
        if (!existing) return;

        await handleUpdate(req, existing);
    });

    // 5. AFTER UPDATE: Audit Log Entry
    this.after('UPDATE', 'GateTransactions', async (data, req) => {
        const prev = req._previousTx;
        const txId = (data && data.ID) || (prev && prev.ID) || getTransactionId(req);
        if (prev && txId) {
            const currentTx = await SELECT.one.from(GateTransactions).where({ ID: txId });
            const newStatus = (currentTx && currentTx.status) || (data && data.status) || prev.status;
            const newStage = (currentTx && currentTx.currentStage) || (data && data.currentStage) || prev.currentStage;
            const statusChanged = newStatus !== prev.status;
            const action = statusChanged ? `STATUS_UPDATE_${newStatus}` : 'GATE_ENTRY_UPDATED';

            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: txId,
                action: action,
                oldStatus: prev.status,
                newStatus: newStatus,
                oldStage: prev.currentStage,
                newStage: newStage,
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: req.user?.id || 'SYSTEM',
                remarks: req.data?.remarks
                    ? `Updated remarks: ${req.data.remarks}`
                    : (statusChanged ? `Status transitioned from ${prev.status} to ${newStatus}` : 'Gate Entry updated')
            });
        }
    });

    this.after('UPDATE', 'SecurityGateEntries', async (data, req) => {
        const secId = (data && data.ID) || req.data?.ID;
        let gateTxId = (data && data.gateTransaction_ID) || req.data?.gateTransaction_ID;

        if (!gateTxId && secId) {
            const secRecord = await SELECT.one.from(SecurityGateEntries).where({ ID: secId });
            if (secRecord) {
                gateTxId = secRecord.gateTransaction_ID;
            }
        }

        if (gateTxId) {
            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: gateTxId,
                action: 'SECURITY_ENTRY_UPDATED',
                oldStatus: null,
                newStatus: null,
                oldStage: null,
                newStage: null,
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: req.user?.id || 'SYSTEM',
                remarks: `Security Gate Entry details updated by ${req.user?.id || 'SYSTEM'}`
            });
        }
    });

    // 6. DELETE: Business Integrity & Protection
    this.before('DELETE', 'GateTransactions', async (req) => {
        const txId = getTransactionId(req);
        if (!txId) return;

        const existing = await SELECT.one.from(GateTransactions).where({ ID: txId });
        if (!existing) return;

        // Integrity check: Only initial GATE_IN or CANCELLED transactions may be deleted
        const protectedStatuses = [
            'SECURITY_IN',
            'WEIGHBRIDGE_IN',
            'FACTORY_IN',
            'FACTORY_OUT',
            'WEIGHBRIDGE_OUT',
            'SECURITY_OUT',
            'COMPLETED'
        ];

        const isSuperAdmin = req.user?.is('Superadmin');
        if (!isSuperAdmin && protectedStatuses.includes(existing.status)) {
            return req.error(
                400,
                `Cannot delete Gate Entry '${existing.gateInNumber}'. Vehicle is currently at stage '${existing.currentStage}' (Status: ${existing.status}). Only initial entries ('GATE_IN' or 'CANCELLED') may be deleted.`
            );
        }

        req._deletedTx = existing;
    });

    // 7. AFTER DELETE: Cascade Child Clean-up
    this.after('DELETE', 'GateTransactions', async (data, req) => {
        const deleted = req._deletedTx;
        const id = (deleted && deleted.ID) || getTransactionId(req);
        if (id) {
            await DELETE.from(SecurityGateEntries).where({ gateTransaction_ID: id });
            await DELETE.from(DeliveryDetails).where({ gateTransaction_ID: id });
            await DELETE.from(PickupDetails).where({ gateTransaction_ID: id });
            await DELETE.from(WeighbridgeTransactions).where({ gateTransaction_ID: id });
            await DELETE.from(FactoryGateEvents).where({ gateTransaction_ID: id });
            await DELETE.from(GateAuditLogs).where({ gateTransaction_ID: id });
        }
    });

    // 8. AFTER READ: Calculate Friendly Durations / Formatting
    this.after('READ', 'GateTransactions', (data) => {
        if (!data) return;
        const records = Array.isArray(data) ? data : [data];
        for (const tx of records) {
            if (tx.gateInDateTime && tx.gateOutDateTime) {
                const diffMs = new Date(tx.gateOutDateTime).getTime() - new Date(tx.gateInDateTime).getTime();
                const diffMins = Math.round(diffMs / 60000);
                tx.durationInPlantMinutes = diffMins;
            }
        }
    });


    /*
     * ============================================================
     * SAP S/4HANA CLOUD EXTERNAL PURCHASE ORDERS
     * ============================================================
     */

    this.on('READ', 'PurchaseOrders', async (req) => {
        try {
            const externalPO = await cds.connect.to('CE_PURCHASEORDER_0001');
            return await externalPO.run(req.query);
        } catch (err) {
            console.warn('[GateService] External S/4HANA PO service not reachable, serving fallback data:', err.message);
            const fallbackPOs = [
                {
                    PurchaseOrder: "4500001001",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-01",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "001",
                    PurchaseOrderDate: "2026-09-10"
                },
                {
                    PurchaseOrder: "4500001002",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-02",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "001",
                    PurchaseOrderDate: "2026-09-12"
                },
                {
                    PurchaseOrder: "4500001003",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-03",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "002",
                    PurchaseOrderDate: "2026-09-14"
                },
                {
                    PurchaseOrder: "PO-4500112233",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-01",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "001",
                    PurchaseOrderDate: "2026-09-15"
                },
                {
                    PurchaseOrder: "PO-APL-7788",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-02",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "001",
                    PurchaseOrderDate: "2026-09-16"
                },
                {
                    PurchaseOrder: "PO-DIRECT-8899",
                    PurchaseOrderType: "NB",
                    Supplier: "SUPP-03",
                    CompanyCode: "1000",
                    PurchasingOrganization: "1010",
                    PurchasingGroup: "002",
                    PurchaseOrderDate: "2026-09-16"
                }
            ];

            return fallbackPOs;
        }
    });


    /*
     * ============================================================
     * CREATE GATE IN
     * ============================================================
     */

    this.on('CreateGateIn', async (req) => {

        const {
            vehicleRegNo,
            vehicleType,
            purpose,
            driverName
        } = req.data;

        // Validation
        if (!vehicleRegNo) {
            return req.reject(
                400,
                'Vehicle Registration Number is mandatory.'
            );
        }

        const normalizedRegNo = vehicleRegNo.trim().toUpperCase();
        const vehicleRegex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
        if (!vehicleRegex.test(normalizedRegNo)) {
            return req.reject(
                400,
                `Invalid Vehicle Registration Number format '${vehicleRegNo}'. Format must be like AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-1234).`
            );
        }

        const effectiveVehicleType = vehicleType || 'TRUCK';

        if (!purpose) {
            return req.reject(
                400,
                'Purpose of Visit is mandatory.'
            );
        }


        /*
         * Check whether the vehicle already has an
         * active transaction.
         */

        const existingTransaction = await SELECT.one
            .from(GateTransactions)
            .where({
                vehicleRegNo: normalizedRegNo,
                status: {
                    in: [
                        'GATE_IN',
                        'SECURITY_IN',
                        'WEIGHBRIDGE_IN',
                        'FACTORY_IN',
                        'FACTORY_OUT',
                        'WEIGHBRIDGE_OUT',
                        'SECURITY_OUT'
                    ]
                }
            });


        if (existingTransaction) {

            return req.reject(
                400,
                `Vehicle ${normalizedRegNo} already has an active Gate IN transaction.`
            );
        }


        /*
         * Generate Gate IN Number
         */

        const gateInNumber =
            await generateGateInNumber();


        /*
         * Create transaction
         */

        const transaction = {
            ID: cds.utils.uuid(),

            gateInNumber: gateInNumber,

            vehicleRegNo: normalizedRegNo,

            vehicleType: effectiveVehicleType,

            driverName: driverName || null,

            purpose: purpose,

            status: 'GATE_IN',

            currentStage: 'MAIN_GATE_IN',

            gateInDateTime: new Date(),

            gateInOperator: req.user?.id || 'SYSTEM'
        };


        await INSERT.into(GateTransactions)
            .entries(transaction);


        /*
         * Audit
         */

        await INSERT.into(GateAuditLogs)
            .entries({
                ID: cds.utils.uuid(),

                gateTransaction_ID: transaction.ID,

                action: 'GATE_IN_CREATED',

                newStatus: 'GATE_IN',

                newStage: 'MAIN_GATE_IN',

                actionDateTime: new Date(),

                userId: req.user?.id || 'SYSTEM',

                userName: req.user?.id || 'SYSTEM'
            });


        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * SECURITY GATE IN
     * ============================================================
     */

    this.on('SecurityGateIn', async (req) => {
        const {
            gateInNumber,
            driverLicenseNo,
            driverPhoneNo,
            helperName,
            vehicleReportingDateTime,
            securityPersonnel,
            driverVerified,
            vehicleVerified,
            documentsVerified,
            poNumber,
            soNumber,
            invoiceNumber,
            invoiceDate,
            withoutPO,
            rgpDocumentNo,
            nrgpDocumentNo,
            gatePassType,
            assignedRoute,
            remarks
        } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.', 'in/gateInNumber');
        }

        if (!driverLicenseNo) {
            return req.error(400, 'Driver License Number is mandatory.', 'in/driverLicenseNo');
        }

        if (!securityPersonnel) {
            return req.error(400, 'Security Personnel is mandatory.', 'in/securityPersonnel');
        }

        // 1. Locate Transaction
        const transaction = await SELECT.one
            .from(GateTransactions)
            .where({ gateInNumber: gateInNumber });

        if (!transaction) {
            return req.error(404, `Gate IN Number '${gateInNumber}' does not exist.`);
        }

        // 2. Validate current stage
        if (transaction.status !== 'GATE_IN') {
            return req.error(400, `Vehicle is not ready for Security Gate IN. Current status: ${transaction.status}`);
        }

        // 3. Delivery vs Pickup Documentation Validation
        const isDelivery = (transaction.purpose === 'DELIVERY');
        const isPickup = (transaction.purpose === 'PICKUP');
        const bWithoutPO = Boolean(withoutPO);

        if (isDelivery && !bWithoutPO) {
            if (!poNumber) {
                return req.error(400, 'Purchase Order (PO) Number is mandatory for Delivery vehicles unless "Without PO" is checked.', 'in/poNumber');
            }
        }

        // 4. Create Security Entry
        const entryId = cds.utils.uuid();
        const determinedPassType = gatePassType || (rgpDocumentNo ? 'RGP' : (nrgpDocumentNo ? 'NRGP' : null));

        await INSERT.into(SecurityGateEntries).entries({
            ID: entryId,
            gateTransaction_ID: transaction.ID,
            gateInNumber: transaction.gateInNumber,
            driverLicenseNo: driverLicenseNo,
            driverPhoneNo: driverPhoneNo || '',
            helperName: helperName || '',
            vehicleReportingDateTime: vehicleReportingDateTime || new Date(),
            securityPersonnel: securityPersonnel,
            driverVerified: driverVerified !== false,
            vehicleVerified: vehicleVerified !== false,
            documentsVerified: documentsVerified !== false,
            poNumber: isDelivery ? (bWithoutPO ? null : (poNumber || null)) : null,
            soNumber: isDelivery ? (bWithoutPO ? null : (soNumber || null)) : null,
            invoiceNumber: isDelivery ? (bWithoutPO ? null : (invoiceNumber || null)) : null,
            invoiceDate: isDelivery ? (bWithoutPO ? null : (invoiceDate || null)) : null,
            withoutPO: isDelivery ? bWithoutPO : false,
            rgpDocumentNo: isPickup ? (rgpDocumentNo || null) : null,
            nrgpDocumentNo: isPickup ? (nrgpDocumentNo || null) : null,
            gatePassType: isPickup ? determinedPassType : null,
            assignedRoute: assignedRoute || null,
            securityInDateTime: new Date(),
            remarks: remarks || (isDelivery && bWithoutPO ? 'Delivery without PO authorized by Security' : '')
        });

        // 5. Sync Delivery Details record if delivery
        if (isDelivery) {
            await INSERT.into(DeliveryDetails).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                poNumber: bWithoutPO ? 'WITHOUT-PO' : (poNumber || ''),
                soNumber: bWithoutPO ? '' : (soNumber || ''),
                invoiceNumber: bWithoutPO ? '' : (invoiceNumber || ''),
                invoiceDate: bWithoutPO ? null : (invoiceDate || null),
                documentVerificationStatus: 'VERIFIED',
                remarks: bWithoutPO ? 'Delivery without PO authorized by Security' : (remarks || '')
            });
        }

        // 5b. Sync Pickup Details record if pickup (both RGP and NRGP are optional at entry)
        if (isPickup && (rgpDocumentNo || nrgpDocumentNo || determinedPassType)) {
            await INSERT.into(PickupDetails).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gatePassType: determinedPassType || 'RGP',
                gatePassDocumentNo: rgpDocumentNo || nrgpDocumentNo || '',
                gatePassDocumentDate: new Date(),
                pickupPurpose: transaction.remarks || 'Material Dispatch / Pickup',
                authorizedBy: securityPersonnel,
                gatePassVerified: Boolean(rgpDocumentNo || nrgpDocumentNo),
                remarks: remarks || 'Pickup documentation noted at Security Gate IN'
            });
        }

        // 6. Update main transaction stage and status
        const determinedRoute = assignedRoute ? assignedRoute.toUpperCase().trim() : '';
        const targetStage = determinedRoute === 'WEIGHBRIDGE' ? 'WEIGHBRIDGE_IN' : (determinedRoute === 'FACTORY' ? 'FACTORY' : 'SECURITY_GATE_IN');
        const targetStatus = determinedRoute === 'FACTORY' ? 'FACTORY_IN' : 'SECURITY_IN';

        await UPDATE(GateTransactions)
            .set({
                status: targetStatus,
                currentStage: targetStage,
                assignedRoute: determinedRoute || null,
                driverLicenseNo: driverLicenseNo || transaction.driverLicenseNo,
                driverPhoneNo: driverPhoneNo || transaction.driverPhoneNo
            })
            .where({
                ID: transaction.ID
            });

        // If directly routed to factory at entry, initialize FactoryGateEntries
        if (determinedRoute === 'FACTORY') {
            await INSERT.into(FactoryGateEntries).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                factoryGateInDateTime: new Date(),
                factoryGateInOperator: securityPersonnel,
                factoryArea: 'Raw Material Yard',
                poNumber: isDelivery ? (bWithoutPO ? '' : (poNumber || '')) : '',
                invoiceNumber: isDelivery ? (bWithoutPO ? '' : (invoiceNumber || '')) : '',
                invoiceDate: isDelivery ? (bWithoutPO ? null : (invoiceDate || null)) : null,
                unloadingStatus: 'IN_PROGRESS',
                remarks: 'Direct Factory Entry assigned at Security Gate IN'
            });
        }

        // 7. Create immutable Audit Log
        let auditRemarks;
        if (isDelivery) {
            auditRemarks = bWithoutPO
                ? `Security Check-In (Without PO) completed by ${securityPersonnel}`
                : `Security Check-In completed by ${securityPersonnel} (PO: ${poNumber || 'N/A'}, Inv: ${invoiceNumber || 'N/A'})`;
        } else {
            const docInfo = rgpDocumentNo ? `RGP: ${rgpDocumentNo}` : (nrgpDocumentNo ? `NRGP: ${nrgpDocumentNo}` : 'Docs Pending at Exit');
            auditRemarks = `Security Check-In (Pickup) completed by ${securityPersonnel} (${docInfo})`;
        }

        if (determinedRoute) {
            auditRemarks += ` [Assigned Route: To ${determinedRoute === 'FACTORY' ? 'Factory Gate' : 'Weighbridge'}]`;
        }

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: determinedRoute === 'FACTORY' ? 'FACTORY_GATE_IN' : 'SECURITY_GATE_IN',
            oldStatus: 'GATE_IN',
            newStatus: targetStatus,
            oldStage: 'MAIN_GATE_IN',
            newStage: targetStage,
            actionDateTime: new Date(),
            userId: req.user?.id || 'SYSTEM',
            userName: securityPersonnel,
            remarks: auditRemarks
        });

        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * ASSIGN ROUTE (TO WEIGHBRIDGE / TO FACTORY)
     * ============================================================
     */
    this.on('AssignRoute', async (req) => {
        const { gateInNumber, route, remarks } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.', 'in/gateInNumber');
        }

        if (!route) {
            return req.error(400, 'Route is mandatory (WEIGHBRIDGE or FACTORY).', 'in/route');
        }

        const sRoute = route.toUpperCase().trim();
        if (sRoute !== 'WEIGHBRIDGE' && sRoute !== 'FACTORY') {
            return req.error(400, "Invalid route. Allowed values: 'WEIGHBRIDGE' or 'FACTORY'.", 'in/route');
        }

        const transaction = await getTransaction(gateInNumber, req);

        if (transaction.status !== 'SECURITY_IN') {
            return req.error(400, `Vehicle ${gateInNumber} is not at Security Gate. Current status: ${transaction.status}`);
        }

        const sOperator = req.user?.id || 'SecurityOfficer';

        if (sRoute === 'WEIGHBRIDGE') {
            await UPDATE(GateTransactions)
                .set({
                    currentStage: 'WEIGHBRIDGE_IN',
                    assignedRoute: 'WEIGHBRIDGE'
                })
                .where({ ID: transaction.ID });

            await UPDATE(SecurityGateEntries)
                .set({ assignedRoute: 'WEIGHBRIDGE' })
                .where({ gateTransaction_ID: transaction.ID });

            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                action: 'ROUTE_ASSIGNED',
                oldStatus: transaction.status,
                newStatus: 'SECURITY_IN',
                oldStage: transaction.currentStage,
                newStage: 'WEIGHBRIDGE_IN',
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: sOperator,
                remarks: remarks || `Security Gate: Route assigned to Weighbridge for gross/tare weighment by ${sOperator}`
            });
        } else if (sRoute === 'FACTORY') {
            await UPDATE(GateTransactions)
                .set({
                    status: 'FACTORY_IN',
                    currentStage: 'FACTORY',
                    assignedRoute: 'FACTORY'
                })
                .where({ ID: transaction.ID });

            await UPDATE(SecurityGateEntries)
                .set({ assignedRoute: 'FACTORY' })
                .where({ gateTransaction_ID: transaction.ID });

            const secEntry = await SELECT.one.from(SecurityGateEntries).where({ gateTransaction_ID: transaction.ID });
            const existingFac = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });

            const poNumber = secEntry?.poNumber || '';
            const invoiceNumber = secEntry?.invoiceNumber || '';
            const invoiceDate = secEntry?.invoiceDate || null;

            if (existingFac) {
                await UPDATE(FactoryGateEntries)
                    .set({
                        factoryGateInDateTime: new Date(),
                        factoryGateInOperator: sOperator,
                        poNumber: poNumber,
                        invoiceNumber: invoiceNumber,
                        invoiceDate: invoiceDate,
                        unloadingStatus: 'IN_PROGRESS',
                        remarks: remarks || 'Direct Factory Entry assigned by Security Gate'
                    })
                    .where({ ID: existingFac.ID });
            } else {
                await INSERT.into(FactoryGateEntries).entries({
                    ID: cds.utils.uuid(),
                    gateTransaction_ID: transaction.ID,
                    gateInNumber: transaction.gateInNumber,
                    factoryGateInDateTime: new Date(),
                    factoryGateInOperator: sOperator,
                    factoryArea: 'Raw Material Yard',
                    poNumber: poNumber,
                    invoiceNumber: invoiceNumber,
                    invoiceDate: invoiceDate,
                    unloadingStatus: 'IN_PROGRESS',
                    remarks: remarks || 'Direct Factory Entry assigned by Security Gate'
                });
            }

            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                action: 'FACTORY_GATE_IN',
                oldStatus: transaction.status,
                newStatus: 'FACTORY_IN',
                oldStage: transaction.currentStage,
                newStage: 'FACTORY',
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: sOperator,
                remarks: remarks || `Direct Factory Entry assigned by Security Gate: ${sOperator} (Weighbridge bypassed)`
            });
        }

        return SELECT.one.from(GateTransactions).where({ ID: transaction.ID });
    });


    /*
     * ============================================================
     * WEIGHBRIDGE
     * ============================================================
     */

    this.on('RecordWeighment', async (req) => {

        const {
            gateInNumber,
            weight,
            weighbridgeNumber,
            weighmentType: reqWeighmentType,
            weightUnit,
            weighbridgeDateTime,
            operator,
            remarks
        } = req.data;


        if (!gateInNumber) {
            return req.error(
                400,
                'Gate IN Number is mandatory.'
            );
        }

        if (
            weight === null ||
            weight === undefined ||
            weight <= 0
        ) {

            return req.error(
                400,
                'Valid weight is mandatory.'
            );
        }

        if (!weighbridgeNumber) {
            return req.error(
                400,
                'Weighbridge Number is mandatory.'
            );
        }


        const transaction = await SELECT.one
            .from(GateTransactions)
            .where({
                gateInNumber: gateInNumber
            });


        if (!transaction) {

            return req.error(
                404,
                `Gate IN Number ${gateInNumber} does not exist.`
            );
        }


        /*
         * Determine whether this is
         * IN or OUT weighing.
         */

        let weighmentType;

        if (
            transaction.status ===
            'SECURITY_IN'
        ) {

            if (
                transaction.purpose ===
                'DELIVERY'
            ) {

                weighmentType =
                    'GROSS_IN';

            } else {

                weighmentType =
                    'TARE_IN';
            }

        } else if (
            transaction.status ===
            'FACTORY_OUT'
        ) {

            if (
                transaction.purpose ===
                'DELIVERY'
            ) {

                weighmentType =
                    'TARE_OUT';

            } else {

                weighmentType =
                    'GROSS_OUT';
            }

        } else {

            return req.error(
                400,
                `Vehicle is not ready for weighbridge. Current status: ${transaction.status}`
            );
        }


        /*
         * Create weighbridge record
         */

        await INSERT.into(
            WeighbridgeTransactions
        ).entries({

            ID: cds.utils.uuid(),

            gateTransaction_ID:
                transaction.ID,

            weighbridgeNumber:
                weighbridgeNumber,

            weighmentType:
                reqWeighmentType || weighmentType,

            weight:
                weight,

            weightUnit:
                weightUnit || 'KG',

            weighbridgeDateTime:
                weighbridgeDateTime ? new Date(weighbridgeDateTime) : new Date(),

            operator:
                operator || req.user?.id || 'SYSTEM',

            remarks:
                remarks || null
        });


        /*
         * Update status
         */

        let newStatus;
        let newStage;

        if (
            transaction.status ===
            'SECURITY_IN'
        ) {

            newStatus =
                'WEIGHBRIDGE_IN';

            newStage =
                'WEIGHBRIDGE_IN';

        } else {

            newStatus =
                'WEIGHBRIDGE_OUT';

            newStage =
                'WEIGHBRIDGE_OUT';
        }


        await UPDATE(GateTransactions)
            .set({

                status:
                    newStatus,

                currentStage:
                    newStage,

                assignedRoute:
                    newStatus === 'WEIGHBRIDGE_IN' ? 'WEIGHBRIDGE' : transaction.assignedRoute

            })
            .where({
                ID: transaction.ID
            });


        /*
         * Audit Log
         */

        const finalType = reqWeighmentType || weighmentType;
        const finalUnit = weightUnit || 'KG';
        const finalOp = operator || req.user?.id || 'SYSTEM';

        await INSERT.into(
            GateAuditLogs
        ).entries({

            ID: cds.utils.uuid(),

            gateTransaction_ID:
                transaction.ID,

            action:
                `WEIGHMENT_${finalType}`,

            oldStatus:
                transaction.status,

            newStatus:
                newStatus,

            oldStage:
                transaction.currentStage,

            newStage:
                newStage,

            actionDateTime:
                weighbridgeDateTime ? new Date(weighbridgeDateTime) : new Date(),

            userId:
                finalOp,

            userName:
                finalOp,

            remarks:
                `Recorded ${finalType}: ${weight} ${finalUnit} on Scale #${weighbridgeNumber}${remarks ? ' - ' + remarks : ''}`
        });


        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * FACTORY GATE IN
     * ============================================================
     */

    this.on('FactoryGateIn', async (req) => {
        const {
            gateInNumber,
            factoryGateInDateTime,
            factoryGateInOperator,
            factoryArea,
            unloadingPoint,
            poNumber: reqPoNumber,
            invoiceNumber: reqInvoiceNumber,
            invoiceDate: reqInvoiceDate,
            supplierName: reqSupplierName,
            transporterName: reqTransporterName,
            materialDescription,
            deliveryNoteNo,
            remarks
        } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.');
        }

        const transaction = await getTransaction(gateInNumber, req);

        // Allow both SECURITY_IN (direct entry without scale) and WEIGHBRIDGE_IN (entry after scale)
        validateStage(
            transaction,
            ['SECURITY_IN', 'WEIGHBRIDGE_IN'],
            req
        );

        // Pull PO, Invoice and Delivery data from SecurityGateEntries if not supplied
        const secEntry = await SELECT.one.from(SecurityGateEntries).where({ gateTransaction_ID: transaction.ID });
        const poNumber = reqPoNumber || secEntry?.poNumber || '';
        const invoiceNumber = reqInvoiceNumber || secEntry?.invoiceNumber || '';
        const invoiceDate = reqInvoiceDate || secEntry?.invoiceDate || null;

        let supplierName = reqSupplierName || '';
        if (!supplierName && transaction.supplier_ID) {
            const s = await SELECT.one.from(Suppliers).where({ ID: transaction.supplier_ID });
            if (s) supplierName = s.supplierName;
        }

        let transporterName = reqTransporterName || '';
        if (!transporterName && transaction.transporter_ID) {
            const t = await SELECT.one.from(Transporters).where({ ID: transaction.transporter_ID });
            if (t) transporterName = t.transporterName;
        }

        const sOperator = factoryGateInOperator || req.user?.id || 'SYSTEM';
        const inTimestamp = factoryGateInDateTime ? new Date(factoryGateInDateTime) : new Date();

        // Check if consolidated record already exists
        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateInDateTime: inTimestamp,
                    factoryGateInOperator: sOperator,
                    factoryArea: factoryArea || existing.factoryArea || 'Raw Material Yard',
                    unloadingPoint: unloadingPoint || existing.unloadingPoint || '',
                    poNumber: poNumber,
                    invoiceNumber: invoiceNumber,
                    invoiceDate: invoiceDate,
                    supplierName: supplierName,
                    transporterName: transporterName,
                    materialDescription: materialDescription || existing.materialDescription || '',
                    deliveryNoteNo: deliveryNoteNo || existing.deliveryNoteNo || '',
                    remarks: remarks || existing.remarks || ''
                })
                .where({ ID: existing.ID });
        } else {
            await INSERT.into(FactoryGateEntries).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                factoryGateInDateTime: inTimestamp,
                factoryGateInOperator: sOperator,
                factoryArea: factoryArea || 'Raw Material Yard',
                unloadingPoint: unloadingPoint || '',
                poNumber: poNumber,
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                supplierName: supplierName,
                transporterName: transporterName,
                materialDescription: materialDescription || '',
                deliveryNoteNo: deliveryNoteNo || '',
                unloadingStatus: 'IN_PROGRESS',
                remarks: remarks || ''
            });
        }

        await UPDATE(GateTransactions)
            .set({
                status: 'FACTORY_IN',
                currentStage: 'FACTORY',
                assignedRoute: 'FACTORY'
            })
            .where({
                ID: transaction.ID
            });

        const flowTypeDesc = transaction.status === 'SECURITY_IN'
            ? 'Direct Factory Entry (Weighbridge bypassed)'
            : 'Factory Entry following Inbound Weighment';

        const auditRemarks = remarks
            ? `Factory Gate IN: ${remarks} (${flowTypeDesc})`
            : `Factory Gate IN recorded by ${sOperator} (${flowTypeDesc}, PO: ${poNumber || 'N/A'}, Inv: ${invoiceNumber || 'N/A'})`;

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: 'FACTORY_GATE_IN',
            oldStatus: transaction.status,
            newStatus: 'FACTORY_IN',
            oldStage: transaction.currentStage,
            newStage: 'FACTORY',
            actionDateTime: inTimestamp,
            userId: req.user?.id || 'SYSTEM',
            userName: sOperator,
            remarks: auditRemarks
        });

        return SELECT.one.from(GateTransactions).where({ ID: transaction.ID });
    });


    /*
     * ============================================================
     * FACTORY GATE OUT
     * ============================================================
     */

    this.on('FactoryGateOut', async (req) => {
        const {
            gateInNumber,
            factoryGateOutDateTime,
            factoryGateOutOperator,
            unloadingStatus,
            unloadedQuantity,
            quantityUnit,
            goodsInspected,
            sealVerified,
            remarks
        } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.');
        }

        const transaction = await getTransaction(gateInNumber, req);

        validateStage(
            transaction,
            'FACTORY_IN',
            req
        );

        const sOperator = factoryGateOutOperator || req.user?.id || 'SYSTEM';
        const outTimestamp = factoryGateOutDateTime ? new Date(factoryGateOutDateTime) : new Date();

        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateOutDateTime: outTimestamp,
                    factoryGateOutOperator: sOperator,
                    unloadingStatus: unloadingStatus || 'COMPLETED',
                    unloadedQuantity: unloadedQuantity || existing.unloadedQuantity,
                    quantityUnit: quantityUnit || existing.quantityUnit || 'KG',
                    goodsInspected: goodsInspected !== undefined ? Boolean(goodsInspected) : existing.goodsInspected,
                    sealVerified: sealVerified !== undefined ? Boolean(sealVerified) : existing.sealVerified,
                    remarks: remarks || existing.remarks || 'Factory yard operations completed'
                })
                .where({ ID: existing.ID });
        } else {
            await INSERT.into(FactoryGateEntries).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                factoryGateOutDateTime: outTimestamp,
                factoryGateOutOperator: sOperator,
                unloadingStatus: unloadingStatus || 'COMPLETED',
                unloadedQuantity: unloadedQuantity || null,
                quantityUnit: quantityUnit || 'KG',
                goodsInspected: goodsInspected !== undefined ? Boolean(goodsInspected) : true,
                sealVerified: sealVerified !== undefined ? Boolean(sealVerified) : true,
                remarks: remarks || 'Factory yard operations completed'
            });
        }

        await UPDATE(GateTransactions)
            .set({
                status: 'FACTORY_OUT',
                currentStage: 'FACTORY'
            })
            .where({
                ID: transaction.ID
            });

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: 'FACTORY_GATE_OUT',
            oldStatus: 'FACTORY_IN',
            newStatus: 'FACTORY_OUT',
            oldStage: 'FACTORY',
            newStage: 'FACTORY',
            actionDateTime: outTimestamp,
            userId: req.user?.id || 'SYSTEM',
            userName: sOperator,
            remarks: remarks
                ? `Factory Gate OUT: ${remarks}`
                : `Factory yard operations completed by ${sOperator}. Vehicle released for exit clearance.`
        });

        return SELECT.one.from(GateTransactions).where({ ID: transaction.ID });
    });


    /*
     * ============================================================
     * RECORD FACTORY OPERATION (CONSOLIDATED IN & OUT)
     * ============================================================
     */

    this.on('RecordFactoryOperation', async (req) => {
        const {
            gateInNumber,
            factoryGateInDateTime,
            factoryGateInOperator,
            factoryGateOutDateTime,
            factoryGateOutOperator,
            factoryArea,
            unloadingPoint,
            poNumber: reqPoNumber,
            invoiceNumber: reqInvoiceNumber,
            invoiceDate: reqInvoiceDate,
            supplierName: reqSupplierName,
            transporterName: reqTransporterName,
            materialDescription,
            unloadingStatus,
            unloadedQuantity,
            quantityUnit,
            deliveryNoteNo,
            goodsInspected,
            sealVerified,
            remarks
        } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.');
        }

        const transaction = await getTransaction(gateInNumber, req);

        // Can record if in SECURITY_IN, WEIGHBRIDGE_IN, or FACTORY_IN
        validateStage(
            transaction,
            ['SECURITY_IN', 'WEIGHBRIDGE_IN', 'FACTORY_IN'],
            req
        );

        const secEntry = await SELECT.one.from(SecurityGateEntries).where({ gateTransaction_ID: transaction.ID });
        const poNumber = reqPoNumber || secEntry?.poNumber || '';
        const invoiceNumber = reqInvoiceNumber || secEntry?.invoiceNumber || '';
        const invoiceDate = reqInvoiceDate || secEntry?.invoiceDate || null;

        let supplierName = reqSupplierName || '';
        if (!supplierName && transaction.supplier_ID) {
            const s = await SELECT.one.from(Suppliers).where({ ID: transaction.supplier_ID });
            if (s) supplierName = s.supplierName;
        }

        let transporterName = reqTransporterName || '';
        if (!transporterName && transaction.transporter_ID) {
            const t = await SELECT.one.from(Transporters).where({ ID: transaction.transporter_ID });
            if (t) transporterName = t.transporterName;
        }

        const inOp = factoryGateInOperator || req.user?.id || 'SYSTEM';
        const outOp = factoryGateOutOperator || (factoryGateOutDateTime ? (req.user?.id || 'SYSTEM') : null);
        const inTime = factoryGateInDateTime ? new Date(factoryGateInDateTime) : new Date();
        const outTime = factoryGateOutDateTime ? new Date(factoryGateOutDateTime) : null;

        const isOutRecorded = Boolean(outTime) || transaction.status === 'FACTORY_IN';
        const newStatus = isOutRecorded ? 'FACTORY_OUT' : 'FACTORY_IN';

        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateInDateTime: inTime || existing.factoryGateInDateTime,
                    factoryGateInOperator: inOp || existing.factoryGateInOperator,
                    factoryGateOutDateTime: outTime || existing.factoryGateOutDateTime,
                    factoryGateOutOperator: outOp || existing.factoryGateOutOperator,
                    factoryArea: factoryArea || existing.factoryArea || 'Raw Material Yard',
                    unloadingPoint: unloadingPoint || existing.unloadingPoint || '',
                    poNumber: poNumber || existing.poNumber,
                    invoiceNumber: invoiceNumber || existing.invoiceNumber,
                    invoiceDate: invoiceDate || existing.invoiceDate,
                    supplierName: supplierName || existing.supplierName,
                    transporterName: transporterName || existing.transporterName,
                    materialDescription: materialDescription || existing.materialDescription || '',
                    unloadingStatus: unloadingStatus || (isOutRecorded ? 'COMPLETED' : 'IN_PROGRESS'),
                    unloadedQuantity: unloadedQuantity || existing.unloadedQuantity,
                    quantityUnit: quantityUnit || existing.quantityUnit || 'KG',
                    deliveryNoteNo: deliveryNoteNo || existing.deliveryNoteNo || '',
                    goodsInspected: goodsInspected !== undefined ? Boolean(goodsInspected) : existing.goodsInspected,
                    sealVerified: sealVerified !== undefined ? Boolean(sealVerified) : existing.sealVerified,
                    remarks: remarks || existing.remarks || ''
                })
                .where({ ID: existing.ID });
        } else {
            await INSERT.into(FactoryGateEntries).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                factoryGateInDateTime: inTime,
                factoryGateInOperator: inOp,
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                factoryArea: factoryArea || 'Raw Material Yard',
                unloadingPoint: unloadingPoint || '',
                poNumber: poNumber,
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                supplierName: supplierName,
                transporterName: transporterName,
                materialDescription: materialDescription || '',
                unloadingStatus: unloadingStatus || (isOutRecorded ? 'COMPLETED' : 'IN_PROGRESS'),
                unloadedQuantity: unloadedQuantity || null,
                quantityUnit: quantityUnit || 'KG',
                deliveryNoteNo: deliveryNoteNo || '',
                goodsInspected: goodsInspected !== undefined ? Boolean(goodsInspected) : true,
                sealVerified: sealVerified !== undefined ? Boolean(sealVerified) : true,
                remarks: remarks || ''
            });
        }

        await UPDATE(GateTransactions)
            .set({
                status: newStatus,
                currentStage: 'FACTORY'
            })
            .where({
                ID: transaction.ID
            });

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: isOutRecorded ? 'FACTORY_GATE_OUT' : 'FACTORY_GATE_IN',
            oldStatus: transaction.status,
            newStatus: newStatus,
            oldStage: transaction.currentStage,
            newStage: 'FACTORY',
            actionDateTime: outTime || inTime,
            userId: req.user?.id || 'SYSTEM',
            userName: isOutRecorded ? (outOp || inOp) : inOp,
            remarks: remarks || `Factory operations recorded (${newStatus})`
        });

        return SELECT.one.from(GateTransactions).where({ ID: transaction.ID });
    });


    /*
     * ============================================================
     * SECURITY GATE OUT
     * ============================================================
     */

    this.on('SecurityGateOut', async (req) => {
        const {
            gateInNumber,
            securityPersonnel,
            gatePassType,
            gatePassDocumentNo,
            driverVerified,
            vehicleVerified,
            documentsVerified,
            gatePassVerified,
            deliveryDetailsVerified,
            emptyInspectionVerified,
            materialInspected,
            remarks
        } = req.data;

        const transaction = await getTransaction(gateInNumber, req);

        // Allow WEIGHBRIDGE_OUT, FACTORY_OUT, SECURITY_IN, and FACTORY_IN (direct exit without scale)
        const allowedOutStatuses = ['WEIGHBRIDGE_OUT', 'FACTORY_OUT', 'SECURITY_IN', 'FACTORY_IN'];
        if (!allowedOutStatuses.includes(transaction.status)) {
            return req.reject(
                400,
                `Invalid process stage for Security Gate OUT. Expected ${allowedOutStatuses.join(', ')}, current status is '${transaction.status}'.`
            );
        }

        const isPickup = (transaction.purpose === 'PICKUP');
        const isDelivery = (transaction.purpose === 'DELIVERY');

        // Locate existing consolidated Security record for this transaction
        const existingSec = await SELECT.one
            .from(SecurityGateEntries)
            .where({ gateTransaction_ID: transaction.ID });

        let determinedPassType = gatePassType;
        let determinedDocNo = gatePassDocumentNo;

        if (isPickup) {
            if (!determinedPassType && existingSec && existingSec.gatePassType) {
                determinedPassType = existingSec.gatePassType;
            }
            if (!determinedDocNo && existingSec) {
                determinedDocNo = existingSec.rgpDocumentNo || existingSec.nrgpDocumentNo || existingSec.exitGatePassDocumentNo;
            }
            if (!determinedPassType && !determinedDocNo) {
                return req.error(400, 'Gate Pass Type (RGP / NRGP) or Document Number is mandatory for material pickup.');
            }
        }

        const outTime = new Date();
        const secOutPerson = securityPersonnel || req.user?.id || 'security_user';

        if (existingSec) {
            // Update the single consolidated record with exit attributes
            await UPDATE(SecurityGateEntries)
                .set({
                    securityOutPersonnel: secOutPerson,
                    securityOutDateTime: outTime,
                    exitDriverVerified: driverVerified !== undefined ? Boolean(driverVerified) : true,
                    exitVehicleVerified: vehicleVerified !== undefined ? Boolean(vehicleVerified) : true,
                    exitDocumentsVerified: documentsVerified !== undefined ? Boolean(documentsVerified) : true,
                    gatePassVerified: gatePassVerified !== undefined ? Boolean(gatePassVerified) : isPickup,
                    deliveryDetailsVerified: deliveryDetailsVerified !== undefined ? Boolean(deliveryDetailsVerified) : isDelivery,
                    emptyInspectionVerified: emptyInspectionVerified !== undefined ? Boolean(emptyInspectionVerified) : true,
                    materialInspected: materialInspected !== undefined ? Boolean(materialInspected) : true,
                    exitGatePassType: determinedPassType || existingSec.gatePassType || null,
                    exitGatePassDocumentNo: determinedDocNo || existingSec.exitGatePassDocumentNo || null,
                    securityOutRemarks: remarks || null,
                    remarks: remarks || existingSec.remarks || null
                })
                .where({ ID: existingSec.ID });
        } else {
            // Create single consolidated record with both IN and OUT data
            await INSERT.into(SecurityGateEntries).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                securityPersonnel: secOutPerson,
                securityInDateTime: transaction.gateInDateTime || outTime,
                securityOutPersonnel: secOutPerson,
                securityOutDateTime: outTime,
                exitDriverVerified: driverVerified !== false,
                exitVehicleVerified: vehicleVerified !== false,
                exitDocumentsVerified: documentsVerified !== false,
                gatePassVerified: isPickup,
                deliveryDetailsVerified: isDelivery,
                emptyInspectionVerified: true,
                materialInspected: true,
                exitGatePassType: determinedPassType || null,
                exitGatePassDocumentNo: determinedDocNo || null,
                securityOutRemarks: remarks || null,
                remarks: remarks || null
            });
        }

        // Update GateTransactions status & stage
        await UPDATE(GateTransactions)
            .set({
                status: 'SECURITY_OUT',
                currentStage: 'SECURITY_GATE_OUT'
            })
            .where({
                ID: transaction.ID
            });

        let stageContext = '';
        if (transaction.status === 'SECURITY_IN') {
            stageContext = '[Direct Exit - Weighbridge bypassed]';
        } else if (transaction.status === 'FACTORY_OUT') {
            stageContext = '[Factory Exit - Outbound scale bypassed]';
        } else if (transaction.status === 'FACTORY_IN') {
            stageContext = '[Factory Yard Exit]';
        } else {
            stageContext = '[Scale Clearance]';
        }

        let auditRemarks = remarks ? `${stageContext} ${remarks}` : (
            transaction.status === 'SECURITY_IN'
                ? `Security Exit Clearance completed directly after Security IN (Weighbridge not required) by ${secOutPerson}`
                : transaction.status === 'FACTORY_OUT'
                ? `Security Exit Clearance completed after Factory operations (Weighbridge not required) by ${secOutPerson}`
                : transaction.status === 'FACTORY_IN'
                ? `Security Exit Clearance completed from Factory Yard by ${secOutPerson}`
                : `Security Exit Clearance completed after Outbound Scale Weighment by ${secOutPerson}`
        );

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: 'SECURITY_GATE_OUT',
            oldStatus: transaction.status,
            newStatus: 'SECURITY_OUT',
            oldStage: transaction.currentStage,
            newStage: 'SECURITY_GATE_OUT',
            actionDateTime: outTime,
            userId: secOutPerson,
            userName: secOutPerson,
            remarks: auditRemarks
        });

        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * MAIN GATE OUT
     * ============================================================
     */

    this.on('MainGateOut', async (req) => {

        const {
            gateInNumber
        } = req.data;


        const transaction =
            await getTransaction(
                gateInNumber,
                req
            );


        if (transaction.status === 'COMPLETED') {
            return req.reject(
                400,
                `Vehicle ${gateInNumber} has already completed Gate OUT (Status: COMPLETED).`
            );
        }

        if (transaction.status === 'CANCELLED') {
            return req.reject(
                400,
                `Gate Entry ${gateInNumber} is cancelled and cannot be gated OUT.`
            );
        }


        const exitDateTime =
            new Date();


        await UPDATE(GateTransactions)
            .set({

                status:
                    'COMPLETED',

                currentStage:
                    'COMPLETED',

                gateOutDateTime:
                    exitDateTime,

                gateOutOperator:
                    req.user?.id || 'SYSTEM'

            })
            .where({
                ID: transaction.ID
            });


        await INSERT.into(
            GateAuditLogs
        ).entries({

            ID: cds.utils.uuid(),

            gateTransaction_ID:
                transaction.ID,

            action:
                'MAIN_GATE_OUT',

            oldStatus:
                transaction.status,

            newStatus:
                'COMPLETED',

            oldStage:
                transaction.currentStage,

            newStage:
                'COMPLETED',

            actionDateTime:
                exitDateTime,

            userId:
                req.user?.id || 'SYSTEM',

            userName:
                req.user?.id || 'SYSTEM'
        });


        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * USER INFO / AUTH CONTEXT
     * ============================================================
     */

    this.on('userInfo', (req) => {
        const roles = [];
        const checkRoles = [
            'Superadmin',
            'Admin',
            'MainGateUser',
            'SecurityGateUser',
            'WeighbridgeUser',
            'FactoryGateUser',
            'Auditor'
        ];

        for (const role of checkRoles) {
            if (req.user?.is(role)) {
                roles.push(role);
            }
        }

        return {
            id: req.user?.id || 'anonymous',
            roles: roles
        };
    });


    /*
     * ============================================================
     * HELPER FUNCTIONS
     * ============================================================
     */

    async function getTransaction(
        gateInNumber,
        req
    ) {

        if (!gateInNumber) {

            return req.reject(
                400,
                'Gate IN Number is mandatory.'
            );
        }


        const transaction =
            await SELECT.one
                .from(GateTransactions)
                .where({
                    gateInNumber:
                        gateInNumber
                });


        if (!transaction) {

            return req.reject(
                404,
                `Gate IN Number ${gateInNumber} does not exist.`
            );
        }


        return transaction;
    }


    function validateStage(
        transaction,
        expectedStatus,
        req
    ) {
        const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
        if (!allowed.includes(transaction.status)) {
            return req.reject(
                400,
                `Invalid process stage. Expected ${allowed.join(' or ')}, current status is ${transaction.status}.`
            );
        }
    }


    async function generateGateInNumber() {

        const year =
            new Date()
                .getFullYear();


        const prefix =
            `GI-${year}-`;


        const lastTransaction =
            await SELECT.one
                .from(GateTransactions)
                .columns('gateInNumber')
                .where({
                    gateInNumber: {
                        like: `${prefix}%`
                    }
                })
                .orderBy({
                    ref: ['gateInNumber'],
                    sort: 'desc'
                });


        let nextNumber = 1;


        if (lastTransaction) {

            const lastNumber =
                parseInt(
                    lastTransaction.gateInNumber
                        .replace(prefix, ''),
                    10
                );


            if (!isNaN(lastNumber)) {

                nextNumber =
                    lastNumber + 1;
            }
        }


        return (
            prefix +
            String(nextNumber)
                .padStart(6, '0')
        );
    }

});