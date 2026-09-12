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
        FactoryGateEvents,
        GateAuditLogs,
        Vehicles,
        Drivers,
        Transporters,
        Suppliers
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
            return req.error(400, 'Vehicle Registration Number is mandatory.', 'in/vehicleRegNo');
        }
        req.data.vehicleRegNo = req.data.vehicleRegNo.trim().toUpperCase();

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

        // If vehicle registration is updated, verify conflict
        if (req.data.vehicleRegNo && req.data.vehicleRegNo.toUpperCase() !== existing.vehicleRegNo) {
            const newReg = req.data.vehicleRegNo.trim().toUpperCase();
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
            await DELETE.from(SecurityGateExits).where({ gateTransaction_ID: id });
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
            return req.error(
                400,
                'Vehicle Registration Number is mandatory.'
            );
        }

        const effectiveVehicleType = vehicleType || 'TRUCK';

        if (!purpose) {
            return req.error(
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
                vehicleRegNo: vehicleRegNo,
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

            return req.error(
                400,
                `Vehicle ${vehicleRegNo} already has an active Gate IN transaction.`
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

            vehicleRegNo: vehicleRegNo,

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
            if (!poNumber && !invoiceNumber) {
                return req.error(400, 'For Delivery vehicles, PO Number and Invoice Number are mandatory unless "Without PO" is checked.', 'in/poNumber');
            }
            if (!poNumber) {
                return req.error(400, 'Purchase Order (PO) Number is mandatory for Delivery vehicles unless "Without PO" is checked.', 'in/poNumber');
            }
            if (!invoiceNumber) {
                return req.error(400, 'Invoice Number is mandatory for Delivery vehicles unless "Without PO" is checked.', 'in/invoiceNumber');
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
        await UPDATE(GateTransactions)
            .set({
                status: 'SECURITY_IN',
                currentStage: 'SECURITY_GATE_IN',
                driverLicenseNo: driverLicenseNo || transaction.driverLicenseNo,
                driverPhoneNo: driverPhoneNo || transaction.driverPhoneNo
            })
            .where({
                ID: transaction.ID
            });

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

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            gateTransaction_ID: transaction.ID,
            action: 'SECURITY_GATE_IN',
            oldStatus: 'GATE_IN',
            newStatus: 'SECURITY_IN',
            oldStage: 'MAIN_GATE_IN',
            newStage: 'SECURITY_GATE_IN',
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
     * WEIGHBRIDGE
     * ============================================================
     */

    this.on('RecordWeighment', async (req) => {

        const {
            gateInNumber,
            weight,
            weighbridgeNumber
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
                weighmentType,

            weight:
                weight,

            weightUnit:
                'KG',

            weighbridgeDateTime:
                new Date(),

            operator:
                req.user?.id || 'SYSTEM'
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
                    newStage

            })
            .where({
                ID: transaction.ID
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
            gateInNumber
        } = req.data;


        const transaction = await getTransaction(
            gateInNumber,
            req
        );


        validateStage(
            transaction,
            'WEIGHBRIDGE_IN',
            req
        );


        await INSERT.into(
            FactoryGateEvents
        ).entries({

            ID: cds.utils.uuid(),

            gateTransaction_ID:
                transaction.ID,

            factoryGateInDateTime:
                new Date(),

            factoryGateInOperator:
                req.user?.id || 'SYSTEM'
        });


        await UPDATE(GateTransactions)
            .set({

                status:
                    'FACTORY_IN',

                currentStage:
                    'FACTORY'
            })
            .where({
                ID: transaction.ID
            });


        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * FACTORY GATE OUT
     * ============================================================
     */

    this.on('FactoryGateOut', async (req) => {

        const {
            gateInNumber
        } = req.data;


        const transaction =
            await getTransaction(
                gateInNumber,
                req
            );


        validateStage(
            transaction,
            'FACTORY_IN',
            req
        );


        await UPDATE(FactoryGateEvents)
            .set({

                factoryGateOutDateTime:
                    new Date(),

                factoryGateOutOperator:
                    req.user?.id || 'SYSTEM'

            })
            .where({

                gateTransaction_ID:
                    transaction.ID

            });


        await UPDATE(GateTransactions)
            .set({

                status:
                    'FACTORY_OUT',

                currentStage:
                    'FACTORY'

            })
            .where({
                ID: transaction.ID
            });


        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
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
            gatePassDocumentNo
        } = req.data;


        const transaction =
            await getTransaction(
                gateInNumber,
                req
            );


        validateStage(
            transaction,
            'WEIGHBRIDGE_OUT',
            req
        );


        /*
         * Pickup requires RGP / NRGP
         */

        if (
            transaction.purpose ===
            'PICKUP'
        ) {

            if (!gatePassType) {

                return req.error(
                    400,
                    'RGP / NRGP is mandatory for pickup.'
                );
            }

            if (!gatePassDocumentNo) {

                return req.error(
                    400,
                    'Gate Pass Document Number is mandatory for pickup.'
                );
            }
        }


        await INSERT.into(
            SecurityGateExits
        ).entries({

            ID: cds.utils.uuid(),

            gateTransaction_ID:
                transaction.ID,

            securityPersonnel:
                securityPersonnel,

            gatePassType:
                gatePassType,

            gatePassDocumentNo:
                gatePassDocumentNo,

            gatePassVerified:
                transaction.purpose ===
                'PICKUP',

            deliveryDetailsVerified:
                transaction.purpose ===
                'DELIVERY',

            securityOutDateTime:
                new Date()
        });


        await UPDATE(GateTransactions)
            .set({

                status:
                    'SECURITY_OUT',

                currentStage:
                    'SECURITY_GATE_OUT'

            })
            .where({
                ID: transaction.ID
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


        validateStage(
            transaction,
            'SECURITY_OUT',
            req
        );


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
                'SECURITY_OUT',

            newStatus:
                'COMPLETED',

            oldStage:
                'SECURITY_GATE_OUT',

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

            return req.error(
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

            return req.error(
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

        if (
            transaction.status !==
            expectedStatus
        ) {

            return req.error(
                400,
                `Invalid process stage. Expected ${expectedStatus}, current status is ${transaction.status}.`
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