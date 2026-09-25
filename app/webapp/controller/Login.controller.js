sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/library",
    "sap/m/MessageToast"
], function (Controller, coreLibrary, MessageToast) {
    "use strict";

    const ValueState = coreLibrary.ValueState;

    return Controller.extend("factory.gate.controller.Login", {
        onInit: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.setProperty("/loginError", "");
                oModel.setProperty("/isLoginBusy", false);
            }
        },

        onClearError: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.setProperty("/loginError", "");
            }
        },

        onQuickPersonaSelect: function (oEvt) {
            const oSource = oEvt.getSource();
            const sUser = oSource.data("user") || "";
            const sPass = oSource.data("pass") || "password";
            const oModel = this.getOwnerComponent().getModel();

            if (oModel) {
                oModel.setProperty("/loginUsername", sUser);
                oModel.setProperty("/loginPassword", sPass);
                oModel.setProperty("/loginError", "");
            }

            // Immediately authenticate
            this.onLoginPress();
        },

        onLoginPress: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const sUser = (oModel.getProperty("/loginUsername") || "").trim();
            const sPass = (oModel.getProperty("/loginPassword") || "").trim();

            const oUserInput = this.byId("inputLoginUsername");
            const oPassInput = this.byId("inputLoginPassword");

            if (!sUser) {
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                oModel.setProperty("/loginError", "Please enter a valid Username.");
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
                // Redirect user to the assigned Dashboard screen
                this.getOwnerComponent().navigateTo("launchpadPage", "slide");
            } catch (err) {
                oModel.setProperty("/loginError", err.message || "Authentication failed. Invalid username or password.");
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                if (oPassInput) oPassInput.setValueState(ValueState.Error);
            } finally {
                oModel.setProperty("/isLoginBusy", false);
                if (oBtn) oBtn.setBusy(false);
            }
        }
    });
});
