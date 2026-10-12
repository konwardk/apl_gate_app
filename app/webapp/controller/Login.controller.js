sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/library",
    "sap/m/MessageToast",
    "factory/gate/model/models"
], function (Controller, coreLibrary, MessageToast, models) {
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
            this.loadLoginUsers();
        },

        loadLoginUsers: async function (bShowToast) {
            const oModel = this.getOwnerComponent().getModel();
            if (!oModel) return;

            try {
                oModel.setProperty("/isUsersLoading", true);
                const res = await fetch(`${ODATA_BASE}/getLoginUsers()`, {
                    headers: { "Content-Type": "application/json" }
                });

                if (res.ok) {
                    const data = await res.json();
                    const aUsers = data.value || [];
                    if (Array.isArray(aUsers) && aUsers.length > 0) {
                        oModel.setProperty("/loginUsers", aUsers);

                        // Cache passwords for instant one-click login if present
                        aUsers.forEach(u => {
                            if (u.username && u.password) {
                                models.setPasswordForUser(u.username, u.password);
                            }
                        });

                        if (bShowToast) {
                            MessageToast.show(`Loaded ${aUsers.length} users from SAP S/4HANA Cloud (YY1_API_CUSTOMUSER_0001)`);
                        }
                        return;
                    }
                }
            } catch (err) {
                console.warn("[LoginController] Could not load users from S/4HANA Cloud CBO:", err);
            } finally {
                oModel.setProperty("/isUsersLoading", false);
            }
        },

        onRefreshUsers: function () {
            this.loadLoginUsers(true);
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

        onQuickPersonaSelect: function (oEvt) {
            const oSource = oEvt.getSource();
            const oCtx = oSource.getBindingContext();
            const oModel = this.getOwnerComponent().getModel();
            let sUser = "";
            let sPass = "";

            if (oCtx) {
                const uObj = oCtx.getObject();
                sUser = uObj.username || uObj.UserId || "";
                sPass = uObj.password || models.getPasswordForUser(sUser) || "password";
            } else {
                sUser = oSource.data("user") || "";
                sPass = oSource.data("pass") || models.getPasswordForUser(sUser) || "password";
            }

            if (oModel) {
                oModel.setProperty("/loginUsername", sUser);
                oModel.setProperty("/loginPassword", sPass);
                oModel.setProperty("/loginError", "");
            }

            const oUserInput = this.byId("inputLoginUsername");
            const oPassInput = this.byId("inputLoginPassword");
            if (oUserInput) oUserInput.setValueState(ValueState.None);
            if (oPassInput) oPassInput.setValueState(ValueState.None);

            if (sPass) {
                // If password exists, authenticate directly
                this.onLoginPress();
            } else if (oPassInput) {
                oPassInput.focus();
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
