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

    return Controller.extend("factory.gate.controller.SecurityOperations", {
        formatter: formatter,

        onInit: function () {
            const activeUser = models.getActiveUser();
            const oSecModel = new JSONModel({
                selectedGateInNumber: "",
                selectedVehicle: null,
                driverLicenseNo: "",
                driverPhoneNo: "",
                helperName: "",
                securityPersonnel: activeUser.includes("security") ? activeUser : "security_user",
                driverVerified: true,
                vehicleVerified: true,
                documentsVerified: true,
                withoutPO: false,
                poNumber: "",
                soNumber: "",
                invoiceNumber: "",
                invoiceDate: null,
                isDelivery: true,
                isPickup: false,
                rgpDocumentNo: "",
                nrgpDocumentNo: "",
                gatePassType: "",
                gatePassVerified: false,
                emptyInspectionVerified: true,
                remarks: "",
                waitingVehicles: [],
                clearedEntries: []
            });
            this.getView().setModel(oSecModel, "secModel");

            this.loadSecurityData();
        },

        loadSecurityData: async function () {
            const oSecModel = this.getView().getModel("secModel");
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                // 1. Fetch Waiting Vehicles (status eq 'GATE_IN')
                const resWaiting = await fetch(`${ODATA_BASE}/GateTransactions?$filter=status eq 'GATE_IN'&$orderby=createdAt desc`, { headers });
                if (resWaiting.ok) {
                    const dataWaiting = await resWaiting.json();
                    const aWaiting = dataWaiting.value || [];
                    oSecModel.setProperty("/waitingVehicles", aWaiting);

                    // If a vehicle is currently selected, refresh its data
                    const currentGateIn = oSecModel.getProperty("/selectedGateInNumber");
                    if (currentGateIn) {
                        const matched = aWaiting.find(v => v.gateInNumber === currentGateIn);
                        if (matched) {
                            oSecModel.setProperty("/selectedVehicle", matched);
                            oSecModel.setProperty("/isDelivery", matched.purpose === "DELIVERY");
                            oSecModel.setProperty("/isPickup", matched.purpose === "PICKUP");
                        }
                    } else if (aWaiting.length > 0) {
                        // Auto-select first waiting vehicle for convenience
                        this.selectVehicleByGateIn(aWaiting[0].gateInNumber);
                    }
                }

                // 2. Fetch Cleared Security Entries
                const resCleared = await fetch(`${ODATA_BASE}/SecurityGateEntries?$orderby=createdAt desc&$top=50`, { headers });
                if (resCleared.ok) {
                    const dataCleared = await resCleared.json();
                    oSecModel.setProperty("/clearedEntries", dataCleared.value || []);
                }
            } catch (err) {
                console.error("Error loading security queue:", err);
            }
        },

        onRefreshQueue: function () {
            this.loadSecurityData();
            MessageToast.show("Security queue refreshed");
        },

        onGateInSelectChange: function (oEvt) {
            let sKey = "";
            if (oEvt) {
                const oSelectedItem = oEvt.getParameter("selectedItem");
                if (oSelectedItem) {
                    sKey = oSelectedItem.getKey();
                } else {
                    const sTypedVal = (oEvt.getParameter("newValue") || (oEvt.getSource && oEvt.getSource().getValue ? oEvt.getSource().getValue() : "")).trim();
                    const aWaiting = this.getView().getModel("secModel").getProperty("/waitingVehicles") || [];
                    const matched = aWaiting.find(v =>
                        v.gateInNumber.toLowerCase() === sTypedVal.toLowerCase() ||
                        (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === sTypedVal.toLowerCase())
                    );
                    sKey = matched ? matched.gateInNumber : sTypedVal;
                }
            }
            if (!sKey) {
                sKey = this.getView().getModel("secModel").getProperty("/selectedGateInNumber");
            }
            this.selectVehicleByGateIn(sKey);
        },

        selectVehicleByGateIn: async function (gateInNumber) {
            const oSecModel = this.getView().getModel("secModel");
            const aWaiting = oSecModel.getProperty("/waitingVehicles") || [];
            let vehicle = aWaiting.find(v =>
                v.gateInNumber.toLowerCase() === (gateInNumber || "").toLowerCase() ||
                (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === (gateInNumber || "").toLowerCase())
            );

            // If not found in loaded waiting list, fetch from server by Gate IN # or Vehicle Reg No
            if (!vehicle && gateInNumber && gateInNumber.trim()) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const sQuery = encodeURIComponent(gateInNumber.trim());
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${sQuery}' or tolower(vehicleRegNo) eq '${sQuery.toLowerCase()}'`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.value && data.value.length > 0) {
                            vehicle = data.value[0];
                        }
                    }
                } catch (e) {
                    console.warn("Direct gate transaction lookup failed:", e);
                }
            }

            oSecModel.setProperty("/selectedGateInNumber", vehicle ? vehicle.gateInNumber : (gateInNumber || ""));
            oSecModel.setProperty("/selectedVehicle", vehicle || null);

            if (vehicle) {
                const isDelivery = (vehicle.purpose === "DELIVERY");
                const isPickup = (vehicle.purpose === "PICKUP");
                oSecModel.setProperty("/isDelivery", isDelivery);
                oSecModel.setProperty("/isPickup", isPickup);

                // Reset purpose-specific fields when switching vehicles
                if (isDelivery) {
                    oSecModel.setProperty("/rgpDocumentNo", "");
                    oSecModel.setProperty("/nrgpDocumentNo", "");
                    oSecModel.setProperty("/gatePassType", "");
                } else if (isPickup) {
                    oSecModel.setProperty("/withoutPO", false);
                    oSecModel.setProperty("/poNumber", "");
                    oSecModel.setProperty("/soNumber", "");
                    oSecModel.setProperty("/invoiceNumber", "");
                    oSecModel.setProperty("/invoiceDate", null);
                }

                // Pre-populate driver details if available from gate in
                if (vehicle.driverLicenseNo && !oSecModel.getProperty("/driverLicenseNo")) {
                    oSecModel.setProperty("/driverLicenseNo", vehicle.driverLicenseNo);
                }
                if (vehicle.driverPhoneNo && !oSecModel.getProperty("/driverPhoneNo")) {
                    oSecModel.setProperty("/driverPhoneNo", vehicle.driverPhoneNo);
                }

                MessageToast.show("Selected: " + vehicle.gateInNumber + " (" + vehicle.vehicleRegNo + ") - " + vehicle.purpose);
            } else if (gateInNumber) {
                MessageToast.show("Searching for Gate IN: " + gateInNumber);
            }
        },

        onSelectWaitingVehicle: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("secModel");
            if (oCtx) {
                const sGateIn = oCtx.getProperty("gateInNumber");
                this.selectVehicleByGateIn(sGateIn);
                const oForm = this.byId("securityEntryForm");
                if (oForm && oForm.getDomRef()) {
                    oForm.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        },

        onWithoutPOToggle: function (oEvt) {
            const bChecked = oEvt.getParameter("selected");
            const oSecModel = this.getView().getModel("secModel");
            oSecModel.setProperty("/withoutPO", bChecked);

            // Clear validation error states when Without PO is checked
            if (bChecked) {
                const oPoInput = this.byId("secPoNumber");
                const oInvInput = this.byId("secInvoiceNumber");
                if (oPoInput) oPoInput.setValueState(ValueState.None);
                if (oInvInput) oInvInput.setValueState(ValueState.None);
                MessageToast.show("Without PO mode active: PO & Invoice fields are waived.");
            }
        },

        onResetForm: function () {
            const oSecModel = this.getView().getModel("secModel");
            oSecModel.setProperty("/driverLicenseNo", "");
            oSecModel.setProperty("/driverPhoneNo", "");
            oSecModel.setProperty("/helperName", "");
            oSecModel.setProperty("/withoutPO", false);
            oSecModel.setProperty("/poNumber", "");
            oSecModel.setProperty("/soNumber", "");
            oSecModel.setProperty("/invoiceNumber", "");
            oSecModel.setProperty("/invoiceDate", null);
            oSecModel.setProperty("/rgpDocumentNo", "");
            oSecModel.setProperty("/nrgpDocumentNo", "");
            oSecModel.setProperty("/gatePassType", "");
            oSecModel.setProperty("/gatePassVerified", false);
            oSecModel.setProperty("/emptyInspectionVerified", true);
            oSecModel.setProperty("/remarks", "");
            oSecModel.setProperty("/driverVerified", true);
            oSecModel.setProperty("/vehicleVerified", true);
            oSecModel.setProperty("/documentsVerified", true);

            const aInputs = [
                this.byId("secDriverLicense"),
                this.byId("secPoNumber"),
                this.byId("secInvoiceNumber"),
                this.byId("secPersonnel"),
                this.byId("secRgpDocNo"),
                this.byId("secNrgpDocNo")
            ];
            aInputs.forEach(input => { if (input) input.setValueState(ValueState.None); });

            MessageToast.show("Security inspection form reset");
        },

        onClearSecurityGateIn: async function () {
            const oSecModel = this.getView().getModel("secModel");
            const m = oSecModel.getData();

            // 1. Validate Gate IN selection
            if (!m.selectedGateInNumber) {
                MessageBox.error("Please select a Gate IN Number to inspect.");
                return;
            }

            // 2. Validate Driver License
            const oLicInput = this.byId("secDriverLicense");
            if (!m.driverLicenseNo || !m.driverLicenseNo.trim()) {
                if (oLicInput) oLicInput.setValueState(ValueState.Error);
                MessageBox.error("Driver License Number is mandatory for Security Clearance.");
                return;
            }
            if (oLicInput) oLicInput.setValueState(ValueState.None);

            // 3. Validate Security Personnel
            const oSecInput = this.byId("secPersonnel");
            if (!m.securityPersonnel || !m.securityPersonnel.trim()) {
                if (oSecInput) oSecInput.setValueState(ValueState.Error);
                MessageBox.error("Security Personnel identifier is mandatory.");
                return;
            }
            if (oSecInput) oSecInput.setValueState(ValueState.None);

            // 4. Validate Delivery Documentation (Mandatory if DELIVERY and Without PO is FALSE)
            const oPoInput = this.byId("secPoNumber");
            const oInvInput = this.byId("secInvoiceNumber");

            if (m.isDelivery && !m.withoutPO) {
                let bError = false;
                let sMsg = "";

                if (!m.poNumber || !m.poNumber.trim()) {
                    if (oPoInput) oPoInput.setValueState(ValueState.Error);
                    bError = true;
                    sMsg = "Purchase Order (PO) Number is mandatory for Delivery vehicles.\n(Or check 'Without PO' if authorized).";
                } else {
                    if (oPoInput) oPoInput.setValueState(ValueState.None);
                }

                if (!m.invoiceNumber || !m.invoiceNumber.trim()) {
                    if (oInvInput) oInvInput.setValueState(ValueState.Error);
                    bError = true;
                    sMsg = (sMsg ? sMsg + "\n" : "") + "Invoice Number is mandatory for Delivery vehicles.";
                } else {
                    if (oInvInput) oInvInput.setValueState(ValueState.None);
                }

                if (bError) {
                    MessageBox.error(sMsg);
                    return;
                }
            }

            // Note: For Pickup vehicles, RGP and NRGP are optional at Gate Entry (may be provided at Gate Exit)

            // 5. Submit Security Clearance Action to Backend
            const payload = {
                gateInNumber: m.selectedGateInNumber,
                driverLicenseNo: m.driverLicenseNo.trim(),
                driverPhoneNo: m.driverPhoneNo ? m.driverPhoneNo.trim() : "",
                helperName: m.helperName ? m.helperName.trim() : "",
                vehicleReportingDateTime: new Date().toISOString(),
                securityPersonnel: m.securityPersonnel.trim(),
                driverVerified: Boolean(m.driverVerified),
                vehicleVerified: Boolean(m.vehicleVerified),
                documentsVerified: Boolean(m.documentsVerified),
                poNumber: m.isDelivery ? (m.withoutPO ? "" : (m.poNumber ? m.poNumber.trim() : "")) : "",
                soNumber: m.isDelivery ? (m.withoutPO ? "" : (m.soNumber ? m.soNumber.trim() : "")) : "",
                invoiceNumber: m.isDelivery ? (m.withoutPO ? "" : (m.invoiceNumber ? m.invoiceNumber.trim() : "")) : "",
                invoiceDate: m.isDelivery ? (m.withoutPO ? null : (m.invoiceDate || null)) : null,
                withoutPO: m.isDelivery ? Boolean(m.withoutPO) : false,
                rgpDocumentNo: m.isPickup ? (m.rgpDocumentNo ? m.rgpDocumentNo.trim() : "") : "",
                nrgpDocumentNo: m.isPickup ? (m.nrgpDocumentNo ? m.nrgpDocumentNo.trim() : "") : "",
                gatePassType: m.isPickup ? (m.gatePassType || "") : "",
                remarks: m.remarks ? m.remarks.trim() : ""
            };

            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const response = await fetch(`${ODATA_BASE}/SecurityGateIn`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to clear Security Gate IN";
                    MessageBox.error("Security Clearance Failed: " + sErrMsg);
                    return;
                }

                // Success!
                let statusText = "";
                if (m.isDelivery) {
                    statusText = m.withoutPO ? "Cleared WITHOUT PO" : "Cleared with PO: " + m.poNumber;
                } else if (m.isPickup) {
                    const passText = m.rgpDocumentNo ? `RGP: ${m.rgpDocumentNo}` : (m.nrgpDocumentNo ? `NRGP: ${m.nrgpDocumentNo}` : "Documents to be reconciled at Exit");
                    statusText = `Cleared for PICKUP (${passText})`;
                } else {
                    statusText = "Cleared Security Gate IN";
                }

                MessageBox.success(`Security Gate IN successfully authorized for ${m.selectedGateInNumber}!\nStatus: SECURITY_IN\nDocumentation: ${statusText}`, {
                    title: "Security Clearance Complete",
                    onClose: () => {
                        this.onResetForm();
                        this.loadSecurityData();
                        this.getOwnerComponent().loadOverviewData();
                    }
                });

            } catch (networkErr) {
                MessageBox.error("Network error communicating with GateService: " + networkErr.message);
            }
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavMainGateOps: function () {
            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
        }
    });
});
