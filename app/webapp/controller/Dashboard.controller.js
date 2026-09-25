sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("factory.gate.controller.Dashboard", {
        onInit: function () {
            const oComponent = this.getOwnerComponent();
            const oModel = oComponent ? oComponent.getModel() : null;
            if (oModel && oModel.getProperty("/isAuthenticated")) {
                oComponent.loadOverviewData();
            }
        },

        onOpenAssignedWorkspace: function () {
            const oModel = this.getOwnerComponent().getModel();
            const sAssigned = oModel ? oModel.getProperty("/assignedScreen") : "launchpadPage";
            if (sAssigned && sAssigned !== "launchpadPage") {
                const oComponent = this.getOwnerComponent();
                oComponent.navigateTo(sAssigned, "slide");
                if (sAssigned === "mainGateOpsPage") {
                    oComponent.loadOverviewData();
                }
            }
        },

        onRefreshDashboard: async function () {
            const oComponent = this.getOwnerComponent();
            if (oComponent && oComponent.loadOverviewData) {
                try {
                    await oComponent.loadOverviewData();
                    MessageToast.show("Dashboard metrics refreshed.");
                } catch (e) {
                    console.error("Dashboard refresh error:", e);
                }
            }
        },

        onKpiPress: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oComponent = this.getOwnerComponent();
            const sAssigned = oModel ? oModel.getProperty("/assignedScreen") : null;

            if (sAssigned && sAssigned !== "launchpadPage") {
                oComponent.navigateTo(sAssigned, "slide");
                if (sAssigned === "mainGateOpsPage") {
                    oComponent.loadOverviewData();
                }
            } else if (oModel && oModel.getProperty("/canViewMainGateOps")) {
                oComponent.navigateTo("mainGateOpsPage", "slide");
                oComponent.loadOverviewData();
            } else if (oModel && oModel.getProperty("/canViewSecurityGateOps")) {
                oComponent.navigateTo("securityGateOpsPage", "slide");
            } else if (oModel && oModel.getProperty("/canViewWeighbridgeOps")) {
                oComponent.navigateTo("weighbridgeOpsPage", "slide");
            } else if (oModel && oModel.getProperty("/canViewFactoryGateOps")) {
                oComponent.navigateTo("factoryGateOpsPage", "slide");
            }
        },

        onOpenGateTxFE: function () {
            this.getOwnerComponent().openFioriElementsApp("GateTransactions", "Gate Entries & Exits (SAP Fiori Elements)");
        },

        onOpenMainGateOps: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewMainGateOps")) {
                MessageBox.error("Access Restricted: Main Gate Operations requires Main Gate Operator, Admin, or Superadmin role.");
                return;
            }
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("mainGateOpsPage", "slide");
            oComponent.loadOverviewData();
        },

        onOpenSecurityGateOps: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewSecurityGateOps")) {
                MessageBox.error("Access Restricted: Security Gate Operations requires Security Officer, Admin, or Superadmin role.");
                return;
            }
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("securityGateOpsPage", "slide");
        },

        onOpenWeighbridgeOps: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewWeighbridgeOps")) {
                MessageBox.error("Access Restricted: Weighbridge Operations requires Weighbridge Operator, Admin, or Superadmin role.");
                return;
            }
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("weighbridgeOpsPage", "slide");
        },

        onOpenFactoryGateOps: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewFactoryGateOps")) {
                MessageBox.error("Access Restricted: Factory Gate Operations requires Factory Gate Operator, Admin, or Superadmin role.");
                return;
            }
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("factoryGateOpsPage", "slide");
        },

        onOpenVehiclesFE: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewMasterData")) {
                MessageBox.error("Access Restricted: Master Data management requires Admin or Superadmin role.");
                return;
            }
            this.getOwnerComponent().openFioriElementsApp("Vehicles", "Vehicles Master (SAP Fiori Elements)");
        },

        onOpenDriversFE: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewMasterData")) {
                MessageBox.error("Access Restricted: Master Data management requires Admin or Superadmin role.");
                return;
            }
            this.getOwnerComponent().openFioriElementsApp("Drivers", "Drivers Master (SAP Fiori Elements)");
        },

        onOpenTransportersFE: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewMasterData")) {
                MessageBox.error("Access Restricted: Master Data management requires Admin or Superadmin role.");
                return;
            }
            this.getOwnerComponent().openFioriElementsApp("Transporters", "Transporters Master (SAP Fiori Elements)");
        },

        onOpenSuppliersFE: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewMasterData")) {
                MessageBox.error("Access Restricted: Master Data management requires Admin or Superadmin role.");
                return;
            }
            this.getOwnerComponent().openFioriElementsApp("Suppliers", "Suppliers Master (SAP Fiori Elements)");
        },

        onOpenAuditFE: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canViewAuditTrail")) {
                MessageBox.error("Access Restricted: Audit Trail logs require Auditor, Admin, or Superadmin role.");
                return;
            }
            this.getOwnerComponent().openFioriElementsApp("GateAuditLogs", "Gate Audit Trail Logs (SAP Fiori Elements)");
        },

        onOpenUserManagement: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel.getProperty("/canManageUsers")) {
                MessageBox.error("Access Restricted: User Management requires Superadmin role.");
                return;
            }
            this.getOwnerComponent().navigateTo("userManagementPage", "slide");
        }
    });
});
