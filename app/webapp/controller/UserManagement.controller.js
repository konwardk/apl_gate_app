sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "factory/gate/model/formatter",
    "factory/gate/model/models",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library"
], function (Controller, formatter, models, JSONModel, Fragment, MessageToast, MessageBox, coreLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const ODATA_BASE = "/gate";

    const ROLE_CONFIG = {
        "Superadmin": { text: "Superadmin", state: "Indication01", icon: "sap-icon://user-settings" },
        "superadmin_user": { text: "Superadmin", state: "Indication01", icon: "sap-icon://user-settings" },
        "MainGateUser": { text: "Main Gate", state: "Information", icon: "sap-icon://log-in" },
        "maingate_user": { text: "Main Gate", state: "Information", icon: "sap-icon://log-in" },
        "SecurityGateUser": { text: "Security Gate", state: "Warning", icon: "sap-icon://shield" },
        "security_user": { text: "Security Gate", state: "Warning", icon: "sap-icon://shield" },
        "WeighbridgeUser": { text: "Weighbridge", state: "Indication04", icon: "sap-icon://dimension" },
        "weighbridge_user": { text: "Weighbridge", state: "Indication04", icon: "sap-icon://dimension" },
        "FactoryGateUser": { text: "Factory Gate", state: "Success", icon: "sap-icon://factory" },
        "factory_user": { text: "Factory Gate", state: "Success", icon: "sap-icon://factory" },
        "Admin": { text: "Admin", state: "Information", icon: "sap-icon://manager" },
        "admin_user": { text: "Admin", state: "Information", icon: "sap-icon://manager" },
        "Auditor": { text: "Auditor", state: "None", icon: "sap-icon://history" },
        "audit_user": { text: "Auditor", state: "None", icon: "sap-icon://history" },
        "auditor_user": { text: "Auditor", state: "None", icon: "sap-icon://history" }
    };

    const ROLE_NORMALIZE = {
        "MainGateUser": "maingate_user",
        "SecurityGateUser": "security_user",
        "WeighbridgeUser": "weighbridge_user",
        "FactoryGateUser": "factory_user",
        "Auditor": "audit_user",
        "auditor_user": "audit_user",
        "Superadmin": "superadmin_user",
        "Admin": "admin_user"
    };

    const ROLE_ALIASES = {
        "maingate_user": ["maingate_user", "MainGateUser"],
        "security_user": ["security_user", "SecurityGateUser"],
        "weighbridge_user": ["weighbridge_user", "WeighbridgeUser"],
        "factory_user": ["factory_user", "FactoryGateUser"],
        "audit_user": ["audit_user", "Auditor", "auditor_user"],
        "superadmin_user": ["superadmin_user", "Superadmin"],
        "admin_user": ["admin_user", "Admin"]
    };

    return Controller.extend("factory.gate.controller.UserManagement", {
        formatter: formatter,

        onInit: function () {
            const oUserModel = new JSONModel({
                users: [],
                displayedUsers: [],
                kpi: {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    inService: 0,
                    multiRole: 0
                },
                selectedRoleFilter: "ALL",
                selectedServiceStatusFilter: "ALL",
                selectedStatusFilter: "ALL",
                searchQuery: "",
                isEdit: false,
                form: {
                    ID: null,
                    username: "",
                    name: "",
                    employeeId: "",
                    password: "",
                    designation: "",
                    department: "Main Gate Operations",
                    email: "",
                    phoneNo: "",
                    serviceStatus: "IN_SERVICE",
                    status: "ACTIVE",
                    selectedRoleKeys: ["maingate_user"],
                    remarks: ""
                }
            });
            this.getView().setModel(oUserModel, "userModel");

            this.loadUsersData();
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onRefreshPress: function () {
            this.loadUsersData();
            MessageToast.show("User registry updated");
        },

        loadUsersData: async function () {
            const oView = this.getView();
            const oModel = oView.getModel("userModel");
            if (!oModel) return;

            try {
                oView.setBusy(true);
                const res = await fetch(`${ODATA_BASE}/Users?$expand=userRoles&$orderby=createdAt desc`, {
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    }
                });

                if (!res.ok) {
                    throw new Error(`Failed to load users (HTTP ${res.status})`);
                }

                const data = await res.json();
                const aRaw = data.value || [];

                const aEnriched = aRaw.map(u => {
                    const sRoles = u.assignedRoles || "";
                    const aRoles = sRoles.split(",").map(r => r.trim()).filter(Boolean);
                    const aBadges = aRoles.map(r => {
                        const cfg = ROLE_CONFIG[r] || { text: r, state: "None", icon: "sap-icon://person-placeholder" };
                        return {
                            roleCode: r,
                            roleName: cfg.text,
                            state: cfg.state,
                            icon: cfg.icon
                        };
                    });

                    // Ensure local password dictionary contains seed/db password safely
                    if (u.username && u.password && typeof models.setPasswordForUser === "function") {
                        models.setPasswordForUser(u.username, u.password);
                    }

                    return Object.assign({}, u, {
                        roleBadges: aBadges,
                        roleCount: aRoles.length
                    });
                });

                oModel.setProperty("/users", aEnriched);

                // Compute KPI counts
                const kpi = {
                    total: aEnriched.length,
                    active: aEnriched.filter(u => u.status === "ACTIVE").length,
                    inactive: aEnriched.filter(u => u.status !== "ACTIVE").length,
                    inService: aEnriched.filter(u => u.serviceStatus === "IN_SERVICE").length,
                    multiRole: aEnriched.filter(u => u.roleCount > 1).length
                };
                oModel.setProperty("/kpi", kpi);

                this._applyFilters();
            } catch (err) {
                console.error("Error loading user management data:", err);
                MessageBox.error("Could not load users: " + err.message);
            } finally {
                oView.setBusy(false);
            }
        },

        onSearchLiveChange: function (oEvt) {
            const oModel = this.getView().getModel("userModel");
            oModel.setProperty("/searchQuery", oEvt.getParameter("newValue") || "");
            this._applyFilters();
        },

        onSearch: function (oEvt) {
            const oModel = this.getView().getModel("userModel");
            oModel.setProperty("/searchQuery", oEvt.getParameter("query") || "");
            this._applyFilters();
        },

        onFilterChange: function () {
            this._applyFilters();
        },

        onResetFilters: function () {
            const oModel = this.getView().getModel("userModel");
            oModel.setProperty("/searchQuery", "");
            oModel.setProperty("/selectedRoleFilter", "ALL");
            oModel.setProperty("/selectedServiceStatusFilter", "ALL");
            oModel.setProperty("/selectedStatusFilter", "ALL");

            const oSearch = this.byId("userSearchField");
            if (oSearch) oSearch.setValue("");

            this._applyFilters();
            MessageToast.show("Filters reset");
        },

        _applyFilters: function () {
            const oModel = this.getView().getModel("userModel");
            const aAll = oModel.getProperty("/users") || [];

            const q = (oModel.getProperty("/searchQuery") || "").toLowerCase().trim();
            const sRole = oModel.getProperty("/selectedRoleFilter") || "ALL";
            const sService = oModel.getProperty("/selectedServiceStatusFilter") || "ALL";
            const sStatus = oModel.getProperty("/selectedStatusFilter") || "ALL";

            const aFiltered = aAll.filter(u => {
                // 1. Role Filter
                if (sRole !== "ALL") {
                    const assigned = (u.assignedRoles || "");
                    const aliases = ROLE_ALIASES[sRole] || [sRole];
                    const hasRole = aliases.some(r => assigned.toLowerCase().includes(r.toLowerCase()));
                    if (!hasRole) return false;
                }

                // 2. Service Status Filter
                if (sService !== "ALL" && u.serviceStatus !== sService) {
                    return false;
                }

                // 3. Account Status Filter
                if (sStatus !== "ALL" && u.status !== sStatus) {
                    return false;
                }

                // 4. Search Query Filter
                if (q) {
                    const matchName = (u.name || "").toLowerCase().includes(q);
                    const matchUser = (u.username || "").toLowerCase().includes(q);
                    const matchEmp = (u.employeeId || "").toLowerCase().includes(q);
                    const matchDesig = (u.designation || "").toLowerCase().includes(q);
                    const matchDept = (u.department || "").toLowerCase().includes(q);
                    const matchEmail = (u.email || "").toLowerCase().includes(q);
                    const matchPhone = (u.phoneNo || "").toLowerCase().includes(q);
                    const matchRole = (u.assignedRoles || "").toLowerCase().includes(q);
                    if (!matchName && !matchUser && !matchEmp && !matchDesig && !matchDept && !matchEmail && !matchPhone && !matchRole) {
                        return false;
                    }
                }

                return true;
            });

            oModel.setProperty("/displayedUsers", aFiltered);
        },

        // ============================================================
        // Formatters
        // ============================================================
        formatServiceStatusText: function (status) {
            switch (status) {
                case "IN_SERVICE": return "In Service";
                case "ON_LEAVE": return "On Leave";
                case "PROBATION": return "On Probation";
                case "SUSPENDED": return "Suspended";
                case "RESIGNED": return "Resigned";
                default: return status || "In Service";
            }
        },

        formatServiceStatusState: function (status) {
            switch (status) {
                case "IN_SERVICE": return ValueState.Success;
                case "ON_LEAVE": return ValueState.Warning;
                case "PROBATION": return ValueState.Information;
                case "SUSPENDED": return ValueState.Error;
                case "RESIGNED": return ValueState.None;
                default: return ValueState.None;
            }
        },

        formatServiceStatusIcon: function (status) {
            switch (status) {
                case "IN_SERVICE": return "sap-icon://sys-enter-2";
                case "ON_LEAVE": return "sap-icon://away";
                case "PROBATION": return "sap-icon://hint";
                case "SUSPENDED": return "sap-icon://alert";
                case "RESIGNED": return "sap-icon://decline";
                default: return "sap-icon://sys-enter-2";
            }
        },

        // ============================================================
        // Create / Edit User Dialog Handlers
        // ============================================================
        _getUserDialog: function () {
            if (!this._pUserDialog) {
                this._pUserDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "factory.gate.fragment.UserDialog",
                    controller: this
                }).then(oDialog => {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                });
            }
            return this._pUserDialog;
        },

        onCreateUserPress: function () {
            const oModel = this.getView().getModel("userModel");
            oModel.setProperty("/isEdit", false);
            oModel.setProperty("/form", {
                ID: null,
                username: "",
                name: "",
                employeeId: "",
                password: "",
                designation: "",
                department: "Main Gate Operations",
                email: "",
                phoneNo: "",
                phoneValueState: ValueState.None,
                phoneValueStateText: "",
                serviceStatus: "IN_SERVICE",
                status: "ACTIVE",
                selectedRoleKeys: ["maingate_user"],
                remarks: ""
            });

            const oPhoneInput = this.byId("inputPhone");
            if (oPhoneInput) {
                oPhoneInput.setValueState(ValueState.None);
                oPhoneInput.setValueStateText("");
            }

            this._getUserDialog().then(oDialog => oDialog.open());
        },

        onEditUserPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("userModel");
            if (!oCtx) return;
            const u = oCtx.getObject();

            const oModel = this.getView().getModel("userModel");
            oModel.setProperty("/isEdit", true);

            const aRoleKeys = (u.assignedRoles || "")
                .split(",")
                .map(r => r.trim())
                .filter(Boolean)
                .map(r => ROLE_NORMALIZE[r] || r);

            // Clean phoneNo if it has non-digit characters from legacy data
            let sPhone = (u.phoneNo || "").trim();
            if (sPhone && /\D/.test(sPhone)) {
                const sDigits = sPhone.replace(/\D/g, "");
                sPhone = sDigits.length > 10 && sDigits.startsWith("91") ? sDigits.slice(2, 12) : sDigits.slice(-10);
            }

            oModel.setProperty("/form", {
                ID: u.ID,
                username: u.username,
                name: u.name,
                employeeId: u.employeeId || "",
                password: "",
                designation: u.designation || "",
                department: u.department || "",
                email: u.email || "",
                phoneNo: sPhone,
                phoneValueState: ValueState.None,
                phoneValueStateText: "",
                serviceStatus: u.serviceStatus || "IN_SERVICE",
                status: u.status || "ACTIVE",
                selectedRoleKeys: aRoleKeys.length ? aRoleKeys : ["maingate_user"],
                remarks: u.remarks || ""
            });

            const oPhoneInput = this.byId("inputPhone");
            if (oPhoneInput) {
                oPhoneInput.setValueState(ValueState.None);
                oPhoneInput.setValueStateText("");
            }

            this._getUserDialog().then(oDialog => oDialog.open());
        },

        onPhoneLiveChange: function (oEvt) {
            const oInput = oEvt.getSource();
            const sValue = oEvt.getParameter("newValue") || "";
            const oModel = this.getView().getModel("userModel");

            // Check if input contains non-digit characters
            const bHasNonDigits = /\D/.test(sValue);
            // Numeric only, max 10 characters
            const sNumericOnly = sValue.replace(/\D/g, "").slice(0, 10);

            if (bHasNonDigits) {
                oInput.setValue(sNumericOnly);
                if (oModel) {
                    oModel.setProperty("/form/phoneNo", sNumericOnly);
                    oModel.setProperty("/form/phoneValueState", ValueState.Error);
                    oModel.setProperty("/form/phoneValueStateText", "Only numbers are allowed (max 10 characters).");
                }
                oInput.setValueState(ValueState.Error);
                oInput.setValueStateText("Only numbers are allowed (max 10 characters).");
                return;
            }

            if (sValue.length > 10) {
                oInput.setValue(sNumericOnly);
                if (oModel) {
                    oModel.setProperty("/form/phoneNo", sNumericOnly);
                    oModel.setProperty("/form/phoneValueState", ValueState.Error);
                    oModel.setProperty("/form/phoneValueStateText", "Phone number cannot exceed 10 characters.");
                }
                oInput.setValueState(ValueState.Error);
                oInput.setValueStateText("Phone number cannot exceed 10 characters.");
                return;
            }

            if (oModel) {
                oModel.setProperty("/form/phoneNo", sValue);
                oModel.setProperty("/form/phoneValueState", ValueState.None);
                oModel.setProperty("/form/phoneValueStateText", "");
            }
            oInput.setValueState(ValueState.None);
            oInput.setValueStateText("");
        },

        onCancelUser: function () {
            const oModel = this.getView().getModel("userModel");
            if (oModel) {
                oModel.setProperty("/form/phoneValueState", ValueState.None);
                oModel.setProperty("/form/phoneValueStateText", "");
            }
            const oPhoneInput = this.byId("inputPhone");
            if (oPhoneInput) {
                oPhoneInput.setValueState(ValueState.None);
                oPhoneInput.setValueStateText("");
            }
            this._getUserDialog().then(oDialog => oDialog.close());
        },

        onSaveUser: async function () {
            const oModel = this.getView().getModel("userModel");
            const oForm = oModel.getProperty("/form");
            const isEdit = oModel.getProperty("/isEdit");

            // Validations
            if (!oForm.name || !oForm.name.trim()) {
                return MessageToast.show("Full Name is mandatory.");
            }
            if (!oForm.username || !oForm.username.trim()) {
                return MessageToast.show("Username is mandatory.");
            }
            if (!isEdit && (!oForm.password || !oForm.password.trim())) {
                return MessageToast.show("Password is required for new user creation.");
            }

            const aRoles = oForm.selectedRoleKeys || [];
            if (aRoles.length === 0) {
                return MessageToast.show("Please assign at least one role to the user.");
            }

            // Phone validation: only numbers and max 10 characters
            const sPhone = (oForm.phoneNo || "").trim();
            if (sPhone) {
                const bOnlyDigits = /^\d+$/.test(sPhone);
                if (!bOnlyDigits) {
                    oModel.setProperty("/form/phoneValueState", ValueState.Error);
                    oModel.setProperty("/form/phoneValueStateText", "Phone number must contain only numbers.");
                    const oPhoneInput = this.byId("inputPhone");
                    if (oPhoneInput) {
                        oPhoneInput.setValueState(ValueState.Error);
                        oPhoneInput.setValueStateText("Phone number must contain only numbers.");
                    }
                    return MessageToast.show("Phone number must contain only numbers.");
                }

                if (sPhone.length > 10) {
                    oModel.setProperty("/form/phoneValueState", ValueState.Error);
                    oModel.setProperty("/form/phoneValueStateText", "Phone number cannot exceed 10 characters.");
                    const oPhoneInput = this.byId("inputPhone");
                    if (oPhoneInput) {
                        oPhoneInput.setValueState(ValueState.Error);
                        oPhoneInput.setValueStateText("Phone number cannot exceed 10 characters.");
                    }
                    return MessageToast.show("Phone number cannot exceed 10 characters.");
                }
            }

            // Reset phone validation state on successful check
            oModel.setProperty("/form/phoneValueState", ValueState.None);
            oModel.setProperty("/form/phoneValueStateText", "");
            const oPhoneInput = this.byId("inputPhone");
            if (oPhoneInput) {
                oPhoneInput.setValueState(ValueState.None);
                oPhoneInput.setValueStateText("");
            }

            const sAssignedRoles = aRoles.join(", ");
            const oDialog = await this._getUserDialog();

            try {
                oDialog.setBusy(true);

                let endpoint = `${ODATA_BASE}/CreateUser`;
                let bodyData = {
                    username: oForm.username.trim().toLowerCase(),
                    password: oForm.password ? oForm.password.trim() : "",
                    name: oForm.name.trim(),
                    employeeId: (oForm.employeeId || "").trim(),
                    designation: (oForm.designation || "").trim(),
                    department: (oForm.department || "").trim(),
                    email: (oForm.email || "").trim(),
                    phoneNo: sPhone,
                    serviceStatus: oForm.serviceStatus || "IN_SERVICE",
                    status: oForm.status || "ACTIVE",
                    assignedRoles: sAssignedRoles,
                    remarks: (oForm.remarks || "").trim()
                };

                if (isEdit) {
                    endpoint = `${ODATA_BASE}/UpdateUser`;
                    bodyData.ID = oForm.ID;
                }

                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(bodyData)
                });

                const data = await res.json();
                if (!res.ok) {
                    const errMsg = data.error?.message || "Error saving user account.";
                    throw new Error(errMsg);
                }

                // Update local authentication password store
                if (bodyData.password && typeof models.setPasswordForUser === "function") {
                    models.setPasswordForUser(bodyData.username, bodyData.password);
                }

                MessageToast.show(isEdit ? `User @${bodyData.username} updated successfully!` : `User @${bodyData.username} created successfully!`);
                oDialog.close();
                await this.loadUsersData();
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                oDialog.setBusy(false);
            }
        },

        onToggleStatusPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("userModel");
            if (!oCtx) return;
            const u = oCtx.getObject();

            if (u.username === "superadmin_user") {
                return MessageBox.warning("The primary Superadmin account cannot be deactivated.");
            }

            const nextStatus = (u.status === "ACTIVE") ? "Inactive" : "Active";
            const sAction = (u.status === "ACTIVE") ? "deactivate" : "activate";

            MessageBox.confirm(`Are you sure you want to ${sAction} user account @${u.username} (${u.name})?`, {
                title: "Confirm Status Change",
                onClose: async (oAction) => {
                    if (oAction !== MessageBox.Action.OK) return;

                    try {
                        const res = await fetch(`${ODATA_BASE}/ToggleUserStatus`, {
                            method: "POST",
                            headers: {
                                "Authorization": models.getAuthHeaderValue(),
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ ID: u.ID })
                        });

                        const data = await res.json();
                        if (!res.ok) {
                            throw new Error(data.error?.message || "Error updating user status.");
                        }

                        MessageToast.show(`User @${u.username} set to ${nextStatus}.`);
                        this.loadUsersData();
                    } catch (err) {
                        MessageBox.error(err.message);
                    }
                }
            });
        },

        onDeleteUserPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("userModel");
            if (!oCtx) return;
            const u = oCtx.getObject();

            if (u.username === "superadmin_user") {
                return MessageBox.error("The primary Superadmin account cannot be deleted.");
            }

            MessageBox.confirm(`Are you sure you want to permanently delete user @${u.username} (${u.name}) and remove all their assigned roles?`, {
                title: "Confirm Delete User",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: async (oAction) => {
                    if (oAction !== MessageBox.Action.DELETE) return;

                    try {
                        const res = await fetch(`${ODATA_BASE}/DeleteUser`, {
                            method: "POST",
                            headers: {
                                "Authorization": models.getAuthHeaderValue(),
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ ID: u.ID })
                        });

                        const data = await res.json();
                        if (!res.ok) {
                            throw new Error(data.error?.message || "Error deleting user.");
                        }

                        MessageToast.show(`User @${u.username} deleted.`);
                        this.loadUsersData();
                    } catch (err) {
                        MessageBox.error(err.message);
                    }
                }
            });
        }
    });
});
