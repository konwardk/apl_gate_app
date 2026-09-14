sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("factory.gate.controller.Dashboard", {
        onInit: function () {
        },

        onKpiPress: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oComponent = this.getOwnerComponent();
            if (oModel.getProperty("/canViewMainGateOps")) {
                oComponent.navigateTo("mainGateOpsPage", "slide");
                oComponent.loadOverviewData();
            } else if (oModel.getProperty("/canViewSecurityGateOps")) {
                oComponent.navigateTo("securityGateOpsPage", "slide");
            } else if (oModel.getProperty("/canViewWeighbridgeOps")) {
                oComponent.navigateTo("weighbridgeOpsPage", "slide");
            } else if (oModel.getProperty("/canViewFactoryGateOps")) {
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
        }
    });
});
