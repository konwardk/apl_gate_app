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
        PurchaseOrders,
        Users,
        UserRoles,
        S4VehicleGateOperations,
        S4SecurityGateEntries,
        S4WeighbridgeTransactions,
        S4FactoryGateEntries,
        S4DeliveryDetails,
        S4PickupDetails,
        S4VehicleEntries,
        S4SecurityEntries,
        S4CustomUsers
    } = this.entities;

    const ROLE_EXPANSIONS = {
        'maingate_user': ['maingate_user', 'MainGateUser'],
        'MainGateUser': ['maingate_user', 'MainGateUser'],
        'security_user': ['security_user', 'SecurityGateUser'],
        'SecurityGateUser': ['security_user', 'SecurityGateUser'],
        'weighbridge_user': ['weighbridge_user', 'WeighbridgeUser'],
        'WeighbridgeUser': ['weighbridge_user', 'WeighbridgeUser'],
        'factory_user': ['factory_user', 'FactoryGateUser'],
        'FactoryGateUser': ['factory_user', 'FactoryGateUser'],
        'audit_user': ['audit_user', 'Auditor', 'auditor_user'],
        'auditor_user': ['audit_user', 'Auditor', 'auditor_user'],
        'Auditor': ['audit_user', 'Auditor', 'auditor_user'],
        'superadmin_user': ['superadmin_user', 'Superadmin'],
        'Superadmin': ['superadmin_user', 'Superadmin'],
        'admin_user': ['admin_user', 'Admin'],
        'Admin': ['admin_user', 'Admin']
    };

    const ROLE_NAMES = {
        'Superadmin': 'Superadministrator',
        'superadmin_user': 'Superadministrator',
        'Admin': 'Operations Administrator',
        'admin_user': 'Operations Administrator',
        'MainGateUser': 'Main Gate Operator',
        'maingate_user': 'Main Gate Operator',
        'SecurityGateUser': 'Security Gate Officer',
        'security_user': 'Security Gate Officer',
        'WeighbridgeUser': 'Weighbridge Scale Operator',
        'weighbridge_user': 'Weighbridge Scale Operator',
        'FactoryGateUser': 'Factory Yard Supervisor',
        'factory_user': 'Factory Yard Supervisor',
        'Auditor': 'Internal Compliance Auditor',
        'audit_user': 'Internal Compliance Auditor',
        'auditor_user': 'Internal Compliance Auditor'
    };

    const ROLE_ICONS = {
        'MainGateUser': 'sap-icon://log-in',
        'maingate_user': 'sap-icon://log-in',
        'SecurityGateUser': 'sap-icon://shield',
        'security_user': 'sap-icon://shield',
        'WeighbridgeUser': 'sap-icon://dimension',
        'weighbridge_user': 'sap-icon://dimension',
        'FactoryGateUser': 'sap-icon://factory',
        'factory_user': 'sap-icon://factory',
        'Admin': 'sap-icon://home',
        'admin_user': 'sap-icon://home',
        'Superadmin': 'sap-icon://user-settings',
        'superadmin_user': 'sap-icon://user-settings',
        'Auditor': 'sap-icon://history',
        'audit_user': 'sap-icon://history',
        'auditor_user': 'sap-icon://history'
    };

    const ROLE_STATES = {
        'MainGateUser': 'Information',
        'maingate_user': 'Information',
        'SecurityGateUser': 'Warning',
        'security_user': 'Warning',
        'WeighbridgeUser': 'Indication04',
        'weighbridge_user': 'Indication04',
        'FactoryGateUser': 'Success',
        'factory_user': 'Success',
        'Admin': 'Information',
        'admin_user': 'Information',
        'Superadmin': 'Indication01',
        'superadmin_user': 'Indication01',
        'Auditor': 'None',
        'audit_user': 'None',
        'auditor_user': 'None'
    };

    const ROLE_TABS = {
        'MainGateUser': 'MAIN_GATE',
        'maingate_user': 'MAIN_GATE',
        'SecurityGateUser': 'SECURITY_GATE',
        'security_user': 'SECURITY_GATE',
        'WeighbridgeUser': 'WEIGHBRIDGE',
        'weighbridge_user': 'WEIGHBRIDGE',
        'FactoryGateUser': 'FACTORY_GATE',
        'factory_user': 'FACTORY_GATE',
        'Admin': 'OVERVIEW',
        'admin_user': 'OVERVIEW',
        'Superadmin': 'OVERVIEW',
        'superadmin_user': 'OVERVIEW',
        'Auditor': 'REPORTS_AUDIT',
        'audit_user': 'REPORTS_AUDIT',
        'auditor_user': 'REPORTS_AUDIT'
    };

    const getS4CustomUserService = async () => {
        return await cds.connect.to('YY1_API_CUSTOMUSER_0001');
    };

    function expandRoles(roleList) {
        const set = new Set();
        for (const r of roleList || []) {
            if (!r) continue;
            const trimmed = r.trim();
            if (ROLE_EXPANSIONS[trimmed]) {
                ROLE_EXPANSIONS[trimmed].forEach(x => set.add(x));
            } else {
                set.add(trimmed);
            }
        }
        if (set.has('Superadmin') || set.has('superadmin_user')) {
            set.add('Admin');
            set.add('admin_user');
            set.add('MainGateUser');
            set.add('maingate_user');
            set.add('SecurityGateUser');
            set.add('security_user');
            set.add('WeighbridgeUser');
            set.add('weighbridge_user');
            set.add('FactoryGateUser');
            set.add('factory_user');
            set.add('Auditor');
            set.add('audit_user');
        }
        return Array.from(set);
    }

    // Sync active users from local DB and S/4HANA Cloud CBO into in-memory auth cache for real-time authentication
    async function syncAuthUsersFromDb() {
        try {
            cds.env.requires ??= {};
            cds.env.requires.auth ??= { kind: 'mocked', users: {} };
            const authUsers = cds.env.requires.auth.users;
            delete authUsers['*'];

            const defaultSeedUsers = {
                'superadmin_user': { password: 'password', roles: ['Superadmin', 'superadmin_user', 'Admin', 'admin_user', 'MainGateUser', 'maingate_user', 'SecurityGateUser', 'security_user', 'WeighbridgeUser', 'weighbridge_user', 'FactoryGateUser', 'factory_user', 'Auditor', 'audit_user'] },
                'maingate_user': { password: 'password', roles: ['MainGateUser', 'maingate_user'] },
                'security_user': { password: 'password', roles: ['SecurityGateUser', 'security_user'] },
                'weighbridge_user': { password: 'password', roles: ['WeighbridgeUser', 'weighbridge_user'] },
                'factory_user': { password: 'password', roles: ['FactoryGateUser', 'factory_user'] },
                'admin_user': { password: 'password', roles: ['Admin', 'admin_user'] },
                'auditor_user': { password: 'password', roles: ['Auditor', 'audit_user'] }
            };

            for (const [uname, udata] of Object.entries(defaultSeedUsers)) {
                authUsers[uname] = new cds.User({ id: uname, ...udata });
            }

            // 1. Sync from local DB
            try {
                const dbUsers = await SELECT.from(Users).where({ status: 'ACTIVE' });
                for (const u of dbUsers) {
                    if (!u.username) continue;
                    const sUsername = u.username.toLowerCase();
                    let roles = [];
                    if (u.assignedRoles) {
                        roles = u.assignedRoles.split(',').map(r => r.trim()).filter(Boolean);
                    }
                    const dbRoles = await SELECT.from(UserRoles).where({ user_ID: u.ID });
                    for (const r of dbRoles) {
                        if (!roles.includes(r.roleCode)) roles.push(r.roleCode);
                    }
                    const expandedRoles = expandRoles(roles);
                    authUsers[sUsername] = new cds.User({
                        id: sUsername,
                        password: u.password || 'password',
                        roles: expandedRoles
                    });
                }
            } catch (_) {}

            // 2. Sync from SAP S/4HANA Cloud CBO (YY1_API_CUSTOMUSER_0001)
            try {
                const s4UserCbo = await getS4CustomUserService();
                const s4Users = await s4UserCbo.run(SELECT.from(s4UserCbo.entities.CustomUser));
                if (Array.isArray(s4Users)) {
                    for (const su of s4Users) {
                        if (!su.username) continue;
                        if (su.active === false || su.status === 'INACTIVE') continue;
                        const sUsername = su.username.toLowerCase();
                        const primaryRole = su.roleCode || (su.assignedRoles || '').split(',')[0]?.trim() || 'MainGateUser';
                        const rolesList = (su.assignedRoles || primaryRole).split(',').map(r => r.trim()).filter(Boolean);
                        const expandedRoles = expandRoles(rolesList);
                        authUsers[sUsername] = new cds.User({
                            id: sUsername,
                            password: su.password || 'password',
                            roles: expandedRoles
                        });
                    }
                }
            } catch (_) {}
        } catch (_) {}
    }
    syncAuthUsersFromDb().catch(() => {});

    // Dynamic auth resolver helper for S/4HANA Cloud custom users
    async function ensureAuthUser(username, password) {
        if (!username) return null;
        const sUser = username.toLowerCase();
        cds.env.requires ??= {};
        cds.env.requires.auth ??= { kind: 'mocked', users: {} };
        const authUsers = cds.env.requires.auth.users;

        if (authUsers[sUser]) {
            if (!password || authUsers[sUser].password === password) {
                return authUsers[sUser];
            }
        }

        // Try S/4HANA CBO CustomUser
        try {
            const s4UserCbo = await getS4CustomUserService();
            const s4User = await s4UserCbo.run(
                SELECT.one.from(s4UserCbo.entities.CustomUser).where({ username: username })
            ) || await s4UserCbo.run(
                SELECT.one.from(s4UserCbo.entities.CustomUser).where({ UserId: username })
            );

            if (s4User && s4User.active !== false && s4User.status !== 'INACTIVE') {
                if (!password || s4User.password === password) {
                    const primaryRole = s4User.roleCode || (s4User.assignedRoles || '').split(',')[0]?.trim() || 'MainGateUser';
                    const rolesList = (s4User.assignedRoles || primaryRole).split(',').map(r => r.trim()).filter(Boolean);
                    const expandedRoles = expandRoles(rolesList);
                    const userObj = new cds.User({
                        id: sUser,
                        password: s4User.password,
                        roles: expandedRoles
                    });
                    authUsers[sUser] = userObj;
                    return userObj;
                }
            }
        } catch (_) {}

        // Try local DB
        try {
            const dbUser = await SELECT.one.from(Users).where({ username: sUser });
            if (dbUser && dbUser.active !== false && dbUser.status !== 'INACTIVE') {
                if (!password || dbUser.password === password) {
                    const roles = (dbUser.assignedRoles || '').split(',').map(r => r.trim()).filter(Boolean);
                    const dbRoles = await SELECT.from(UserRoles).where({ user_ID: dbUser.ID });
                    for (const r of dbRoles) {
                        if (!roles.includes(r.roleCode)) roles.push(r.roleCode);
                    }
                    const expandedRoles = expandRoles(roles);
                    const userObj = new cds.User({
                        id: sUser,
                        password: dbUser.password,
                        roles: expandedRoles
                    });
                    authUsers[sUser] = userObj;
                    return userObj;
                }
            }
        } catch (_) {}

        return null;
    }
    this.ensureAuthUser = ensureAuthUser;


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
        
        // FIX: Wrap the original query incoming from the request, 
        // but explicitly bind it to the external entity definition.
        const delegatedQuery = SELECT.from(externalPO.entities.PurchaseOrder);
        
        // Safely apply query modifiers from the incoming request structure
        if (req.query.SELECT.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
        if (req.query.SELECT.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
        if (req.query.SELECT.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
        if (req.query.SELECT.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
        if (req.query.SELECT.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
        if (req.query.SELECT.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
        
        // Execute the bound query against the external system
        return await externalPO.run(delegatedQuery);
    } catch (err) {
        console.warn('[GateService] External S/4HANA PO service not reachable, serving fallback data:', err.message);
        
        const fallbackPOs = [
            {
                PurchaseOrder: "PO-SPARE-2026-08",
                PurchaseOrderType: "FO",
                Supplier: "SUP002",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "003",
                PurchaseOrderDate: "2026-09-11",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "4500001001",
                PurchaseOrderType: "NB",
                Supplier: "SUPP-01",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "001",
                PurchaseOrderDate: "2026-09-10",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "4500001002",
                PurchaseOrderType: "NB",
                Supplier: "SUPP-01",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "001",
                PurchaseOrderDate: "2026-09-08",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "4500001003",
                PurchaseOrderType: "NB",
                Supplier: "SUPP-01",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "002",
                PurchaseOrderDate: "2026-09-05",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "PO-METH-2026-01",
                PurchaseOrderType: "NB",
                Supplier: "SUP001",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "001",
                PurchaseOrderDate: "2026-09-04",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "PO-GAS-2026-12",
                PurchaseOrderType: "FO",
                Supplier: "SUP003",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "002",
                PurchaseOrderDate: "2026-09-02",
                DocumentCurrency: "INR"
            },
            {
                PurchaseOrder: "PO-CHEM-2026-99",
                PurchaseOrderType: "NB",
                Supplier: "SUP004",
                CompanyCode: "1000",
                PurchasingOrganization: "1010",
                PurchasingGroup: "001",
                PurchaseOrderDate: "2026-08-28",
                DocumentCurrency: "INR"
            }
        ];

        let result = [...fallbackPOs];

        // 1. Filter by key if single entity requested by key
        if (req.data?.PurchaseOrder) {
            result = result.filter(item => String(item.PurchaseOrder).toLowerCase() === String(req.data.PurchaseOrder).toLowerCase());
        }

        // 2. Apply WHERE filtering if provided in CQN
        if (req.query?.SELECT?.where) {
            const where = req.query.SELECT.where;
            function matchesWhere(item, whereClause) {
                if (!whereClause || whereClause.length === 0) return true;
                if (!Array.isArray(whereClause) && typeof whereClause === 'object') {
                    return Object.entries(whereClause).every(([k, v]) => String(item[k]).toLowerCase() === String(v).toLowerCase());
                }
                let currentResult = true;
                let pendingLogicalOp = null;

                for (let i = 0; i < whereClause.length; i++) {
                    const token = whereClause[i];
                    if (typeof token === 'string' && (token.toLowerCase() === 'or' || token.toLowerCase() === 'and')) {
                        pendingLogicalOp = token.toLowerCase();
                        continue;
                    }

                    let termResult = true;
                    if (token && typeof token === 'object' && token.func === 'contains') {
                        const colRef = token.args?.[0]?.ref?.[0];
                        const searchVal = token.args?.[1]?.val;
                        if (colRef && searchVal !== undefined) {
                            termResult = String(item[colRef] || '').toLowerCase().includes(String(searchVal).toLowerCase());
                        }
                    } else if (token && typeof token === 'object' && token.ref) {
                        const col = token.ref[0];
                        const op = whereClause[i + 1];
                        const val = whereClause[i + 2]?.val ?? whereClause[i + 2];
                        i += 2;
                        if (op === '=' || op === '==') {
                            termResult = String(item[col] || '').toLowerCase() === String(val).toLowerCase();
                        } else if (op === '!=' || op === '<>') {
                            termResult = String(item[col] || '').toLowerCase() !== String(val).toLowerCase();
                        } else if (op === 'like') {
                            const pattern = String(val).replace(/%/g, '.*');
                            termResult = new RegExp('^' + pattern + '$', 'i').test(String(item[col] || ''));
                        }
                    }

                    if (pendingLogicalOp === 'or') {
                        currentResult = currentResult || termResult;
                    } else if (pendingLogicalOp === 'and') {
                        currentResult = currentResult && termResult;
                    } else {
                        currentResult = termResult;
                    }
                    pendingLogicalOp = null;
                }
                return currentResult;
            }

            result = result.filter(item => matchesWhere(item, where));
        }

        // 3. Apply ORDER BY sorting (Fixed string comparisons)
        if (req.query?.SELECT?.orderBy && req.query.SELECT.orderBy.length > 0) {
            const orderItem = req.query.SELECT.orderBy[0];
            const sortCol = orderItem?.ref?.[0];
            const isDesc = orderItem?.sort === 'desc' || orderItem?.asc === false; // checks both variants
            if (sortCol) {
                result.sort((a, b) => {
                    const valA = String(a[sortCol] || '');
                    const valB = String(b[sortCol] || '');
                    return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                });
            }
        }

        // 4. Apply LIMIT / TOP if provided
        const limitVal = req.query?.SELECT?.limit?.rows?.val ?? req.query?.SELECT?.limit?.rows;
        if (limitVal !== undefined && limitVal !== null) {
            result = result.slice(0, Number(limitVal));
        }

        if (req.query?.SELECT?.count) {
            result.$count = result.length;
        }

        // 5. Return single entity if SELECT.one was requested
        if (req.query?.SELECT?.one) {
            return result[0] || null;
        }

        return result;
    }
});

    /*
     * ============================================================
     * SAP S/4HANA CLOUD CBO: VEHICLE GATE OPERATION
     * (YY1_API_VEHICLEGATEOPERATION_0001)
     * ============================================================
     */

    const getS4VehicleGateOperationService = async () => {
        return await cds.connect.to('YY1_API_VEHICLEGATEOPERATION_0001');
    };
    const getS4VehicleEntryService = getS4VehicleGateOperationService;

    // ------------------------------------------------------------
    // S/4HANA CLOUD CBO SYNC HELPERS (Resilient, Non-blocking)
    // ------------------------------------------------------------

    function mapVisitPurpose(purpose) {
        if (!purpose) return 'DL';
        const p = purpose.toUpperCase().trim();
        if (p === 'DELIVERY' || p === 'DL') return 'DL';
        if (p === 'PICKUP' || p === 'PK') return 'PK';
        return p.substring(0, 2);
    }

    async function pushVehicleGateOperationToS4Hana(tx) {
        if (!tx || !tx.gateInNumber) return;
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = (tx.gateInNumber || '').substring(0, 20);
            const payload = {
                MainGateEntryId: mainGateEntryId,
                VehicleType: (tx.vehicleType || 'TRUCK').substring(0, 10),
                VehicleRegNumber: (tx.vehicleRegNo || '').substring(0, 20),
                DriverName: (tx.driverName || 'Driver').substring(0, 100),
                VisitPurpose: mapVisitPurpose(tx.purpose),
                VehicleStatus: (tx.status || 'GATE_IN').substring(0, 15),
                GateInOperator: (tx.gateInOperator || 'SYSTEM').substring(0, 20),
                GateInTime: tx.gateInDateTime ? new Date(tx.gateInDateTime).toISOString() : new Date().toISOString(),
                MainGateRemarks: (tx.remarks || `APL Gate Entry - ${tx.gateInNumber}`).substring(0, 250),
                assignedRoute: (tx.assignedRoute || 'UNASSIGNED').substring(0, 100),
                CurrentStage: (tx.currentStage || 'MAIN_GATE_IN').substring(0, 20),
                SAPDescription: `APL Gate Entry - ${tx.gateInNumber}`.substring(0, 80)
            };
            try {
                await s4Cbo.post('/VehicleGateOperation', payload);
                console.log(`[GateService] S/4HANA Auto-Sync: Created VehicleGateOperation ${mainGateEntryId}`);
            } catch (postErr) {
                if (postErr.message && (postErr.message.includes('already in use') || postErr.message.includes('400') || postErr.message.includes('409'))) {
                    await s4Cbo.patch(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')`, payload);
                    console.log(`[GateService] S/4HANA Auto-Sync: Updated existing VehicleGateOperation ${mainGateEntryId}`);
                } else {
                    throw postErr;
                }
            }
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for VehicleGateOperation ${tx.gateInNumber}:`, err.message);
        }
    }
    const pushVehicleEntryToS4Hana = pushVehicleGateOperationToS4Hana;

    async function updateVehicleGateOperationInS4Hana(identifier, patchFields) {
        if (!identifier || !patchFields) return;
        try {
            let gateInNumber = identifier;
            if (typeof identifier === 'object' && identifier.gateInNumber) {
                gateInNumber = identifier.gateInNumber;
            } else if (typeof identifier === 'string' && identifier.includes('-') && identifier.length > 20) {
                const tx = await SELECT.one.from(GateTransactions).where({ ID: identifier });
                if (tx && tx.gateInNumber) gateInNumber = tx.gateInNumber;
            }
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = (gateInNumber || '').substring(0, 20);
            const sanitized = {};
            if (patchFields.VehicleStatus || patchFields.Status) {
                sanitized.VehicleStatus = (patchFields.VehicleStatus || patchFields.Status).substring(0, 15);
            }
            if (patchFields.CurrentStage) sanitized.CurrentStage = patchFields.CurrentStage.substring(0, 20);
            if (patchFields.assignedRoute || patchFields.AssignedRoute) {
                sanitized.assignedRoute = (patchFields.assignedRoute || patchFields.AssignedRoute).substring(0, 100);
            }
            if (patchFields.MainGateRemarks) sanitized.MainGateRemarks = patchFields.MainGateRemarks.substring(0, 250);
            if (patchFields.GateOutTime || patchFields.GateOutDateTime) {
                sanitized.GateOutTime = new Date(patchFields.GateOutTime || patchFields.GateOutDateTime).toISOString();
            }
            if (patchFields.GateOutOperator && !isNaN(Date.parse(patchFields.GateOutOperator))) {
                sanitized.GateOutOperator = new Date(patchFields.GateOutOperator).toISOString();
            }
            if (Object.keys(sanitized).length > 0) {
                await s4Cbo.patch(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')`, sanitized);
                console.log(`[GateService] S/4HANA Auto-Sync: Updated VehicleGateOperation ${mainGateEntryId}`);
            }
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync update warning for VehicleGateOperation ${identifier}:`, err.message);
        }
    }
    const updateVehicleEntryInS4Hana = updateVehicleGateOperationInS4Hana;

    async function pushSecurityGateEntryToS4Hana(txOrId, sec) {
        if (!sec) return;
        try {
            let gateInNumber = '';
            if (typeof txOrId === 'object' && txOrId.gateInNumber) {
                gateInNumber = txOrId.gateInNumber;
            } else if (sec.gateInNumber) {
                gateInNumber = sec.gateInNumber;
            } else if (typeof txOrId === 'string') {
                if (txOrId.startsWith('GI-')) {
                    gateInNumber = txOrId;
                } else {
                    const tx = await SELECT.one.from(GateTransactions).where({ ID: txOrId });
                    if (tx) gateInNumber = tx.gateInNumber;
                }
            }
            if (!gateInNumber) return;

            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);
            const secId = (sec.ID ? sec.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
            const secPayload = {
                SecuritygateId: secId,
                gateInNumber: gateInNumber.substring(0, 20),
                driverLicenseNo: (sec.driverLicenseNo || 'N/A').substring(0, 50),
                driverPhoneNo: (sec.driverPhoneNo || 'N/A').substring(0, 20),
                helperName: (sec.helperName || 'N/A').substring(0, 50),
                vehicleReportingDateTime: sec.vehicleReportingDateTime ? new Date(sec.vehicleReportingDateTime).toISOString() : new Date().toISOString(),
                securityInDateTime: sec.securityInDateTime ? new Date(sec.securityInDateTime).toISOString() : new Date().toISOString(),
                securityPersonnel: (sec.securityPersonnel || sec.securityOfficer || 'Security').substring(0, 150),
                driverVerified: sec.driverVerified !== false,
                vehicleVerified: sec.vehicleVerified !== false,
                documentsVerified: sec.documentsVerified !== false,
                poNumber: (sec.poNumber || sec.PurchaseOrderNumber || '').substring(0, 50),
                soNumber: (sec.soNumber || '').substring(0, 50),
                invoiceNumber: (sec.invoiceNumber || '').substring(0, 50),
                invoiceDate: sec.invoiceDate ? sec.invoiceDate : null,
                withoutPO: (sec.withoutPO ? 'YES' : 'NO'),
                rgpDocumentNo: (sec.rgpDocumentNo || '').substring(0, 50),
                nrgpDocumentNo: (sec.nrgpDocumentNo || '').substring(0, 50),
                gatePassType: (sec.gatePassType || '').substring(0, 5),
                SecurityAssignedRoute: (sec.assignedRoute || sec.SecurityAssignedRoute || 'UNASSIGNED').substring(0, 20),
                securityInRemarks: (sec.remarks || sec.securityInRemarks || 'Security In clearance').substring(0, 250),
                securityOutPersonnel: (sec.securityOutPersonnel || '').substring(0, 150),
                securityOutDateTime: sec.securityOutDateTime ? new Date(sec.securityOutDateTime).toISOString() : null,
                exitDriverVerified: Boolean(sec.exitDriverVerified),
                exitVehicleVerified: Boolean(sec.exitVehicleVerified),
                exitDocumentsVerified: Boolean(sec.exitDocumentsVerified),
                gatePassVerified: Boolean(sec.gatePassVerified),
                deliveryDetailsVerified: Boolean(sec.deliveryDetailsVerified),
                emptyInspectionVerified: Boolean(sec.emptyInspectionVerified),
                materialInspected: Boolean(sec.materialInspected),
                exitGatePassType: (sec.exitGatePassType || '').substring(0, 5),
                exitGatePassDocumentNo: (sec.exitGatePassDocumentNo || '').substring(0, 50),
                securityOutRemarks: (sec.securityOutRemarks || '').substring(0, 250)
            };
            await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_SecurityGateEntries`, secPayload);
            console.log(`[GateService] S/4HANA Auto-Sync: Created SecurityGateEntry for ${mainGateEntryId}`);
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for SecurityGateEntry:`, err.message);
        }
    }
    const pushSecurityEntryToS4Hana = pushSecurityGateEntryToS4Hana;

    async function updateSecurityGateEntryInS4Hana(gateInNumber, secId, patchFields) {
        if (!gateInNumber) return;
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);
            const sSecId = (secId ? secId.replace(/-/g, '') : '').substring(0, 20);
            const key = sSecId
                ? `(MainGateEntryId='${mainGateEntryId}',SecuritygateId='${sSecId}')`
                : `(MainGateEntryId='${mainGateEntryId}')`;
            try {
                await s4Cbo.patch(`/SecurityGateEntries${key}`, patchFields);
                console.log(`[GateService] S/4HANA Auto-Sync: Updated SecurityGateEntries for ${mainGateEntryId}`);
            } catch (patchErr) {
                const existing = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.SecurityGateEntries).where({ MainGateEntryId: mainGateEntryId }));
                if (existing && existing.SecuritygateId) {
                    await s4Cbo.patch(`/SecurityGateEntries(MainGateEntryId='${mainGateEntryId}',SecuritygateId='${existing.SecuritygateId}')`, patchFields);
                    console.log(`[GateService] S/4HANA Auto-Sync: Updated SecurityGateEntries with resolved ID ${existing.SecuritygateId}`);
                } else {
                    throw patchErr;
                }
            }
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for SecurityGateEntries update ${gateInNumber}:`, err.message);
        }
    }

    async function pushWeighbridgeTransactionToS4Hana(tx, wb) {
        const gateInNumber = tx?.gateInNumber || wb?.gateInNumber;
        if (!gateInNumber || !wb) return;
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);
            const wbId = (wb.ID ? wb.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
            const wbPayload = {
                WeighbridgeId: wbId,
                weighbridgeNumber: (wb.weighbridgeNumber || 'WB-01').substring(0, 20),
                weighmentType: (wb.weighmentType || 'GROSS_IN').substring(0, 10),
                weight: Number(wb.weight) || 0,
                weightUnit: (wb.weightUnit || 'KG').substring(0, 3),
                weighbridgeDateTime: wb.weighbridgeDateTime ? new Date(wb.weighbridgeDateTime).toISOString() : new Date().toISOString(),
                WeightOperator: (wb.operator || wb.WeightOperator || 'SYSTEM').substring(0, 150),
                weighRemark: (wb.remarks || wb.weighRemark || 'Weighment recorded').substring(0, 250)
            };
            await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_WeighbridgeTransactions`, wbPayload);
            console.log(`[GateService] S/4HANA Auto-Sync: Created WeighbridgeTransaction for ${mainGateEntryId}`);
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for WeighbridgeTransaction ${gateInNumber}:`, err.message);
        }
    }

    async function pushFactoryGateEntryToS4Hana(tx, fac) {
        const gateInNumber = tx?.gateInNumber || fac?.gateInNumber;
        if (!gateInNumber || !fac) return;
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);
            const facId = (fac.ID ? fac.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
            const facPayload = {
                FactoryEntryId: facId,
                GateInNoF: gateInNumber.substring(0, 20),
                factoryGateInDateTime: fac.factoryGateInDateTime ? new Date(fac.factoryGateInDateTime).toISOString() : new Date().toISOString(),
                factoryGateInOperator: (fac.factoryGateInOperator || 'SYSTEM').substring(0, 150),
                factoryGateInRemarks: (fac.factoryGateInRemarks || fac.remarks || 'Factory gate check-in').substring(0, 250),
                factoryGateOutDateTime: fac.factoryGateOutDateTime ? new Date(fac.factoryGateOutDateTime).toISOString() : null,
                factoryGateOutOperator: (fac.factoryGateOutOperator || '').substring(0, 150),
                factoryGateOutRemarks: (fac.factoryGateOutRemarks || '').substring(0, 250),
                FactoryGateOutType: (fac.gateOutType || fac.FactoryGateOutType || 'STD').substring(0, 5),
                FactoryPONumber: (fac.poNumber || fac.FactoryPONumber || '').substring(0, 20),
                FactoryInvoiceNumber: (fac.invoiceNumber || fac.FactoryInvoiceNumber || '').substring(0, 20),
                FactoryInvoiceDate: fac.invoiceDate ? String(fac.invoiceDate).substring(0, 20) : '',
                supplierNameInFactory: (fac.supplierName || fac.supplierNameInFactory || '').substring(0, 250),
                transporterName: (fac.transporterName || '').substring(0, 250),
                deliveryNoteNo: (fac.deliveryNoteNo || '').substring(0, 50),
                factoryArea: (fac.factoryArea || 'Raw Material Yard').substring(0, 150),
                unloadingPoint: (fac.unloadingPoint || '').substring(0, 100),
                materialDescription: (fac.materialDescription || '').substring(0, 250),
                unloadingStatus: (fac.unloadingStatus || 'IN_PROGRESS').substring(0, 20),
                unloadedQuantity: (fac.unloadedQuantity !== undefined && fac.unloadedQuantity !== null ? String(fac.unloadedQuantity) : '').substring(0, 20),
                quantityUnit: (fac.quantityUnit || 'KG').substring(0, 20),
                goodsInspected: fac.goodsInspected !== false,
                sealVerified: fac.sealVerified !== false,
                FactoryOutRemarks: (fac.FactoryOutRemarks || fac.remarks || '').substring(0, 250)
            };
            await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_FactoryGateEntries`, facPayload);
            console.log(`[GateService] S/4HANA Auto-Sync: Created FactoryGateEntry for ${mainGateEntryId}`);
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for FactoryGateEntry ${gateInNumber}:`, err.message);
        }
    }

    async function updateFactoryGateEntryInS4Hana(gateInNumber, facId, patchFields) {
        if (!gateInNumber) return;
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);
            const sFacId = (facId ? facId.replace(/-/g, '') : '').substring(0, 20);
            const key = sFacId
                ? `(MainGateEntryId='${mainGateEntryId}',FactoryEntryId='${sFacId}')`
                : `(MainGateEntryId='${mainGateEntryId}')`;
            try {
                await s4Cbo.patch(`/FactoryGateEntries${key}`, patchFields);
                console.log(`[GateService] S/4HANA Auto-Sync: Updated FactoryGateEntries for ${mainGateEntryId}`);
            } catch (patchErr) {
                const existing = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.FactoryGateEntries).where({ MainGateEntryId: mainGateEntryId }));
                if (existing && existing.FactoryEntryId) {
                    await s4Cbo.patch(`/FactoryGateEntries(MainGateEntryId='${mainGateEntryId}',FactoryEntryId='${existing.FactoryEntryId}')`, patchFields);
                    console.log(`[GateService] S/4HANA Auto-Sync: Updated FactoryGateEntries with resolved ID ${existing.FactoryEntryId}`);
                } else {
                    throw patchErr;
                }
            }
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for FactoryGateEntries update ${gateInNumber}:`, err.message);
        }
    }

    // 1. READ S4VehicleGateOperations from S/4HANA Cloud CBO
    this.on('READ', 'S4VehicleGateOperations', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.VehicleGateOperation);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await s4Cbo.run(delegatedQuery);
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO VehicleGateOperation service not reachable, serving fallback data:', err.message);
            const txs = await SELECT.from('factory.gate.GateTransactions');
            return txs.map(tx => ({
                MainGateEntryId: (tx.gateInNumber || tx.ID).substring(0, 20),
                VehicleType: (tx.vehicleType || 'TRUCK').substring(0, 10),
                VehicleRegNumber: (tx.vehicleRegNo || '').substring(0, 20),
                DriverName: (tx.driverName || 'Driver').substring(0, 100),
                VisitPurpose: mapVisitPurpose(tx.purpose),
                VehicleStatus: (tx.status || 'GATE_IN').substring(0, 15),
                GateInOperator: (tx.gateInOperator || 'SYSTEM').substring(0, 20),
                GateInTime: tx.gateInDateTime,
                GateOutOperator: null,
                GateOutTime: tx.gateOutDateTime,
                MainGateRemarks: (tx.remarks || `APL Gate Entry - ${tx.gateInNumber}`).substring(0, 250),
                assignedRoute: (tx.assignedRoute || 'UNASSIGNED').substring(0, 100),
                CurrentStage: (tx.currentStage || 'MAIN_GATE_IN').substring(0, 20),
                SAPDescription: `APL Gate Entry - ${tx.gateInNumber}`.substring(0, 80)
            }));
        }
    });

    // 2. CREATE S4VehicleGateOperations in S/4HANA Cloud CBO
    this.on('CREATE', 'S4VehicleGateOperations', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const entryData = Object.assign({}, req.data);
            if (!entryData.MainGateEntryId) {
                entryData.MainGateEntryId = `GI-${Date.now().toString().slice(-14)}`;
            }
            if (!entryData.VisitPurpose) {
                entryData.VisitPurpose = 'DL';
            }
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.VehicleGateOperation).entries(entryData));
        } catch (err) {
            console.error('[GateService] Failed to create VehicleGateOperation in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create VehicleGateOperation in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 3. READ S4SecurityGateEntries from S/4HANA Cloud CBO
    this.on('READ', 'S4SecurityGateEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.SecurityGateEntries);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await s4Cbo.run(delegatedQuery);
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO SecurityGateEntries service not reachable, serving fallback data:', err.message);
            const secEntries = await SELECT.from('factory.gate.SecurityGateEntries');
            return secEntries.map(s => ({
                MainGateEntryId: (s.gateInNumber || s.gateTransaction_ID || s.ID).substring(0, 20),
                SecuritygateId: (s.ID ? s.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                gateInNumber: (s.gateInNumber || '').substring(0, 20),
                driverLicenseNo: s.driverLicenseNo || '',
                driverPhoneNo: s.driverPhoneNo || '',
                helperName: s.helperName || '',
                vehicleReportingDateTime: s.vehicleReportingDateTime,
                securityInDateTime: s.securityInDateTime,
                securityPersonnel: s.securityPersonnel || s.securityOfficer || 'Security',
                driverVerified: s.driverVerified ?? true,
                vehicleVerified: s.vehicleVerified ?? true,
                documentsVerified: s.documentsVerified ?? true,
                poNumber: s.poNumber || '',
                soNumber: s.soNumber || '',
                invoiceNumber: s.invoiceNumber || '',
                invoiceDate: s.invoiceDate || null,
                withoutPO: s.withoutPO ? 'YES' : 'NO',
                rgpDocumentNo: s.rgpDocumentNo || '',
                nrgpDocumentNo: s.nrgpDocumentNo || '',
                gatePassType: s.gatePassType || '',
                SecurityAssignedRoute: s.assignedRoute || s.SecurityAssignedRoute || '',
                securityInRemarks: (s.remarks || s.securityInRemarks || '').substring(0, 250),
                securityOutPersonnel: s.securityOutPersonnel || '',
                securityOutDateTime: s.securityOutDateTime,
                exitDriverVerified: Boolean(s.exitDriverVerified),
                exitVehicleVerified: Boolean(s.exitVehicleVerified),
                exitDocumentsVerified: Boolean(s.exitDocumentsVerified),
                gatePassVerified: Boolean(s.gatePassVerified),
                deliveryDetailsVerified: Boolean(s.deliveryDetailsVerified),
                emptyInspectionVerified: Boolean(s.emptyInspectionVerified),
                materialInspected: Boolean(s.materialInspected),
                exitGatePassType: s.exitGatePassType || '',
                exitGatePassDocumentNo: s.exitGatePassDocumentNo || '',
                securityOutRemarks: (s.securityOutRemarks || '').substring(0, 250)
            }));
        }
    });

    // 4. CREATE S4SecurityGateEntries in S/4HANA Cloud CBO
    this.on('CREATE', 'S4SecurityGateEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const entryData = Object.assign({}, req.data);
            if (!entryData.SecuritygateId) {
                entryData.SecuritygateId = cds.utils.uuid().replace(/-/g, '').substring(0, 20);
            }
            if (entryData.MainGateEntryId) {
                return await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${entryData.MainGateEntryId}')/_SecurityGateEntries`, entryData);
            }
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.SecurityGateEntries).entries(entryData));
        } catch (err) {
            console.error('[GateService] Failed to create SecurityGateEntries in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create SecurityGateEntries in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 5. READ S4WeighbridgeTransactions from S/4HANA Cloud CBO
    this.on('READ', 'S4WeighbridgeTransactions', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.WeighbridgeTransactions);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await s4Cbo.run(delegatedQuery);
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO WeighbridgeTransactions service not reachable, serving fallback data:', err.message);
            const records = await SELECT.from('factory.gate.WeighbridgeTransactions');
            return records.map(w => ({
                MainGateEntryId: (w.gateInNumber || w.gateTransaction_ID || w.ID).substring(0, 20),
                WeighbridgeId: (w.ID ? w.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                weighbridgeNumber: w.weighbridgeNumber || 'WB-01',
                weighmentType: w.weighmentType || 'GROSS_IN',
                weight: Number(w.weight) || 0,
                weightUnit: w.weightUnit || 'KG',
                weighbridgeDateTime: w.weighbridgeDateTime,
                WeightOperator: w.operator || 'SYSTEM',
                weighRemark: (w.remarks || '').substring(0, 250)
            }));
        }
    });

    // 6. CREATE S4WeighbridgeTransactions in S/4HANA Cloud CBO
    this.on('CREATE', 'S4WeighbridgeTransactions', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const entryData = Object.assign({}, req.data);
            if (!entryData.WeighbridgeId) {
                entryData.WeighbridgeId = cds.utils.uuid().replace(/-/g, '').substring(0, 20);
            }
            if (entryData.MainGateEntryId) {
                return await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${entryData.MainGateEntryId}')/_WeighbridgeTransactions`, entryData);
            }
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.WeighbridgeTransactions).entries(entryData));
        } catch (err) {
            console.error('[GateService] Failed to create WeighbridgeTransactions in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create WeighbridgeTransactions in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 7. READ S4FactoryGateEntries from S/4HANA Cloud CBO
    this.on('READ', 'S4FactoryGateEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.FactoryGateEntries);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await s4Cbo.run(delegatedQuery);
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO FactoryGateEntries service not reachable, serving fallback data:', err.message);
            const facEntries = await SELECT.from('factory.gate.FactoryGateEntries');
            return facEntries.map(f => ({
                MainGateEntryId: (f.gateInNumber || f.gateTransaction_ID || f.ID).substring(0, 20),
                FactoryEntryId: (f.ID ? f.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                GateInNoF: (f.gateInNumber || '').substring(0, 20),
                factoryGateInDateTime: f.factoryGateInDateTime,
                factoryGateInOperator: f.factoryGateInOperator || '',
                factoryGateInRemarks: f.factoryGateInRemarks || '',
                factoryGateOutDateTime: f.factoryGateOutDateTime,
                factoryGateOutOperator: f.factoryGateOutOperator || '',
                factoryGateOutRemarks: f.factoryGateOutRemarks || '',
                FactoryGateOutType: (f.gateOutType || 'STD').substring(0, 5),
                FactoryPONumber: (f.poNumber || '').substring(0, 20),
                FactoryInvoiceNumber: (f.invoiceNumber || '').substring(0, 20),
                FactoryInvoiceDate: f.invoiceDate ? String(f.invoiceDate).substring(0, 20) : '',
                supplierNameInFactory: f.supplierName || '',
                transporterName: f.transporterName || '',
                deliveryNoteNo: f.deliveryNoteNo || '',
                factoryArea: f.factoryArea || '',
                unloadingPoint: f.unloadingPoint || '',
                materialDescription: f.materialDescription || '',
                unloadingStatus: f.unloadingStatus || '',
                unloadedQuantity: f.unloadedQuantity !== undefined && f.unloadedQuantity !== null ? String(f.unloadedQuantity) : '',
                quantityUnit: f.quantityUnit || 'KG',
                goodsInspected: f.goodsInspected ?? true,
                sealVerified: f.sealVerified ?? true,
                FactoryOutRemarks: f.remarks || ''
            }));
        }
    });

    // 8. CREATE S4FactoryGateEntries in S/4HANA Cloud CBO
    this.on('CREATE', 'S4FactoryGateEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const entryData = Object.assign({}, req.data);
            if (!entryData.FactoryEntryId) {
                entryData.FactoryEntryId = cds.utils.uuid().replace(/-/g, '').substring(0, 20);
            }
            if (entryData.MainGateEntryId) {
                return await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${entryData.MainGateEntryId}')/_FactoryGateEntries`, entryData);
            }
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.FactoryGateEntries).entries(entryData));
        } catch (err) {
            console.error('[GateService] Failed to create FactoryGateEntries in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create FactoryGateEntries in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 9. READ S4DeliveryDetails
    this.on('READ', 'S4DeliveryDetails', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            return await s4Cbo.run(SELECT.from(s4Cbo.entities.DeliveryDetails));
        } catch (err) {
            const deliveries = await SELECT.from('factory.gate.DeliveryDetails');
            return deliveries.map(d => ({
                MainGateEntryId: (d.gateInNumber || d.gateTransaction_ID || d.ID).substring(0, 20),
                DeliveryId: (d.ID ? d.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                gateTransaction: (d.gateInNumber || '').substring(0, 20),
                PurchaseOrderNo: (d.poNumber || '').substring(0, 20),
                SalesOrderNo: (d.soNumber || '').substring(0, 20),
                InvoiceNo: (d.invoiceNumber || '').substring(0, 20),
                DeliveryNo: (d.deliveryNoteNo || '').substring(0, 20)
            }));
        }
    });

    // 10. READ S4PickupDetails
    this.on('READ', 'S4PickupDetails', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            return await s4Cbo.run(SELECT.from(s4Cbo.entities.PickupDetail));
        } catch (err) {
            const pickups = await SELECT.from('factory.gate.PickupDetails');
            return pickups.map(p => ({
                MainGateEntryId: (p.gateInNumber || p.gateTransaction_ID || p.ID).substring(0, 20),
                PickupId: (p.ID ? p.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                pickupGatePassType: (p.gatePassType || 'RGP').substring(0, 5),
                PickupGatePassDocumentNo: (p.gatePassDocumentNo || '').substring(0, 50),
                PickupGatePassDocumentDate: p.gatePassDocumentDate || null,
                PickupPurpose: (p.purpose || 'Material pickup').substring(0, 250),
                authorizedBy: (p.authorizedBy || '').substring(0, 150)
            }));
        }
    });

    // Backward compatibility aliases
    this.on('READ', 'S4VehicleEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.VehicleGateOperation);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            const res = await s4Cbo.run(delegatedQuery);
            const arr = Array.isArray(res) ? res : (res ? [res] : []);
            const mapped = arr.map(v => ({
                EntryID: v.MainGateEntryId,
                GateInNumber: v.MainGateEntryId,
                VehicleRegNo: v.VehicleRegNumber,
                VehicleType: v.VehicleType,
                DriverName: v.DriverName,
                Purpose: v.VisitPurpose === 'DL' ? 'DELIVERY' : (v.VisitPurpose === 'PK' ? 'PICKUP' : v.VisitPurpose),
                Status: v.VehicleStatus,
                GateInDateTime: v.GateInTime,
                GateInOperator: v.GateInOperator,
                AssignedRoute: v.assignedRoute,
                GateOutDateTime: v.GateOutTime,
                GateOutOperator: '',
                CurrentStage: v.CurrentStage,
                SAPDescription: v.SAPDescription
            }));
            return req.query?.SELECT?.one ? (mapped[0] || null) : mapped;
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO VehicleGateOperation service not reachable, serving fallback data:', err.message);
            const txs = await SELECT.from('factory.gate.GateTransactions');
            return txs.map(tx => ({
                EntryID: tx.ID,
                GateInNumber: tx.gateInNumber,
                VehicleRegNo: tx.vehicleRegNo,
                VehicleType: tx.vehicleType,
                DriverName: tx.driverName,
                Purpose: tx.purpose,
                Status: tx.status,
                GateInDateTime: tx.gateInDateTime,
                GateInOperator: tx.gateInOperator,
                AssignedRoute: tx.assignedRoute,
                GateOutDateTime: tx.gateOutDateTime,
                GateOutOperator: tx.gateOutOperator,
                CurrentStage: tx.currentStage,
                SAPDescription: `Vehicle Entry ${tx.gateInNumber}`
            }));
        }
    });

    this.on('CREATE', 'S4VehicleEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const d = req.data;
            const payload = {
                MainGateEntryId: (d.GateInNumber || d.EntryID || `GI-${Date.now().toString().slice(-14)}`).substring(0, 20),
                VehicleType: (d.VehicleType || 'TRUCK').substring(0, 10),
                VehicleRegNumber: (d.VehicleRegNo || d.VehicleRegNumber || '').substring(0, 20),
                DriverName: (d.DriverName || 'Driver').substring(0, 100),
                VisitPurpose: mapVisitPurpose(d.Purpose || d.VisitPurpose),
                VehicleStatus: (d.Status || d.VehicleStatus || 'GATE_IN').substring(0, 15),
                GateInOperator: (d.GateInOperator || 'SYSTEM').substring(0, 20),
                GateInTime: d.GateInDateTime ? new Date(d.GateInDateTime).toISOString() : new Date().toISOString(),
                MainGateRemarks: (d.SAPDescription || 'APL Vehicle Entry').substring(0, 250),
                assignedRoute: (d.AssignedRoute || d.assignedRoute || 'UNASSIGNED').substring(0, 100),
                CurrentStage: (d.CurrentStage || 'MAIN_GATE_IN').substring(0, 20),
                SAPDescription: (d.SAPDescription || `APL Vehicle Entry`).substring(0, 80)
            };
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.VehicleGateOperation).entries(payload));
        } catch (err) {
            console.error('[GateService] Failed to create VehicleEntry in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create VehicleEntry in S/4HANA Cloud: ${err.message}`);
        }
    });

    this.on('READ', 'S4SecurityEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const delegatedQuery = SELECT.from(s4Cbo.entities.SecurityGateEntries);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            const res = await s4Cbo.run(delegatedQuery);
            const arr = Array.isArray(res) ? res : (res ? [res] : []);
            const mapped = arr.map(s => ({
                EntryID: s.MainGateEntryId,
                SecurityID: s.SecuritygateId,
                DriverLicenseNo: s.driverLicenseNo || '',
                DriverPhoneNo: s.driverPhoneNo || '',
                DriverVerified: s.driverVerified ?? true,
                VehicleVerified: s.vehicleVerified ?? true,
                DocumentVerified: s.documentsVerified ?? true,
                SecurityInDateTime: s.securityInDateTime,
                SecurityOutDateTime: s.securityOutDateTime,
                SecurityPersonnel: s.securityPersonnel || '',
                Remarks: (s.securityInRemarks || '').substring(0, 20),
                PurchaseOrderNumber: s.poNumber || '',
                HelperName: s.helperName || ''
            }));
            return req.query?.SELECT?.one ? (mapped[0] || null) : mapped;
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO SecurityGateEntries service not reachable, serving fallback data:', err.message);
            const secEntries = await SELECT.from('factory.gate.SecurityGateEntries');
            return secEntries.map(s => ({
                EntryID: s.gateTransaction_ID || s.ID,
                SecurityID: s.ID,
                DriverLicenseNo: s.driverLicenseNo || '',
                DriverPhoneNo: s.driverPhoneNo || '',
                DriverVerified: s.driverVerified ?? true,
                VehicleVerified: s.vehicleVerified ?? true,
                DocumentVerified: s.documentsVerified ?? true,
                SecurityInDateTime: s.securityInDateTime,
                SecurityOutDateTime: s.securityOutDateTime,
                SecurityPersonnel: s.securityOfficer || '',
                Remarks: (s.remarks || '').substring(0, 20),
                PurchaseOrderNumber: s.poNumber || '',
                HelperName: s.helperName || ''
            }));
        }
    });

    this.on('CREATE', 'S4SecurityEntries', async (req) => {
        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const d = req.data;
            const secPayload = {
                SecuritygateId: (d.SecurityID || cds.utils.uuid().replace(/-/g, '')).substring(0, 20),
                gateInNumber: (d.EntryID || '').substring(0, 20),
                driverLicenseNo: (d.DriverLicenseNo || 'N/A').substring(0, 50),
                driverPhoneNo: (d.DriverPhoneNo || 'N/A').substring(0, 20),
                helperName: (d.HelperName || 'N/A').substring(0, 50),
                vehicleReportingDateTime: new Date().toISOString(),
                securityInDateTime: d.SecurityInDateTime ? new Date(d.SecurityInDateTime).toISOString() : new Date().toISOString(),
                securityPersonnel: (d.SecurityPersonnel || 'Security').substring(0, 150),
                driverVerified: d.DriverVerified !== false,
                vehicleVerified: d.VehicleVerified !== false,
                documentsVerified: d.DocumentVerified !== false,
                poNumber: (d.PurchaseOrderNumber || '').substring(0, 50),
                soNumber: '',
                invoiceNumber: '',
                withoutPO: 'NO',
                rgpDocumentNo: '',
                nrgpDocumentNo: '',
                gatePassType: '',
                SecurityAssignedRoute: 'UNASSIGNED',
                securityInRemarks: (d.Remarks || 'Security In clearance').substring(0, 250),
                securityOutPersonnel: '',
                exitDriverVerified: false,
                exitVehicleVerified: false,
                exitDocumentsVerified: false,
                gatePassVerified: false,
                deliveryDetailsVerified: false,
                emptyInspectionVerified: false,
                materialInspected: false,
                exitGatePassType: '',
                exitGatePassDocumentNo: '',
                securityOutRemarks: ''
            };
            if (d.EntryID) {
                return await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${d.EntryID}')/_SecurityGateEntries`, secPayload);
            }
            return await s4Cbo.run(INSERT.into(s4Cbo.entities.SecurityGateEntries).entries(secPayload));
        } catch (err) {
            console.error('[GateService] Failed to create SecurityEntry in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create SecurityEntry in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 11. Action: Sync Gate Transaction to S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
    this.on('SyncToS4Hana', async (req) => {
        const { gateInNumber } = req.data;
        if (!gateInNumber) {
            req.error(400, 'gateInNumber is required for S/4HANA CBO synchronization.');
            return;
        }

        const tx = await SELECT.one.from('factory.gate.GateTransactions')
            .where({ gateInNumber })
            .columns(t => {
                t('*'),
                t.securityEntry(s => { s('*') }),
                t.weighments(w => { w('*') }),
                t.factoryEntry(f => { f('*') }),
                t.deliveryDetails(d => { d('*') }),
                t.pickupDetails(p => { p('*') })
            });

        if (!tx) {
            req.error(404, `Gate Transaction with Gate IN number ${gateInNumber} not found.`);
            return;
        }

        try {
            const s4Cbo = await getS4VehicleGateOperationService();
            const mainGateEntryId = gateInNumber.substring(0, 20);

            // 1. Root: VehicleGateOperation
            const vehicleGateOpPayload = {
                MainGateEntryId: mainGateEntryId,
                VehicleType: (tx.vehicleType || 'TRUCK').substring(0, 10),
                VehicleRegNumber: (tx.vehicleRegNo || '').substring(0, 20),
                DriverName: (tx.driverName || 'Driver').substring(0, 100),
                VisitPurpose: mapVisitPurpose(tx.purpose),
                VehicleStatus: (tx.status || 'GATE_IN').substring(0, 15),
                GateInOperator: (tx.gateInOperator || 'SYSTEM').substring(0, 20),
                GateInTime: tx.gateInDateTime ? new Date(tx.gateInDateTime).toISOString() : new Date().toISOString(),
                GateOutTime: tx.gateOutDateTime ? new Date(tx.gateOutDateTime).toISOString() : null,
                MainGateRemarks: (tx.remarks || `APL Gate Entry - ${tx.gateInNumber}`).substring(0, 250),
                assignedRoute: (tx.assignedRoute || 'UNASSIGNED').substring(0, 100),
                CurrentStage: (tx.currentStage || 'MAIN_GATE_IN').substring(0, 20),
                SAPDescription: `APL Gate Entry - ${tx.gateInNumber}`.substring(0, 80)
            };

            let existingRoot = null;
            try {
                existingRoot = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.VehicleGateOperation).where({ MainGateEntryId: mainGateEntryId }));
            } catch (_) {}

            if (existingRoot) {
                await s4Cbo.patch(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')`, vehicleGateOpPayload);
            } else {
                await s4Cbo.post('/VehicleGateOperation', vehicleGateOpPayload);
            }

            // 2. Child: SecurityGateEntries
            if (tx.securityEntry) {
                const sec = tx.securityEntry;
                const secId = (sec.ID ? sec.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
                const secPayload = {
                    SecuritygateId: secId,
                    gateInNumber: mainGateEntryId,
                    driverLicenseNo: (sec.driverLicenseNo || 'N/A').substring(0, 50),
                    driverPhoneNo: (sec.driverPhoneNo || 'N/A').substring(0, 20),
                    helperName: (sec.helperName || 'N/A').substring(0, 50),
                    vehicleReportingDateTime: sec.vehicleReportingDateTime ? new Date(sec.vehicleReportingDateTime).toISOString() : new Date().toISOString(),
                    securityInDateTime: sec.securityInDateTime ? new Date(sec.securityInDateTime).toISOString() : new Date().toISOString(),
                    securityPersonnel: (sec.securityPersonnel || sec.securityOfficer || 'Security').substring(0, 150),
                    driverVerified: sec.driverVerified !== false,
                    vehicleVerified: sec.vehicleVerified !== false,
                    documentsVerified: sec.documentsVerified !== false,
                    poNumber: (sec.poNumber || '').substring(0, 50),
                    soNumber: (sec.soNumber || '').substring(0, 50),
                    invoiceNumber: (sec.invoiceNumber || '').substring(0, 50),
                    invoiceDate: sec.invoiceDate ? sec.invoiceDate : null,
                    withoutPO: (sec.withoutPO ? 'YES' : 'NO'),
                    rgpDocumentNo: (sec.rgpDocumentNo || '').substring(0, 50),
                    nrgpDocumentNo: (sec.nrgpDocumentNo || '').substring(0, 50),
                    gatePassType: (sec.gatePassType || '').substring(0, 5),
                    SecurityAssignedRoute: (sec.assignedRoute || sec.SecurityAssignedRoute || tx.assignedRoute || 'UNASSIGNED').substring(0, 20),
                    securityInRemarks: (sec.remarks || sec.securityInRemarks || 'Security In clearance').substring(0, 250),
                    securityOutPersonnel: (sec.securityOutPersonnel || '').substring(0, 150),
                    securityOutDateTime: sec.securityOutDateTime ? new Date(sec.securityOutDateTime).toISOString() : null,
                    exitDriverVerified: Boolean(sec.exitDriverVerified),
                    exitVehicleVerified: Boolean(sec.exitVehicleVerified),
                    exitDocumentsVerified: Boolean(sec.exitDocumentsVerified),
                    gatePassVerified: Boolean(sec.gatePassVerified),
                    deliveryDetailsVerified: Boolean(sec.deliveryDetailsVerified),
                    emptyInspectionVerified: Boolean(sec.emptyInspectionVerified),
                    materialInspected: Boolean(sec.materialInspected),
                    exitGatePassType: (sec.exitGatePassType || '').substring(0, 5),
                    exitGatePassDocumentNo: (sec.exitGatePassDocumentNo || '').substring(0, 50),
                    securityOutRemarks: (sec.securityOutRemarks || '').substring(0, 250)
                };

                let existingSec = null;
                try {
                    existingSec = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.SecurityGateEntries).where({ MainGateEntryId: mainGateEntryId, SecuritygateId: secId }));
                } catch (_) {}

                if (!existingSec) {
                    await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_SecurityGateEntries`, secPayload);
                } else {
                    await s4Cbo.patch(`/SecurityGateEntries(MainGateEntryId='${mainGateEntryId}',SecuritygateId='${secId}')`, secPayload);
                }
            }

            // 3. Child: WeighbridgeTransactions
            if (Array.isArray(tx.weighments) && tx.weighments.length > 0) {
                for (const wb of tx.weighments) {
                    const wbId = (wb.ID ? wb.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
                    let existingWb = null;
                    try {
                        existingWb = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.WeighbridgeTransactions).where({ MainGateEntryId: mainGateEntryId, WeighbridgeId: wbId }));
                    } catch (_) {}

                    const wbPayload = {
                        WeighbridgeId: wbId,
                        weighbridgeNumber: (wb.weighbridgeNumber || 'WB-01').substring(0, 20),
                        weighmentType: (wb.weighmentType || 'GROSS_IN').substring(0, 10),
                        weight: Number(wb.weight) || 0,
                        weightUnit: (wb.weightUnit || 'KG').substring(0, 3),
                        weighbridgeDateTime: wb.weighbridgeDateTime ? new Date(wb.weighbridgeDateTime).toISOString() : new Date().toISOString(),
                        WeightOperator: (wb.operator || wb.WeightOperator || 'SYSTEM').substring(0, 150),
                        weighRemark: (wb.remarks || wb.weighRemark || 'Weighment recorded').substring(0, 250)
                    };

                    if (!existingWb) {
                        await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_WeighbridgeTransactions`, wbPayload);
                    } else {
                        await s4Cbo.patch(`/WeighbridgeTransactions(MainGateEntryId='${mainGateEntryId}',WeighbridgeId='${wbId}')`, wbPayload);
                    }
                }
            }

            // 4. Child: FactoryGateEntries
            if (tx.factoryEntry) {
                const fac = tx.factoryEntry;
                const facId = (fac.ID ? fac.ID.replace(/-/g, '') : cds.utils.uuid().replace(/-/g, '')).substring(0, 20);
                const facPayload = {
                    FactoryEntryId: facId,
                    GateInNoF: mainGateEntryId,
                    factoryGateInDateTime: fac.factoryGateInDateTime ? new Date(fac.factoryGateInDateTime).toISOString() : new Date().toISOString(),
                    factoryGateInOperator: (fac.factoryGateInOperator || 'SYSTEM').substring(0, 150),
                    factoryGateInRemarks: (fac.factoryGateInRemarks || fac.remarks || 'Factory gate check-in').substring(0, 250),
                    factoryGateOutDateTime: fac.factoryGateOutDateTime ? new Date(fac.factoryGateOutDateTime).toISOString() : null,
                    factoryGateOutOperator: (fac.factoryGateOutOperator || '').substring(0, 150),
                    factoryGateOutRemarks: (fac.factoryGateOutRemarks || '').substring(0, 250),
                    FactoryGateOutType: (fac.gateOutType || fac.FactoryGateOutType || 'STD').substring(0, 5),
                    FactoryPONumber: (fac.poNumber || fac.FactoryPONumber || '').substring(0, 20),
                    FactoryInvoiceNumber: (fac.invoiceNumber || fac.FactoryInvoiceNumber || '').substring(0, 20),
                    FactoryInvoiceDate: fac.invoiceDate ? String(fac.invoiceDate).substring(0, 20) : '',
                    supplierNameInFactory: (fac.supplierName || fac.supplierNameInFactory || '').substring(0, 250),
                    transporterName: (fac.transporterName || '').substring(0, 250),
                    deliveryNoteNo: (fac.deliveryNoteNo || '').substring(0, 50),
                    factoryArea: (fac.factoryArea || 'Raw Material Yard').substring(0, 150),
                    unloadingPoint: (fac.unloadingPoint || '').substring(0, 100),
                    materialDescription: (fac.materialDescription || '').substring(0, 250),
                    unloadingStatus: (fac.unloadingStatus || 'IN_PROGRESS').substring(0, 20),
                    unloadedQuantity: (fac.unloadedQuantity !== undefined && fac.unloadedQuantity !== null ? String(fac.unloadedQuantity) : '').substring(0, 20),
                    quantityUnit: (fac.quantityUnit || 'KG').substring(0, 20),
                    goodsInspected: fac.goodsInspected !== false,
                    sealVerified: fac.sealVerified !== false,
                    FactoryOutRemarks: (fac.FactoryOutRemarks || fac.remarks || '').substring(0, 250)
                };

                let existingFac = null;
                try {
                    existingFac = await s4Cbo.run(SELECT.one.from(s4Cbo.entities.FactoryGateEntries).where({ MainGateEntryId: mainGateEntryId, FactoryEntryId: facId }));
                } catch (_) {}

                if (!existingFac) {
                    await s4Cbo.post(`/VehicleGateOperation(MainGateEntryId='${mainGateEntryId}')/_FactoryGateEntries`, facPayload);
                } else {
                    await s4Cbo.patch(`/FactoryGateEntries(MainGateEntryId='${mainGateEntryId}',FactoryEntryId='${facId}')`, facPayload);
                }
            }

            console.log(`[GateService] Successfully synchronized Gate IN ${gateInNumber} to S/4HANA CBO (YY1_API_VEHICLEGATEOPERATION_0001)`);
            return `Successfully synchronized Gate IN ${gateInNumber} to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001).`;
        } catch (err) {
            console.error(`[GateService] Error synchronizing ${gateInNumber} to S/4HANA CBO:`, err.message);
            req.error(502, `Failed to sync with S/4HANA Cloud CBO: ${err.message}`);
        }
    });


    /*
     * ============================================================
     * SAP S/4HANA CLOUD CBO: CUSTOM USER MANAGEMENT
     * ============================================================
     */

    // ------------------------------------------------------------
    // S/4HANA CLOUD CBO CUSTOM USER HELPERS (Resilient, Non-blocking)
    // ------------------------------------------------------------

    async function pushCustomUserToS4Hana(userEntry, rolesList = [], assignedBy = 'SUPERADMIN') {
        if (!userEntry || !userEntry.username) return null;
        try {
            const s4UserCbo = await getS4CustomUserService();
            const roleArray = Array.isArray(rolesList) && rolesList.length > 0
                ? rolesList
                : (userEntry.assignedRoles ? userEntry.assignedRoles.split(',').map(r => r.trim()).filter(Boolean) : []);
            const primaryRole = (roleArray[0] || 'MainGateUser').substring(0, 20);
            const primaryRoleName = (ROLE_NAMES[primaryRole] || primaryRole).substring(0, 100);
            const assignedRolesStr = (roleArray.length > 0 ? roleArray.join(', ') : (userEntry.assignedRoles || primaryRole)).substring(0, 250);
            const sUserId = (userEntry.UserId || userEntry.employeeId || userEntry.username || userEntry.ID || '').substring(0, 20);

            const payload = {
                UserId: sUserId,
                username: (userEntry.username || '').substring(0, 50),
                password: (userEntry.password || '').substring(0, 20),
                name: (userEntry.name || '').substring(0, 50),
                employeeId: (userEntry.employeeId || sUserId).substring(0, 20),
                designation: (userEntry.designation || 'Gate Staff').substring(0, 50),
                department: (userEntry.department || 'Operations').substring(0, 50),
                email: (userEntry.email || `${userEntry.username}@apl.com`).substring(0, 100),
                phoneNo: (userEntry.phoneNo || '').substring(0, 20),
                serviceStatus: (userEntry.serviceStatus || 'IN_SERVICE').substring(0, 12),
                status: (userEntry.status || 'ACTIVE').substring(0, 8),
                active: userEntry.active !== false,
                assignedRoles: assignedRolesStr,
                remarks: (userEntry.remarks || 'User created in APL Gate App').substring(0, 250),
                roleCode: primaryRole,
                roleName: primaryRoleName,
                assignedDate: userEntry.assignedDate || new Date().toISOString().slice(0, 10),
                assignedBy: (assignedBy || 'SUPERADMIN').substring(0, 100),
                SAPDescription: `APL Gate User - ${userEntry.username || ''}`.substring(0, 80)
            };

            await s4UserCbo.post('/CustomUser', payload);
            console.log(`[GateService] S/4HANA Auto-Sync: Created CustomUser ${sUserId} (${userEntry.username})`);
            return payload;
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync warning for CustomUser ${userEntry.username}:`, err.message);
            return null;
        }
    }

    async function updateCustomUserInS4Hana(userId, patchFields) {
        if (!userId) return;
        try {
            const s4UserCbo = await getS4CustomUserService();
            await s4UserCbo.patch(`/CustomUser(UserId='${userId}')`, patchFields);
            console.log(`[GateService] S/4HANA Auto-Sync: Updated CustomUser ${userId}`);
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync update warning for CustomUser ${userId}:`, err.message);
        }
    }

    async function deleteCustomUserInS4Hana(userId) {
        if (!userId) return;
        try {
            const s4UserCbo = await getS4CustomUserService();
            await s4UserCbo.delete(`/CustomUser(UserId='${userId}')`);
            console.log(`[GateService] S/4HANA Auto-Sync: Deleted CustomUser ${userId}`);
        } catch (err) {
            console.warn(`[GateService] S/4HANA Auto-Sync delete warning for CustomUser ${userId}:`, err.message);
        }
    }

    // 1. READ S4CustomUsers from S/4HANA Cloud CBO
    this.on('READ', 'S4CustomUsers', async (req) => {
        try {
            const s4UserCbo = await getS4CustomUserService();
            const delegatedQuery = SELECT.from(s4UserCbo.entities.CustomUser);
            if (req.query?.SELECT?.one) delegatedQuery.SELECT.one = req.query.SELECT.one;
            if (req.query?.SELECT?.columns) delegatedQuery.SELECT.columns = req.query.SELECT.columns;
            if (req.query?.SELECT?.where) delegatedQuery.SELECT.where = req.query.SELECT.where;
            if (req.query?.SELECT?.orderBy) delegatedQuery.SELECT.orderBy = req.query.SELECT.orderBy;
            if (req.query?.SELECT?.limit) delegatedQuery.SELECT.limit = req.query.SELECT.limit;
            if (req.query?.SELECT?.count) delegatedQuery.SELECT.count = req.query.SELECT.count;
            return await s4UserCbo.run(delegatedQuery);
        } catch (err) {
            console.warn('[GateService] S/4HANA CBO CustomUser service not reachable, serving fallback data:', err.message);
            const localUsers = await SELECT.from(Users);
            return localUsers.map(u => {
                const primaryRole = (u.assignedRoles || '').split(',')[0]?.trim() || '';
                return {
                    UserId: (u.employeeId || u.username || u.ID).substring(0, 20),
                    username: u.username,
                    password: u.password,
                    name: u.name,
                    employeeId: (u.employeeId || '').substring(0, 20),
                    designation: u.designation || '',
                    department: u.department || '',
                    email: u.email || '',
                    phoneNo: u.phoneNo || '',
                    serviceStatus: u.serviceStatus || 'IN_SERVICE',
                    status: u.status || 'ACTIVE',
                    active: u.active ?? true,
                    assignedRoles: u.assignedRoles || '',
                    remarks: u.remarks || '',
                    roleCode: primaryRole.substring(0, 20),
                    roleName: (ROLE_NAMES[primaryRole] || primaryRole).substring(0, 100),
                    assignedDate: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                    assignedBy: u.createdBy || 'SUPERADMIN',
                    SAPDescription: `APL Gate User - ${u.username}`.substring(0, 80)
                };
            });
        }
    });

    // 2. CREATE S4CustomUsers in S/4HANA Cloud CBO
    this.on('CREATE', 'S4CustomUsers', async (req) => {
        try {
            const s4UserCbo = await getS4CustomUserService();
            const entryData = Object.assign({}, req.data);
            if (!entryData.UserId) {
                entryData.UserId = (entryData.username || entryData.employeeId || cds.utils.uuid()).substring(0, 20);
            }
            if (!entryData.SAPDescription) {
                entryData.SAPDescription = `APL Gate User - ${entryData.username || entryData.UserId}`.substring(0, 80);
            }
            return await s4UserCbo.run(INSERT.into(s4UserCbo.entities.CustomUser).entries(entryData));
        } catch (err) {
            console.error('[GateService] Failed to create CustomUser in S/4HANA CBO:', err.message);
            req.error(502, `Failed to create CustomUser in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 3. UPDATE S4CustomUsers in S/4HANA Cloud CBO
    this.on('UPDATE', 'S4CustomUsers', async (req) => {
        try {
            const s4UserCbo = await getS4CustomUserService();
            const key = req.data.UserId;
            return await s4UserCbo.patch(`/CustomUser(UserId='${key}')`, req.data);
        } catch (err) {
            console.error('[GateService] Failed to update CustomUser in S/4HANA CBO:', err.message);
            req.error(502, `Failed to update CustomUser in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 4. DELETE S4CustomUsers in S/4HANA Cloud CBO
    this.on('DELETE', 'S4CustomUsers', async (req) => {
        try {
            const s4UserCbo = await getS4CustomUserService();
            const key = req.data.UserId;
            return await s4UserCbo.delete(`/CustomUser(UserId='${key}')`);
        } catch (err) {
            console.error('[GateService] Failed to delete CustomUser in S/4HANA CBO:', err.message);
            req.error(502, `Failed to delete CustomUser in S/4HANA Cloud: ${err.message}`);
        }
    });

    // 5. Action: Sync User to S/4HANA Cloud CBO
    this.on('SyncUserToS4Hana', async (req) => {
        const { username } = req.data;
        if (!username) {
            req.error(400, 'username is required for S/4HANA CBO user synchronization.');
            return;
        }

        const user = await SELECT.one.from(Users).where({ username: username.toLowerCase() });
        if (!user) {
            req.error(404, `User ${username} not found.`);
            return;
        }

        const dbRoles = await SELECT.from(UserRoles).where({ user_ID: user.ID });
        const rolesList = dbRoles.map(r => r.roleCode);
        if (rolesList.length === 0 && user.assignedRoles) {
            rolesList.push(...user.assignedRoles.split(',').map(r => r.trim()).filter(Boolean));
        }

        try {
            const s4UserCbo = await getS4CustomUserService();
            const primaryRole = (rolesList[0] || 'MainGateUser').substring(0, 20);
            const primaryRoleName = (ROLE_NAMES[primaryRole] || primaryRole).substring(0, 100);
            const assignedRolesStr = (rolesList.length > 0 ? rolesList.join(', ') : (user.assignedRoles || primaryRole)).substring(0, 250);
            const sUserId = (user.employeeId || user.username || user.ID || '').substring(0, 20);

            const userPayload = {
                UserId: sUserId,
                username: (user.username || '').substring(0, 50),
                password: (user.password || '').substring(0, 20),
                name: (user.name || '').substring(0, 50),
                employeeId: (user.employeeId || sUserId).substring(0, 20),
                designation: (user.designation || 'Gate Staff').substring(0, 50),
                department: (user.department || 'Operations').substring(0, 50),
                email: (user.email || `${user.username}@apl.com`).substring(0, 100),
                phoneNo: (user.phoneNo || '').substring(0, 20),
                serviceStatus: (user.serviceStatus || 'IN_SERVICE').substring(0, 12),
                status: (user.status || 'ACTIVE').substring(0, 8),
                active: user.active !== false,
                assignedRoles: assignedRolesStr,
                remarks: (user.remarks || 'APL Gate App User').substring(0, 250),
                roleCode: primaryRole,
                roleName: primaryRoleName,
                assignedDate: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                assignedBy: (req.user?.id || 'SUPERADMIN').substring(0, 100),
                SAPDescription: `APL Gate User - ${user.username || ''}`.substring(0, 80)
            };

            let existingUser = null;
            try {
                existingUser = await s4UserCbo.run(SELECT.one.from(s4UserCbo.entities.CustomUser).where({ UserId: sUserId }));
            } catch (_) {}

            if (existingUser) {
                await s4UserCbo.patch(`/CustomUser(UserId='${sUserId}')`, userPayload);
            } else {
                await s4UserCbo.post('/CustomUser', userPayload);
            }

            console.log(`[GateService] Successfully synchronized User ${username} to S/4HANA CBO`);
            return `Successfully synchronized User ${username} to SAP S/4HANA Cloud CBO (CustomUser).`;
        } catch (err) {
            console.error(`[GateService] Error synchronizing User ${username} to S/4HANA CBO:`, err.message);
            req.error(502, `Failed to sync user with S/4HANA Cloud CBO: ${err.message}`);
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
            driverName,
            gateInOperator
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

            gateInOperator: gateInOperator || req.user?.id || 'SYSTEM'
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

        /*
         * Auto-sync to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await pushVehicleGateOperationToS4Hana(transaction);


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
        // Security Gate IN only stores the Security Gate IN record and assigns the route.
        // It does NOT change factory gate IN status or create FactoryGateEntries.
        // The factory GATE IN record will be stored by the factory gate operator.
        const determinedRoute = assignedRoute ? assignedRoute.toUpperCase().trim() : '';
        const targetStage = determinedRoute === 'WEIGHBRIDGE' ? 'WEIGHBRIDGE_IN' : (determinedRoute === 'FACTORY' ? 'FACTORY' : 'SECURITY_GATE_IN');
        const targetStatus = 'SECURITY_IN';

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
            action: 'SECURITY_GATE_IN',
            oldStatus: 'GATE_IN',
            newStatus: targetStatus,
            oldStage: 'MAIN_GATE_IN',
            newStage: targetStage,
            actionDateTime: new Date(),
            userId: req.user?.id || 'SYSTEM',
            userName: securityPersonnel,
            remarks: auditRemarks
        });

        /*
         * Auto-sync to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await pushSecurityGateEntryToS4Hana(transaction, {
            ID: entryId,
            gateInNumber: transaction.gateInNumber,
            driverLicenseNo: driverLicenseNo,
            driverPhoneNo: driverPhoneNo,
            helperName: helperName,
            securityPersonnel: securityPersonnel,
            driverVerified: driverVerified,
            vehicleVerified: vehicleVerified,
            documentsVerified: documentsVerified,
            poNumber: poNumber,
            soNumber: soNumber,
            invoiceNumber: invoiceNumber,
            invoiceDate: invoiceDate,
            withoutPO: bWithoutPO,
            rgpDocumentNo: rgpDocumentNo,
            nrgpDocumentNo: nrgpDocumentNo,
            gatePassType: determinedPassType,
            assignedRoute: determinedRoute || '',
            remarks: remarks,
            securityInDateTime: new Date()
        });

        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: targetStatus,
            CurrentStage: targetStage,
            assignedRoute: determinedRoute || ''
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
                    status: 'SECURITY_IN',
                    currentStage: 'FACTORY',
                    assignedRoute: 'FACTORY'
                })
                .where({ ID: transaction.ID });

            await UPDATE(SecurityGateEntries)
                .set({ assignedRoute: 'FACTORY' })
                .where({ gateTransaction_ID: transaction.ID });

            await INSERT.into(GateAuditLogs).entries({
                ID: cds.utils.uuid(),
                gateTransaction_ID: transaction.ID,
                action: 'ROUTE_ASSIGNED',
                oldStatus: transaction.status,
                newStatus: 'SECURITY_IN',
                oldStage: transaction.currentStage,
                newStage: 'FACTORY',
                actionDateTime: new Date(),
                userId: req.user?.id || 'SYSTEM',
                userName: sOperator,
                remarks: remarks || `Security Gate: Route assigned to Factory Gate (Weighbridge bypassed) by ${sOperator}`
            });
        }

        /*
         * Auto-sync route assignment to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            CurrentStage: sRoute === 'WEIGHBRIDGE' ? 'WEIGHBRIDGE_IN' : 'FACTORY',
            assignedRoute: sRoute
        });

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


        /*
         * Auto-sync weighment to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await pushWeighbridgeTransactionToS4Hana(transaction, {
            weighbridgeNumber,
            weighmentType: finalType,
            weight,
            weightUnit: finalUnit,
            weighbridgeDateTime: weighbridgeDateTime ? new Date(weighbridgeDateTime) : new Date(),
            operator: finalOp,
            remarks
        });

        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: newStatus,
            CurrentStage: newStage,
            assignedRoute: newStatus === 'WEIGHBRIDGE_IN' ? 'WEIGHBRIDGE' : transaction.assignedRoute
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
            factoryGateInRemarks,
            remarks
        } = req.data;

        if (!gateInNumber) {
            return req.error(400, 'Gate IN Number is mandatory.');
        }

        const transaction = await getTransaction(gateInNumber, req);

        // Allow SECURITY_IN (direct entry without scale), WEIGHBRIDGE_IN (entry after scale), and FACTORY_IN (direct factory route assigned from Security Gate or updating check-in)
        validateStage(
            transaction,
            ['SECURITY_IN', 'WEIGHBRIDGE_IN', 'FACTORY_IN'],
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
        const sInRemarks = factoryGateInRemarks || remarks || '';

        // Check if consolidated record already exists
        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        const factoryEntryId = existing ? existing.ID : cds.utils.uuid();
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateInDateTime: inTimestamp,
                    factoryGateInOperator: sOperator,
                    factoryGateInRemarks: sInRemarks || existing.factoryGateInRemarks || '',
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
                ID: factoryEntryId,
                gateTransaction_ID: transaction.ID,
                gateInNumber: transaction.gateInNumber,
                factoryGateInDateTime: inTimestamp,
                factoryGateInOperator: sOperator,
                factoryGateInRemarks: sInRemarks,
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

        /*
         * Auto-sync factory check-in to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await pushFactoryGateEntryToS4Hana(transaction, {
            ID: factoryEntryId,
            factoryGateInDateTime: inTimestamp,
            factoryGateInOperator: sOperator,
            factoryGateInRemarks: sInRemarks,
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

        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: 'FACTORY_IN',
            CurrentStage: 'FACTORY',
            assignedRoute: 'FACTORY'
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
            gateOutType,
            factoryGateOutRemarks,
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
        const sOutRemarks = factoryGateOutRemarks || remarks || '';
        const sGateOutType = gateOutType || 'STANDARD';

        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateOutDateTime: outTimestamp,
                    factoryGateOutOperator: sOperator,
                    gateOutType: sGateOutType,
                    factoryGateOutRemarks: sOutRemarks || existing.factoryGateOutRemarks || '',
                    unloadingStatus: unloadingStatus || existing.unloadingStatus || 'COMPLETED',
                    unloadedQuantity: (unloadedQuantity !== undefined && unloadedQuantity !== null) ? unloadedQuantity : existing.unloadedQuantity,
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
                gateOutType: sGateOutType,
                factoryGateOutRemarks: sOutRemarks,
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

        /*
         * Auto-sync factory check-out to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await updateFactoryGateEntryInS4Hana(transaction.gateInNumber, existing?.ID, {
            factoryGateOutDateTime: outTimestamp.toISOString(),
            factoryGateOutOperator: sOperator.substring(0, 150),
            FactoryGateOutType: sGateOutType.substring(0, 5),
            factoryGateOutRemarks: sOutRemarks.substring(0, 250),
            unloadingStatus: (unloadingStatus || 'COMPLETED').substring(0, 20),
            unloadedQuantity: (unloadedQuantity !== undefined && unloadedQuantity !== null ? String(unloadedQuantity) : '').substring(0, 20),
            quantityUnit: (quantityUnit || 'KG').substring(0, 20),
            goodsInspected: goodsInspected !== undefined ? Boolean(goodsInspected) : true,
            sealVerified: sealVerified !== undefined ? Boolean(sealVerified) : true,
            FactoryOutRemarks: (remarks || 'Factory yard operations completed').substring(0, 250)
        });

        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: 'FACTORY_OUT',
            CurrentStage: 'FACTORY'
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
            gateOutType,
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
            factoryGateInRemarks,
            factoryGateOutRemarks,
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
        const sGateOutType = gateOutType || 'STANDARD';

        const isOutRecorded = Boolean(outTime) || transaction.status === 'FACTORY_IN';
        const newStatus = isOutRecorded ? 'FACTORY_OUT' : 'FACTORY_IN';

        const existing = await SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: transaction.ID });
        if (existing) {
            await UPDATE(FactoryGateEntries)
                .set({
                    factoryGateInDateTime: inTime || existing.factoryGateInDateTime,
                    factoryGateInOperator: inOp || existing.factoryGateInOperator,
                    factoryGateInRemarks: factoryGateInRemarks || existing.factoryGateInRemarks || '',
                    factoryGateOutDateTime: outTime || existing.factoryGateOutDateTime,
                    factoryGateOutOperator: outOp || existing.factoryGateOutOperator,
                    factoryGateOutRemarks: factoryGateOutRemarks || existing.factoryGateOutRemarks || '',
                    gateOutType: sGateOutType || existing.gateOutType || 'STANDARD',
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
                factoryGateInRemarks: factoryGateInRemarks || '',
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                factoryGateOutRemarks: factoryGateOutRemarks || '',
                gateOutType: sGateOutType,
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

        /*
         * Auto-sync security gate out to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await updateSecurityGateEntryInS4Hana(transaction.gateInNumber, existingSec?.ID, {
            securityOutPersonnel: secOutPerson.substring(0, 150),
            securityOutDateTime: outTime.toISOString(),
            exitDriverVerified: driverVerified !== undefined ? Boolean(driverVerified) : true,
            exitVehicleVerified: vehicleVerified !== undefined ? Boolean(vehicleVerified) : true,
            exitDocumentsVerified: documentsVerified !== undefined ? Boolean(documentsVerified) : true,
            gatePassVerified: Boolean(gatePassVerified),
            deliveryDetailsVerified: Boolean(deliveryDetailsVerified),
            emptyInspectionVerified: Boolean(emptyInspectionVerified),
            materialInspected: Boolean(materialInspected),
            exitGatePassType: (determinedPassType || '').substring(0, 5),
            exitGatePassDocumentNo: (determinedDocNo || '').substring(0, 50),
            securityOutRemarks: (remarks || '').substring(0, 250)
        });

        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: 'SECURITY_OUT',
            CurrentStage: 'SECURITY_GATE_OUT'
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
            gateInNumber,
            gateOutOperator
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

        const operatorName = (gateOutOperator && gateOutOperator.trim()) ? gateOutOperator.trim() : (req.user?.id || 'SYSTEM');

        await UPDATE(GateTransactions)
            .set({

                status:
                    'COMPLETED',

                currentStage:
                    'COMPLETED',

                gateOutDateTime:
                    exitDateTime,

                gateOutOperator:
                    operatorName

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
                operatorName,

            remarks:
                `Main Gate OUT clearance recorded by ${operatorName}`
        });

        /*
         * Auto-sync completed exit to SAP S/4HANA Cloud CBO (YY1_API_VEHICLEGATEOPERATION_0001)
         */
        await updateVehicleGateOperationInS4Hana(transaction.gateInNumber, {
            VehicleStatus: 'COMPLETED',
            CurrentStage: 'COMPLETED',
            GateOutTime: exitDateTime.toISOString(),
            MainGateRemarks: `Main Gate OUT clearance recorded by ${operatorName}`
        });

        return SELECT.one
            .from(GateTransactions)
            .where({
                ID: transaction.ID
            });
    });


    /*
     * ============================================================
     * SUPERADMIN USER MANAGEMENT
     * ============================================================
     */

    this.on('CreateUser', async (req) => {
        const {
            UserId,
            username,
            password,
            name,
            employeeId,
            designation,
            department,
            email,
            phoneNo,
            serviceStatus,
            status,
            assignedRoles,
            remarks
        } = req.data;

        if (!username || !username.trim()) {
            return req.error(400, 'Username is mandatory.');
        }
        if (!name || !name.trim()) {
            return req.error(400, 'Full Name is mandatory.');
        }
        if (!password || !password.trim()) {
            return req.error(400, 'Password is mandatory.');
        }

        const sUsername = username.trim().toLowerCase();
        const existing = await SELECT.one.from(Users).where({ username: sUsername });
        if (existing) {
            return req.error(400, `User with username '${sUsername}' already exists.`);
        }

        const sStatus = status || 'ACTIVE';
        const bActive = (sStatus === 'ACTIVE');
        const sServiceStatus = serviceStatus || 'IN_SERVICE';
        const sRoles = (assignedRoles || '').trim();
        const empId = employeeId !== undefined ? (employeeId || '').trim() : (req.data.employee_id ? String(req.data.employee_id).trim() : null);

        const newUserId = cds.utils.uuid();
        const userEntry = {
            ID: newUserId,
            username: sUsername,
            password: password.trim(),
            name: name.trim(),
            employeeId: empId,
            designation: designation ? designation.trim() : null,
            department: department ? department.trim() : null,
            email: email ? email.trim() : null,
            phoneNo: phoneNo ? phoneNo.trim() : null,
            serviceStatus: sServiceStatus,
            status: sStatus,
            active: bActive,
            assignedRoles: sRoles,
            remarks: remarks ? remarks.trim() : null
        };

        await INSERT.into(Users).entries(userEntry);

        if (sRoles) {
            const roleArray = sRoles.split(',').map(r => r.trim()).filter(Boolean);
            for (const rCode of roleArray) {
                await INSERT.into(UserRoles).entries({
                    ID: cds.utils.uuid(),
                    user_ID: newUserId,
                    roleCode: rCode,
                    roleName: ROLE_NAMES[rCode] || rCode,
                    assignedDate: new Date(),
                    assignedBy: req.user?.id || 'SUPERADMIN'
                });
            }
        }

        // Real-time auth cache registration for immediate login
        if (cds.env?.requires?.auth?.users) {
            const roleArray = sRoles ? sRoles.split(',').map(r => r.trim()).filter(Boolean) : [];
            const expandedRoles = expandRoles(roleArray);
            cds.env.requires.auth.users[sUsername] = new cds.User({
                id: sUsername,
                password: password.trim(),
                roles: expandedRoles
            });
        }

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            action: 'USER_CREATED',
            actionDateTime: new Date(),
            userId: req.user?.id || 'SUPERADMIN',
            userName: req.user?.id || 'SUPERADMIN',
            remarks: `User created: ${sUsername} (${name}) with roles: ${sRoles || 'None'}`
        });

        /*
         * Auto-sync newly created user to SAP S/4HANA Cloud CBO (YY1_API_CUSTOMUSER_0001)
         */
        const s4RoleArray = sRoles ? sRoles.split(',').map(r => r.trim()).filter(Boolean) : [];
        await pushCustomUserToS4Hana(
            {
                ...userEntry,
                UserId: (UserId || empId || sUsername).substring(0, 20)
            },
            s4RoleArray,
            req.user?.id || 'SUPERADMIN'
        );

        return SELECT.one.from(Users).where({ ID: newUserId });
    });

    this.on('UpdateUser', async (req) => {
        const {
            ID,
            username,
            password,
            name,
            employeeId,
            designation,
            department,
            email,
            phoneNo,
            serviceStatus,
            status,
            assignedRoles,
            remarks
        } = req.data;

        if (!ID) {
            return req.error(400, 'User ID is mandatory.');
        }

        const user = await SELECT.one.from(Users).where({ ID: ID });
        if (!user) {
            return req.error(404, 'User not found.');
        }

        const sUsername = username ? username.trim().toLowerCase() : user.username;
        if (sUsername !== user.username) {
            const existing = await SELECT.one.from(Users).where({ username: sUsername });
            if (existing) {
                return req.error(400, `Username '${sUsername}' is already in use by another account.`);
            }
        }

        const sStatus = status || user.status || 'ACTIVE';
        if (user.username === 'superadmin_user' && sStatus !== 'ACTIVE') {
            return req.error(400, 'Primary Superadmin user cannot be deactivated.');
        }

        const sRoles = assignedRoles !== undefined ? assignedRoles.trim() : user.assignedRoles;
        if (user.username === 'superadmin_user' && !sRoles.includes('Superadmin') && !sRoles.includes('superadmin_user')) {
            return req.error(400, 'Superadmin role cannot be removed from primary Superadmin user.');
        }

        const updateData = {
            username: sUsername,
            name: (name && name.trim()) || user.name,
            designation: designation !== undefined ? designation.trim() : user.designation,
            department: department !== undefined ? department.trim() : user.department,
            email: email !== undefined ? email.trim() : user.email,
            phoneNo: phoneNo !== undefined ? phoneNo.trim() : user.phoneNo,
            serviceStatus: serviceStatus || user.serviceStatus || 'IN_SERVICE',
            status: sStatus,
            active: (sStatus === 'ACTIVE'),
            assignedRoles: sRoles,
            remarks: remarks !== undefined ? remarks.trim() : user.remarks
        };

        if (employeeId !== undefined || req.data.employee_id !== undefined) {
            updateData.employeeId = (employeeId !== undefined ? employeeId : req.data.employee_id || '').trim();
        }

        if (password && password.trim()) {
            updateData.password = password.trim();
        }

        await UPDATE(Users).set(updateData).where({ ID: ID });

        if (assignedRoles !== undefined) {
            await DELETE.from(UserRoles).where({ user_ID: ID });
            const roleArray = sRoles.split(',').map(r => r.trim()).filter(Boolean);
            for (const rCode of roleArray) {
                await INSERT.into(UserRoles).entries({
                    ID: cds.utils.uuid(),
                    user_ID: ID,
                    roleCode: rCode,
                    roleName: ROLE_NAMES[rCode] || rCode,
                    assignedDate: new Date(),
                    assignedBy: req.user?.id || 'SUPERADMIN'
                });
            }
        }

        // Real-time auth cache update for immediate login
        if (cds.env?.requires?.auth?.users) {
            const roleArray = (sRoles !== undefined ? sRoles : (user.assignedRoles || '')).split(',').map(r => r.trim()).filter(Boolean);
            const expandedRoles = expandRoles(roleArray);
            cds.env.requires.auth.users[sUsername] = new cds.User({
                id: sUsername,
                password: updateData.password || user.password,
                roles: expandedRoles
            });
        }

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            action: 'USER_UPDATED',
            actionDateTime: new Date(),
            userId: req.user?.id || 'SUPERADMIN',
            userName: req.user?.id || 'SUPERADMIN',
            remarks: `User updated: ${sUsername} (${updateData.name}) - Status: ${sStatus}, Roles: ${sRoles}`
        });

        /*
         * Auto-sync updated user to SAP S/4HANA Cloud CBO (YY1_API_CUSTOMUSER_0001)
         */
        const s4UserId = (user.employeeId || user.username || user.ID).substring(0, 20);
        const primaryRole = (sRoles || '').split(',')[0]?.trim() || '';
        const patchPayload = {
            name: (updateData.name || '').substring(0, 50),
            designation: (updateData.designation || '').substring(0, 50),
            department: (updateData.department || '').substring(0, 50),
            email: (updateData.email || '').substring(0, 100),
            phoneNo: (updateData.phoneNo || '').substring(0, 20),
            serviceStatus: (updateData.serviceStatus || 'IN_SERVICE').substring(0, 12),
            status: (updateData.status || 'ACTIVE').substring(0, 8),
            active: updateData.active,
            assignedRoles: (updateData.assignedRoles || '').substring(0, 250),
            remarks: (updateData.remarks || '').substring(0, 250),
            roleCode: primaryRole.substring(0, 20),
            roleName: (ROLE_NAMES[primaryRole] || primaryRole).substring(0, 100)
        };
        if (updateData.password) {
            patchPayload.password = updateData.password.substring(0, 20);
        }
        await updateCustomUserInS4Hana(s4UserId, patchPayload);

        return SELECT.one.from(Users).where({ ID: ID });
    });

    this.on('ToggleUserStatus', async (req) => {
        const { ID } = req.data;
        if (!ID) {
            return req.error(400, 'User ID is mandatory.');
        }

        const user = await SELECT.one.from(Users).where({ ID: ID });
        if (!user) {
            return req.error(404, 'User not found.');
        }

        if (user.username === 'superadmin_user' && user.status === 'ACTIVE') {
            return req.error(400, 'Primary Superadmin user cannot be deactivated.');
        }

        const newStatus = (user.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
        const bActive = (newStatus === 'ACTIVE');

        await UPDATE(Users).set({
            status: newStatus,
            active: bActive
        }).where({ ID: ID });

        // Update auth cache
        if (cds.env?.requires?.auth?.users) {
            if (newStatus === 'ACTIVE') {
                const roleArray = (user.assignedRoles || '').split(',').map(r => r.trim()).filter(Boolean);
                const expandedRoles = expandRoles(roleArray);
                cds.env.requires.auth.users[user.username] = new cds.User({
                    id: user.username,
                    password: user.password,
                    roles: expandedRoles
                });
            } else {
                delete cds.env.requires.auth.users[user.username];
            }
        }

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            action: 'USER_STATUS_TOGGLED',
            actionDateTime: new Date(),
            userId: req.user?.id || 'SUPERADMIN',
            userName: req.user?.id || 'SUPERADMIN',
            remarks: `User ${user.username} status toggled to ${newStatus}`
        });

        /*
         * Auto-sync status toggle to SAP S/4HANA Cloud CBO (YY1_API_CUSTOMUSER_0001)
         */
        const s4ToggleUserId = (user.employeeId || user.username || user.ID).substring(0, 20);
        await updateCustomUserInS4Hana(s4ToggleUserId, {
            status: newStatus.substring(0, 8),
            active: bActive
        });

        return SELECT.one.from(Users).where({ ID: ID });
    });

    this.on('DeleteUser', async (req) => {
        const { ID } = req.data;
        if (!ID) {
            return req.error(400, 'User ID is mandatory.');
        }

        const user = await SELECT.one.from(Users).where({ ID: ID });
        if (!user) {
            return req.error(404, 'User not found.');
        }

        if (user.username === 'superadmin_user') {
            return req.error(400, 'Primary Superadmin user cannot be deleted.');
        }

        await DELETE.from(UserRoles).where({ user_ID: ID });
        await DELETE.from(Users).where({ ID: ID });

        // Remove from auth cache
        if (cds.env?.requires?.auth?.users) {
            delete cds.env.requires.auth.users[user.username];
        }

        await INSERT.into(GateAuditLogs).entries({
            ID: cds.utils.uuid(),
            action: 'USER_DELETED',
            actionDateTime: new Date(),
            userId: req.user?.id || 'SUPERADMIN',
            userName: req.user?.id || 'SUPERADMIN',
            remarks: `User deleted: ${user.username} (${user.name})`
        });

        /*
         * Auto-sync deletion to SAP S/4HANA Cloud CBO (YY1_API_CUSTOMUSER_0001)
         */
        const s4DeleteUserId = (user.employeeId || user.username || user.ID).substring(0, 20);
        await deleteCustomUserInS4Hana(s4DeleteUserId);

        return true;
    });



    /*
     * ============================================================
     * USER INFO / AUTH CONTEXT
     * ============================================================
     */

    this.on('userInfo', async (req) => {
        let roles = [];
        const checkRoles = [
            'Superadmin',
            'superadmin_user',
            'Admin',
            'admin_user',
            'MainGateUser',
            'maingate_user',
            'SecurityGateUser',
            'security_user',
            'WeighbridgeUser',
            'weighbridge_user',
            'FactoryGateUser',
            'factory_user',
            'Auditor',
            'audit_user',
            'auditor_user'
        ];

        if (typeof req.user?.is === 'function') {
            for (const role of checkRoles) {
                if (req.user.is(role)) {
                    roles.push(role);
                }
            }
        }

        if (Array.isArray(req.user?.roles)) {
            for (const r of req.user.roles) {
                if (checkRoles.includes(r) && !roles.includes(r)) {
                    roles.push(r);
                }
            }
        } else if (req.user?.roles && typeof req.user.roles === 'object') {
            for (const r of Object.keys(req.user.roles)) {
                if (checkRoles.includes(r) && !roles.includes(r)) {
                    roles.push(r);
                }
            }
        }

        const username = req.user?.id ? req.user.id.toLowerCase() : '';
        let userDb = null;
        let s4User = null;

        if (username) {
            try {
                userDb = await SELECT.one.from(Users).where({ username: username });
            } catch (_) {}

            try {
                const s4UserCbo = await getS4CustomUserService();
                s4User = await s4UserCbo.run(
                    SELECT.one.from(s4UserCbo.entities.CustomUser).where({ username: username })
                ) || await s4UserCbo.run(
                    SELECT.one.from(s4UserCbo.entities.CustomUser).where({ UserId: username })
                );
            } catch (_) {}

            if (roles.length === 0) {
                if (s4User) {
                    const s4Roles = (s4User.assignedRoles || s4User.roleCode || '').split(',').map(r => r.trim()).filter(Boolean);
                    roles.push(...s4Roles.filter(r => checkRoles.includes(r)));
                } else if (userDb) {
                    if (userDb.assignedRoles) {
                        const dbRoles = userDb.assignedRoles.split(',').map(r => r.trim());
                        roles.push(...dbRoles.filter(r => checkRoles.includes(r)));
                    }
                    const assigned = await SELECT.from(UserRoles).where({ user_ID: userDb.ID });
                    for (const a of assigned) {
                        if (checkRoles.includes(a.roleCode) && !roles.includes(a.roleCode)) {
                            roles.push(a.roleCode);
                        }
                    }
                }
            }
        }

        roles = expandRoles(roles);

        const primaryRole = roles[0] || (s4User?.roleCode || '');
        const fallbackName = username === 'superadmin_user' ? 'System Superadmin' :
            (username === 'maingate_user' ? 'Mahesh Verma' :
            (username === 'security_user' ? 'Vikram Rathore' :
            (username === 'weighbridge_user' ? 'Suresh Patil' :
            (username === 'factory_user' ? 'Sunil Nair' :
            (username === 'admin_user' ? 'Amit Roy' :
            (username === 'auditor_user' ? 'Pooja Hegde' : (req.user?.id || 'User')))))));

        if (!req.user?.id || req.user.id === 'anonymous' || roles.length === 0) {
            return req.reject(401, 'Invalid username or password.');
        }

        const resolvedName = s4User?.name || userDb?.name || fallbackName;
        const resolvedEmpId = s4User?.employeeId || s4User?.UserId || userDb?.employeeId || '';
        const resolvedDesignation = s4User?.designation || s4User?.roleName || userDb?.designation || ROLE_NAMES[primaryRole] || '';
        const resolvedDepartment = s4User?.department || userDb?.department || '';
        const resolvedStatus = s4User?.status || userDb?.status || 'ACTIVE';

        return {
            id: req.user.id,
            roles: roles,
            name: resolvedName,
            employeeId: resolvedEmpId,
            designation: resolvedDesignation,
            department: resolvedDepartment,
            status: resolvedStatus
        };
    });

    /*
     * ============================================================
     * LOGIN USERS FROM S/4HANA CLOUD CBO (YY1_API_CUSTOMUSER_0001)
     * ============================================================
     */

    this.on('getLoginUsers', async () => {
        let customUsers = [];

        // 1. Fetch active users directly from S/4HANA Cloud CBO
        try {
            const s4UserCbo = await getS4CustomUserService();
            const s4Data = await s4UserCbo.run(SELECT.from(s4UserCbo.entities.CustomUser));
            if (Array.isArray(s4Data) && s4Data.length > 0) {
                customUsers = s4Data.filter(u => u.active !== false && u.status !== 'INACTIVE');
            }
        } catch (err) {
            console.warn('[GateService] S/4HANA CustomUser fetch for login warning:', err.message);
        }

        cds.env.requires ??= {};
        cds.env.requires.auth ??= { kind: 'mocked', users: {} };
        const authUsers = cds.env.requires.auth.users;

        if (customUsers.length > 0) {
            return customUsers.map(u => {
                const primaryRole = u.roleCode || (u.assignedRoles || '').split(',')[0]?.trim() || 'MainGateUser';
                const roleName = u.roleName || ROLE_NAMES[primaryRole] || primaryRole;
                const rolesList = (u.assignedRoles || primaryRole).split(',').map(r => r.trim()).filter(Boolean);
                const expandedRoles = expandRoles(rolesList);
                const sUser = (u.username || u.UserId).toLowerCase();

                // Register user into in-memory auth cache for immediate login
                authUsers[sUser] = new cds.User({
                    id: sUser,
                    password: u.password || 'password',
                    roles: expandedRoles
                });

                return {
                    UserId: u.UserId || u.employeeId || u.username,
                    username: u.username || u.UserId,
                    password: u.password || 'password',
                    name: u.name || u.username,
                    employeeId: u.employeeId || '',
                    designation: u.designation || roleName,
                    department: u.department || 'Operations',
                    email: u.email || `${u.username}@apl.com`,
                    phoneNo: u.phoneNo || '',
                    roleCode: primaryRole,
                    roleName: roleName,
                    assignedRoles: u.assignedRoles || primaryRole,
                    status: u.status || 'ACTIVE',
                    active: u.active !== false,
                    serviceStatus: u.serviceStatus || 'IN_SERVICE',
                    icon: ROLE_ICONS[primaryRole] || 'sap-icon://person-placeholder',
                    roleBadgeState: ROLE_STATES[primaryRole] || 'Information',
                    assignedTab: ROLE_TABS[primaryRole] || 'OVERVIEW'
                };
            });
        }

        // 2. Fallback: Local DB active users
        try {
            const localUsers = await SELECT.from(Users).where({ status: 'ACTIVE' });
            if (localUsers.length > 0) {
                return localUsers.map(u => {
                    const primaryRole = (u.assignedRoles || '').split(',')[0]?.trim() || 'MainGateUser';
                    const roleName = ROLE_NAMES[primaryRole] || primaryRole;
                    const rolesList = (u.assignedRoles || primaryRole).split(',').map(r => r.trim()).filter(Boolean);
                    const expandedRoles = expandRoles(rolesList);
                    const sUser = u.username.toLowerCase();

                    authUsers[sUser] = new cds.User({
                        id: sUser,
                        password: u.password || 'password',
                        roles: expandedRoles
                    });

                    return {
                        UserId: u.employeeId || u.username || u.ID,
                        username: u.username,
                        password: u.password || 'password',
                        name: u.name || u.username,
                        employeeId: u.employeeId || '',
                        designation: u.designation || roleName,
                        department: u.department || 'Operations',
                        email: u.email || '',
                        phoneNo: u.phoneNo || '',
                        roleCode: primaryRole,
                        roleName: roleName,
                        assignedRoles: u.assignedRoles || primaryRole,
                        status: u.status || 'ACTIVE',
                        active: u.active !== false,
                        serviceStatus: u.serviceStatus || 'IN_SERVICE',
                        icon: ROLE_ICONS[primaryRole] || 'sap-icon://person-placeholder',
                        roleBadgeState: ROLE_STATES[primaryRole] || 'Information',
                        assignedTab: ROLE_TABS[primaryRole] || 'OVERVIEW'
                    };
                });
            }
        } catch (_) {}

        // 3. Fallback: Standard seed personas
        return [
            { UserId: 'EMP-001', username: 'maingate_user', password: 'password', name: 'Mahesh Verma', designation: 'Main Gate Operator', department: 'Main Gate Operations', roleCode: 'MainGateUser', roleName: 'Main Gate Operator', assignedRoles: 'MainGateUser', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://log-in', roleBadgeState: 'Information', assignedTab: 'MAIN_GATE' },
            { UserId: 'EMP-002', username: 'security_user', password: 'password', name: 'Vikram Rathore', designation: 'Security Gate Officer', department: 'Security & Vigilance', roleCode: 'SecurityGateUser', roleName: 'Security Gate Officer', assignedRoles: 'SecurityGateUser', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://shield', roleBadgeState: 'Warning', assignedTab: 'SECURITY_GATE' },
            { UserId: 'EMP-003', username: 'weighbridge_user', password: 'password', name: 'Suresh Patil', designation: 'Weighbridge Scale Operator', department: 'Weighment Logistics', roleCode: 'WeighbridgeUser', roleName: 'Weighbridge Scale Operator', assignedRoles: 'WeighbridgeUser', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://dimension', roleBadgeState: 'Indication04', assignedTab: 'WEIGHBRIDGE' },
            { UserId: 'EMP-004', username: 'factory_user', password: 'password', name: 'Sunil Nair', designation: 'Factory Yard Supervisor', department: 'Plant Yard Logistics', roleCode: 'FactoryGateUser', roleName: 'Factory Yard Supervisor', assignedRoles: 'FactoryGateUser', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://factory', roleBadgeState: 'Success', assignedTab: 'FACTORY_GATE' },
            { UserId: 'EMP-005', username: 'admin_user', password: 'password', name: 'Amit Roy', designation: 'Operations Administrator', department: 'Plant Administration', roleCode: 'Admin', roleName: 'Operations Administrator', assignedRoles: 'Admin', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://home', roleBadgeState: 'Information', assignedTab: 'OVERVIEW' },
            { UserId: 'EMP-000', username: 'superadmin_user', password: 'password', name: 'System Superadmin', designation: 'System Superadministrator', department: 'IT Enterprise Systems', roleCode: 'Superadmin', roleName: 'System Superadministrator', assignedRoles: 'Superadmin, Admin, MainGateUser, SecurityGateUser, WeighbridgeUser, FactoryGateUser, Auditor', status: 'ACTIVE', active: true, serviceStatus: 'IN_SERVICE', icon: 'sap-icon://user-settings', roleBadgeState: 'Indication01', assignedTab: 'OVERVIEW' }
        ];
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