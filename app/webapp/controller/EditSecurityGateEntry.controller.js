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

    return Controller.extend("factory.gate.controller.EditSecurityGateEntry", {
        formatter: formatter,

        onInit: function () {
            this._oSecEditModel = new JSONModel({
                ID: "",
                gateTransaction_ID: "",
                gateInNumber: "",
                vehicleRegNo: "",
                driverName: "",
                purpose: "DELIVERY",
                transactionStatus: "GATE_IN",
                currentStage: "MAIN_GATE_IN",

                // Security IN Details
                driverLicenseNo: "",
                driverPhoneNo: "",
                helperName: "",
                vehicleReportingDateTime: null,
                securityInDateTime: null,
                securityPersonnel: "",
                driverVerified: false,
                vehicleVerified: false,
                documentsVerified: false,

                // Inbound Delivery Documentation
                withoutPO: false,
                poNumber: "",
                soNumber: "",
                invoiceNumber: "",
                invoiceDate: null,

                // Inbound Pickup Documentation
                gatePassType: "",
                rgpDocumentNo: "",
                nrgpDocumentNo: "",
                securityInRemarks: "",

                // Security OUT Details
                securityOutPersonnel: "",
                securityOutDateTime: null,
                exitGatePassType: "",
                exitGatePassDocumentNo: "",
                exitDriverVerified: false,
                exitVehicleVerified: false,
                exitDocumentsVerified: false,
                emptyInspectionVerified: false,
                materialInspected: false,
                gatePassVerified: false,
                deliveryDetailsVerified: false,
                securityOutRemarks: "",

                // Combined Remarks
                remarks: ""
            });
            this.getView().setModel(this._oSecEditModel, "secEditModel");

            this._originalData = null;
        },

        loadTransaction: async function (txOrId) {
            let sId = "";
            let sGateInNo = "";
            if (typeof txOrId === "string") {
                sId = txOrId;
            } else if (txOrId && txOrId.ID) {
                sId = txOrId.ID;
                sGateInNo = txOrId.gateInNumber || "";
            } else if (txOrId && txOrId.gateInNumber) {
                sGateInNo = txOrId.gateInNumber;
            }

            const oPage = this.byId("editSecGateEntryPageControl");
            if (oPage) oPage.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                let oTx = null;
                if (sId) {
                    const resTx = await fetch(`${ODATA_BASE}/GateTransactions(${sId})?$expand=securityEntry,driver`, { headers });
                    if (resTx.ok) {
                        oTx = await resTx.json();
                    }
                } else if (sGateInNo) {
                    const resTx = await fetch(`${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${sGateInNo}'&$expand=securityEntry,driver`, { headers });
                    if (resTx.ok) {
                        const d = await resTx.json();
                        oTx = (d.value && d.value[0]) || null;
                    }
                }

                if (!oTx) {
                    throw new Error("Unable to locate Gate Transaction record for Security Entry editing.");
                }

                // If securityEntry wasn't expanded directly, try fetching it via gateTransaction_ID
                let sec = oTx.securityEntry || null;
                if (!sec) {
                    const resSec = await fetch(`${ODATA_BASE}/SecurityGateEntries?$filter=gateTransaction_ID eq '${oTx.ID}'`, { headers });
                    if (resSec.ok) {
                        const dSec = await resSec.json();
                        sec = (dSec.value && dSec.value[0]) || null;
                    }
                }

                const activeUser = models.getActiveUser();
                const defaultOfficer = activeUser.includes("security") ? activeUser : (activeUser === "superadmin_user" ? "SecurityChief" : "security_user");

                const editData = {
                    ID: sec ? sec.ID : "",
                    gateTransaction_ID: oTx.ID,
                    gateInNumber: oTx.gateInNumber,
                    vehicleRegNo: oTx.vehicleRegNo,
                    driverName: oTx.driverName || (oTx.driver && oTx.driver.driverName) || "",
                    purpose: oTx.purpose || "DELIVERY",
                    transactionStatus: oTx.status || "GATE_IN",
                    currentStage: oTx.currentStage || "MAIN_GATE_IN",

                    // Security IN Details
                    driverLicenseNo: (sec && sec.driverLicenseNo) || (oTx.driver && oTx.driver.drivingLicenseNo) || "",
                    driverPhoneNo: (sec && sec.driverPhoneNo) || (oTx.driver && oTx.driver.phoneNo) || "",
                    helperName: (sec && sec.helperName) || "",
                    vehicleReportingDateTime: (sec && sec.vehicleReportingDateTime) || oTx.gateInDateTime || null,
                    securityInDateTime: (sec && sec.securityInDateTime) || (oTx.status !== "GATE_IN" ? oTx.gateInDateTime : null),
                    securityPersonnel: (sec && sec.securityPersonnel) || defaultOfficer,
                    driverVerified: sec ? Boolean(sec.driverVerified) : true,
                    vehicleVerified: sec ? Boolean(sec.vehicleVerified) : true,
                    documentsVerified: sec ? Boolean(sec.documentsVerified) : true,

                    // Inbound Delivery Documentation
                    withoutPO: sec ? Boolean(sec.withoutPO) : false,
                    poNumber: (sec && sec.poNumber) || "",
                    soNumber: (sec && sec.soNumber) || "",
                    invoiceNumber: (sec && sec.invoiceNumber) || "",
                    invoiceDate: (sec && sec.invoiceDate) || null,

                    // Inbound Pickup Documentation
                    gatePassType: (sec && sec.gatePassType) || "",
                    rgpDocumentNo: (sec && sec.rgpDocumentNo) || "",
                    nrgpDocumentNo: (sec && sec.nrgpDocumentNo) || "",
                    securityInRemarks: (sec && sec.securityInRemarks) || "",

                    // Security OUT Details
                    securityOutPersonnel: (sec && sec.securityOutPersonnel) || defaultOfficer,
                    securityOutDateTime: (sec && sec.securityOutDateTime) || null,
                    exitGatePassType: (sec && sec.exitGatePassType) || (sec && sec.gatePassType) || "",
                    exitGatePassDocumentNo: (sec && sec.exitGatePassDocumentNo) || (sec && (sec.rgpDocumentNo || sec.nrgpDocumentNo)) || "",
                    exitDriverVerified: sec ? Boolean(sec.exitDriverVerified) : false,
                    exitVehicleVerified: sec ? Boolean(sec.exitVehicleVerified) : false,
                    exitDocumentsVerified: sec ? Boolean(sec.exitDocumentsVerified) : false,
                    emptyInspectionVerified: sec ? Boolean(sec.emptyInspectionVerified) : (oTx.purpose === "DELIVERY"),
                    materialInspected: sec ? Boolean(sec.materialInspected) : (oTx.purpose === "PICKUP"),
                    gatePassVerified: sec ? Boolean(sec.gatePassVerified) : false,
                    deliveryDetailsVerified: sec ? Boolean(sec.deliveryDetailsVerified) : false,
                    securityOutRemarks: (sec && sec.securityOutRemarks) || "",

                    // General Remarks
                    remarks: (sec && sec.remarks) || (oTx && oTx.remarks) || ""
                };

                this._oSecEditModel.setData(editData);
                this._originalData = JSON.parse(JSON.stringify(editData));

                const oTabBar = this.byId("secEditTabBar");
                if (oTabBar) {
                    oTabBar.setSelectedKey("secInTab");
                }
            } catch (err) {
                console.error("Error loading Security Gate Entry:", err);
                MessageBox.error(err.message || "Failed to load Security Gate Entry.");
            } finally {
                if (oPage) oPage.setBusy(false);
            }
        },

        onDateTimeChange: function (oEvt) {
            const oSource = oEvt.getSource();
            const sField = oSource.data("field");
            const oDate = oSource.getDateValue();
            if (sField && oDate) {
                this._oSecEditModel.setProperty("/" + sField, oDate.toISOString());
            }
        },

        onWithoutPOToggle: function (oEvt) {
            const bChecked = oEvt.getParameter("state");
            this._oSecEditModel.setProperty("/withoutPO", bChecked);

            const oPoInput = this.byId("inputSecPoNumber");
            const oInvInput = this.byId("inputSecInvoiceNumber");
            if (bChecked) {
                if (oPoInput) oPoInput.setValueState(ValueState.None);
                if (oInvInput) oInvInput.setValueState(ValueState.None);
                MessageToast.show("Without PO: PO & Invoice requirements relaxed.");
            }
        },

        _hasUnsavedChanges: function () {
            if (!this._originalData) return false;
            const current = this._oSecEditModel.getData();
            const orig = this._originalData;

            const fields = [
                "driverLicenseNo",
                "driverPhoneNo",
                "helperName",
                "securityPersonnel",
                "vehicleReportingDateTime",
                "securityInDateTime",
                "driverVerified",
                "vehicleVerified",
                "documentsVerified",
                "withoutPO",
                "poNumber",
                "soNumber",
                "invoiceNumber",
                "invoiceDate",
                "gatePassType",
                "rgpDocumentNo",
                "nrgpDocumentNo",
                "securityInRemarks",
                "securityOutPersonnel",
                "securityOutDateTime",
                "exitGatePassType",
                "exitGatePassDocumentNo",
                "exitDriverVerified",
                "exitVehicleVerified",
                "exitDocumentsVerified",
                "emptyInspectionVerified",
                "materialInspected",
                "gatePassVerified",
                "deliveryDetailsVerified",
                "securityOutRemarks",
                "remarks"
            ];

            return fields.some(f => current[f] !== orig[f]);
        },

        onDriverPhoneLiveChange: function (oEvt) {
            const oInput = oEvt.getSource();
            let sVal = oEvt.getParameter("value") || "";
            // Keep only numbers and max 10 digits
            const sDigits = sVal.replace(/\D/g, "").slice(0, 10);

            if (sVal !== sDigits) {
                oInput.setValue(sDigits);
                this._oSecEditModel.setProperty("/driverPhoneNo", sDigits);
            }

            if (sDigits.length === 0) {
                oInput.setValueState(ValueState.None);
                oInput.setValueStateText("");
            } else if (sDigits.length < 10) {
                oInput.setValueState(ValueState.Warning);
                oInput.setValueStateText(`Enter 10 numeric digits (${sDigits.length}/10)`);
            } else {
                oInput.setValueState(ValueState.Success);
                oInput.setValueStateText("Valid 10-digit phone number");
            }
        },

        onSave: async function () {
            const m = this._oSecEditModel.getData();

            // 1. Mandatory Validations
            const oLicInput = this.byId("inputSecDriverLicense");
            if (!m.driverLicenseNo || !m.driverLicenseNo.trim()) {
                if (oLicInput) oLicInput.setValueState(ValueState.Error);
                MessageBox.error("Driver License Number is mandatory for Security Gate Entry.");
                return;
            }
            if (oLicInput) oLicInput.setValueState(ValueState.None);

            const oPhoneInput = this.byId("inputSecDriverPhone");
            if (m.driverPhoneNo && m.driverPhoneNo.trim()) {
                const sPhone = m.driverPhoneNo.trim();
                if (!/^\d+$/.test(sPhone)) {
                    if (oPhoneInput) {
                        oPhoneInput.setValueState(ValueState.Error);
                        oPhoneInput.setValueStateText("Driver Phone No must contain only numbers (0-9).");
                    }
                    MessageBox.error("Invalid Driver Phone No:\nOnly numbers (0-9) are allowed.");
                    return;
                }
                if (sPhone.length > 10) {
                    if (oPhoneInput) {
                        oPhoneInput.setValueState(ValueState.Error);
                        oPhoneInput.setValueStateText("Driver Phone No cannot exceed 10 digits.");
                    }
                    MessageBox.error("Invalid Driver Phone No:\nMaximum 10 digits allowed.");
                    return;
                }
                if (sPhone.length < 10) {
                    if (oPhoneInput) {
                        oPhoneInput.setValueState(ValueState.Error);
                        oPhoneInput.setValueStateText("Driver Phone No must be exactly 10 digits.");
                    }
                    MessageBox.error("Invalid Driver Phone No:\nPlease enter a complete 10-digit mobile number.");
                    return;
                }
                if (oPhoneInput) oPhoneInput.setValueState(ValueState.None);
            }

            const oSecInput = this.byId("inputSecPersonnel");
            if (!m.securityPersonnel || !m.securityPersonnel.trim()) {
                if (oSecInput) oSecInput.setValueState(ValueState.Error);
                MessageBox.error("Security IN Officer name is mandatory.");
                return;
            }
            if (oSecInput) oSecInput.setValueState(ValueState.None);

            const oPoInput = this.byId("inputSecPoNumber");
            const oInvInput = this.byId("inputSecInvoiceNumber");

            if (m.purpose === "DELIVERY" && !m.withoutPO) {
                let bError = false;
                let sMsg = "";

                if (!m.poNumber || !m.poNumber.trim()) {
                    if (oPoInput) oPoInput.setValueState(ValueState.Error);
                    bError = true;
                    sMsg = "Purchase Order (PO) Number is mandatory for Delivery entries.\n(Or toggle 'Without PO Allowed' if authorized).";
                } else {
                    if (oPoInput) oPoInput.setValueState(ValueState.None);
                }

                if (!m.invoiceNumber || !m.invoiceNumber.trim()) {
                    if (oInvInput) oInvInput.setValueState(ValueState.Error);
                    bError = true;
                    sMsg = (sMsg ? sMsg + "\n" : "") + "Invoice Number is mandatory for Delivery entries.";
                } else {
                    if (oInvInput) oInvInput.setValueState(ValueState.None);
                }

                if (bError) {
                    MessageBox.error(sMsg);
                    return;
                }
            }

            // 2. Prepare Payload matching SecurityGateEntries in schema.cds
            const payload = {
                gateTransaction_ID: m.gateTransaction_ID,
                gateInNumber: m.gateInNumber,
                driverLicenseNo: m.driverLicenseNo ? m.driverLicenseNo.trim() : "",
                driverPhoneNo: m.driverPhoneNo ? m.driverPhoneNo.trim() : "",
                helperName: m.helperName ? m.helperName.trim() : "",
                vehicleReportingDateTime: m.vehicleReportingDateTime || null,
                securityInDateTime: m.securityInDateTime || null,
                securityPersonnel: m.securityPersonnel ? m.securityPersonnel.trim() : "",
                driverVerified: Boolean(m.driverVerified),
                vehicleVerified: Boolean(m.vehicleVerified),
                documentsVerified: Boolean(m.documentsVerified),
                poNumber: m.poNumber ? m.poNumber.trim() : "",
                soNumber: m.soNumber ? m.soNumber.trim() : "",
                invoiceNumber: m.invoiceNumber ? m.invoiceNumber.trim() : "",
                invoiceDate: m.invoiceDate || null,
                withoutPO: Boolean(m.withoutPO),
                rgpDocumentNo: m.rgpDocumentNo ? m.rgpDocumentNo.trim() : "",
                nrgpDocumentNo: m.nrgpDocumentNo ? m.nrgpDocumentNo.trim() : "",
                gatePassType: m.gatePassType || null,
                securityInRemarks: m.securityInRemarks ? m.securityInRemarks.trim() : "",
                securityOutPersonnel: m.securityOutPersonnel ? m.securityOutPersonnel.trim() : null,
                securityOutDateTime: m.securityOutDateTime || null,
                exitGatePassType: m.exitGatePassType || null,
                exitGatePassDocumentNo: m.exitGatePassDocumentNo ? m.exitGatePassDocumentNo.trim() : "",
                exitDriverVerified: Boolean(m.exitDriverVerified),
                exitVehicleVerified: Boolean(m.exitVehicleVerified),
                exitDocumentsVerified: Boolean(m.exitDocumentsVerified),
                emptyInspectionVerified: Boolean(m.emptyInspectionVerified),
                materialInspected: Boolean(m.materialInspected),
                gatePassVerified: Boolean(m.gatePassVerified),
                deliveryDetailsVerified: Boolean(m.deliveryDetailsVerified),
                securityOutRemarks: m.securityOutRemarks ? m.securityOutRemarks.trim() : "",
                remarks: m.remarks ? m.remarks.trim() : ""
            };

            const oPage = this.byId("editSecGateEntryPageControl");
            if (oPage) oPage.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                let res = null;
                if (m.ID) {
                    // Update existing consolidated security record
                    res = await fetch(`${ODATA_BASE}/SecurityGateEntries(${m.ID})`, {
                        method: "PATCH",
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create consolidated security record if not yet created
                    res = await fetch(`${ODATA_BASE}/SecurityGateEntries`, {
                        method: "POST",
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                }

                if (!res.ok) {
                    let sErr = "Failed to update Security Gate Entry";
                    try {
                        const errData = await res.json();
                        sErr = errData.error?.message || sErr;
                    } catch (e) {}
                    throw new Error(sErr);
                }

                MessageToast.show(`Security Gate Entry for ${m.gateInNumber} successfully saved!`);

                this.getOwnerComponent().loadOverviewData();

                // Navigate back to Security Gate Operations
                this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
            } catch (err) {
                MessageBox.error(err.message || "Failed to save Security Gate Entry.");
            } finally {
                if (oPage) oPage.setBusy(false);
            }
        },

        onReset: function () {
            if (this._originalData) {
                this._oSecEditModel.setData(JSON.parse(JSON.stringify(this._originalData)));
                MessageToast.show("Form reset to saved values.");
            }
        },

        onCancel: function () {
            this.onNavBack();
        },

        onNavBack: function () {
            if (this._hasUnsavedChanges()) {
                MessageBox.confirm("You have unsaved changes. Discard them and return to Security Gate Operations?", {
                    title: "Unsaved Changes",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
                        }
                    }.bind(this)
                });
            } else {
                this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
            }
        },

        onNavSecurityOps: function () {
            this.onNavBack();
        },

        onNavMainGateOps: function () {
            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
        },

        onNavWeighbridgeOps: function () {
            this.getOwnerComponent().navigateTo("weighbridgeOpsPage", "slide");
        },

        onRefresh: function () {
            const sGateInNo = this._oSecEditModel.getProperty("/gateInNumber");
            const sId = this._oSecEditModel.getProperty("/gateTransaction_ID");
            if (sId || sGateInNo) {
                this.loadTransaction({ ID: sId, gateInNumber: sGateInNo });
                MessageToast.show("Security Gate Entry refreshed");
            }
        }
    });
});
