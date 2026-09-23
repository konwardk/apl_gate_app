sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "factory/gate/model/formatter",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, formatter, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("factory.gate.controller.Operations", {
        formatter: formatter,

        onInit: function () {
            this._selectedCategoryFilter = "ALL";
            this._searchQuery = "";
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavSecurityGateOps: function () {
            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
        },

        onNavWeighbridgeOps: function () {
            this.getOwnerComponent().navigateTo("weighbridgeOpsPage", "slide");
        },

        onNavFactoryGateOps: function () {
            this.getOwnerComponent().navigateTo("factoryGateOpsPage", "slide");
        },

        onOpenGateIn: function () {
            this.getOwnerComponent().openGateInDialog();
        },

        onOpenGateOut: function () {
            this.getOwnerComponent().openGateOutDialog();
        },

        onRowGateInPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext();
            if (!oCtx) return;
            const oTx = oCtx.getObject();
            this.getOwnerComponent().openGateInSuccessDialog(oTx);
        },

        onRowGateOutPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext();
            if (!oCtx) return;
            const oTx = oCtx.getObject();
            if (oTx.status !== "SECURITY_OUT") {
                MessageBox.warning(
                    `Vehicle ${oTx.vehicleRegNo || oTx.gateInNumber} cannot be Gate OUT yet because intermediate operations are still in progress (Current Status: ${oTx.status}).\n\nMain Gate OUT exit clearance is only permitted once all operations (Security / Weighbridge / Factory) are performed completely and Security Gate OUT clearance has been recorded.`
                );
                return;
            }
            this.getOwnerComponent().openGateOutDialog(oTx);
        },

        onFilterCategoryChange: function (oEvt) {
            const sKey = oEvt.getParameter("item").getKey();
            this._selectedCategoryFilter = sKey;
            this._applyTableFilters();
        },

        onRefreshQueue: function () {
            this.getOwnerComponent().loadOverviewData().then(() => {
                this._applyTableFilters();
                MessageToast.show("Gate transactions queue refreshed");
            });
        },

        onOtherVehicleStreamPress: function () {
            MessageToast.show("Main Gate Operations active for general cargo & trucks.");
        },

        onSearchLiveChange: function (oEvt) {
            this._searchQuery = oEvt.getParameter("newValue") || "";
            this._applyTableFilters();
        },

        onSearch: function (oEvt) {
            this._searchQuery = oEvt.getParameter("query") || "";
            this._applyTableFilters();
        },

        onResetSearch: function () {
            this._searchQuery = "";
            this._selectedCategoryFilter = "ALL";
            const oSearchField = this.byId("opsSearchField");
            if (oSearchField) {
                oSearchField.setValue("");
            }
            const oSegBtn = this.byId("opsFilterSegmentedBtn");
            if (oSegBtn) {
                oSegBtn.setSelectedKey("ALL");
            }
            this._applyTableFilters();
        },

        _applyTableFilters: function () {
            const oComp = this.getOwnerComponent();
            const aRaw = oComp._rawTransactions || [];
            const sCategory = this._selectedCategoryFilter || "ALL";
            const q = (this._searchQuery || "").toLowerCase().trim();

            let aFiltered = aRaw.slice();

            // 1. Category Filter
            if (sCategory === "GATE_IN") {
                aFiltered = aFiltered.filter(t => t.status === "GATE_IN");
            } else if (sCategory === "IN_PLANT") {
                aFiltered = aFiltered.filter(t => ["SECURITY_IN", "WEIGHBRIDGE_IN", "FACTORY_IN", "FACTORY_OUT", "WEIGHBRIDGE_OUT"].includes(t.status));
            } else if (sCategory === "READY_OUT") {
                aFiltered = aFiltered.filter(t => t.status === "SECURITY_OUT");
            } else if (sCategory === "COMPLETED") {
                aFiltered = aFiltered.filter(t => t.status === "COMPLETED");
            }

            // 2. Search query filter
            if (q) {
                aFiltered = aFiltered.filter(t =>
                    (t.gateInNumber && t.gateInNumber.toLowerCase().includes(q)) ||
                    (t.vehicleRegNo && t.vehicleRegNo.toLowerCase().includes(q)) ||
                    (t.driverName && t.driverName.toLowerCase().includes(q)) ||
                    (t.purpose && t.purpose.toLowerCase().includes(q)) ||
                    (t.status && t.status.toLowerCase().includes(q)) ||
                    (t.currentStage && t.currentStage.toLowerCase().includes(q))
                );
            }

            oComp.getModel().setProperty("/transactions", aFiltered);
        },

        onTxRowPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
        },

        onTxDetailPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
        },

        onTxPrintPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().printGateInPass(oTx);
        },

        onTxEditPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().openEditGateEntryPage(oTx);
        },

        onTxDeletePress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().deleteTransaction(oTx);
        },

        onOpenFioriElementsApp: function () {
            this.getOwnerComponent().openFioriElementsApp("GateTransactions", "Gate Entries & Exits (SAP Fiori Elements)");
        }
    });
});
