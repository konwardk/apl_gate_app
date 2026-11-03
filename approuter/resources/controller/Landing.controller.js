sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/library",
    "sap/m/MessageToast"
], function (Controller, mobileLibrary, MessageToast) {
    "use strict";

    const URLHelper = mobileLibrary.URLHelper;

    return Controller.extend("factory.gate.controller.Landing", {
        onInit: function () {
        },

        onTankerTilePress: function () {
            const sUrl = "https://my443555-api.s4hana.cloud.sap/sap/bc/ui5_ui5/sap/ztanker_v1/index.html";
            MessageToast.show("Redirecting to Tanker Management System...");
            if (URLHelper && URLHelper.redirect) {
                URLHelper.redirect(sUrl, true);
            } else {
                window.open(sUrl, "_blank");
            }
        },

        onOtherVehiclePress: function () {
            const oComponent = this.getOwnerComponent();
            const oModel = oComponent ? oComponent.getModel() : null;
            const sAssignedTab = oModel ? (oModel.getProperty("/assignedTab") || "OVERVIEW") : "OVERVIEW";
            if (oModel) {
                oModel.setProperty("/selectedDashboardTab", sAssignedTab);
                oModel.setProperty("/selectedVehicleStream", "OTHER VEHICLE");
            }
            oComponent.navigateTo("launchpadPage", "slide");
            oComponent.loadOverviewData();
        },

        onKpiPress: function () {
            const oComponent = this.getOwnerComponent();
            const oModel = oComponent ? oComponent.getModel() : null;
            const sAssignedTab = oModel ? (oModel.getProperty("/assignedTab") || "OVERVIEW") : "OVERVIEW";
            if (oModel) {
                oModel.setProperty("/selectedDashboardTab", sAssignedTab);
            }
            oComponent.navigateTo("launchpadPage", "slide");
            oComponent.loadOverviewData();
        }
    });
});
