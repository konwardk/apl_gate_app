sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("factory.gate.controller.App", {
        onInit: function () {
            // Clean up login query parameters or sub-path from URL bar if present
            if (window.location.pathname !== "/" && window.location.pathname !== "/index.html") {
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, "/" + (window.location.hash || ""));
                }
            }

            const oNavContainer = this.byId("idAppNavContainer") || this.byId("navContainer");
            this.getOwnerComponent().setNavContainer(oNavContainer);

            // Determine opening page based on authentication status
            const oComp = this.getOwnerComponent();
            const oModel = oComp.getModel();
            const bAuth = oModel ? oModel.getProperty("/isAuthenticated") : false;
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

            if (bAuth) {
                oComp.navigateTo("landingPage", "show");
            } else {
                oComp.initSession().then(function (bLoggedIn) {
                    if (bLoggedIn) {
                        oComp.navigateTo("landingPage", "show");
                    } else if (isLocal) {
                        oComp.navigateTo("loginPage", "show");
                    } else {
                        // On SAP BTP Cloud Foundry, trigger standard XSUAA login
                        window.location.replace("/index.html");
                    }
                }).catch(function () {
                    if (isLocal) {
                        oComp.navigateTo("loginPage", "show");
                    } else {
                        window.location.replace("/index.html");
                    }
                });
            }
        },

        onHomePressed: function () {
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
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            if (isLocal) {
                this.getOwnerComponent().navigateTo("loginPage", "slide");
            } else {
                window.location.replace("/index.html");
            }
        },

        onSignOutPress: function () {
            this.getOwnerComponent().handleSignOut();
        },

        onToggleTheme: function () {
            this.getOwnerComponent().toggleTheme();
        }
    });
});
