sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("factory.gate.controller.Landing", {
        onInit: function () {
        },

        onOtherVehiclePress: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("launchpadPage", "slide");
            oComponent.loadOverviewData();
        },

        onKpiPress: function () {
            const oComponent = this.getOwnerComponent();
            oComponent.navigateTo("mainGateOpsPage", "slide");
            oComponent.loadOverviewData();
        }
    });
});
