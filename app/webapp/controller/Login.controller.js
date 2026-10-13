sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/library",
    "factory/gate/model/models"
], function (Controller, coreLibrary, models) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const ODATA_BASE = "/gate";

    return Controller.extend("factory.gate.controller.Login", {
        onInit: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.setProperty("/loginUsername", "");
                oModel.setProperty("/loginPassword", "");
                oModel.setProperty("/loginError", "");
                oModel.setProperty("/isLoginBusy", false);
            }
        },

        onClearError: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.setProperty("/loginError", "");
            }
            const oUserInput = this.byId("inputLoginUsername");
            const oPassInput = this.byId("inputLoginPassword");
            if (oUserInput) oUserInput.setValueState(ValueState.None);
            if (oPassInput) oPassInput.setValueState(ValueState.None);
        },

        onCredentialChange: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel && oModel.getProperty("/loginError")) {
                oModel.setProperty("/loginError", "");
            }
            const oUserInput = this.byId("inputLoginUsername");
            const oPassInput = this.byId("inputLoginPassword");
            if (oUserInput && oUserInput.getValueState() === ValueState.Error) {
                oUserInput.setValueState(ValueState.None);
            }
            if (oPassInput && oPassInput.getValueState() === ValueState.Error) {
                oPassInput.setValueState(ValueState.None);
            }
        },

        onLoginPress: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const sUser = (oModel.getProperty("/loginUsername") || "").trim();
            const sPass = (oModel.getProperty("/loginPassword") || "").trim();

            const oUserInput = this.byId("inputLoginUsername");
            const oPassInput = this.byId("inputLoginPassword");

            if (!sUser) {
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                oModel.setProperty("/loginError", "Please enter your Username / User ID.");
                return;
            }
            if (oUserInput) oUserInput.setValueState(ValueState.None);

            if (!sPass) {
                if (oPassInput) oPassInput.setValueState(ValueState.Error);
                oModel.setProperty("/loginError", "Please enter your password.");
                return;
            }
            if (oPassInput) oPassInput.setValueState(ValueState.None);

            oModel.setProperty("/loginError", "");
            oModel.setProperty("/isLoginBusy", true);
            const oBtn = this.byId("btnLoginSubmit");
            if (oBtn) oBtn.setBusy(true);

            try {
                await this.getOwnerComponent().authenticateUser(sUser, sPass);
                // Clear password field after successful sign-in
                oModel.setProperty("/loginPassword", "");
                // Redirect user to their specific role's tab on the Dashboard
                const sAssignedTab = oModel.getProperty("/assignedTab") || "OVERVIEW";
                oModel.setProperty("/selectedDashboardTab", sAssignedTab);
                this.getOwnerComponent().navigateTo("launchpadPage", "slide");
            } catch (err) {
                const sErrorMsg = err.message || "User credentials not matched.";
                oModel.setProperty("/loginError", sErrorMsg);
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                if (oPassInput) oPassInput.setValueState(ValueState.Error);
            } finally {
                oModel.setProperty("/isLoginBusy", false);
                if (oBtn) oBtn.setBusy(false);
            }
        }
    });
});
