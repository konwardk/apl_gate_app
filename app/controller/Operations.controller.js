sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "factory/gate/model/formatter",
    "sap/m/MessageToast"
], function (Controller, formatter, MessageToast) {
    "use strict";

    return Controller.extend("factory.gate.controller.Operations", {
        formatter: formatter,

        onInit: function () {
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavSecurityGateOps: function () {
            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
        },

        onOpenGateIn: function () {
            this.getOwnerComponent().openGateInDialog();
        },

        onOpenGateOut: function () {
            this.getOwnerComponent().openGateOutDialog();
        },

        onOtherVehicleStreamPress: function () {
            MessageToast.show("Main Gate Operations active for general cargo & trucks.");
        },

        onSearchLiveChange: function (oEvt) {
            const sQuery = oEvt.getParameter("newValue");
            this.getOwnerComponent().filterTransactions(sQuery);
        },

        onSearch: function (oEvt) {
            const sQuery = oEvt.getParameter("query");
            this.getOwnerComponent().filterTransactions(sQuery);
        },

        onResetSearch: function () {
            const oSearchField = this.byId("opsSearchField");
            if (oSearchField) {
                oSearchField.setValue("");
            }
            this.getOwnerComponent().filterTransactions("");
        },

        onTxRowPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
        },

        onTxDetailPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext().getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
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
