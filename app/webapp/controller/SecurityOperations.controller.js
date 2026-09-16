sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "factory/gate/model/formatter",
    "factory/gate/model/models"
], function (Controller, JSONModel, Fragment, MessageToast, MessageBox, coreLibrary, Filter, FilterOperator, formatter, models) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const ODATA_BASE = "/gate";

    return Controller.extend("factory.gate.controller.SecurityOperations", {
        formatter: formatter,

        onInit: function () {
            const activeUser = models.getActiveUser();
            const defaultOfficer = activeUser.includes("security") ? activeUser : (activeUser === "superadmin_user" ? "SecurityChief" : "security_user");

            const oSecModel = new JSONModel({
                // Table and queues
                records: [],
                displayedRecords: [],
                selectedFilter: "ALL",
                searchQuery: "",
                allRecordsCount: 0,
                waitingInCount: 0,
                inPlantCount: 0,
                waitingOutCount: 0,
                clearedCount: 0,

                waitingVehicles: [],
                waitingOutVehicles: [],

                // Gate IN properties
                isVehicleSelectable: true,
                selectedGateInNumber: "",
                selectedVehicle: null,
                driverLicenseNo: "",
                driverPhoneNo: "",
                helperName: "",
                securityPersonnel: defaultOfficer,
                driverVerified: false,
                vehicleVerified: false,
                documentsVerified: false,
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
                emptyInspectionVerified: false,
                remarks: "",

                // Gate OUT properties
                isOutVehicleSelectable: true,
                outSelectedGateInNumber: "",
                outSelectedVehicle: null,
                outSecurityPersonnel: defaultOfficer,
                outDriverVerified: true,
                outVehicleVerified: true,
                outEmptyInspectionVerified: true,
                outMaterialInspected: true,
                outDocumentsVerified: true,
                outGatePassVerified: false,
                outDeliveryDetailsVerified: false,
                outGatePassType: "RGP",
                outGatePassDocumentNo: "",
                outRemarks: "",
                outInboundRecord: null,
                outWeighmentSummary: ""
            });
            this.getView().setModel(oSecModel, "secModel");

            this.loadSecurityData();
        },

        loadSecurityData: async function () {
            const oSecModel = this.getView().getModel("secModel");
            const oTable = this.byId("secTxTable");
            if (oTable) oTable.setBusy(true);

            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                // Fetch all GateTransactions expanding unified securityEntry and driver
                const res = await fetch(`${ODATA_BASE}/GateTransactions?$expand=securityEntry,driver&$orderby=createdAt desc&$top=100`, { headers });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                const aRecords = data.value || [];
                oSecModel.setProperty("/records", aRecords);

                // Derive waiting queues
                const aWaitingIn = aRecords.filter(r => r.status === "GATE_IN");
                // Eligible for Security Gate OUT: Scale outbound, Factory outbound, or Direct exit without scale (SECURITY_IN, FACTORY_IN)
                const aWaitingOut = aRecords.filter(r => 
                    r.status === "WEIGHBRIDGE_OUT" || 
                    r.status === "FACTORY_OUT" || 
                    r.status === "SECURITY_IN" || 
                    r.status === "FACTORY_IN"
                );
                const aWaitingOutReady = aRecords.filter(r => r.status === "WEIGHBRIDGE_OUT" || r.status === "FACTORY_OUT");

                oSecModel.setProperty("/waitingVehicles", aWaitingIn);
                oSecModel.setProperty("/waitingOutVehicles", aWaitingOut);

                // Compute counts
                const inPlantCount = aRecords.filter(r => ["SECURITY_IN", "WEIGHBRIDGE_IN", "FACTORY_IN"].includes(r.status)).length;
                const clearedCount = aRecords.filter(r => ["SECURITY_OUT", "COMPLETED"].includes(r.status) || (r.securityEntry && r.securityEntry.securityOutDateTime)).length;

                oSecModel.setProperty("/allRecordsCount", aRecords.length);
                oSecModel.setProperty("/waitingInCount", aWaitingIn.length);
                oSecModel.setProperty("/inPlantCount", inPlantCount);
                oSecModel.setProperty("/waitingOutCount", aWaitingOutReady.length);
                oSecModel.setProperty("/clearedCount", clearedCount);

                this._applyFilters();
            } catch (err) {
                console.error("Error loading security operations data:", err);
                MessageToast.show("Failed to load security records: " + err.message);
            } finally {
                if (oTable) oTable.setBusy(false);
            }
        },

        _applyFilters: function () {
            const oSecModel = this.getView().getModel("secModel");
            const aRecords = oSecModel.getProperty("/records") || [];
            const sFilter = oSecModel.getProperty("/selectedFilter") || "ALL";
            const sQuery = (oSecModel.getProperty("/searchQuery") || "").trim().toLowerCase();

            let aFiltered = aRecords.slice();

            // 1. Filter Category
            if (sFilter === "WAITING_IN") {
                aFiltered = aFiltered.filter(r => r.status === "GATE_IN");
            } else if (sFilter === "IN_PLANT") {
                aFiltered = aFiltered.filter(r => ["SECURITY_IN", "WEIGHBRIDGE_IN", "FACTORY_IN"].includes(r.status));
            } else if (sFilter === "WAITING_OUT") {
                aFiltered = aFiltered.filter(r => r.status === "WEIGHBRIDGE_OUT" || r.status === "FACTORY_OUT");
            } else if (sFilter === "CLEARED") {
                aFiltered = aFiltered.filter(r => ["SECURITY_OUT", "COMPLETED"].includes(r.status) || (r.securityEntry && r.securityEntry.securityOutDateTime));
            }

            // 2. Search Query Filter
            if (sQuery) {
                aFiltered = aFiltered.filter(r => {
                    const matchGateIn = (r.gateInNumber || "").toLowerCase().includes(sQuery);
                    const matchVehicle = (r.vehicleRegNo || "").toLowerCase().includes(sQuery);
                    const matchDriver = (r.driverName || (r.driver && r.driver.driverName) || "").toLowerCase().includes(sQuery);
                    const matchPurpose = (r.purpose || "").toLowerCase().includes(sQuery);
                    const matchStatus = (r.status || "").toLowerCase().includes(sQuery);
                    const matchStage = (r.currentStage || "").toLowerCase().includes(sQuery);

                    const sec = r.securityEntry;
                    const matchPo = sec && (sec.poNumber || "").toLowerCase().includes(sQuery);
                    const matchInv = sec && (sec.invoiceNumber || "").toLowerCase().includes(sQuery);
                    const matchRgp = sec && (sec.rgpDocumentNo || "").toLowerCase().includes(sQuery);
                    const matchNrgp = sec && (sec.nrgpDocumentNo || "").toLowerCase().includes(sQuery);
                    const matchExitPass = sec && (sec.exitGatePassDocumentNo || "").toLowerCase().includes(sQuery);
                    const matchInOfficer = sec && (sec.securityPersonnel || "").toLowerCase().includes(sQuery);
                    const matchOutOfficer = sec && (sec.securityOutPersonnel || "").toLowerCase().includes(sQuery);

                    return matchGateIn || matchVehicle || matchDriver || matchPurpose || matchStatus || matchStage ||
                        matchPo || matchInv || matchRgp || matchNrgp || matchExitPass || matchInOfficer || matchOutOfficer;
                });
            }

            oSecModel.setProperty("/displayedRecords", aFiltered);
        },

        onFilterCategoryChange: function (oEvt) {
            const oItem = oEvt.getParameter("item");
            const sKey = oItem ? oItem.getKey() : oEvt.getSource().getSelectedKey();
            this.getView().getModel("secModel").setProperty("/selectedFilter", sKey);
            this._applyFilters();
        },

        onSearchLiveChange: function (oEvt) {
            const sQuery = oEvt.getParameter("newValue") || "";
            this.getView().getModel("secModel").setProperty("/searchQuery", sQuery);
            this._applyFilters();
        },

        onSearch: function (oEvt) {
            const sQuery = oEvt.getParameter("query") || "";
            this.getView().getModel("secModel").setProperty("/searchQuery", sQuery);
            this._applyFilters();
        },

        onResetSearch: function () {
            const oSearchField = this.byId("secSearchField");
            if (oSearchField) oSearchField.setValue("");
            const oSecModel = this.getView().getModel("secModel");
            oSecModel.setProperty("/searchQuery", "");
            oSecModel.setProperty("/selectedFilter", "ALL");
            const oSegBtn = this.byId("secFilterSegmentedBtn");
            if (oSegBtn) oSegBtn.setSelectedKey("ALL");
            this._applyFilters();
        },

        onRefreshQueue: function () {
            this.loadSecurityData();
            MessageToast.show("Security Gate records refreshed");
        },

        // ============================================================
        // DIALOG: Security Gate IN
        // ============================================================
        onOpenSecurityGateInDialog: function (oPreselectedTx) {
            const sId = this.getView().createId("secGateInFrag");
            const oSecModel = this.getView().getModel("secModel");
            const activeUser = models.getActiveUser();
            const defaultOfficer = activeUser.includes("security") ? activeUser : (activeUser === "superadmin_user" ? "SecurityChief" : "security_user");

            const bIsPreselected = Boolean(oPreselectedTx && oPreselectedTx.gateInNumber);
            oSecModel.setProperty("/isVehicleSelectable", !bIsPreselected);

            // Reset Gate IN fields
            oSecModel.setProperty("/driverLicenseNo", "");
            oSecModel.setProperty("/driverPhoneNo", "");
            oSecModel.setProperty("/helperName", "");
            oSecModel.setProperty("/securityPersonnel", defaultOfficer);
            oSecModel.setProperty("/withoutPO", false);
            oSecModel.setProperty("/poNumber", "");
            oSecModel.setProperty("/soNumber", "");
            oSecModel.setProperty("/invoiceNumber", "");
            oSecModel.setProperty("/invoiceDate", null);
            oSecModel.setProperty("/rgpDocumentNo", "");
            oSecModel.setProperty("/nrgpDocumentNo", "");
            oSecModel.setProperty("/gatePassType", "");
            oSecModel.setProperty("/assignedRoute", "WEIGHBRIDGE");
            oSecModel.setProperty("/gatePassVerified", false);
            oSecModel.setProperty("/emptyInspectionVerified", false);
            oSecModel.setProperty("/remarks", "");
            oSecModel.setProperty("/driverVerified", false);
            oSecModel.setProperty("/vehicleVerified", false);
            oSecModel.setProperty("/documentsVerified", false);

            if (!this._pGateInDialog) {
                this._pGateInDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.SecurityGateInDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateInDialog.then(function (oDialog) {
                // Determine preselected vehicle
                let sGateInNo = "";
                if (bIsPreselected) {
                    sGateInNo = oPreselectedTx.gateInNumber;
                } else {
                    const aWaiting = oSecModel.getProperty("/waitingVehicles") || [];
                    if (aWaiting.length > 0) sGateInNo = aWaiting[0].gateInNumber;
                }

                if (sGateInNo) {
                    this.selectVehicleByGateIn(sGateInNo);
                } else {
                    oSecModel.setProperty("/selectedGateInNumber", "");
                    oSecModel.setProperty("/selectedVehicle", null);
                }

                const oComboBox = Fragment.byId(sId, "dialogSecGateInComboBox");
                if (oComboBox) {
                    oComboBox.setEnabled(!bIsPreselected);
                    oComboBox.setEditable(!bIsPreselected);
                }

                this._resetDialogInputStates(sId, [
                    "dialogSecDriverPhone",
                    "dialogSecDriverLicense",
                    "dialogSecPersonnel",
                    "dialogSecPoNumber",
                    "dialogSecInvoiceNumber"
                ]);

                oDialog.open();
            }.bind(this));
        },

        onGateInSelectChange: function (oEvt) {
            const oSecModel = this.getView().getModel("secModel");
            if (oSecModel && oSecModel.getProperty("/isVehicleSelectable") === false) {
                return;
            }
            let sKey = "";
            if (oEvt) {
                const oSelectedItem = oEvt.getParameter("selectedItem");
                if (oSelectedItem) {
                    sKey = oSelectedItem.getKey();
                } else {
                    const sTypedVal = (oEvt.getParameter("newValue") || "").trim();
                    if (sTypedVal) {
                        const aWaiting = this.getView().getModel("secModel").getProperty("/waitingVehicles") || [];
                        const matched = aWaiting.find(v =>
                            v.gateInNumber.toLowerCase() === sTypedVal.toLowerCase() ||
                            (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === sTypedVal.toLowerCase())
                        );
                        sKey = matched ? matched.gateInNumber : sTypedVal;
                    } else {
                        sKey = "";
                    }
                }
            } else {
                sKey = this.getView().getModel("secModel").getProperty("/selectedGateInNumber");
            }
            this.selectVehicleByGateIn(sKey);
        },

        selectVehicleByGateIn: async function (gateInNumber) {
            const oSecModel = this.getView().getModel("secModel");
            const sId = this.getView().createId("secGateInFrag");

            // Reset user-fillable fields so no previous vehicle data remains
            oSecModel.setProperty("/driverLicenseNo", "");
            oSecModel.setProperty("/driverPhoneNo", "");
            oSecModel.setProperty("/helperName", "");
            oSecModel.setProperty("/driverVerified", false);
            oSecModel.setProperty("/vehicleVerified", false);
            oSecModel.setProperty("/documentsVerified", false);
            oSecModel.setProperty("/emptyInspectionVerified", false);
            oSecModel.setProperty("/withoutPO", false);
            oSecModel.setProperty("/poNumber", "");
            oSecModel.setProperty("/soNumber", "");
            oSecModel.setProperty("/invoiceNumber", "");
            oSecModel.setProperty("/invoiceDate", null);
            oSecModel.setProperty("/rgpDocumentNo", "");
            oSecModel.setProperty("/nrgpDocumentNo", "");
            oSecModel.setProperty("/gatePassType", "");
            oSecModel.setProperty("/assignedRoute", "WEIGHBRIDGE");
            oSecModel.setProperty("/remarks", "");

            this._resetDialogInputStates(sId, [
                "dialogSecDriverPhone",
                "dialogSecDriverLicense",
                "dialogSecPersonnel",
                "dialogSecPoNumber",
                "dialogSecInvoiceNumber"
            ]);

            if (!gateInNumber) {
                oSecModel.setProperty("/selectedGateInNumber", "");
                oSecModel.setProperty("/selectedVehicle", null);
                oSecModel.setProperty("/isDelivery", true);
                oSecModel.setProperty("/isPickup", false);
                return;
            }

            oSecModel.setProperty("/selectedGateInNumber", gateInNumber);
            const aWaiting = oSecModel.getProperty("/waitingVehicles") || [];
            let matched = aWaiting.find(v => v.gateInNumber === gateInNumber);

            if (!matched) {
                const aAll = oSecModel.getProperty("/records") || [];
                matched = aAll.find(v => v.gateInNumber === gateInNumber);
            }

            if (!matched) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${gateInNumber}'`, { headers });
                    if (res.ok) {
                        const d = await res.json();
                        if (d.value && d.value.length > 0) matched = d.value[0];
                    }
                } catch (e) {}
            }

            if (matched) {
                if (!aWaiting.some(v => v.gateInNumber === matched.gateInNumber)) {
                    aWaiting.push(matched);
                    oSecModel.setProperty("/waitingVehicles", aWaiting);
                }
                oSecModel.setProperty("/selectedVehicle", matched);
                oSecModel.setProperty("/isDelivery", matched.purpose === "DELIVERY");
                oSecModel.setProperty("/isPickup", matched.purpose === "PICKUP");
            } else {
                oSecModel.setProperty("/selectedVehicle", null);
                oSecModel.setProperty("/isDelivery", true);
                oSecModel.setProperty("/isPickup", false);
            }
        },

        onDriverPhoneLiveChange: function (oEvt) {
            const oInput = oEvt.getSource();
            let sVal = oEvt.getParameter("value") || "";
            // Keep only numbers and max 10 digits
            const sDigits = sVal.replace(/\D/g, "").slice(0, 10);

            if (sVal !== sDigits) {
                oInput.setValue(sDigits);
                this.getView().getModel("secModel").setProperty("/driverPhoneNo", sDigits);
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

        onWithoutPOToggle: function (oEvt) {
            const bChecked = oEvt.getParameter("selected");
            const oSecModel = this.getView().getModel("secModel");
            oSecModel.setProperty("/withoutPO", bChecked);

            const sId = this.getView().createId("secGateInFrag");
            const oPoInput = Fragment.byId(sId, "dialogSecPoNumber");
            const oInvInput = Fragment.byId(sId, "dialogSecInvoiceNumber");
            if (bChecked) {
                if (oPoInput) oPoInput.setValueState(ValueState.None);
                if (oInvInput) oInvInput.setValueState(ValueState.None);
                MessageToast.show("Without PO mode: PO & Invoice requirement waived.");
            }
        },

        onConfirmSecurityGateIn: async function () {
            const oSecModel = this.getView().getModel("secModel");
            const m = oSecModel.getData();
            const sId = this.getView().createId("secGateInFrag");

            if (!m.selectedGateInNumber) {
                MessageBox.error("Please select a Gate IN Number to inspect.");
                return;
            }

            const oLicInput = Fragment.byId(sId, "dialogSecDriverLicense");
            if (!m.driverLicenseNo || !m.driverLicenseNo.trim()) {
                if (oLicInput) oLicInput.setValueState(ValueState.Error);
                MessageBox.error("Driver License Number is mandatory for Security Clearance.");
                return;
            }
            if (oLicInput) oLicInput.setValueState(ValueState.None);

            const oSecInput = Fragment.byId(sId, "dialogSecPersonnel");
            if (!m.securityPersonnel || !m.securityPersonnel.trim()) {
                if (oSecInput) oSecInput.setValueState(ValueState.Error);
                MessageBox.error("Security Personnel identifier is mandatory.");
                return;
            }
            if (oSecInput) oSecInput.setValueState(ValueState.None);

            const oPhoneInput = Fragment.byId(sId, "dialogSecDriverPhone");
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

            const oPoInput = Fragment.byId(sId, "dialogSecPoNumber");
            const oInvInput = Fragment.byId(sId, "dialogSecInvoiceNumber");
            if (oInvInput) oInvInput.setValueState(ValueState.None);

            if (m.isDelivery && !m.withoutPO) {
                if (!m.poNumber || !m.poNumber.trim()) {
                    if (oPoInput) oPoInput.setValueState(ValueState.Error);
                    MessageBox.error("Purchase Order (PO) Number is mandatory for Delivery vehicles.\n(Or check 'Without PO Allowed' if authorized).");
                    return;
                } else {
                    if (oPoInput) oPoInput.setValueState(ValueState.None);
                }
            }

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
                assignedRoute: m.assignedRoute || "WEIGHBRIDGE",
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

                // Close dialog
                if (this._pGateInDialog) {
                    this._pGateInDialog.then(oDialog => oDialog.close());
                }

                let statusText = "";
                if (m.isDelivery) {
                    statusText = m.withoutPO ? "Cleared WITHOUT PO" : "Cleared with PO: " + m.poNumber;
                } else if (m.isPickup) {
                    const passText = m.rgpDocumentNo ? `RGP: ${m.rgpDocumentNo}` : (m.nrgpDocumentNo ? `NRGP: ${m.nrgpDocumentNo}` : "Documents to be reconciled at Exit");
                    statusText = `Cleared for PICKUP (${passText})`;
                } else {
                    statusText = "Cleared Security Gate IN";
                }

                const sRouteDesc = (m.assignedRoute === "FACTORY") ? "To Factory Gate (Direct Delivery)" : "To Weighbridge (Gross/Tare Scale)";

                MessageBox.success(`Security Gate IN successfully authorized for ${m.selectedGateInNumber}!\n\nStatus: ${m.assignedRoute === "FACTORY" ? "FACTORY_IN" : "SECURITY_IN"}\nAssigned Route: ${sRouteDesc}\nDocumentation: ${statusText}`, {
                    title: "Security Clearance Complete",
                    onClose: () => {
                        this.loadSecurityData();
                        this.getOwnerComponent().loadOverviewData();
                    }
                });

            } catch (networkErr) {
                MessageBox.error("Network error communicating with GateService: " + networkErr.message);
            }
        },

        onCancelSecurityGateIn: function () {
            if (this._pGateInDialog) {
                this._pGateInDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // F4 SEARCH HELP: Purchase Orders from SAP S/4HANA Cloud
        // ============================================================
        onPoValueHelpRequest: async function () {
            const sId = this.getView().createId("poVHFrag");

            if (!this._pPoValueHelpDialog) {
                this._pPoValueHelpDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.PurchaseOrderValueHelpDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            const oDialog = await this._pPoValueHelpDialog;
            oDialog.setBusy(true);
            oDialog.open();

            try {
                const res = await fetch(`${ODATA_BASE}/PurchaseOrders?$top=50&$orderby=PurchaseOrderDate desc`, {
                    headers: {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    const aPOs = data.value || [];
                    const oPoModel = new JSONModel(aPOs);
                    oDialog.setModel(oPoModel, "poModel");
                    const oBinding = oDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter([]);
                    }
                } else {
                    MessageToast.show("Failed to fetch Purchase Orders from server.");
                }
            } catch (err) {
                console.error("Error loading Purchase Orders:", err);
                MessageToast.show("Could not load POs: " + err.message);
            } finally {
                oDialog.setBusy(false);
            }
        },

        onPoValueHelpSearch: function (oEvt) {
            const sValue = (oEvt.getParameter("value") || "").trim().toUpperCase();
            const oFilter = new Filter({
                filters: [
                    new Filter("PurchaseOrder", FilterOperator.Contains, sValue),
                    new Filter("Supplier", FilterOperator.Contains, sValue),
                    new Filter("CompanyCode", FilterOperator.Contains, sValue)
                ],
                and: false
            });
            const oBinding = oEvt.getSource().getBinding("items");
            if (oBinding) {
                oBinding.filter(sValue ? [oFilter] : []);
            }
        },

        onPoValueHelpConfirm: function (oEvt) {
            const oSelectedItem = oEvt.getParameter("selectedItem");
            if (oSelectedItem) {
                const oContext = oSelectedItem.getBindingContext("poModel");
                if (oContext) {
                    const sSelectedPo = oContext.getProperty("PurchaseOrder");
                    const oSecModel = this.getView().getModel("secModel");
                    oSecModel.setProperty("/poNumber", sSelectedPo);

                    // Clear error state if set
                    const sId = this.getView().createId("secGateInFrag");
                    const oPoInput = Fragment.byId(sId, "dialogSecPoNumber");
                    if (oPoInput) {
                        oPoInput.setValueState(ValueState.None);
                    }

                    MessageToast.show(`Selected Purchase Order: ${sSelectedPo}`);
                }
            }
        },

        onPoValueHelpCancel: function () {
            // Dialog closes automatically
        },

        // ============================================================
        // DIALOG: Security Gate OUT
        // ============================================================
        onOpenSecurityGateOutDialog: function (oPreselectedTx) {
            const sId = this.getView().createId("secGateOutFrag");
            const oSecModel = this.getView().getModel("secModel");
            const activeUser = models.getActiveUser();
            const defaultOfficer = activeUser.includes("security") ? activeUser : (activeUser === "superadmin_user" ? "SecurityChief" : "security_user");

            const bIsPreselected = Boolean(oPreselectedTx && oPreselectedTx.gateInNumber);
            oSecModel.setProperty("/isOutVehicleSelectable", !bIsPreselected);

            // Reset Gate OUT fields
            oSecModel.setProperty("/outSecurityPersonnel", defaultOfficer);
            oSecModel.setProperty("/outDriverVerified", true);
            oSecModel.setProperty("/outVehicleVerified", true);
            oSecModel.setProperty("/outEmptyInspectionVerified", true);
            oSecModel.setProperty("/outMaterialInspected", true);
            oSecModel.setProperty("/outDocumentsVerified", true);
            oSecModel.setProperty("/outGatePassVerified", false);
            oSecModel.setProperty("/outDeliveryDetailsVerified", false);
            oSecModel.setProperty("/outGatePassType", "RGP");
            oSecModel.setProperty("/outGatePassDocumentNo", "");
            oSecModel.setProperty("/outRemarks", "");
            oSecModel.setProperty("/outInboundRecord", null);
            oSecModel.setProperty("/outWeighmentSummary", "");

            if (!this._pGateOutDialog) {
                this._pGateOutDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.SecurityGateOutDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pGateOutDialog.then(function (oDialog) {
                let sGateInNo = "";
                if (bIsPreselected) {
                    sGateInNo = oPreselectedTx.gateInNumber;
                } else {
                    const aWaitingOut = oSecModel.getProperty("/waitingOutVehicles") || [];
                    if (aWaitingOut.length > 0) sGateInNo = aWaitingOut[0].gateInNumber;
                }

                if (sGateInNo) {
                    this.selectVehicleForGateOut(sGateInNo);
                } else {
                    oSecModel.setProperty("/outSelectedGateInNumber", "");
                    oSecModel.setProperty("/outSelectedVehicle", null);
                }

                const oComboBox = Fragment.byId(sId, "dialogSecOutGateInComboBox");
                if (oComboBox) {
                    oComboBox.setEnabled(!bIsPreselected);
                    oComboBox.setEditable(!bIsPreselected);
                }

                this._resetDialogInputStates(sId, [
                    "dialogSecOutPersonnel",
                    "dialogSecOutDocNo"
                ]);

                oDialog.open();
            }.bind(this));
        },

        onGateOutSelectChange: function (oEvt) {
            const oSecModel = this.getView().getModel("secModel");
            if (oSecModel && oSecModel.getProperty("/isOutVehicleSelectable") === false) {
                return;
            }
            let sKey = "";
            if (oEvt) {
                const oSelectedItem = oEvt.getParameter("selectedItem");
                if (oSelectedItem) {
                    sKey = oSelectedItem.getKey();
                } else {
                    const sTypedVal = (oEvt.getParameter("newValue") || "").trim();
                    const aWaitingOut = this.getView().getModel("secModel").getProperty("/waitingOutVehicles") || [];
                    const matched = aWaitingOut.find(v =>
                        v.gateInNumber.toLowerCase() === sTypedVal.toLowerCase() ||
                        (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === sTypedVal.toLowerCase())
                    );
                    sKey = matched ? matched.gateInNumber : sTypedVal;
                }
            }
            if (!sKey) {
                sKey = this.getView().getModel("secModel").getProperty("/outSelectedGateInNumber");
            }
            this.selectVehicleForGateOut(sKey);
        },

        selectVehicleForGateOut: async function (gateInNumber) {
            const oSecModel = this.getView().getModel("secModel");
            if (!gateInNumber) return;

            oSecModel.setProperty("/outSelectedGateInNumber", gateInNumber);
            const aWaitingOut = oSecModel.getProperty("/waitingOutVehicles") || [];
            let matched = aWaitingOut.find(v => v.gateInNumber === gateInNumber);

            if (!matched) {
                const aAll = oSecModel.getProperty("/records") || [];
                matched = aAll.find(v => v.gateInNumber === gateInNumber);
            }

            if (!matched) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${gateInNumber}'&$expand=driver`, { headers });
                    if (res.ok) {
                        const d = await res.json();
                        if (d.value && d.value.length > 0) matched = d.value[0];
                    }
                } catch (e) {}
            }

            if (matched) {
                if (!aWaitingOut.some(v => v.gateInNumber === matched.gateInNumber)) {
                    aWaitingOut.push(matched);
                    oSecModel.setProperty("/waitingOutVehicles", aWaitingOut);
                }
                oSecModel.setProperty("/outSelectedVehicle", matched);

                // Fetch single consolidated Security record and weighments for prior clearance verification
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };

                    const [resSec, resWb] = await Promise.all([
                        fetch(`${ODATA_BASE}/SecurityGateEntries?$filter=gateTransaction_ID eq '${matched.ID}'`, { headers }),
                        fetch(`${ODATA_BASE}/WeighbridgeTransactions?$filter=gateTransaction_ID eq '${matched.ID}'&$orderby=weighbridgeDateTime desc`, { headers })
                    ]);

                    if (resSec.ok) {
                        const dSec = await resSec.json();
                        const secRecord = (dSec.value && dSec.value[0]) || null;
                        oSecModel.setProperty("/outInboundRecord", secRecord);

                        if (secRecord) {
                            if (secRecord.rgpDocumentNo) {
                                oSecModel.setProperty("/outGatePassType", "RGP");
                                oSecModel.setProperty("/outGatePassDocumentNo", secRecord.rgpDocumentNo);
                            } else if (secRecord.nrgpDocumentNo) {
                                oSecModel.setProperty("/outGatePassType", "NRGP");
                                oSecModel.setProperty("/outGatePassDocumentNo", secRecord.nrgpDocumentNo);
                            } else if (secRecord.exitGatePassDocumentNo) {
                                oSecModel.setProperty("/outGatePassDocumentNo", secRecord.exitGatePassDocumentNo);
                            }
                        }
                    }

                    if (resWb.ok) {
                        const dWb = await resWb.json();
                        const aWb = dWb.value || [];
                        if (aWb.length > 0) {
                            const latest = aWb[0];
                            const sSummary = `${latest.weighmentType}: ${latest.weight} ${latest.weightUnit || "KG"} on Scale #${latest.weighbridgeNumber} (${formatter.formatDateTime(latest.weighbridgeDateTime)}) by ${latest.operator}`;
                            oSecModel.setProperty("/outWeighmentSummary", sSummary);
                        } else {
                            oSecModel.setProperty("/outWeighmentSummary", "Direct factory movement (No scale weighments recorded)");
                        }
                    }
                } catch (e) {
                    console.warn("Failed to load outbound clearance summary:", e);
                }
            }
        },

        onConfirmSecurityGateOut: async function () {
            const oSecModel = this.getView().getModel("secModel");
            const m = oSecModel.getData();
            const sId = this.getView().createId("secGateOutFrag");

            // 1. Validate Gate IN selection
            if (!m.outSelectedGateInNumber) {
                MessageBox.error("Please select a vehicle awaiting Security Gate OUT.");
                return;
            }

            // 2. Validate Security Personnel
            const oSecOutInput = Fragment.byId(sId, "dialogSecOutPersonnel");
            if (!m.outSecurityPersonnel || !m.outSecurityPersonnel.trim()) {
                if (oSecOutInput) oSecOutInput.setValueState(ValueState.Error);
                MessageBox.error("Security Exit Officer identifier is mandatory.");
                return;
            }
            if (oSecOutInput) oSecOutInput.setValueState(ValueState.None);

            // 3. For Pickup, Gate Pass Document Number is required
            const isPickup = (m.outSelectedVehicle && m.outSelectedVehicle.purpose === "PICKUP");
            const oDocInput = Fragment.byId(sId, "dialogSecOutDocNo");
            if (isPickup && (!m.outGatePassDocumentNo || !m.outGatePassDocumentNo.trim())) {
                if (oDocInput) oDocInput.setValueState(ValueState.Error);
                MessageBox.error("Gate Pass Document Number (RGP / NRGP) is mandatory for material pickup exits.");
                return;
            }
            if (oDocInput) oDocInput.setValueState(ValueState.None);

            // 4. Prepare SecurityGateOut payload
            const payload = {
                gateInNumber: m.outSelectedGateInNumber,
                securityPersonnel: m.outSecurityPersonnel.trim(),
                gatePassType: m.outGatePassType || "RGP",
                gatePassDocumentNo: m.outGatePassDocumentNo ? m.outGatePassDocumentNo.trim() : "",
                driverVerified: Boolean(m.outDriverVerified),
                vehicleVerified: Boolean(m.outVehicleVerified),
                documentsVerified: Boolean(m.outDocumentsVerified),
                gatePassVerified: Boolean(m.outGatePassVerified || isPickup),
                deliveryDetailsVerified: Boolean(m.outDeliveryDetailsVerified || !isPickup),
                emptyInspectionVerified: Boolean(m.outEmptyInspectionVerified),
                materialInspected: Boolean(m.outMaterialInspected),
                remarks: m.outRemarks ? m.outRemarks.trim() : ""
            };

            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const response = await fetch(`${ODATA_BASE}/SecurityGateOut`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to authorize Security Gate OUT";
                    MessageBox.error("Security Exit Clearance Failed: " + sErrMsg);
                    return;
                }

                // Close dialog
                if (this._pGateOutDialog) {
                    this._pGateOutDialog.then(oDialog => oDialog.close());
                }

                MessageBox.success(`Security Gate OUT successfully cleared for ${m.outSelectedGateInNumber}!\n\nStatus transitioned to: SECURITY_OUT\nCurrent Stage: SECURITY_GATE_OUT\n\nThe vehicle is now authorized for final Main Gate Exit. Both Gate IN and Gate OUT have been consolidated onto a single security record.`, {
                    title: "Security Exit Clearance Complete",
                    onClose: () => {
                        this.loadSecurityData();
                        this.getOwnerComponent().loadOverviewData();
                    }
                });

            } catch (networkErr) {
                MessageBox.error("Network error communicating with GateService: " + networkErr.message);
            }
        },

        onCancelSecurityGateOut: function () {
            if (this._pGateOutDialog) {
                this._pGateOutDialog.then(oDialog => oDialog.close());
            }
        },

        _resetDialogInputStates: function (sFragId, aControlIds) {
            aControlIds.forEach(ctrlId => {
                const ctrl = Fragment.byId(sFragId, ctrlId);
                if (ctrl && ctrl.setValueState) {
                    ctrl.setValueState(ValueState.None);
                    ctrl.setValueStateText("");
                }
            });
        },

        // ============================================================
        // ROW ACTIONS
        // ============================================================
        onRowGateInPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.onOpenSecurityGateInDialog(oTx);
        },

        onRowSendToWeighbridgePress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            if (!oTx || !oTx.gateInNumber) return;

            MessageBox.confirm(
                `Assign Route to Weighbridge:\n\nSend vehicle ${oTx.vehicleRegNo} (${oTx.gateInNumber}) to Weighbridge for Gross/Tare weighment?`,
                {
                    title: "Route to Weighbridge",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: async (sAction) => {
                        if (sAction !== MessageBox.Action.YES) return;

                        const oTable = this.byId("secTxTable");
                        if (oTable) oTable.setBusy(true);

                        try {
                            const headers = {
                                "Authorization": models.getAuthHeaderValue(),
                                "Content-Type": "application/json"
                            };
                            const res = await fetch(`${ODATA_BASE}/AssignRoute`, {
                                method: "POST",
                                headers: headers,
                                body: JSON.stringify({
                                    gateInNumber: oTx.gateInNumber,
                                    route: "WEIGHBRIDGE",
                                    remarks: "Route assigned to Weighbridge by Security Gate"
                                })
                            });

                            if (!res.ok) {
                                const errData = await res.json();
                                const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to assign route to Weighbridge";
                                throw new Error(sErrMsg);
                            }

                            MessageToast.show(`Vehicle ${oTx.vehicleRegNo} successfully routed to Weighbridge.`);
                            await this.loadSecurityData();
                            this.getOwnerComponent().loadOverviewData();
                        } catch (err) {
                            MessageBox.error("Route Assignment Error: " + err.message);
                        } finally {
                            if (oTable) oTable.setBusy(false);
                        }
                    }
                }
            );
        },

        onRowSendToFactoryPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            if (!oTx || !oTx.gateInNumber) return;

            MessageBox.confirm(
                `Direct Factory Entry:\n\nSend vehicle ${oTx.vehicleRegNo} (${oTx.gateInNumber}) directly to Factory Gate without Weighbridge?`,
                {
                    title: "Route to Factory Gate",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: async (sAction) => {
                        if (sAction !== MessageBox.Action.YES) return;

                        const oTable = this.byId("secTxTable");
                        if (oTable) oTable.setBusy(true);

                        try {
                            const headers = {
                                "Authorization": models.getAuthHeaderValue(),
                                "Content-Type": "application/json"
                            };
                            const res = await fetch(`${ODATA_BASE}/AssignRoute`, {
                                method: "POST",
                                headers: headers,
                                body: JSON.stringify({
                                    gateInNumber: oTx.gateInNumber,
                                    route: "FACTORY",
                                    remarks: "Direct Factory Entry assigned by Security Gate"
                                })
                            });

                            if (!res.ok) {
                                const errData = await res.json();
                                const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to assign route to Factory Gate";
                                throw new Error(sErrMsg);
                            }

                            MessageToast.show(`Vehicle ${oTx.vehicleRegNo} successfully routed to Factory Gate (Weighbridge Bypassed).`);
                            await this.loadSecurityData();
                            this.getOwnerComponent().loadOverviewData();
                        } catch (err) {
                            MessageBox.error("Route Assignment Error: " + err.message);
                        } finally {
                            if (oTable) oTable.setBusy(false);
                        }
                    }
                }
            );
        },

        onRowReleaseFromFactoryPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            if (!oTx || !oTx.gateInNumber) return;

            MessageBox.confirm(
                `Complete Factory Operations:\n\nRelease vehicle ${oTx.vehicleRegNo} (${oTx.gateInNumber}) from Factory Gate?`,
                {
                    title: "Factory Gate Release",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: async (sAction) => {
                        if (sAction !== MessageBox.Action.YES) return;

                        const oTable = this.byId("secTxTable");
                        if (oTable) oTable.setBusy(true);

                        try {
                            const headers = {
                                "Authorization": models.getAuthHeaderValue(),
                                "Content-Type": "application/json"
                            };
                            const res = await fetch(`${ODATA_BASE}/FactoryGateOut`, {
                                method: "POST",
                                headers: headers,
                                body: JSON.stringify({ gateInNumber: oTx.gateInNumber })
                            });

                            if (!res.ok) {
                                const errData = await res.json();
                                const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to record Factory Gate OUT";
                                throw new Error(sErrMsg);
                            }

                            MessageToast.show(`Vehicle ${oTx.vehicleRegNo} successfully released from Factory Gate. Ready for Gate OUT.`);
                            await this.loadSecurityData();
                            this.getOwnerComponent().loadOverviewData();
                        } catch (err) {
                            MessageBox.error("Factory Gate Release Error: " + err.message);
                        } finally {
                            if (oTable) oTable.setBusy(false);
                        }
                    }
                }
            );
        },

        onRowGateOutPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.onOpenSecurityGateOutDialog(oTx);
        },

        onRowPrintPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.getOwnerComponent().printGateInPass(oTx);
        },

        onRowDetailPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
        },

        onRowEditPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.getOwnerComponent().openEditSecurityGateEntryPage(oTx);
        },

        onTxRowPress: function (oEvt) {
            const oTx = oEvt.getSource().getBindingContext("secModel").getObject();
            this.getOwnerComponent().openDetailDialog(oTx);
        },

        // ============================================================
        // NAVIGATION
        // ============================================================
        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavMainGateOps: function () {
            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
        },

        onNavWeighbridgeOps: function () {
            this.getOwnerComponent().navigateTo("weighbridgeOpsPage", "slide");
        },

        onNavFactoryGateOps: function () {
            this.getOwnerComponent().navigateTo("factoryGateOpsPage", "slide");
        }
    });
});
