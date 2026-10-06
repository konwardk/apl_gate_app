sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "factory/gate/model/formatter"
], function (JSONModel, formatter) {
    "use strict";

    const defaultPasswords = {
        "superadmin_user": "password",
        "maingate_user": "password",
        "security_user": "password",
        "weighbridge_user": "password",
        "factory_user": "password",
        "admin_user": "password",
        "auditor_user": "password"
    };

    const ROLE_TITLES = {
        "MainGateUser": "Main Gate Operator",
        "maingate_user": "Main Gate Operator",
        "SecurityGateUser": "Security Gate Officer",
        "security_user": "Security Gate Officer",
        "WeighbridgeUser": "Weighbridge Scale Operator",
        "weighbridge_user": "Weighbridge Scale Operator",
        "FactoryGateUser": "Factory Yard Supervisor",
        "factory_user": "Factory Yard Supervisor",
        "Admin": "Operations Administrator",
        "admin_user": "Operations Administrator",
        "Superadmin": "System Superadministrator",
        "superadmin_user": "System Superadministrator",
        "Auditor": "Compliance Auditor",
        "audit_user": "Compliance Auditor",
        "auditor_user": "Compliance Auditor"
    };

    const ROLE_ICONS = {
        "MainGateUser": "sap-icon://log-in",
        "maingate_user": "sap-icon://log-in",
        "SecurityGateUser": "sap-icon://shield",
        "security_user": "sap-icon://shield",
        "WeighbridgeUser": "sap-icon://dimension",
        "weighbridge_user": "sap-icon://dimension",
        "FactoryGateUser": "sap-icon://factory",
        "factory_user": "sap-icon://factory",
        "Admin": "sap-icon://home",
        "admin_user": "sap-icon://home",
        "Superadmin": "sap-icon://shield",
        "superadmin_user": "sap-icon://shield",
        "Auditor": "sap-icon://history",
        "audit_user": "sap-icon://history",
        "auditor_user": "sap-icon://history"
    };

    const ROLE_SCREENS = {
        "MainGateUser": { pageId: "mainGateOpsPage", title: "Main Gate Operations", icon: "sap-icon://log-in" },
        "maingate_user": { pageId: "mainGateOpsPage", title: "Main Gate Operations", icon: "sap-icon://log-in" },
        "SecurityGateUser": { pageId: "securityGateOpsPage", title: "Security Gate Operations", icon: "sap-icon://shield" },
        "security_user": { pageId: "securityGateOpsPage", title: "Security Gate Operations", icon: "sap-icon://shield" },
        "WeighbridgeUser": { pageId: "weighbridgeOpsPage", title: "Weighbridge Operations", icon: "sap-icon://dimension" },
        "weighbridge_user": { pageId: "weighbridgeOpsPage", title: "Weighbridge Operations", icon: "sap-icon://dimension" },
        "FactoryGateUser": { pageId: "factoryGateOpsPage", title: "Factory Yard Operations", icon: "sap-icon://factory" },
        "factory_user": { pageId: "factoryGateOpsPage", title: "Factory Yard Operations", icon: "sap-icon://factory" },
        "Admin": { pageId: "launchpadPage", title: "Launchpad Dashboard", icon: "sap-icon://home" },
        "admin_user": { pageId: "launchpadPage", title: "Launchpad Dashboard", icon: "sap-icon://home" },
        "Superadmin": { pageId: "launchpadPage", title: "Superadmin Dashboard", icon: "sap-icon://shield" },
        "superadmin_user": { pageId: "launchpadPage", title: "Superadmin Dashboard", icon: "sap-icon://shield" },
        "Auditor": { pageId: "launchpadPage", title: "Compliance Dashboard", icon: "sap-icon://history" },
        "audit_user": { pageId: "launchpadPage", title: "Compliance Dashboard", icon: "sap-icon://history" },
        "auditor_user": { pageId: "launchpadPage", title: "Compliance Dashboard", icon: "sap-icon://history" },
        "reportsPage": { pageId: "reportsPage", title: "Operational Reports", icon: "sap-icon://pdf-attachment" }
    };

    const ROLE_TABS = {
        "MainGateUser": "MAIN_GATE",
        "maingate_user": "MAIN_GATE",
        "SecurityGateUser": "SECURITY_GATE",
        "security_user": "SECURITY_GATE",
        "WeighbridgeUser": "WEIGHBRIDGE",
        "weighbridge_user": "WEIGHBRIDGE",
        "FactoryGateUser": "FACTORY_GATE",
        "factory_user": "FACTORY_GATE",
        "Admin": "OVERVIEW",
        "admin_user": "OVERVIEW",
        "Superadmin": "OVERVIEW",
        "superadmin_user": "OVERVIEW",
        "Auditor": "REPORTS_AUDIT",
        "audit_user": "REPORTS_AUDIT",
        "auditor_user": "REPORTS_AUDIT"
    };

    const DEFAULT_LOGIN_USERS = [
        { UserId: "EMP-001", username: "maingate_user", password: "password", name: "Mahesh Verma", designation: "Main Gate Operator", department: "Main Gate Operations", roleCode: "MainGateUser", roleName: "Main Gate Operator", assignedRoles: "MainGateUser", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://log-in", roleBadgeState: "Information", assignedTab: "MAIN_GATE" },
        { UserId: "EMP-002", username: "security_user", password: "password", name: "Vikram Rathore", designation: "Security Gate Officer", department: "Security & Vigilance", roleCode: "SecurityGateUser", roleName: "Security Gate Officer", assignedRoles: "SecurityGateUser", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://shield", roleBadgeState: "Warning", assignedTab: "SECURITY_GATE" },
        { UserId: "EMP-003", username: "weighbridge_user", password: "password", name: "Suresh Patil", designation: "Weighbridge Scale Operator", department: "Weighment Logistics", roleCode: "WeighbridgeUser", roleName: "Weighbridge Scale Operator", assignedRoles: "WeighbridgeUser", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://dimension", roleBadgeState: "Indication04", assignedTab: "WEIGHBRIDGE" },
        { UserId: "EMP-004", username: "factory_user", password: "password", name: "Sunil Nair", designation: "Factory Yard Supervisor", department: "Plant Yard Logistics", roleCode: "FactoryGateUser", roleName: "Factory Yard Supervisor", assignedRoles: "FactoryGateUser", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://factory", roleBadgeState: "Success", assignedTab: "FACTORY_GATE" },
        { UserId: "EMP-005", username: "admin_user", password: "password", name: "Amit Roy", designation: "Operations Administrator", department: "Plant Administration", roleCode: "Admin", roleName: "Operations Administrator", assignedRoles: "Admin", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://home", roleBadgeState: "Information", assignedTab: "OVERVIEW" },
        { UserId: "EMP-000", username: "superadmin_user", password: "password", name: "System Superadmin", designation: "System Superadministrator", department: "IT Enterprise Systems", roleCode: "Superadmin", roleName: "System Superadministrator", assignedRoles: "Superadmin, Admin, MainGateUser, SecurityGateUser, WeighbridgeUser, FactoryGateUser, Auditor", status: "ACTIVE", active: true, serviceStatus: "IN_SERVICE", icon: "sap-icon://user-settings", roleBadgeState: "Indication01", assignedTab: "OVERVIEW" }
    ];

    return {
        defaultPasswords: defaultPasswords,
        DEFAULT_LOGIN_USERS: DEFAULT_LOGIN_USERS,
        ROLE_TITLES: ROLE_TITLES,
        ROLE_ICONS: ROLE_ICONS,
        ROLE_SCREENS: ROLE_SCREENS,
        ROLE_TABS: ROLE_TABS,

        setPasswordForUser: function (username, password) {
            if (!username) return;
            const u = username.toLowerCase();
            this.defaultPasswords[u] = password;
            try {
                const stored = JSON.parse(localStorage.getItem("gate_user_passwords") || "{}");
                stored[u] = password;
                localStorage.setItem("gate_user_passwords", JSON.stringify(stored));
            } catch (e) {}
        },

        getPasswordForUser: function (username) {
            if (!username) return "password";
            const u = username.toLowerCase();
            try {
                const stored = JSON.parse(localStorage.getItem("gate_user_passwords") || "{}");
                if (stored[u]) return stored[u];
            } catch (e) {}
            return this.defaultPasswords[u] || "password";
        },

        getActiveUser: function () {
            return sessionStorage.getItem("gate_active_user") || localStorage.getItem("gate_active_user") || "";
        },

        getAuthHeaderValue: function () {
            return sessionStorage.getItem("gate_auth_header") || localStorage.getItem("gate_auth_header") || "";
        },

        getSavedUserInfo: function () {
            const raw = sessionStorage.getItem("gate_user_info") || localStorage.getItem("gate_user_info");
            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch (e) {}
            }
            return null;
        },

        setSession: function (userInfo, authHeader) {
            if (!userInfo) return;
            const sUsername = (userInfo.id || "").toLowerCase();
            sessionStorage.setItem("gate_active_user", sUsername);
            localStorage.setItem("gate_active_user", sUsername);

            if (authHeader) {
                sessionStorage.setItem("gate_auth_header", authHeader);
                localStorage.setItem("gate_auth_header", authHeader);
            }

            sessionStorage.setItem("gate_user_info", JSON.stringify(userInfo));
            localStorage.setItem("gate_user_info", JSON.stringify(userInfo));
        },

        clearSession: function () {
            sessionStorage.removeItem("gate_active_user");
            sessionStorage.removeItem("gate_auth_header");
            sessionStorage.removeItem("gate_user_info");
            localStorage.removeItem("gate_active_user");
            localStorage.removeItem("gate_auth_header");
            localStorage.removeItem("gate_user_info");
        },

        getPermissionsForUser: function (roles, username) {
            const aRoles = (roles || []).map(r => (r || "").trim());
            const u = (username || this.getActiveUser() || "").toLowerCase();

            const isSuper = aRoles.includes("Superadmin") || aRoles.includes("superadmin_user") || aRoles.includes("superadmin") || u === "superadmin_user";
            const isAdmin = aRoles.includes("Admin") || aRoles.includes("admin_user") || aRoles.includes("admin") || u === "admin_user";
            const isMainGate = aRoles.includes("MainGateUser") || aRoles.includes("maingate_user") || u === "maingate_user";
            const isSecurity = aRoles.includes("SecurityGateUser") || aRoles.includes("security_user") || u === "security_user";
            const isWeighbridge = aRoles.includes("WeighbridgeUser") || aRoles.includes("weighbridge_user") || u === "weighbridge_user";
            const isFactory = aRoles.includes("FactoryGateUser") || aRoles.includes("factory_user") || u === "factory_user";
            const isAuditor = aRoles.includes("Auditor") || aRoles.includes("audit_user") || aRoles.includes("auditor_user") || u === "auditor_user";

            // Determine primary role & assigned workspace screen & role dashboard tab
            let primaryRole = "Authenticated";
            let assignedScreen = "launchpadPage";
            let assignedScreenTitle = "Launchpad Dashboard";
            let assignedScreenIcon = "sap-icon://home";
            let assignedTab = "OVERVIEW";

            if (isSuper) {
                primaryRole = "Superadmin";
                assignedScreen = "launchpadPage";
                assignedScreenTitle = "Superadmin Console";
                assignedScreenIcon = "sap-icon://shield";
                assignedTab = "OVERVIEW";
            } else if (isAdmin) {
                primaryRole = "Admin";
                assignedScreen = "launchpadPage";
                assignedScreenTitle = "Operations Dashboard";
                assignedScreenIcon = "sap-icon://home";
                assignedTab = "OVERVIEW";
            } else if (isMainGate) {
                primaryRole = "MainGateUser";
                assignedScreen = "mainGateOpsPage";
                assignedScreenTitle = "Main Gate Operations";
                assignedScreenIcon = "sap-icon://log-in";
                assignedTab = "MAIN_GATE";
            } else if (isSecurity) {
                primaryRole = "SecurityGateUser";
                assignedScreen = "securityGateOpsPage";
                assignedScreenTitle = "Security Gate Operations";
                assignedScreenIcon = "sap-icon://shield";
                assignedTab = "SECURITY_GATE";
            } else if (isWeighbridge) {
                primaryRole = "WeighbridgeUser";
                assignedScreen = "weighbridgeOpsPage";
                assignedScreenTitle = "Weighbridge Operations";
                assignedScreenIcon = "sap-icon://dimension";
                assignedTab = "WEIGHBRIDGE";
            } else if (isFactory) {
                primaryRole = "FactoryGateUser";
                assignedScreen = "factoryGateOpsPage";
                assignedScreenTitle = "Factory Yard Operations";
                assignedScreenIcon = "sap-icon://factory";
                assignedTab = "FACTORY_GATE";
            } else if (isAuditor) {
                primaryRole = "Auditor";
                assignedScreen = "launchpadPage";
                assignedScreenTitle = "Compliance Dashboard";
                assignedScreenIcon = "sap-icon://history";
                assignedTab = "REPORTS_AUDIT";
            }

            return {
                isSuper: isSuper,
                isAdmin: isAdmin,
                isMainGate: isMainGate,
                isSecurity: isSecurity,
                isWeighbridge: isWeighbridge,
                isFactory: isFactory,
                isAuditor: isAuditor,
                primaryRole: primaryRole,
                primaryRoleTitle: ROLE_TITLES[primaryRole] || primaryRole,
                assignedScreen: assignedScreen,
                assignedScreenTitle: assignedScreenTitle,
                assignedScreenIcon: assignedScreenIcon,
                assignedTab: assignedTab,

                // Screen Visibility Flags
                canViewMainGateOps: isSuper || isAdmin || isMainGate,
                canViewSecurityGateOps: isSuper || isAdmin || isSecurity,
                canViewWeighbridgeOps: isSuper || isAdmin || isWeighbridge,
                canViewFactoryGateOps: isSuper || isAdmin || isFactory,
                canViewMasterData: isSuper || isAdmin,
                canViewAuditTrail: isSuper || isAdmin || isAuditor,
                canManageUsers: isSuper,
                canViewReports: isSuper || isAdmin,
                canViewLiveOps: isSuper || isMainGate || isAdmin || isSecurity || isWeighbridge || isFactory || isAuditor,
                canViewGateOps: isSuper || isAdmin || isMainGate || isSecurity || isWeighbridge || isFactory,

                // Action Authorization Flags
                canCreateGateIn: isSuper || isAdmin || isMainGate,
                canMainGateOut: isSuper || isAdmin || isMainGate,
                canRecordWeighment: isSuper || isAdmin || isWeighbridge,
                canRecordFactoryOps: isSuper || isAdmin || isFactory
            };
        },

        createAppModel: function () {
            const savedInfo = this.getSavedUserInfo();
            const activeUser = savedInfo ? savedInfo.id : this.getActiveUser();
            const savedRoles = savedInfo ? (savedInfo.roles || []) : [];
            const bAuth = !!(activeUser && this.getAuthHeaderValue());
            const perms = bAuth ? this.getPermissionsForUser(savedRoles, activeUser) : this.getPermissionsForUser([], "");

            const oModel = new JSONModel({
                activeUser: activeUser,
                userName: savedInfo?.name || activeUser || "",
                userEmployeeId: savedInfo?.employeeId || "",
                userDesignation: savedInfo?.designation || perms.primaryRoleTitle || "",
                userDepartment: savedInfo?.department || "",
                userRoles: savedRoles,
                userInitials: activeUser ? formatter.getUserInitials(savedInfo?.name || activeUser) : "?",
                userAvatarColor: activeUser ? formatter.getUserAvatarColor(activeUser) : "Accent1",
                isAuthenticated: bAuth,
                userRolesText: savedRoles.length ? savedRoles.map(r => ROLE_TITLES[r] || r).join(", ") : (bAuth ? perms.primaryRoleTitle : "Not Authenticated"),
                userPrimaryRoleTitle: perms.primaryRoleTitle,
                assignedScreen: perms.assignedScreen,
                assignedScreenTitle: perms.assignedScreenTitle,
                assignedScreenIcon: perms.assignedScreenIcon,
                assignedTab: perms.assignedTab,
                selectedDashboardTab: perms.assignedTab || "OVERVIEW",
                currentTheme: "sap_horizon",
                loginUsername: "",
                loginPassword: "",
                loginError: "",
                isLoginBusy: false,
                loginUsers: DEFAULT_LOGIN_USERS.slice(),
                isUsersLoading: false,
                counts: {
                    TOTAL: 0,
                    ACTIVE: 0,
                    GATE_IN: 0,
                    READY_OUT: 0,
                    COMPLETED: 0,
                    MAIN_GATE: 0,
                    SECURITY_GATE: 0,
                    SECURITY_AWAITING_IN: 0,
                    SECURITY_IN_PLANT: 0,
                    SECURITY_AWAITING_OUT: 0,
                    SECURITY_CLEARED: 0,
                    WEIGHBRIDGE: 0,
                    WEIGHBRIDGE_AWAITING_IN: 0,
                    WEIGHBRIDGE_INSIDE_YARD: 0,
                    WEIGHBRIDGE_AWAITING_OUT: 0,
                    WEIGHBRIDGE_COMPLETED: 0,
                    FACTORY_GATE: 0,
                    FACTORY_AWAITING_IN: 0,
                    FACTORY_ACTIVE: 0,
                    FACTORY_DONE: 0,
                    IN_PLANT: 0,
                    VEHICLES: 0,
                    DRIVERS: 0,
                    TRANSPORTERS: 0,
                    SUPPLIERS: 0,
                    MASTER_DATA: 0,
                    AUDIT: 0,
                    USERS: 0
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
                canViewFactoryOps: perms.canViewFactoryGateOps,
                canViewMasterData: perms.canViewMasterData,
                canViewAuditTrail: perms.canViewAuditTrail,
                canViewAudit: perms.canViewAuditTrail,
                canManageUsers: perms.canManageUsers,
                canViewReports: perms.canViewReports,
                currentFeAppTitle: "",
                currentFeAppUrl: ""
            });
            return oModel;
        }
    };
});
