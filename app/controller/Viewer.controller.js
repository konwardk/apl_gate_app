sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("factory.gate.controller.Viewer", {
        onInit: function () {
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onOpenNewTab: function () {
            const sUrl = this.getOwnerComponent().getModel().getProperty("/currentFeAppUrl");
            if (sUrl) {
                window.open(sUrl, "_blank");
            }
        },

        onReload: function () {
            this.getOwnerComponent().reloadFeFrame();
        }
    });
});
