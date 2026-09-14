sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "factory/gate/model/formatter",
    "factory/gate/model/models"
], function (Controller, JSONModel, MessageToast, MessageBox, coreLibrary, formatter, models) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const ODATA_BASE = "/gate";

    return Controller.extend("factory.gate.controller.EditGateEntry", {
        formatter: formatter,

        onInit: function () {
            this._oEditModel = new JSONModel({
                ID: "",
                gateInNumber: "",
                vehicleRegNo: "",
                vehicleType: "TRUCK",
                driverName: "",
                purpose: "DELIVERY",
                status: "GATE_IN",
                currentStage: "MAIN_GATE_IN",
                gateInDateTime: null,
                gateInOperator: "",
                gateOutDateTime: null,
                gateOutOperator: "",
                remarks: "",
                transporter_ID: "",
                supplier_ID: "",
                driver_ID: "",
                vehicle: null,
                driver: null,
                transporter: null,
                supplier: null,
                securityEntry: null,
                deliveryDetails: null,
                pickupDetails: null,
                weighments: [],
                auditLogs: [],
                vehicleRegNoState: ValueState.None,
                vehicleRegNoStateText: "",
                isBusy: false
            });
            this.getView().setModel(this._oEditModel, "editModel");

            this._oMasterModel = new JSONModel({
                transporters: [],
                suppliers: [],
                drivers: []
            });
            this.getView().setModel(this._oMasterModel, "masterModel");

            this._originalData = null;
            this.loadMasterData();
        },

        loadMasterData: async function () {
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const [resTrans, resSupp, resDrivers] = await Promise.all([
                    fetch(`${ODATA_BASE}/Transporters?$filter=active eq true&$orderby=transporterName asc`, { headers }),
                    fetch(`${ODATA_BASE}/Suppliers?$filter=active eq true&$orderby=supplierName asc`, { headers }),
                    fetch(`${ODATA_BASE}/Drivers?$filter=active eq true&$orderby=driverName asc`, { headers })
                ]);

                if (resTrans.ok) {
                    const d = await resTrans.json();
                    this._oMasterModel.setProperty("/transporters", d.value || []);
                }
                if (resSupp.ok) {
                    const d = await resSupp.json();
                    this._oMasterModel.setProperty("/suppliers", d.value || []);
                }
                if (resDrivers.ok) {
                    const d = await resDrivers.json();
                    this._oMasterModel.setProperty("/drivers", d.value || []);
                }
            } catch (e) {
                console.warn("Failed to load master data dropdowns:", e);
            }
        },

        loadTransaction: async function (txOrId) {
            let sId = "";
            if (typeof txOrId === "string") {
                sId = txOrId;
            } else if (txOrId && txOrId.ID) {
                sId = txOrId.ID;
            }

            if (!sId) {
                MessageToast.show("No transaction identifier provided");
                return;
            }

            const oPage = this.byId("editGateEntryPageControl");
            if (oPage) {
                oPage.setBusy(true);
            }

            // Ensure master data is loaded
            if (!this._oMasterModel.getProperty("/transporters") || this._oMasterModel.getProperty("/transporters").length === 0) {
                this.loadMasterData();
            }

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const url = `${ODATA_BASE}/GateTransactions(${sId})?$expand=vehicle,driver,transporter,supplier,securityEntry,deliveryDetails,pickupDetails,weighments,auditLogs`;
                const res = await fetch(url, { headers });

                if (!res.ok) {
                    throw new Error(`Failed to load Gate Transaction (HTTP ${res.status}): ${res.statusText}`);
                }

                const data = await res.json();

                // Sort weighments and auditLogs chronologically
                if (data.weighments && Array.isArray(data.weighments)) {
                    data.weighments.sort((a, b) => new Date(b.weighbridgeDateTime || 0) - new Date(a.weighbridgeDateTime || 0));
                }
                if (data.auditLogs && Array.isArray(data.auditLogs)) {
                    data.auditLogs.sort((a, b) => new Date(b.actionDateTime || 0) - new Date(a.actionDateTime || 0));
                }

                data.vehicleRegNoState = ValueState.None;
                data.vehicleRegNoStateText = "";

                this._oEditModel.setData(data);
                this._originalData = JSON.parse(JSON.stringify(data));

                // Reset TabBar to first tab
                const oTabBar = this.byId("editTabBar");
                if (oTabBar) {
                    oTabBar.setSelectedKey("generalTab");
                }
            } catch (err) {
                MessageBox.error(err.message || "Failed to load Gate Transaction data.");
            } finally {
                if (oPage) {
                    oPage.setBusy(false);
                }
            }
        },

        _validateVehicleRegNo: function (sVal) {
            if (!sVal) {
                this._oEditModel.setProperty("/vehicleRegNoState", ValueState.Error);
                this._oEditModel.setProperty("/vehicleRegNoStateText", "Vehicle Registration Number is mandatory.");
                return false;
            }

            const sClean = sVal.trim().toUpperCase();
            // Expected format: AS-02-1234 or AS-02-AB-1234 or MH-04-JK-9999
            const regex = /^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$/;
            if (!regex.test(sClean)) {
                this._oEditModel.setProperty("/vehicleRegNoState", ValueState.Error);
                this._oEditModel.setProperty("/vehicleRegNoStateText", "Invalid format. Expected: AS-02-1234 or AS-02-AB-1234 (e.g. MH-04-JK-9999)");
                return false;
            }

            this._oEditModel.setProperty("/vehicleRegNoState", ValueState.Success);
            this._oEditModel.setProperty("/vehicleRegNoStateText", "");
            return true;
        },

        onVehicleRegLiveChange: function (oEvt) {
            let sVal = (oEvt.getParameter("value") || "").trim().toUpperCase();
            this._oEditModel.setProperty("/vehicleRegNo", sVal);
            this._validateVehicleRegNo(sVal);
        },

        onVehicleRegChange: function (oEvt) {
            let sVal = (oEvt.getParameter("value") || "").trim().toUpperCase();
            this._oEditModel.setProperty("/vehicleRegNo", sVal);
            this._validateVehicleRegNo(sVal);
        },

        _hasUnsavedChanges: function () {
            if (!this._originalData) return false;
            const current = this._oEditModel.getData();
            const orig = this._originalData;

            const fields = [
                "vehicleRegNo",
                "vehicleType",
                "driverName",
                "purpose",
                "status",
                "currentStage",
                "gateInOperator",
                "gateOutOperator",
                "remarks",
                "transporter_ID",
                "supplier_ID",
                "driver_ID"
            ];

            return fields.some(f => (current[f] || "") !== (orig[f] || ""));
        },

        onSave: async function () {
            const oData = this._oEditModel.getData();

            // 1. Validate mandatory fields
            const bRegValid = this._validateVehicleRegNo(oData.vehicleRegNo);
            if (!bRegValid) {
                MessageBox.error("Please enter a valid Vehicle Registration Number before saving.");
                return;
            }

            if (!oData.driverName || !oData.driverName.trim()) {
                MessageBox.error("Driver Name is mandatory.");
                return;
            }

            if (!oData.purpose) {
                MessageBox.error("Visit Purpose is mandatory.");
                return;
            }

            // 2. Check if anything was modified
            if (!this._hasUnsavedChanges()) {
                MessageToast.show("No modifications detected to save.");
                return;
            }

            // 3. Prepare payload for OData PATCH
            const payload = {
                vehicleRegNo: (oData.vehicleRegNo || "").trim().toUpperCase(),
                vehicleType: oData.vehicleType || "TRUCK",
                driverName: (oData.driverName || "").trim(),
                purpose: oData.purpose,
                status: oData.status,
                currentStage: oData.currentStage,
                remarks: oData.remarks || "",
                gateInOperator: oData.gateInOperator || "",
                gateOutOperator: oData.gateOutOperator || null,
                transporter_ID: oData.transporter_ID || null,
                supplier_ID: oData.supplier_ID || null,
                driver_ID: oData.driver_ID || null
            };

            // Automatically set gateOutDateTime if status completed
            if (payload.status === "COMPLETED" && !oData.gateOutDateTime) {
                payload.gateOutDateTime = new Date().toISOString();
                if (!payload.gateOutOperator) {
                    payload.gateOutOperator = models.getActiveUser();
                }
            }

            const oPage = this.byId("editGateEntryPageControl");
            if (oPage) oPage.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const res = await fetch(`${ODATA_BASE}/GateTransactions(${oData.ID})`, {
                    method: "PATCH",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errMsg = "Failed to update Gate Entry";
                    try {
                        const errBody = await res.json();
                        errMsg = errBody.error?.message || errMsg;
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                MessageToast.show(`Gate Entry '${oData.gateInNumber}' updated successfully!`);

                // Reload overview data in background so main lists & counters are in sync
                this.getOwnerComponent().loadOverviewData();

                // Reload current transaction to show updated audit logs and timestamps
                await this.loadTransaction(oData.ID);
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                if (oPage) oPage.setBusy(false);
            }
        },

        onReset: function () {
            if (!this._originalData) return;

            if (!this._hasUnsavedChanges()) {
                MessageToast.show("Form is already at original values.");
                return;
            }

            MessageBox.confirm("Are you sure you want to discard all your changes and reset the form?", {
                title: "Confirm Discard",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        const restored = JSON.parse(JSON.stringify(this._originalData));
                        restored.vehicleRegNoState = ValueState.None;
                        restored.vehicleRegNoStateText = "";
                        this._oEditModel.setData(restored);
                        MessageToast.show("Changes reverted to saved values.");
                    }
                }.bind(this)
            });
        },

        onCancel: function () {
            this.onNavBack();
        },

        onNavBack: function () {
            if (this._hasUnsavedChanges()) {
                MessageBox.confirm("You have unsaved changes. Do you want to discard them and return to Main Gate Operations?", {
                    title: "Unsaved Changes",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
                        }
                    }.bind(this)
                });
            } else {
                this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
            }
        },

        onNavMainGateOps: function () {
            this.onNavBack();
        },

        onNavSecurityOps: function () {
            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
        },

        onNavWeighbridgeOps: function () {
            this.getOwnerComponent().navigateTo("weighbridgeOpsPage", "slide");
        },

        onRefresh: function () {
            const sId = this._oEditModel.getProperty("/ID");
            if (sId) {
                this.loadTransaction(sId);
                MessageToast.show("Gate Entry refreshed");
            }
        }
    });
});
