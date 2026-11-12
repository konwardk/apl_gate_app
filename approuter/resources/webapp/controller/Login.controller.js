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

        onLoginErrorMessageStripClose: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.setProperty("/loginError", "");
            }
            const oUserInput = this.byId("idLoginUsernameInput");
            const oPassInput = this.byId("idLoginPasswordInput");
            if (oUserInput) oUserInput.setValueState(ValueState.None);
            if (oPassInput) oPassInput.setValueState(ValueState.None);
        },

        onClearError: function () {
            this.onLoginErrorMessageStripClose();
        },

        onLoginUsernameInputLiveChange: function () {
            this._clearFieldErrors();
        },

        onLoginUsernameInputSubmit: function () {
            this.onSignInToWorkspaceButtonPress();
        },

        onLoginPasswordInputLiveChange: function () {
            this._clearFieldErrors();
        },

        onLoginPasswordInputSubmit: function () {
            this.onSignInToWorkspaceButtonPress();
        },

        onCredentialChange: function () {
            this._clearFieldErrors();
        },

        _clearFieldErrors: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel && oModel.getProperty("/loginError")) {
                oModel.setProperty("/loginError", "");
            }
            const oUserInput = this.byId("idLoginUsernameInput");
            const oPassInput = this.byId("idLoginPasswordInput");
            if (oUserInput && oUserInput.getValueState() === ValueState.Error) {
                oUserInput.setValueState(ValueState.None);
            }
            if (oPassInput && oPassInput.getValueState() === ValueState.Error) {
                oPassInput.setValueState(ValueState.None);
            }
        },

        onSignInBtpButtonPress: function () {
            const oModel = this.getOwnerComponent().getModel();
            const sUser = (oModel.getProperty("/loginUsername") || "").trim();
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

            if (isLocal) {
                oModel.setProperty("/loginUsername", sUser || "superadmin_user");
                oModel.setProperty("/loginPassword", "password");
                return this.onSignInToWorkspaceButtonPress();
            }

            let sLoginUrl = "/auth/login";
            if (sUser) {
                sLoginUrl += "?login_hint=" + encodeURIComponent(sUser);
            }
            window.location.href = sLoginUrl;
        },

        onSignInToWorkspaceButtonPress: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const sUser = (oModel.getProperty("/loginUsername") || "").trim();
            const sPass = (oModel.getProperty("/loginPassword") || "").trim();
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

            const oUserInput = this.byId("idLoginUsernameInput");
            const oPassInput = this.byId("idLoginPasswordInput");

            if (!sUser) {
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                oModel.setProperty("/loginError", "Please enter your Username or BTP User ID.");
                return;
            }
            if (oUserInput) oUserInput.setValueState(ValueState.None);

            // When deployed on SAP BTP Cloud Foundry:
            // Route through XSUAA protected authentication route with user's ID pre-populated
            if (!isLocal) {
                oModel.setProperty("/loginError", "Authenticating with SAP BTP...");
                oModel.setProperty("/isLoginBusy", true);
                const oBtn = this.byId("idSignInToWorkspaceButton");
                if (oBtn) oBtn.setBusy(true);

                let sLoginUrl = "/auth/login";
                if (sUser) {
                    sLoginUrl += "?login_hint=" + encodeURIComponent(sUser);
                }
                window.location.href = sLoginUrl;
                return;
            }

            // Local development authentication with username & password
            if (!sPass) {
                if (oPassInput) oPassInput.setValueState(ValueState.Error);
                oModel.setProperty("/loginError", "Please enter your password.");
                return;
            }
            if (oPassInput) oPassInput.setValueState(ValueState.None);

            oModel.setProperty("/loginError", "");
            oModel.setProperty("/isLoginBusy", true);
            const oBtn = this.byId("idSignInToWorkspaceButton");
            if (oBtn) oBtn.setBusy(true);

            try {
                await this.getOwnerComponent().authenticateUser(sUser, sPass);
                // Clear password field after successful sign-in
                oModel.setProperty("/loginPassword", "");
                // Pre-configure assigned tab according to the user's role
                const sAssignedTab = oModel.getProperty("/assignedTab") || "OVERVIEW";
                oModel.setProperty("/selectedDashboardTab", sAssignedTab);
                // Redirect user to the Vehicle Stream selection screen
                this.getOwnerComponent().navigateTo("landingPage", "slide");
            } catch (err) {
                const sErrorMsg = err.message || "User credentials not matched.";
                oModel.setProperty("/loginError", sErrorMsg);
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                if (oPassInput) oPassInput.setValueState(ValueState.Error);
            } finally {
                oModel.setProperty("/isLoginBusy", false);
                if (oBtn) oBtn.setBusy(false);
            }
        },

        onLoginPress: async function () {
            return this.onSignInToWorkspaceButtonPress();
        }
    });
});
