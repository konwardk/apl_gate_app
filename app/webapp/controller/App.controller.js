sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("factory.gate.controller.App", {
        onInit: function () {
            const oNavContainer = this.byId("navContainer");
            this.getOwnerComponent().setNavContainer(oNavContainer);

            // Determine opening page based on authentication status
            const oModel = this.getOwnerComponent().getModel();
            const bAuth = oModel ? oModel.getProperty("/isAuthenticated") : false;

            if (bAuth) {
                this.getOwnerComponent().navigateTo("launchpadPage", "show");
            } else {
                this.getOwnerComponent().navigateTo("loginPage", "show");
            }
        },

        onHomePressed: function () {
            const oModel = this.getOwnerComponent().getModel();
            const bAuth = oModel ? oModel.getProperty("/isAuthenticated") : false;
            if (!bAuth) {
                this.getOwnerComponent().navigateTo("loginPage", "slide");
                return;
            }
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onAssignedWorkspaceNav: function () {
            const oModel = this.getOwnerComponent().getModel();
            const sAssigned = oModel ? (oModel.getProperty("/assignedScreen") || "launchpadPage") : "launchpadPage";
            this.getOwnerComponent().navigateTo(sAssigned, "slide");
        },

        onVehicleSelectionNav: function () {
            this.getOwnerComponent().navigateTo("landingPage", "slide");
        },

        onLaunchpadNav: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onUserManagementNav: function () {
            this.getOwnerComponent().navigateTo("userManagementPage", "slide");
        },

        onProfilePressed: function (oEvt) {
            const oSource = oEvt.getSource();
            this.getOwnerComponent().openUserProfilePopover(oSource);
        },

        onSignInNav: function () {
            this.getOwnerComponent().navigateTo("loginPage", "slide");
        },

        onSignOutPress: function () {
            this.getOwnerComponent().handleSignOut();
        },

        onToggleTheme: function () {
            this.getOwnerComponent().toggleTheme();
        }
    });
});
