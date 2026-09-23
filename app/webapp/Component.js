sap.ui.define([
    "sap/ui/core/UIComponent",
    "factory/gate/model/models",
    "factory/gate/model/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library"
], function (UIComponent, models, formatter, Fragment, JSONModel, MessageToast, MessageBox, coreLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;

    const ODATA_BASE = "/gate";
    const FIORI_PREVIEW_BASE = "/$fiori-preview/GateService";

    return UIComponent.extend("factory.gate.Component", {
        metadata: {
            manifest: "json"
        },

        formatter: formatter,

        init: function () {
            // Call base init
            UIComponent.prototype.init.apply(this, arguments);

            this._rawTransactions = [];
            this._selectedPurpose = "DELIVERY";

            // Initialize app data model
            const oModel = models.createAppModel();
            this.setModel(oModel);

            // Initial load of overview data
            this.loadOverviewData();
        },

        setNavContainer: function (oNavContainer) {
            this._oNavContainer = oNavContainer;
        },

        getNavContainer: function () {
            return this._oNavContainer;
        },

        navigateTo: function (sPageId, sTransition) {
            if (this._oNavContainer) {
                const aPages = this._oNavContainer.getPages();
                const oTarget = aPages.find(function (p) {
                    return p.getId().endsWith(sPageId);
                });
                if (oTarget) {
                    this._oNavContainer.to(oTarget, sTransition || "slide");
                    const oCtrl = oTarget.getController && oTarget.getController();
                    if (sPageId === "securityGateOpsPage" && oCtrl && oCtrl.loadSecurityData) {
                        oCtrl.loadSecurityData();
                    } else if (sPageId === "weighbridgeOpsPage" && oCtrl && oCtrl.loadScaleQueue) {
                        oCtrl.loadScaleQueue();
                    } else if (sPageId === "factoryGateOpsPage" && oCtrl && oCtrl.loadFactoryData) {
                        oCtrl.loadFactoryData();
                    } else if (sPageId === "userManagementPage" && oCtrl && oCtrl.loadUsersData) {
                        oCtrl.loadUsersData();
                    }
                } else {
                    this._oNavContainer.to(sPageId, sTransition || "slide");
                }
            }
        },

        openFactoryOperationsFor: function (gateInNumber) {
            this.navigateTo("factoryGateOpsPage", "slide");
            const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
            const oFacPage = aPages.find(function (p) {
                return p.getId().endsWith("factoryGateOpsPage");
            });
            if (oFacPage && oFacPage.getController) {
                const oCtrl = oFacPage.getController();
                if (oCtrl && oCtrl.loadVehicleByGateInNumber) {
                    oCtrl.loadVehicleByGateInNumber(gateInNumber);
                } else if (oCtrl && oCtrl.loadFactoryData) {
                    oCtrl.loadFactoryData().then(function () {
                        if (oCtrl._selectVehicleByGateInNumber) {
                            oCtrl._selectVehicleByGateInNumber(gateInNumber);
                        }
                    });
                }
            }
        },

        // ============================================================
        // Fiori Elements App Navigation & Viewer
        // ============================================================
        openFioriElementsApp: function (entityName, appTitle) {
            let previewUrl;
            if (entityName === "GateTransactions") {
                previewUrl = "/gate-entry/webapp/index.html#preview-app";
            } else {
                previewUrl = `${FIORI_PREVIEW_BASE}/${entityName}#preview-app`;
            }
            const oModel = this.getModel();
            oModel.setProperty("/currentFeAppTitle", appTitle);
            oModel.setProperty("/currentFeAppUrl", previewUrl);

            this.navigateTo("feViewerPage", "fade");

            setTimeout(function () {
                const iframe = document.getElementById("fioriAppIframe");
                if (iframe) {
                    iframe.src = previewUrl;
                }
            }, 60);
        },

        reloadFeFrame: function () {
            const iframe = document.getElementById("fioriAppIframe");
            const url = this.getModel().getProperty("/currentFeAppUrl");
            if (iframe && url) {
                iframe.src = url;
                MessageToast.show("Reloading Fiori Elements application...");
            }
        },

        // ============================================================
        // Quick Search Filter for Transactions Table
        // ============================================================
        filterTransactions: function (query) {
            const q = (query || "").toLowerCase().trim();
            const oModel = this.getModel();
            if (!q) {
                oModel.setProperty("/transactions", this._rawTransactions);
                return;
            }
            const filtered = this._rawTransactions.filter(function (t) {
                return (t.gateInNumber && t.gateInNumber.toLowerCase().includes(q)) ||
                       (t.vehicleRegNo && t.vehicleRegNo.toLowerCase().includes(q)) ||
                       (t.driverName && t.driverName.toLowerCase().includes(q)) ||
                       (t.purpose && t.purpose.toLowerCase().includes(q)) ||
                       (t.status && t.status.toLowerCase().includes(q));
            });
            oModel.setProperty("/transactions", filtered);
        },

        // ============================================================
        // Data Loading & Role Check
        // ============================================================
        loadOverviewData: async function () {
            const oModel = this.getModel();
            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                // 1. Fetch User Info & RBAC Roles
                let currentRoles = [];
                try {
                    const resUser = await fetch(`${ODATA_BASE}/userInfo()`, { headers });
                    if (resUser.ok) {
                        const info = await resUser.json();
                        currentRoles = info.roles || [];
                    }
                } catch (e) {
                    console.warn("User info fetch failed:", e);
                }

                const activeUser = oModel.getProperty("/activeUser");
                const perms = models.getPermissionsForUser(currentRoles, activeUser);

                const sRoleText = currentRoles.length ? currentRoles.join(", ") : 
                    (activeUser === "superadmin_user" ? "Superadmin" : 
                    (activeUser === "maingate_user" ? "MainGateUser" : 
                    (activeUser === "security_user" ? "SecurityGateUser" : 
                    (activeUser === "weighbridge_user" ? "WeighbridgeUser" : 
                    (activeUser === "factory_user" ? "FactoryGateUser" : 
                    (activeUser === "admin_user" ? "Admin" : 
                    (activeUser === "auditor_user" ? "Auditor" : "Authenticated")))))));
                oModel.setProperty("/userRolesText", sRoleText);
                oModel.setProperty("/canCreateGateIn", perms.canCreateGateIn);
                oModel.setProperty("/canMainGateOut", perms.canMainGateOut);
                oModel.setProperty("/canViewLiveOps", perms.canViewLiveOps);
                oModel.setProperty("/canViewGateOps", perms.canViewGateOps);
                oModel.setProperty("/canViewMainGateOps", perms.canViewMainGateOps);
                oModel.setProperty("/canViewSecurityGateOps", perms.canViewSecurityGateOps);
                oModel.setProperty("/canRecordWeighment", perms.canRecordWeighment);
                oModel.setProperty("/canViewWeighbridgeOps", perms.canViewWeighbridgeOps);
                oModel.setProperty("/canRecordFactoryOps", perms.canRecordFactoryOps);
                oModel.setProperty("/canViewFactoryGateOps", perms.canViewFactoryGateOps);
                oModel.setProperty("/canViewFactoryOps", perms.canViewFactoryOps);
                oModel.setProperty("/canViewMasterData", perms.canViewMasterData);
                oModel.setProperty("/canViewAuditTrail", perms.canViewAuditTrail);
                oModel.setProperty("/canViewAudit", perms.canViewAuditTrail);
                oModel.setProperty("/canManageUsers", perms.canManageUsers);

                // 2. Fetch Transactions
                const resTx = await fetch(`${ODATA_BASE}/GateTransactions?$orderby=createdAt desc`, { headers });
                if (resTx.ok) {
                    const txData = await resTx.json();
                    this._rawTransactions = txData.value || [];
                    oModel.setProperty("/transactions", this._rawTransactions);

                    const counts = {
                        TOTAL: this._rawTransactions.length,
                        GATE_IN: 0,
                        IN_PLANT: 0,
                        ACTIVE: 0,
                        READY_OUT: 0,
                        COMPLETED: 0
                    };

                    this._rawTransactions.forEach(function (tx) {
                        if (tx.status === "COMPLETED") {
                            counts.COMPLETED++;
                        } else if (tx.status === "SECURITY_OUT") {
                            counts.READY_OUT++;
                            counts.ACTIVE++;
                        } else if (tx.status === "GATE_IN") {
                            counts.GATE_IN++;
                            counts.ACTIVE++;
                        } else if (["SECURITY_IN", "WEIGHBRIDGE_IN", "FACTORY_IN", "FACTORY_OUT", "WEIGHBRIDGE_OUT"].includes(tx.status)) {
                            counts.IN_PLANT++;
                            counts.ACTIVE++;
                        } else if (tx.status !== "CANCELLED") {
                            counts.ACTIVE++;
                        }
                    });
                    oModel.setProperty("/counts", counts);
                }
            } catch (err) {
                console.error("Error loading overview data:", err);
            }
        },

        // ============================================================
        // Persona Switcher & Authentication Handlers
        // ============================================================
        handlePersonaChange: function (newKey) {
            const oModel = this.getModel();
            localStorage.setItem("gate_active_user", newKey);
            oModel.setProperty("/activeUser", newKey);
            oModel.setProperty("/userInitials", formatter.getUserInitials(newKey));
            oModel.setProperty("/userAvatarColor", formatter.getUserAvatarColor(newKey));
            oModel.setProperty("/isAuthenticated", true);

            MessageToast.show("Authenticated as: " + newKey);

            // Optimistic permissions update for instant UI feedback
            const perms = models.getPermissionsForUser([], newKey);
            oModel.setProperty("/canCreateGateIn", perms.canCreateGateIn);
            oModel.setProperty("/canMainGateOut", perms.canMainGateOut);
            oModel.setProperty("/canViewLiveOps", perms.canViewLiveOps);
            oModel.setProperty("/canViewGateOps", perms.canViewGateOps);
            oModel.setProperty("/canViewMainGateOps", perms.canViewMainGateOps);
            oModel.setProperty("/canViewSecurityGateOps", perms.canViewSecurityGateOps);
            oModel.setProperty("/canRecordWeighment", perms.canRecordWeighment);
            oModel.setProperty("/canViewWeighbridgeOps", perms.canViewWeighbridgeOps);
            oModel.setProperty("/canRecordFactoryOps", perms.canRecordFactoryOps);
            oModel.setProperty("/canViewFactoryGateOps", perms.canViewFactoryGateOps);
            oModel.setProperty("/canViewFactoryOps", perms.canViewFactoryOps);
            oModel.setProperty("/canViewMasterData", perms.canViewMasterData);
            oModel.setProperty("/canViewAuditTrail", perms.canViewAuditTrail);
            oModel.setProperty("/canViewAudit", perms.canViewAuditTrail);
            oModel.setProperty("/canManageUsers", perms.canManageUsers);

            this.loadOverviewData();

            // Automatic role-based view navigation
            if (newKey === "weighbridge_user") {
                this.navigateTo("weighbridgeOpsPage", "slide");
                const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
                const oWbPage = aPages.find(p => p.getId().endsWith("weighbridgeOpsPage"));
                if (oWbPage && oWbPage.getController && oWbPage.getController().loadWeighbridgeData) {
                    oWbPage.getController().loadWeighbridgeData();
                }
            } else if (newKey === "security_user") {
                this.navigateTo("securityGateOpsPage", "slide");
                const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
                const oSecPage = aPages.find(p => p.getId().endsWith("securityGateOpsPage"));
                if (oSecPage && oSecPage.getController && oSecPage.getController().loadSecurityData) {
                    oSecPage.getController().loadSecurityData();
                }
            } else if (newKey === "factory_user") {
                this.navigateTo("factoryGateOpsPage", "slide");
                const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
                const oFacPage = aPages.find(p => p.getId().endsWith("factoryGateOpsPage"));
                if (oFacPage && oFacPage.getController && oFacPage.getController().loadFactoryData) {
                    oFacPage.getController().loadFactoryData();
                }
            } else if (newKey === "maingate_user") {
                this.navigateTo("mainGateOpsPage", "slide");
            }

            // If inside Fiori Elements viewer, reload frame
            if (this._oNavContainer) {
                const oCurrentPage = this._oNavContainer.getCurrentPage();
                if (oCurrentPage && oCurrentPage.getId().includes("feViewerPage")) {
                    this.reloadFeFrame();
                }
            }
        },

        toggleTheme: function () {
            const oModel = this.getModel();
            const current = oModel.getProperty("/currentTheme");
            const next = current === "sap_horizon" ? "sap_horizon_dark" : "sap_horizon";
            sap.ui.getCore().applyTheme(next);
            oModel.setProperty("/currentTheme", next);
            MessageToast.show("Theme changed to: " + (next === "sap_horizon" ? "Morning Horizon (Light)" : "Evening Horizon (Dark)"));
        },

        handleSignOut: function () {
            const oModel = this.getModel();
            localStorage.removeItem("gate_active_user");
            oModel.setProperty("/activeUser", "Signed Out");
            oModel.setProperty("/userInitials", "??");
            oModel.setProperty("/userAvatarColor", "Accent1");
            oModel.setProperty("/userRolesText", "None");
            oModel.setProperty("/isAuthenticated", false);
            oModel.setProperty("/canCreateGateIn", false);
            oModel.setProperty("/canMainGateOut", false);
            oModel.setProperty("/canViewLiveOps", false);
            oModel.setProperty("/canViewGateOps", false);
            oModel.setProperty("/canViewMainGateOps", false);
            oModel.setProperty("/canViewSecurityGateOps", false);
            oModel.setProperty("/canRecordWeighment", false);
            oModel.setProperty("/canViewWeighbridgeOps", false);
            oModel.setProperty("/canRecordFactoryOps", false);
            oModel.setProperty("/canViewFactoryGateOps", false);
            oModel.setProperty("/canViewFactoryOps", false);
            oModel.setProperty("/canViewMasterData", false);
            oModel.setProperty("/canViewAuditTrail", false);
            oModel.setProperty("/canViewAudit", false);
            oModel.setProperty("/transactions", []);
            oModel.setProperty("/counts", { TOTAL: 0, ACTIVE: 0, READY_OUT: 0, COMPLETED: 0 });

            MessageToast.show("You have signed out.");
            this.openSignInDialog();
        },

        // ============================================================
        // Dialog: User Profile Popover
        // ============================================================
        openUserProfilePopover: function (oSource) {
            const sId = this.createId("profilePopoverFrag");
            if (!this._pProfilePopover) {
                this._pProfilePopover = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.UserProfilePopover",
                    controller: this
                }).then(function (oPopover) {
                    this.getRootControl().addDependent(oPopover);
                    return oPopover;
                }.bind(this));
            }
            this._pProfilePopover.then(function (oPopover) {
                oPopover.openBy(oSource);
            });
        },

        onSwitchUserPress: function () {
            if (this._pProfilePopover) {
                this._pProfilePopover.then(oPopover => oPopover.close());
            }
            this.openSignInDialog();
        },

        onSignOutPress: function () {
            if (this._pProfilePopover) {
                this._pProfilePopover.then(oPopover => oPopover.close());
            }
            this.handleSignOut();
        },

        // ============================================================
        // Dialog: Sign In
        // ============================================================
        openSignInDialog: function () {
            const sId = this.createId("signInFrag");
            if (!this._pSignInDialog) {
                this._pSignInDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.SignInDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }
            this._pSignInDialog.then(function (oDialog) {
                const sActive = models.getActiveUser();
                const oUserInput = Fragment.byId(sId, "signInUsername");
                const oPassInput = Fragment.byId(sId, "signInPassword");
                if (oUserInput) oUserInput.setValue(sActive);
                if (oPassInput) oPassInput.setValue(models.userPasswords[sActive] || "password");
                oDialog.open();
            });
        },

        onSelectQuickPersona: function (oEvt) {
            const sId = this.createId("signInFrag");
            const sUser = oEvt.getSource().data("user");
            const sPass = models.userPasswords[sUser] || "password";
            const oUserInput = Fragment.byId(sId, "signInUsername");
            const oPassInput = Fragment.byId(sId, "signInPassword");
            if (oUserInput) oUserInput.setValue(sUser);
            if (oPassInput) oPassInput.setValue(sPass);
        },

        onSignInConfirm: async function () {
            const sId = this.createId("signInFrag");
            const oUserInput = Fragment.byId(sId, "signInUsername");
            const oPassInput = Fragment.byId(sId, "signInPassword");
            const u = oUserInput ? oUserInput.getValue().trim() : "";
            const p = oPassInput ? oPassInput.getValue().trim() : "";

            if (!u) {
                if (oUserInput) oUserInput.setValueState(ValueState.Error);
                return MessageToast.show("Username is required");
            }
            if (oUserInput) oUserInput.setValueState(ValueState.None);

            const oDialog = await this._pSignInDialog;
            try {
                oDialog.setBusy(true);
                const testHeader = "Basic " + btoa(u + ":" + p);
                const res = await fetch(`${ODATA_BASE}/userInfo()`, {
                    headers: { "Authorization": testHeader }
                });

                if (!res.ok) {
                    throw new Error("Authentication failed: Invalid credentials or unauthorized user.");
                }

                const info = await res.json();
                models.userPasswords[u] = p;
                this.handlePersonaChange(u);
                oDialog.close();
                MessageToast.show(`Welcome, ${u}! Authenticated with roles: ${(info.roles || []).join(", ")}`);
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                oDialog.setBusy(false);
            }
        },

        onSignInCancel: function () {
            if (this._pSignInDialog) {
                this._pSignInDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // Dialog: Gate IN
        // ============================================================
        openGateInDialog: function () {
            const sId = this.createId("gateInFrag");
            this._selectedPurpose = "DELIVERY";

            if (!this._pGateInDialog) {
                this._pGateInDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.GateInDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateInDialog.then(function (oDialog) {
                const oReg = Fragment.byId(sId, "inputVehicleRegNo");
                const oType = Fragment.byId(sId, "selectVehicleType");
                const oDriver = Fragment.byId(sId, "inputDriverName");
                const oDel = Fragment.byId(sId, "cbDelivery");
                const oPick = Fragment.byId(sId, "cbPickup");
                if (oReg) {
                    oReg.setValue("");
                    oReg.setValueState(ValueState.None);
                    oReg.setValueStateText("");
                }
                if (oType) {
                    oType.setSelectedKey("TRUCK");
                }
                if (oDriver) {
                    oDriver.setValue("");
                    oDriver.setValueState(ValueState.None);
                    oDriver.setValueStateText("");
                }
                if (oDel) oDel.setSelected(true);
                if (oPick) oPick.setSelected(false);
                oDialog.open();
            });
        },

        _validateVehicleRegNo: function (oInput, sVal) {
            if (!oInput) return false;
            if (!sVal) {
                oInput.setValueState(ValueState.None);
                oInput.setValueStateText("");
                return false;
            }
            // Format: AS-02-(Optional Series)-1234, e.g. AS-02-1234 or AS-02-AB-1234
            const regex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
            if (!regex.test(sVal)) {
                oInput.setValueState(ValueState.Error);
                oInput.setValueStateText("Invalid vehicle registration format. Expected: AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-9999)");
                return false;
            }
            oInput.setValueState(ValueState.Success);
            oInput.setValueStateText("");
            return true;
        },

        onVehicleRegLiveChange: function (oEvt) {
            const oInput = oEvt.getSource();
            let sVal = (oEvt.getParameter("value") || "").trim().toUpperCase();
            oInput.setValue(sVal);
            this._validateVehicleRegNo(oInput, sVal);
        },

        onVehicleRegChange: function (oEvt) {
            const oInput = oEvt.getSource();
            let sVal = (oInput.getValue() || "").trim().toUpperCase();
            oInput.setValue(sVal);
            this._validateVehicleRegNo(oInput, sVal);
        },

        onDeliveryCheck: function (oEvt) {
            const sId = this.createId("gateInFrag");
            const oPick = Fragment.byId(sId, "cbPickup");
            if (oEvt.getParameter("selected")) {
                if (oPick) oPick.setSelected(false);
                this._selectedPurpose = "DELIVERY";
            } else if (oPick && !oPick.getSelected()) {
                this._selectedPurpose = "";
            }
        },

        onPickupCheck: function (oEvt) {
            const sId = this.createId("gateInFrag");
            const oDel = Fragment.byId(sId, "cbDelivery");
            if (oEvt.getParameter("selected")) {
                if (oDel) oDel.setSelected(false);
                this._selectedPurpose = "PICKUP";
            } else if (oDel && !oDel.getSelected()) {
                this._selectedPurpose = "";
            }
        },

        onGateInConfirm: async function () {
            const sId = this.createId("gateInFrag");
            const oReg = Fragment.byId(sId, "inputVehicleRegNo");
            const oType = Fragment.byId(sId, "selectVehicleType");
            const oDriver = Fragment.byId(sId, "inputDriverName");
            const regNo = oReg ? oReg.getValue().trim().toUpperCase() : "";
            const vehicleType = oType ? oType.getSelectedKey() || "TRUCK" : "TRUCK";
            const driver = oDriver ? oDriver.getValue().trim() : "";

            if (!regNo) {
                if (oReg) {
                    oReg.setValueState(ValueState.Error);
                    oReg.setValueStateText("Vehicle Registration Number is mandatory.");
                }
                return MessageToast.show("Vehicle Registration Number is mandatory");
            }

            const vehicleRegex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
            if (!vehicleRegex.test(regNo)) {
                if (oReg) {
                    oReg.setValueState(ValueState.Error);
                    oReg.setValueStateText("Invalid vehicle registration format. Expected: AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-9999)");
                }
                return MessageBox.error("Invalid Vehicle Registration Number format.\n\nRequired format: AS-02-(Optional Series)-1234\n\nExamples:\n• AS-02-1234 (without series)\n• AS-02-A-1234 (with single letter series)\n• AS-02-AB-1234 (with double letter series)\n• MH-04-JK-9999\n\nPlease re-enter a valid vehicle registration number.");
            }
            if (oReg) {
                oReg.setValueState(ValueState.Success);
                oReg.setValueStateText("");
            }

            if (!driver) {
                if (oDriver) oDriver.setValueState(ValueState.Error);
                return MessageToast.show("Driver Name is mandatory");
            }
            if (oDriver) oDriver.setValueState(ValueState.None);

            if (!this._selectedPurpose) {
                return MessageToast.show("Please select Purpose of Visit (DELIVERY or PICKUP)");
            }

            const oDialog = await this._pGateInDialog;
            try {
                oDialog.setBusy(true);
                const res = await fetch(`${ODATA_BASE}/CreateGateIn`, {
                    method: "POST",
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        vehicleRegNo: regNo,
                        vehicleType: vehicleType,
                        purpose: this._selectedPurpose,
                        driverName: driver
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    const errMsg = data.error?.message || "Error creating Gate IN";
                    throw new Error(errMsg);
                }

                oDialog.close();
                await this.loadOverviewData();
                this.openGateInSuccessDialog(data);
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                oDialog.setBusy(false);
            }
        },

        onGateInCancel: function () {
            if (this._pGateInDialog) {
                this._pGateInDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // Dialog: Gate IN Success Badge
        // ============================================================
        openGateInSuccessDialog: function (data) {
            this._lastCreatedGateIn = data;
            const sId = this.createId("gateInSuccessFrag");
            const oSuccessModel = new JSONModel(data);

            if (!this._pGateInSuccessDialog) {
                this._pGateInSuccessDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.GateInSuccessDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateInSuccessDialog.then(function (oDialog) {
                oDialog.setModel(oSuccessModel, "gateInSuccess");
                oDialog.open();
            });
        },

        onGateInSuccessDone: function () {
            if (this._pGateInSuccessDialog) {
                this._pGateInSuccessDialog.then(oDialog => oDialog.close());
            }
        },

        onPrintGateInSuccessPass: function () {
            let d = this._lastCreatedGateIn;
            if (this._pGateInSuccessDialog) {
                this._pGateInSuccessDialog.then(oDialog => {
                    const m = oDialog.getModel("gateInSuccess");
                    if (m && m.getData()) {
                        d = m.getData();
                    }
                    this.printGateInPass(d);
                });
            } else {
                this.printGateInPass(d);
            }
        },

        // ============================================================
        // Dialog: Gate OUT
        // ============================================================
        openGateOutDialog: function (targetTx) {
            let eligible = (this._rawTransactions || []).filter(tx => tx.status !== "COMPLETED" && tx.status !== "CANCELLED");

            if (eligible.length === 0) {
                MessageBox.information("No vehicles currently active or waiting for Gate OUT.");
                return;
            }

            // Prioritize vehicles ready for final exit (SECURITY_OUT), followed by newest active entries
            eligible = eligible.slice().sort((a, b) => {
                if (a.status === "SECURITY_OUT" && b.status !== "SECURITY_OUT") return -1;
                if (b.status === "SECURITY_OUT" && a.status !== "SECURITY_OUT") return 1;
                const tA = new Date(a.createdAt || a.gateInDateTime || 0).getTime();
                const tB = new Date(b.createdAt || b.gateInDateTime || 0).getTime();
                return tB - tA;
            });

            const targetVehicle = targetTx ? (eligible.find(v => v.gateInNumber === targetTx.gateInNumber) || targetTx) : (eligible.find(v => v.status === "SECURITY_OUT") || null);

            const activeUser = models.getActiveUser();
            const defaultOperator = activeUser.includes("maingate") ? activeUser : (activeUser === "superadmin_user" ? "MainGateOperator" : (activeUser || "maingate_user"));

            const sId = this.createId("gateOutFrag");
            const oGateOutModel = new JSONModel({
                isRowAction: !!targetTx,
                eligibleVehicles: targetTx ? [targetVehicle] : eligible,
                selectedVehicle: targetVehicle,
                operator: defaultOperator
            });

            if (!this._pGateOutDialog) {
                this._pGateOutDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.GateOutDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateOutDialog.then(function (oDialog) {
                oDialog.setModel(oGateOutModel, "gateOutModel");
                const oSelect = Fragment.byId(sId, "selectGateInPass");
                if (oSelect) {
                    const sKey = targetVehicle ? targetVehicle.gateInNumber : "";
                    oSelect.setSelectedKey(sKey);
                    oSelect.setValue(sKey);
                }
                const oOpInput = Fragment.byId(sId, "inputGateOutOperator");
                if (oOpInput) {
                    oOpInput.setValueState(ValueState.None);
                    oOpInput.setValueStateText("");
                }
                oDialog.open();
            });
        },

        onGateOutPassChange: function () {
            const sId = this.createId("gateOutFrag");
            const oSelect = Fragment.byId(sId, "selectGateInPass");
            if (!oSelect) return;

            const sKey = oSelect.getSelectedKey();
            const sVal = (oSelect.getValue() || "").trim().toUpperCase();

            this._pGateOutDialog.then(function (oDialog) {
                const oModel = oDialog.getModel("gateOutModel");
                if (!oModel) return;
                const eligible = oModel.getProperty("/eligibleVehicles") || [];

                let matched = null;
                if (sKey) {
                    matched = eligible.find(v => v.gateInNumber === sKey);
                }
                if (!matched && sVal) {
                    matched = eligible.find(v =>
                        (v.gateInNumber && v.gateInNumber.toUpperCase() === sVal) ||
                        (v.vehicleRegNo && v.vehicleRegNo.toUpperCase() === sVal)
                    );
                    if (matched) {
                        oSelect.setSelectedKey(matched.gateInNumber);
                    }
                }
                oModel.setProperty("/selectedVehicle", matched || null);
            });
        },

        onGateOutConfirm: async function () {
            const sId = this.createId("gateOutFrag");
            const oSelect = Fragment.byId(sId, "selectGateInPass");
            let gateIn = oSelect ? oSelect.getSelectedKey() : "";
            const sVal = oSelect ? (oSelect.getValue() || "").trim() : "";

            const oDialog = await this._pGateOutDialog;
            const oModel = oDialog.getModel("gateOutModel");
            const eligible = (oModel && oModel.getProperty("/eligibleVehicles")) || [];

            if (!gateIn && sVal) {
                const matched = eligible.find(v =>
                    (v.gateInNumber && v.gateInNumber.toUpperCase() === sVal.toUpperCase()) ||
                    (v.vehicleRegNo && v.vehicleRegNo.toUpperCase() === sVal.toUpperCase())
                );
                if (matched) {
                    gateIn = matched.gateInNumber;
                    oSelect.setSelectedKey(matched.gateInNumber);
                } else {
                    gateIn = sVal;
                }
            }

            if (!gateIn) {
                return MessageToast.show("Please enter or select a Gate IN #");
            }

            const selectedVehicle = oModel ? oModel.getProperty("/selectedVehicle") : null;
            const currentSelected = selectedVehicle || eligible.find(v => v.gateInNumber === gateIn);
            if (currentSelected && currentSelected.status !== "SECURITY_OUT") {
                MessageBox.warning(
                    `Vehicle ${currentSelected.vehicleRegNo || gateIn} cannot be Gate OUT yet (Current Status: ${currentSelected.status}).\n\nMain Gate OUT is only permitted once all intermediate operations (Security / Weighbridge / Factory) are performed completely and Security Gate OUT clearance has been granted.`
                );
                return;
            }

            const oOpInput = Fragment.byId(sId, "inputGateOutOperator");
            const sOperator = (oModel && oModel.getProperty("/operator") || "").trim();

            if (!sOperator) {
                if (oOpInput) {
                    oOpInput.setValueState(ValueState.Error);
                    oOpInput.setValueStateText("Main Gate Operator is mandatory.");
                }
                return MessageToast.show("Please enter Main Gate Operator name.");
            }
            if (oOpInput) {
                oOpInput.setValueState(ValueState.None);
                oOpInput.setValueStateText("");
            }

            try {
                oDialog.setBusy(true);
                const res = await fetch(`${ODATA_BASE}/MainGateOut`, {
                    method: "POST",
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        gateInNumber: gateIn,
                        gateOutOperator: sOperator
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    const errMsg = data.error?.message || "Error executing Gate OUT";
                    throw new Error(errMsg);
                }

                oDialog.close();
                await this.loadOverviewData();
                this.openGateOutSuccessDialog(data);
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                oDialog.setBusy(false);
            }
        },

        onGateOutCancel: function () {
            if (this._pGateOutDialog) {
                this._pGateOutDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // Dialog: Gate OUT Success
        // ============================================================
        openGateOutSuccessDialog: function (data) {
            const sId = this.createId("gateOutSuccessFrag");
            const oSuccessModel = new JSONModel(data);

            if (!this._pGateOutSuccessDialog) {
                this._pGateOutSuccessDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.GateOutSuccessDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateOutSuccessDialog.then(function (oDialog) {
                oDialog.setModel(oSuccessModel, "gateOutSuccess");
                oDialog.open();
            });
        },

        onGateOutSuccessDone: function () {
            if (this._pGateOutSuccessDialog) {
                this._pGateOutSuccessDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // Dialog: Transaction Detail View
        // ============================================================
        openDetailDialog: function (tx) {
            this._currentDetailTx = tx;
            const sId = this.createId("detailFrag");
            const oDetailModel = new JSONModel(tx);

            if (!this._pDetailDialog) {
                this._pDetailDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.DetailDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getRootControl().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pDetailDialog.then(function (oDialog) {
                oDialog.setModel(oDetailModel, "detailModel");
                oDialog.open();
            });
        },

        onDetailClose: function () {
            if (this._pDetailDialog) {
                this._pDetailDialog.then(oDialog => oDialog.close());
            }
        },

        openEditGateEntryPage: function (tx) {
            this.navigateTo("editGateEntryPage", "slide");
            const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
            const oEditPage = aPages.find(p => p.getId().endsWith("editGateEntryPage"));
            if (oEditPage) {
                const oCtrl = oEditPage.getController();
                if (oCtrl && oCtrl.loadTransaction) {
                    oCtrl.loadTransaction(tx);
                }
            }
        },

        openEditSecurityGateEntryPage: function (tx) {
            this.navigateTo("editSecurityGateEntryPage", "slide");
            const aPages = this._oNavContainer ? this._oNavContainer.getPages() : [];
            const oEditSecPage = aPages.find(p => p.getId().endsWith("editSecurityGateEntryPage"));
            if (oEditSecPage) {
                const oCtrl = oEditSecPage.getController();
                if (oCtrl && oCtrl.loadTransaction) {
                    oCtrl.loadTransaction(tx);
                }
            }
        },

        onDetailEdit: function (oEvt) {
            if (this._pDetailDialog) {
                this._pDetailDialog.then(oDialog => {
                    const oDetailModel = oDialog.getModel("detailModel");
                    const oTx = (oDetailModel && oDetailModel.getData()) || this._currentDetailTx;
                    oDialog.close();
                    if (oTx) {
                        const oCurrentPage = this._oNavContainer ? this._oNavContainer.getCurrentPage() : null;
                        const sPageId = oCurrentPage ? oCurrentPage.getId() : "";
                        if (sPageId.includes("securityGateOpsPage")) {
                            this.openEditSecurityGateEntryPage(oTx);
                        } else {
                            this.openEditGateEntryPage(oTx);
                        }
                    }
                });
            } else if (this._currentDetailTx) {
                this.openEditGateEntryPage(this._currentDetailTx);
            }
        },

        onDetailEditInFE: function (oEvt) {
            this.onDetailEdit(oEvt);
        },

        deleteTransaction: async function (tx) {
            if (!tx || !tx.ID) return;

            const bConfirmed = await new Promise(resolve => {
                MessageBox.confirm(
                    `Are you sure you want to delete Gate Entry '${tx.gateInNumber}' (${tx.vehicleRegNo})?`, {
                        title: "Confirm Deletion",
                        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                        emphasizedAction: MessageBox.Action.DELETE,
                        onClose: function (sAction) {
                            resolve(sAction === MessageBox.Action.DELETE);
                        }
                    }
                );
            });

            if (!bConfirmed) return;

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const res = await fetch(`${ODATA_BASE}/GateTransactions(${tx.ID})`, {
                    method: "DELETE",
                    headers: headers
                });

                if (!res.ok) {
                    let errMsg = "Failed to delete transaction.";
                    try {
                        const errData = await res.json();
                        errMsg = errData.error?.message || errMsg;
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                MessageToast.show(`Gate Entry ${tx.gateInNumber} deleted successfully.`);
                await this.loadOverviewData();
            } catch (err) {
                MessageBox.error(err.message);
            }
        },

        onDetailPrint: function () {
            let d = this._currentDetailTx;
            if (this._pDetailDialog) {
                this._pDetailDialog.then(oDialog => {
                    const m = oDialog.getModel("detailModel");
                    if (m && m.getData()) {
                        d = m.getData();
                    }
                    this.printGateInPass(d);
                });
            } else {
                this.printGateInPass(d);
            }
        },

        // ============================================================
        // Print Operation: Gate IN Pass Document
        // ============================================================
        printGateInPass: function (tx) {
            if (!tx || !tx.gateInNumber) {
                MessageToast.show("No Gate IN record available to print.");
                return;
            }

            let iframe = document.getElementById("gateInPrintIframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "gateInPrintIframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);
            }

            const sGateInNo = tx.gateInNumber;
            const sVehicleReg = tx.vehicleRegNo || "-";
            const sVehicleType = tx.vehicleType || (tx.vehicle && tx.vehicle.vehicleType) || "TRUCK";
            const sDriver = tx.driverName || (tx.driver && tx.driver.driverName) || "-";
            const sPurpose = tx.purpose || "DELIVERY";
            const sOperator = tx.gateInOperator || "Gate Operator";
            const sFormattedDate = formatter.formatDateTime(tx.gateInDateTime || new Date());
            const barcodeSvg = this._generateBarcodeSvg(sGateInNo);

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>APL Gate IN Pass - ${sGateInNo}</title>
                <style>
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    }
                    body {
                        background: #ffffff;
                        color: #111827;
                        padding: 10px;
                        font-size: 13px;
                    }
                    .slip-card {
                        max-width: 520px;
                        margin: 0 auto;
                        border: 2px solid #111827;
                        border-radius: 6px;
                        padding: 20px 24px;
                    }
                    .header-box {
                        text-align: center;
                        border-bottom: 2px solid #111827;
                        padding-bottom: 12px;
                        margin-bottom: 14px;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: 800;
                        color: #111827;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                    }
                    .company-sub {
                        font-size: 12px;
                        font-weight: 700;
                        color: #0284c7;
                        letter-spacing: 1px;
                        margin-top: 3px;
                    }
                    .barcode-box {
                        text-align: center;
                        margin: 12px 0 16px 0;
                        padding: 8px 0;
                        background: #f8fafc;
                        border-radius: 4px;
                    }
                    .barcode-text {
                        font-family: "Courier New", Courier, monospace;
                        font-size: 13px;
                        font-weight: 700;
                        letter-spacing: 3px;
                        color: #1e293b;
                        margin-top: 4px;
                    }
                    .details-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 18px;
                    }
                    .details-table td {
                        padding: 8px 10px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 13px;
                    }
                    .label-col {
                        width: 42%;
                        font-weight: 600;
                        color: #4b5563;
                        text-transform: uppercase;
                        font-size: 11.5px;
                    }
                    .val-col {
                        width: 58%;
                        font-weight: 700;
                        color: #111827;
                    }
                    .highlight-num {
                        font-size: 16px;
                        color: #0284c7;
                        font-family: "Courier New", Courier, monospace;
                    }
                    .highlight-reg {
                        font-size: 15px;
                    }
                    .purpose-tag {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 700;
                        background: ${sPurpose === "DELIVERY" ? "#e0f2fe" : "#fef3c7"};
                        color: ${sPurpose === "DELIVERY" ? "#0369a1" : "#92400e"};
                    }
                    .signatures-box {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 30px;
                        padding-top: 8px;
                    }
                    .sig-item {
                        width: 45%;
                        text-align: center;
                    }
                    .sig-line {
                        border-top: 1px dashed #6b7280;
                        margin-top: 35px;
                        margin-bottom: 5px;
                    }
                    .sig-label {
                        font-size: 11px;
                        font-weight: 600;
                        color: #374151;
                    }
                </style>
            </head>
            <body>
                <div class="slip-card">
                    <div class="header-box">
                        <div class="company-name">Assam Petro-chemicals Ltd (APL)</div>
                        <div class="company-sub">GATE IN ENTRY PASS</div>
                    </div>

                    <div class="barcode-box">
                        ${barcodeSvg}
                        <div class="barcode-text">* ${sGateInNo} *</div>
                    </div>

                    <table class="details-table">
                        <tr>
                            <td class="label-col">Gate IN Number</td>
                            <td class="val-col highlight-num">${sGateInNo}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Vehicle Registration No</td>
                            <td class="val-col highlight-reg">${sVehicleReg}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Vehicle Type</td>
                            <td class="val-col">${sVehicleType}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Driver Name</td>
                            <td class="val-col">${sDriver}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Visit Purpose</td>
                            <td class="val-col"><span class="purpose-tag">${sPurpose}</span></td>
                        </tr>
                        <tr>
                            <td class="label-col">Gate IN Date &amp; Time</td>
                            <td class="val-col">${sFormattedDate}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Gate Operator</td>
                            <td class="val-col">${sOperator}</td>
                        </tr>
                    </table>

                    <div class="signatures-box">
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Driver Signature</div>
                        </div>
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Gate Operator Signature</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            const frameDoc = iframe.contentWindow.document;
            frameDoc.open();
            frameDoc.write(htmlContent);
            frameDoc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 300);
        },

        printFactoryGateOutSlip: function (tx) {
            if (!tx || !tx.gateInNumber) {
                MessageToast.show("No Factory Gate OUT record available to print.");
                return;
            }

            let iframe = document.getElementById("factoryGateOutPrintIframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "factoryGateOutPrintIframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);
            }

            const sGateInNo = tx.gateInNumber;
            const sVehicleReg = tx.vehicleRegNo || (tx.vehicle && tx.vehicle.vehicleRegNo) || "-";
            const sVehicleType = tx.vehicleType || (tx.vehicle && tx.vehicle.vehicleType) || "TRUCK";
            const sDriver = tx.driverName || (tx.driver && tx.driver.driverName) || "-";
            const sTransporter = tx.transporterName || (tx.transporter && tx.transporter.transporterName) || (tx.factoryEntry && tx.factoryEntry.transporterName) || "-";
            const sPo = tx.poNumber || (tx.factoryEntry && tx.factoryEntry.poNumber) || (tx.securityEntry && tx.securityEntry.poNumber) || "-";
            const sSupplier = tx.supplierName || (tx.supplier && tx.supplier.supplierName) || (tx.factoryEntry && tx.factoryEntry.supplierName) || "-";
            const sInvoice = tx.invoiceNumber || (tx.factoryEntry && tx.factoryEntry.invoiceNumber) || (tx.securityEntry && tx.securityEntry.invoiceNumber) || "-";

            let sGateOutType = tx.gateOutType || "";
            if (!sGateOutType && tx.factoryEntry && tx.factoryEntry.remarks) {
                const match = tx.factoryEntry.remarks.match(/\[Gate Out Type:\s*([^\]]+)\]/i);
                if (match) sGateOutType = match[1].trim();
            }
            if (!sGateOutType && tx.securityEntry && tx.securityEntry.gatePassType) {
                sGateOutType = tx.securityEntry.gatePassType;
            }
            if (!sGateOutType) sGateOutType = "STANDARD";
            const sGateOutTypeDesc = tx.gateOutTypeDesc || formatter.getGateOutTypeDesc(sGateOutType);

            const sFacInDate = tx.factoryGateInDateTime || (tx.factoryEntry && tx.factoryEntry.factoryGateInDateTime);
            const sFacInOp = tx.factoryGateInOperator || (tx.factoryEntry && tx.factoryEntry.factoryGateInOperator) || "Factory Operator";
            const sFacOutDate = tx.factoryGateOutDateTime || (tx.factoryEntry && tx.factoryEntry.factoryGateOutDateTime) || new Date();
            const sFacOutOp = tx.factoryGateOutOperator || (tx.factoryEntry && tx.factoryEntry.factoryGateOutOperator) || "Factory Operator";

            let sRemarks = tx.remarks || (tx.factoryEntry && tx.factoryEntry.remarks) || "Clearance Completed";
            sRemarks = sRemarks.replace(/\[Gate Out Type:\s*[^\]]+\]\s*/i, "").trim() || "Yard clearance completed";

            const barcodeSvg = this._generateBarcodeSvg(sGateInNo);

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>APL Factory Gate OUT Clearance - ${sGateInNo}</title>
                <style>
                    @page { size: auto; margin: 10mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                    body { background: #ffffff; color: #111827; padding: 10px; font-size: 13px; }
                    .slip-card { max-width: 560px; margin: 0 auto; border: 2px solid #111827; border-radius: 6px; padding: 22px 26px; }
                    .header-box { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
                    .company-name { font-size: 18px; font-weight: 800; color: #111827; letter-spacing: 0.5px; text-transform: uppercase; }
                    .company-sub { font-size: 13px; font-weight: 700; color: #15803d; letter-spacing: 1px; margin-top: 3px; }
                    .barcode-box { text-align: center; margin: 12px 0 16px 0; padding: 8px 0; background: #f8fafc; border-radius: 4px; }
                    .barcode-text { font-family: "Courier New", Courier, monospace; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #1e293b; margin-top: 4px; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
                    .details-table td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12.5px; }
                    .label-col { width: 40%; font-weight: 600; color: #4b5563; text-transform: uppercase; font-size: 11px; }
                    .val-col { width: 60%; font-weight: 700; color: #111827; }
                    .highlight-num { font-size: 16px; color: #0284c7; font-family: "Courier New", Courier, monospace; }
                    .type-badge { display: inline-block; padding: 3px 9px; border-radius: 4px; font-size: 12px; font-weight: 800; }
                    .badge-rgp { background: #fef3c7; color: #b45309; border: 1px solid #f59e0b; }
                    .badge-nrgp { background: #e0f2fe; color: #0369a1; border: 1px solid #38bdf8; }
                    .badge-standard { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
                    .badge-return { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
                    .signatures-box { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 8px; }
                    .sig-item { width: 30%; text-align: center; }
                    .sig-line { border-top: 1px dashed #6b7280; margin-top: 36px; margin-bottom: 5px; }
                    .sig-label { font-size: 10.5px; font-weight: 600; color: #374151; }
                </style>
            </head>
            <body>
                <div class="slip-card">
                    <div class="header-box">
                        <div class="company-name">Assam Petro-chemicals Ltd (APL)</div>
                        <div class="company-sub">FACTORY GATE OUT CLEARANCE SLIP</div>
                    </div>

                    <div class="barcode-box">
                        ${barcodeSvg}
                        <div class="barcode-text">* ${sGateInNo} *</div>
                    </div>

                    <table class="details-table">
                        <tr>
                            <td class="label-col">Gate IN Number</td>
                            <td class="val-col highlight-num">${sGateInNo}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Gate Out Type</td>
                            <td class="val-col">
                                <span class="type-badge ${sGateOutType === 'RGP' ? 'badge-rgp' : (sGateOutType === 'NRGP' ? 'badge-nrgp' : (sGateOutType === 'MATERIAL_RETURN' ? 'badge-return' : 'badge-standard'))}">
                                    ${sGateOutTypeDesc}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td class="label-col">Vehicle Reg No</td>
                            <td class="val-col">${sVehicleReg} (${sVehicleType})</td>
                        </tr>
                        <tr>
                            <td class="label-col">Driver / Transporter</td>
                            <td class="val-col">${sDriver} / ${sTransporter}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Purchase Order (PO)</td>
                            <td class="val-col">${sPo}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Supplier / Vendor</td>
                            <td class="val-col">${sSupplier}</td>
                        </tr>
                        ${sInvoice && sInvoice !== "-" ? `
                        <tr>
                            <td class="label-col">Invoice Number</td>
                            <td class="val-col">${sInvoice}</td>
                        </tr>` : ""}
                        <tr>
                            <td class="label-col">Factory Gate IN</td>
                            <td class="val-col">${formatter.formatDateTime(sFacInDate)} (By: ${sFacInOp})</td>
                        </tr>
                        <tr>
                            <td class="label-col">Factory Gate OUT</td>
                            <td class="val-col">${formatter.formatDateTime(sFacOutDate)} (By: ${sFacOutOp})</td>
                        </tr>
                        <tr>
                            <td class="label-col">Clearance Status</td>
                            <td class="val-col" style="color: #15803d;">FACTORY YARD CLEARED</td>
                        </tr>
                        <tr>
                            <td class="label-col">Remarks / Observations</td>
                            <td class="val-col">${sRemarks}</td>
                        </tr>
                    </table>

                    <div class="signatures-box">
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Driver Signature</div>
                        </div>
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Factory In-Charge</div>
                        </div>
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Security Officer</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            const frameDoc = iframe.contentWindow.document;
            frameDoc.open();
            frameDoc.write(htmlContent);
            frameDoc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 300);
        },

        printFactoryGateInSlip: function (tx) {
            if (!tx || !tx.gateInNumber) {
                MessageToast.show("No Factory Gate IN record available to print.");
                return;
            }

            let iframe = document.getElementById("factoryGateInPrintIframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "factoryGateInPrintIframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);
            }

            const sGateInNo = tx.gateInNumber;
            const sVehicleReg = tx.vehicleRegNo || (tx.vehicle && tx.vehicle.vehicleRegNo) || "-";
            const sVehicleType = tx.vehicleType || (tx.vehicle && tx.vehicle.vehicleType) || "TRUCK";
            const sDriver = tx.driverName || (tx.driver && tx.driver.driverName) || "-";
            const sTransporter = tx.transporterName || (tx.transporter && tx.transporter.transporterName) || "-";
            const sPo = tx.poNumber || "-";
            const sSupplier = tx.supplierName || "-";
            const sFacInDate = tx.factoryGateInDateTime || new Date();
            const sFacInOp = tx.factoryGateInOperator || "Factory Operator";
            const barcodeSvg = this._generateBarcodeSvg(sGateInNo);

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>APL Factory Gate IN Slip - ${sGateInNo}</title>
                <style>
                    @page { size: auto; margin: 10mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                    body { background: #ffffff; color: #111827; padding: 10px; font-size: 13px; }
                    .slip-card { max-width: 540px; margin: 0 auto; border: 2px solid #111827; border-radius: 6px; padding: 22px 26px; }
                    .header-box { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
                    .company-name { font-size: 18px; font-weight: 800; color: #111827; letter-spacing: 0.5px; text-transform: uppercase; }
                    .company-sub { font-size: 13px; font-weight: 700; color: #0284c7; letter-spacing: 1px; margin-top: 3px; }
                    .barcode-box { text-align: center; margin: 12px 0 16px 0; padding: 8px 0; background: #f8fafc; border-radius: 4px; }
                    .barcode-text { font-family: "Courier New", Courier, monospace; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #1e293b; margin-top: 4px; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
                    .details-table td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                    .label-col { width: 42%; font-weight: 600; color: #4b5563; text-transform: uppercase; font-size: 11.5px; }
                    .val-col { width: 58%; font-weight: 700; color: #111827; }
                    .highlight-num { font-size: 16px; color: #0284c7; font-family: "Courier New", Courier, monospace; }
                    .signatures-box { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 8px; }
                    .sig-item { width: 45%; text-align: center; }
                    .sig-line { border-top: 1px dashed #6b7280; margin-top: 35px; margin-bottom: 5px; }
                    .sig-label { font-size: 11px; font-weight: 600; color: #374151; }
                </style>
            </head>
            <body>
                <div class="slip-card">
                    <div class="header-box">
                        <div class="company-name">Assam Petro-chemicals Ltd (APL)</div>
                        <div class="company-sub">FACTORY GATE IN ENTRY SLIP</div>
                    </div>

                    <div class="barcode-box">
                        ${barcodeSvg}
                        <div class="barcode-text">* ${sGateInNo} *</div>
                    </div>

                    <table class="details-table">
                        <tr>
                            <td class="label-col">Gate IN Number</td>
                            <td class="val-col highlight-num">${sGateInNo}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Vehicle Registration No</td>
                            <td class="val-col">${sVehicleReg} (${sVehicleType})</td>
                        </tr>
                        <tr>
                            <td class="label-col">Driver / Transporter</td>
                            <td class="val-col">${sDriver} / ${sTransporter}</td>
                        </tr>
                        <tr>
                            <td class="label-col">PO Number</td>
                            <td class="val-col">${sPo}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Supplier</td>
                            <td class="val-col">${sSupplier}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Factory Gate IN Time</td>
                            <td class="val-col">${formatter.formatDateTime(sFacInDate)}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Inbound Operator</td>
                            <td class="val-col">${sFacInOp}</td>
                        </tr>
                    </table>

                    <div class="signatures-box">
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Driver Signature</div>
                        </div>
                        <div class="sig-item">
                            <div class="sig-line"></div>
                            <div class="sig-label">Factory Operator Signature</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            const frameDoc = iframe.contentWindow.document;
            frameDoc.open();
            frameDoc.write(htmlContent);
            frameDoc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 300);
        },

        _generateBarcodeSvg: function (text) {
            if (!text) text = "GATE-PASS";
            let x = 10;
            let rects = "";
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                const barWidth = (code % 2 === 0) ? 3 : 1.5;
                const gap = (code % 3 === 0) ? 2.5 : 1.5;
                rects += `<rect x="${x}" y="0" width="${barWidth}" height="42" fill="#0f172a" />`;
                x += barWidth + gap;
                const bar2 = (code % 4 === 0) ? 3.5 : 1.5;
                rects += `<rect x="${x}" y="0" width="${bar2}" height="42" fill="#0f172a" />`;
                x += bar2 + 2;
            }
            return `<svg width="${x + 10}" height="42" viewBox="0 0 ${x + 10} 42" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">${rects}</svg>`;
        }
    });
});
