sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("factory.gate.controller.App", {
        onInit: function () {
            const oNavContainer = this.byId("idAppNavContainer") || this.byId("navContainer");
            this.getOwnerComponent().setNavContainer(oNavContainer);

            // Determine opening page based on authentication status
            const oComp = this.getOwnerComponent();
            const oModel = oComp.getModel();
            const bAuth = oModel ? oModel.getProperty("/isAuthenticated") : false;

            if (bAuth) {
                oComp.navigateTo("landingPage", "show");
            } else {
                oComp.initSession().then(function (bLoggedIn) {
                    if (bLoggedIn) {
                        oComp.navigateTo("landingPage", "show");
                    } else {
                        oComp.navigateTo("loginPage", "show");
                    }
                }).catch(function () {
                    oComp.navigateTo("loginPage", "show");
                });
            }
        },

        onHomePressed: function () {
            const oModel = this.getOwnerComponent().getModel();
            const bAuth = oModel ? oModel.getProperty("/isAuthenticated") : false;
            if (!bAuth) {
                this.getOwnerComponent().navigateTo("loginPage", "slide");
                return;
            }
            this.getOwnerComponent().navigateTo("landingPage", "slide");
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
            const oModel = this.getOwnerComponent().getModel();
            const sAssignedTab = oModel ? (oModel.getProperty("/assignedTab") || "OVERVIEW") : "OVERVIEW";
            if (oModel) {
                oModel.setProperty("/selectedDashboardTab", sAssignedTab);
            }
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onUserManagementNav: function () {
            this.getOwnerComponent().navigateTo("userManagementPage", "slide");
        },

        onReportsNav: function () {
            this.getOwnerComponent().navigateTo("reportsPage", "slide");
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
