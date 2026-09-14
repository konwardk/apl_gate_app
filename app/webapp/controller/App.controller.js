sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("factory.gate.controller.App", {
        onInit: function () {
            const oNavContainer = this.byId("navContainer");
            this.getOwnerComponent().setNavContainer(oNavContainer);
            const oLandingPage = this.byId("landingPage");
            if (oNavContainer && oLandingPage) {
                oNavContainer.to(oLandingPage);
            }
        },

        onHomePressed: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onVehicleSelectionNav: function () {
            this.getOwnerComponent().navigateTo("landingPage", "slide");
        },

        onLaunchpadNav: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onGateInPress: function () {
            this.getOwnerComponent().openGateInDialog();
        },

        onGateOutPress: function () {
            this.getOwnerComponent().openGateOutDialog();
        },

        onPersonaChange: function (oEvt) {
            const sKey = oEvt.getParameter("selectedItem").getKey();
            this.getOwnerComponent().handlePersonaChange(sKey);
        },

        onProfilePressed: function (oEvt) {
            const oSource = oEvt.getSource();
            this.getOwnerComponent().openUserProfilePopover(oSource);
        },

        onSignInPress: function (oEvt) {
            const oSource = oEvt.getSource();
            this.getOwnerComponent().openUserProfilePopover(oSource);
        },

        onToggleTheme: function () {
            this.getOwnerComponent().toggleTheme();
        },

        onRefreshPress: function () {
            this.getOwnerComponent().loadOverviewData();
        }
    });
});
