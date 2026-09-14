sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "factory/gate/model/formatter"
], function (JSONModel, formatter) {
    "use strict";

    const userPasswords = {
        "superadmin_user": "password",
        "maingate_user": "password",
        "security_user": "password",
        "weighbridge_user": "password",
        "factory_user": "password",
        "admin_user": "password",
        "auditor_user": "password"
    };

    return {
        userPasswords: userPasswords,

        getActiveUser: function () {
            return localStorage.getItem("gate_active_user") || "superadmin_user";
        },

        getAuthHeaderValue: function (user) {
            const u = user || this.getActiveUser();
            const p = userPasswords[u] || "password";
            return "Basic " + btoa(u + ":" + p);
        },

        getPermissionsForUser: function (roles, username) {
            const aRoles = roles || [];
            const u = username || this.getActiveUser();
            const isSuper = aRoles.includes("Superadmin") || u === "superadmin_user";
            const isAdmin = aRoles.includes("Admin") || u === "admin_user";
            const isMainGate = aRoles.includes("MainGateUser") || u === "maingate_user";
            const isSecurity = aRoles.includes("SecurityGateUser") || u === "security_user";
            const isWeighbridge = aRoles.includes("WeighbridgeUser") || u === "weighbridge_user";
            const isFactory = aRoles.includes("FactoryGateUser") || u === "factory_user";
            const isAuditor = aRoles.includes("Auditor") || u === "auditor_user";

            return {
                isSuper: isSuper,
                isAdmin: isAdmin,
                isMainGate: isMainGate,
                isSecurity: isSecurity,
                isWeighbridge: isWeighbridge,
                isFactory: isFactory,
                canCreateGateIn: isSuper || isMainGate,
                canMainGateOut: isSuper || isMainGate,
                canViewLiveOps: isSuper || isMainGate || isAdmin || isSecurity || isWeighbridge || isFactory || isAuditor,
                canViewGateOps: isSuper || isAdmin || isMainGate || isSecurity || isWeighbridge || isFactory,
                canViewMainGateOps: isSuper || isAdmin || isMainGate,
                canViewSecurityGateOps: isSuper || isAdmin || isSecurity,
                canRecordWeighment: isSuper || isWeighbridge,
                canViewWeighbridgeOps: isSuper || isAdmin || isWeighbridge,
                canRecordFactoryOps: isSuper || isFactory,
                canViewFactoryGateOps: isSuper || isAdmin || isFactory,
                canViewFactoryOps: isSuper || isAdmin || isFactory,
                canViewMasterData: isSuper || isAdmin,
                canViewAuditTrail: isSuper || isAdmin || isAuditor
            };
        },

        createAppModel: function () {
            const activeUser = this.getActiveUser();
            const perms = this.getPermissionsForUser([], activeUser);
            const oModel = new JSONModel({
                activeUser: activeUser,
                userInitials: formatter.getUserInitials(activeUser),
                userAvatarColor: formatter.getUserAvatarColor(activeUser),
                isAuthenticated: true,
                userRolesText: activeUser === "superadmin_user" ? "Superadmin" : (activeUser === "maingate_user" ? "MainGateUser" : (activeUser === "security_user" ? "SecurityGateUser" : (activeUser === "weighbridge_user" ? "WeighbridgeUser" : (activeUser === "factory_user" ? "FactoryGateUser" : (activeUser === "admin_user" ? "Admin" : (activeUser === "auditor_user" ? "Auditor" : "Authenticated")))))),
                currentTheme: "sap_horizon",
                counts: {
                    TOTAL: 0,
                    ACTIVE: 0,
                    READY_OUT: 0,
                    COMPLETED: 0,
                    VEHICLES: 0,
                    DRIVERS: 0,
                    TRANSPORTERS: 0,
                    SUPPLIERS: 0,
                    AUDIT: 0
                },
                transactions: [],
                canCreateGateIn: perms.canCreateGateIn,
                canMainGateOut: perms.canMainGateOut,
                canViewLiveOps: perms.canViewLiveOps,
                canViewGateOps: perms.canViewGateOps,
                canViewMainGateOps: perms.canViewMainGateOps,
                canViewSecurityGateOps: perms.canViewSecurityGateOps,
                canRecordWeighment: perms.canRecordWeighment,
                canViewWeighbridgeOps: perms.canViewWeighbridgeOps,
                canRecordFactoryOps: perms.canRecordFactoryOps,
                canViewFactoryGateOps: perms.canViewFactoryGateOps,
                canViewFactoryOps: perms.canViewFactoryOps,
                canViewMasterData: perms.canViewMasterData,
                canViewAuditTrail: perms.canViewAuditTrail,
                canViewAudit: perms.canViewAuditTrail,
                currentFeAppTitle: "",
                currentFeAppUrl: ""
            });
            return oModel;
        }
    };
});
