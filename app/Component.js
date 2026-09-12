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
                } else {
                    this._oNavContainer.to(sPageId, sTransition || "slide");
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

                oModel.setProperty("/userRolesText", currentRoles.length ? currentRoles.join(", ") : (activeUser.includes("superadmin") ? "Superadmin" : "MainGateUser"));
                oModel.setProperty("/canCreateGateIn", perms.canCreateGateIn);
                oModel.setProperty("/canMainGateOut", perms.canMainGateOut);
                oModel.setProperty("/canViewLiveOps", perms.canViewLiveOps);
                oModel.setProperty("/canViewGateOps", perms.canViewGateOps);
                oModel.setProperty("/canViewMasterData", perms.canViewMasterData);
                oModel.setProperty("/canViewAuditTrail", perms.canViewAuditTrail);
                oModel.setProperty("/canViewAudit", perms.canViewAuditTrail);

                // 2. Fetch Transactions
                const resTx = await fetch(`${ODATA_BASE}/GateTransactions?$orderby=createdAt desc`, { headers });
                if (resTx.ok) {
                    const txData = await resTx.json();
                    this._rawTransactions = txData.value || [];
                    oModel.setProperty("/transactions", this._rawTransactions);

                    const counts = {
                        TOTAL: this._rawTransactions.length,
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
            oModel.setProperty("/canViewMasterData", perms.canViewMasterData);
            oModel.setProperty("/canViewAuditTrail", perms.canViewAuditTrail);
            oModel.setProperty("/canViewAudit", perms.canViewAuditTrail);

            this.loadOverviewData();

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
                const oDriver = Fragment.byId(sId, "inputDriverName");
                const oDel = Fragment.byId(sId, "cbDelivery");
                const oPick = Fragment.byId(sId, "cbPickup");
                if (oReg) {
                    oReg.setValue("");
                    oReg.setValueState(ValueState.None);
                    oReg.setValueStateText("");
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
            const oDriver = Fragment.byId(sId, "inputDriverName");
            const regNo = oReg ? oReg.getValue().trim().toUpperCase() : "";
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
                        vehicleType: "TRUCK",
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

        // ============================================================
        // Dialog: Gate OUT
        // ============================================================
        openGateOutDialog: function () {
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

            const sId = this.createId("gateOutFrag");
            const oGateOutModel = new JSONModel({
                eligibleVehicles: eligible,
                selectedVehicle: null
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
                    oSelect.setSelectedKey("");
                    oSelect.setValue("");
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

            try {
                oDialog.setBusy(true);
                const res = await fetch(`${ODATA_BASE}/MainGateOut`, {
                    method: "POST",
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ gateInNumber: gateIn })
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

        onDetailEditInFE: function (oEvt) {
            if (this._pDetailDialog) {
                this._pDetailDialog.then(oDialog => oDialog.close());
            }
            this.openFioriElementsApp("GateTransactions", "Gate Entries & Exits (SAP Fiori Elements)");
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
        }
    });
});
