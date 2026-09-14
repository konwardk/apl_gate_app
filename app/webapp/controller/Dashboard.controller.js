sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("factory.gate.controller.Dashboard", {
        onInit: function () {
        },

        onKpiPress: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("mainGateOpsPage", "slide");
            oComponent.loadOverviewData();
        },

        onOpenGateTxFE: function () {
            this.getOwnerComponent().openFioriElementsApp("GateTransactions", "Gate Entries & Exits (SAP Fiori Elements)");
        },

        onOpenMainGateOps: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("mainGateOpsPage", "slide");
            oComponent.loadOverviewData();
        },

        onOpenSecurityGateOps: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("securityGateOpsPage", "slide");
        },

        onOpenWeighbridgeOps: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("weighbridgeOpsPage", "slide");
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
        }
    });
});
