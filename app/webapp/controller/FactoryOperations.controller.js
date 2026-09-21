sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "factory/gate/model/formatter",
    "factory/gate/model/models"
], function (Controller, Fragment, JSONModel, MessageToast, MessageBox, formatter, models) {
    "use strict";

    const ODATA_BASE = "/gate";

    return Controller.extend("factory.gate.controller.FactoryOperations", {
        formatter: formatter,

        onInit: function () {
            this._oFacModel = new JSONModel({
                allRecords: [],
                displayedRecords: [],
                eligibleVehicles: [],
                selectedGateInNumber: "",
                selectedVehicle: null,
                selectedPoDetails: null,
                vehicleStageMessage: "",
                vehicleStageMessageType: "None",
                selectedFilter: "ALL",
                searchQuery: "",
                allCount: 0,
                waitingInCount: 0,
                insideYardCount: 0,
                yardDoneCount: 0,
                isVehicleSelectable: true,
                isOutVehicleSelectable: true,
                insideYardVehicles: [],
                gateInSuccess: null,
                gateOutSuccess: null,
                form: {
                    gateInNumber: "",
                    poNumber: "",
                    invoiceNumber: "",
                    invoiceDate: null,
                    supplierName: "",
                    transporterName: "",
                    factoryArea: "Raw Material Yard",
                    unloadingPoint: "",
                    gateOutType: "STANDARD",
                    factoryGateInDateTime: new Date().toISOString(),
                    factoryGateInDateTimeStr: new Date().toISOString().substring(0, 19),
                    factoryGateInOperator: models.getActiveUser(),
                    factoryGateOutDateTime: null,
                    factoryGateOutDateTimeStr: "",
                    factoryGateOutOperator: "",
                    materialDescription: "",
                    deliveryNoteNo: "",
                    unloadingStatus: "COMPLETED",
                    goodsInspected: true,
                    sealVerified: true,
                    remarks: ""
                }
            });
            this.getView().setModel(this._oFacModel, "facModel");

            this.loadFactoryData();
        },

        _enrichRecord: function (tx) {
            const hasGrossIn = tx.weighments && tx.weighments.some(w => w.weighmentType === "GROSS_IN");
            const isWeighedDelivery = hasGrossIn || tx.status === "WEIGHBRIDGE_IN" || tx.status === "WEIGHBRIDGE_OUT" || tx.assignedRoute === "WEIGHBRIDGE";

            let flowDesc = "Direct to Factory (Scale Bypassed)";
            let flowState = "Warning";
            if (isWeighedDelivery) {
                flowDesc = "Weighed Delivery (Via Weighbridge)";
                flowState = "Information";
            }

            let inboundWeightStr = "";
            if (tx.weighments && tx.weighments.length) {
                const gross = tx.weighments.find(w => w.weighmentType === "GROSS_IN");
                if (gross) {
                    inboundWeightStr = formatter.formatWeight(gross.weight, gross.weightUnit);
                }
            }

            const driverName = tx.driverName || (tx.driver && tx.driver.driverName) || "";
            const hasGateOut = Boolean(tx.factoryEntry && tx.factoryEntry.factoryGateOutDateTime) || tx.status === "FACTORY_OUT" || tx.status === "COMPLETED";
            const hasGateIn = Boolean(tx.factoryEntry && tx.factoryEntry.factoryGateInDateTime);

            // Cleared by security check: must NOT be GATE_IN (Main Gate only)
            const isClearedBySecurity = tx.status !== "GATE_IN" && (
                Boolean(tx.securityEntry) ||
                ["SECURITY_IN", "WEIGHBRIDGE_IN", "FACTORY_IN", "FACTORY_OUT", "WEIGHBRIDGE_OUT", "SECURITY_OUT", "COMPLETED"].includes(tx.status)
            );

            // Still at weighbridge: assigned to weighbridge, still at SECURITY_IN and has not completed gross weighment
            const isStillAtWeighbridge = (tx.assignedRoute === "WEIGHBRIDGE" && tx.status === "SECURITY_IN" && !hasGrossIn);

            // Eligible for Factory Gate: cleared by security AND not pending at weighbridge
            const isEligibleForFactoryOps = isClearedBySecurity && !isStillAtWeighbridge && tx.status !== "CANCELLED";

            // Stage filters for queue table:
            // Awaiting Factory IN: eligible, yard exit not recorded, and either arrived from weighbridge (WEIGHBRIDGE_IN) or routed directly to factory
            const isWaitingIn = isEligibleForFactoryOps && !hasGateOut && (tx.status === "WEIGHBRIDGE_IN" || tx.assignedRoute === "FACTORY" || !hasGateIn);
            const isInsideYard = isEligibleForFactoryOps && (tx.status === "FACTORY_IN" || hasGateIn) && !hasGateOut;
            const isYardDone = isEligibleForFactoryOps && hasGateOut;

            return {
                ...tx,
                driverName: driverName,
                isWeighedDelivery: isWeighedDelivery,
                deliveryFlowDesc: flowDesc,
                deliveryFlowState: flowState,
                inboundWeightFormatted: inboundWeightStr,
                inboundWeightText: inboundWeightStr || "No Inbound Weight (Direct Delivery)",
                canRowFactoryIn: isEligibleForFactoryOps && !hasGateOut,
                canRowFactoryOut: isInsideYard,
                isWaitingIn: isWaitingIn,
                isInsideYard: isInsideYard,
                isYardDone: isYardDone,
                isClearedBySecurity: isClearedBySecurity,
                isStillAtWeighbridge: isStillAtWeighbridge,
                isEligibleForFactoryOps: isEligibleForFactoryOps
            };
        },

        loadFactoryData: async function () {
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                // Fetch all transactions without restricting to DELIVERY so any factory deliveries/pickups are loaded
                const url = `${ODATA_BASE}/GateTransactions?$expand=securityEntry,factoryEntry,weighments,transporter,supplier,driver,deliveryDetails&$orderby=createdAt desc`;
                const res = await fetch(url, { headers });
                if (!res.ok) {
                    throw new Error(`Failed to fetch transactions: ${res.statusText}`);
                }

                const data = await res.json();
                const raw = data.value || [];

                // Filter out records that are ONLY at Main Gate (GATE_IN with no security clearance)
                const processed = raw
                    .map(tx => this._enrichRecord(tx))
                    .filter(tx => tx.isEligibleForFactoryOps);

                this._oFacModel.setProperty("/allRecords", processed);

                // For the Gate IN dropdown: ONLY active vehicles cleared by security that need Factory IN or Factory OUT
                const activeEligible = processed.filter(t => !t.isYardDone);
                const insideYard = processed.filter(t => t.isInsideYard);
                this._oFacModel.setProperty("/eligibleVehicles", activeEligible);
                this._oFacModel.setProperty("/insideYardVehicles", insideYard);

                // Compute counts
                const waitingInCount = processed.filter(t => t.isWaitingIn).length;
                const insideYardCount = processed.filter(t => t.isInsideYard).length;
                const yardDoneCount = processed.filter(t => t.isYardDone).length;

                this._oFacModel.setProperty("/allCount", processed.length);
                this._oFacModel.setProperty("/waitingInCount", waitingInCount);
                this._oFacModel.setProperty("/insideYardCount", insideYardCount);
                this._oFacModel.setProperty("/yardDoneCount", yardDoneCount);

                this._applyFilterAndSearch();

                // If currently selected vehicle exists in new list, re-sync selection
                const currGateIn = this._oFacModel.getProperty("/selectedGateInNumber");
                if (currGateIn) {
                    const match = processed.find(t => t.gateInNumber === currGateIn);
                    if (match) {
                        this._populateFormFromVehicle(match, false);
                    }
                }
            } catch (err) {
                console.error("Error loading factory data:", err);
                MessageToast.show("Failed to load Factory Gate data");
            }
        },

        _applyFilterAndSearch: function () {
            const all = this._oFacModel.getProperty("/allRecords") || [];
            const filterKey = this._oFacModel.getProperty("/selectedFilter") || "ALL";
            const q = (this._oFacModel.getProperty("/searchQuery") || "").trim().toLowerCase();

            let filtered = all;

            if (filterKey === "WAITING_IN") {
                filtered = all.filter(t => t.isWaitingIn);
            } else if (filterKey === "INSIDE_YARD") {
                filtered = all.filter(t => t.isInsideYard);
            } else if (filterKey === "YARD_DONE") {
                filtered = all.filter(t => t.isYardDone);
            }

            if (q) {
                filtered = filtered.filter(t =>
                    (t.gateInNumber && t.gateInNumber.toLowerCase().includes(q)) ||
                    (t.vehicleRegNo && t.vehicleRegNo.toLowerCase().includes(q)) ||
                    (t.driverName && t.driverName.toLowerCase().includes(q)) ||
                    (t.securityEntry?.poNumber && t.securityEntry.poNumber.toLowerCase().includes(q)) ||
                    (t.securityEntry?.invoiceNumber && t.securityEntry.invoiceNumber.toLowerCase().includes(q)) ||
                    (t.factoryEntry?.factoryArea && t.factoryEntry.factoryArea.toLowerCase().includes(q))
                );
            }

            this._oFacModel.setProperty("/displayedRecords", filtered);
        },

        onFilterCategoryChange: function (oEvt) {
            const key = oEvt.getParameter("item").getKey();
            this._oFacModel.setProperty("/selectedFilter", key);
            this._applyFilterAndSearch();
        },

        onSearchLiveChange: function (oEvt) {
            const q = oEvt.getParameter("newValue") || "";
            this._oFacModel.setProperty("/searchQuery", q);
            this._applyFilterAndSearch();
        },

        onSearch: function (oEvt) {
            const q = oEvt.getParameter("query") || "";
            this._oFacModel.setProperty("/searchQuery", q);
            this._applyFilterAndSearch();
        },

        onResetSearch: function () {
            this._oFacModel.setProperty("/searchQuery", "");
            this._oFacModel.setProperty("/selectedFilter", "ALL");
            const oSearch = this.byId("facSearchField");
            if (oSearch) oSearch.setValue("");
            this._applyFilterAndSearch();
        },

        onRefreshQueue: function () {
            this.loadFactoryData();
            MessageToast.show("Factory queue refreshed");
        },

        onGateInSelectChange: function (oEvt) {
            let sKey = "";
            if (oEvt) {
                const oSource = oEvt.getSource ? oEvt.getSource() : null;
                const oSelectedItem = oEvt.getParameter("selectedItem");
                if (oSelectedItem) {
                    sKey = oSelectedItem.getKey();
                } else {
                    const sVal = (oEvt.getParameter("value") || (oSource && oSource.getValue ? oSource.getValue() : "")).trim();
                    sKey = sVal;
                }
                if (oSource && oSource.setValueState) {
                    oSource.setValueState("None");
                    oSource.setValueStateText("");
                }
            }
            if (!sKey) {
                sKey = this._oFacModel.getProperty("/selectedGateInNumber") || "";
            }
            this._selectVehicleByGateInNumber(sKey);
        },

        onSearchGateInBtnPress: function () {
            const oCombo = this.byId("facGateInComboBox");
            const sVal = (oCombo ? (oCombo.getSelectedKey() || oCombo.getValue()) : "").trim();
            if (sVal) {
                this._selectVehicleByGateInNumber(sVal);
            } else {
                MessageToast.show("Please enter or select a Gate IN Number");
            }
        },

        loadVehicleByGateInNumber: async function (sGateInNo) {
            if (!sGateInNo || !sGateInNo.trim()) return;
            await this.loadFactoryData();
            await this._selectVehicleByGateInNumber(sGateInNo.trim());
            const oVehicle = this._oFacModel.getProperty("/selectedVehicle");
            if (oVehicle) {
                if (oVehicle.canRowFactoryIn) {
                    this.onOpenFactoryGateInDialog();
                } else if (oVehicle.canRowFactoryOut) {
                    this.onOpenFactoryGateOutDialog();
                }
            }
        },

        _selectVehicleByGateInNumber: async function (sGateInNo) {
            const oCombo = this.byId("facGateInComboBox");
            if (!sGateInNo || !sGateInNo.trim()) {
                this.onResetForm();
                if (oCombo) {
                    oCombo.setValueState("None");
                    oCombo.setValueStateText("");
                }
                return;
            }

            const q = sGateInNo.trim().toLowerCase();
            const all = this._oFacModel.getProperty("/allRecords") || [];

            // Match by gateInNumber, vehicleRegNo, or poNumber
            let match = all.find(t =>
                (t.gateInNumber && t.gateInNumber.toLowerCase() === q) ||
                (t.vehicleRegNo && t.vehicleRegNo.toLowerCase() === q) ||
                (t.securityEntry && t.securityEntry.poNumber && t.securityEntry.poNumber.toLowerCase() === q) ||
                (t.deliveryDetails && t.deliveryDetails.poNumber && t.deliveryDetails.poNumber.toLowerCase() === q) ||
                (t.factoryEntry && t.factoryEntry.poNumber && t.factoryEntry.poNumber.toLowerCase() === q)
            );

            // If not found in loaded memory, direct server lookup
            if (!match) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const sEnc = encodeURIComponent(sGateInNo.trim());
                    const sEncLow = encodeURIComponent(q);
                    const url = `${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${sEnc}' or tolower(gateInNumber) eq '${sEncLow}' or tolower(vehicleRegNo) eq '${sEncLow}'&$expand=securityEntry,factoryEntry,weighments,transporter,supplier,driver,deliveryDetails`;
                    const res = await fetch(url, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.value && data.value.length > 0) {
                            match = this._enrichRecord(data.value[0]);
                        }
                    }
                } catch (e) {
                    console.warn("Direct lookup for gate transaction failed:", e);
                }
            }

            if (match) {
                // Check if vehicle has completed Security Gate clearance
                if (match.status === "GATE_IN" || !match.isClearedBySecurity) {
                    if (oCombo) {
                        oCombo.setValueState("Error");
                        oCombo.setValueStateText(`Vehicle #${match.gateInNumber} has not completed Security Gate clearance.`);
                    }
                    MessageBox.warning(
                        `Vehicle #${match.gateInNumber} (${match.vehicleRegNo}) is currently at Main Gate Entry (Status: GATE_IN).\n\nIt must be cleared at the Security Gate before proceeding to Factory Gate Operations.`,
                        {
                            title: "Security Clearance Required"
                        }
                    );
                    this.onResetForm();
                    return;
                }

                // Check if vehicle is still awaiting weighbridge weighment
                if (match.isStillAtWeighbridge) {
                    if (oCombo) {
                        oCombo.setValueState("Warning");
                        oCombo.setValueStateText(`Vehicle #${match.gateInNumber} is awaiting Inbound Weighbridge weighment.`);
                    }
                    MessageBox.warning(
                        `Vehicle #${match.gateInNumber} (${match.vehicleRegNo}) was assigned to WEIGHBRIDGE by Security Gate.\n\nInbound gross weighment must be completed at the Weighbridge before Factory Gate check-in.`,
                        {
                            title: "Weighbridge Weighment Pending"
                        }
                    );
                    this.onResetForm();
                    return;
                }

                if (oCombo) {
                    oCombo.setValueState("None");
                    oCombo.setValueStateText("");
                    oCombo.setSelectedKey(match.gateInNumber);
                }
                this._populateFormFromVehicle(match, true);
            } else {
                if (oCombo) {
                    oCombo.setValueState("Warning");
                    oCombo.setValueStateText(`No security-cleared vehicle found matching '${sGateInNo}'`);
                }
                MessageToast.show(`No security-cleared vehicle found for '${sGateInNo}'`);
            }
        },

        _fetchPoDetails: async function (sPoNumber) {
            if (!sPoNumber || sPoNumber === "N/A") {
                this._oFacModel.setProperty("/selectedPoDetails", null);
                return;
            }
            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };
                const sClean = sPoNumber.replace(/^PO-/i, "").trim();
                const sEnc1 = encodeURIComponent(sPoNumber.trim());
                const sEnc2 = encodeURIComponent(sClean);
                const url = `${ODATA_BASE}/PurchaseOrders?$filter=PurchaseOrder eq '${sEnc1}' or PurchaseOrder eq '${sEnc2}' or contains(PurchaseOrder,'${sEnc2}')&$top=1`;
                const res = await fetch(url, { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data.value && data.value.length > 0) {
                        this._oFacModel.setProperty("/selectedPoDetails", data.value[0]);
                        return;
                    }
                }
            } catch (e) {
                console.warn("PO details fetch failed:", e);
            }
            this._oFacModel.setProperty("/selectedPoDetails", null);
        },

        _populateFormFromVehicle: async function (oTx, bNotify) {
            if (!oTx) return;

            // Ensure oTx has enriched properties
            if (!oTx.deliveryFlowDesc) {
                oTx = this._enrichRecord(oTx);
            }

            this._oFacModel.setProperty("/selectedGateInNumber", oTx.gateInNumber);
            this._oFacModel.setProperty("/selectedVehicle", oTx);

            const fac = oTx.factoryEntry;
            const sec = oTx.securityEntry;
            const del = oTx.deliveryDetails;

            // Auto-collect PO, Invoice, Supplier, Transporter from Security Gate, DeliveryDetails or existing Factory entry
            const poNumber = (fac && fac.poNumber) || (sec && sec.poNumber) || (del && del.poNumber) || "";
            const invoiceNumber = (fac && fac.invoiceNumber) || (sec && sec.invoiceNumber) || (del && del.invoiceNumber) || "";
            const invoiceDate = (fac && fac.invoiceDate) || (sec && sec.invoiceDate) || (del && del.invoiceDate) || null;
            const supplierName = (fac && fac.supplierName) || (oTx.supplier && oTx.supplier.supplierName) || (sec && sec.supplierName) || (del && del.supplierName) || "";
            const transporterName = (fac && fac.transporterName) || (oTx.transporter && oTx.transporter.transporterName) || (sec && sec.transporterName) || "";

            const now = new Date();
            let facInTimeIso = now.toISOString();
            if (fac && fac.factoryGateInDateTime) {
                const d = new Date(fac.factoryGateInDateTime);
                if (!isNaN(d.getTime())) facInTimeIso = d.toISOString();
            }
            const facInTimeStr = facInTimeIso.substring(0, 19);
            let facInOp = (fac && fac.factoryGateInOperator) || models.getActiveUser();
            if (facInOp === "security_user" || (fac && fac.remarks === "Direct Factory Entry assigned at Security Gate IN")) {
                facInOp = models.getActiveUser();
            }

            let facOutTimeIso = null;
            let facOutTimeStr = "";
            if (fac && fac.factoryGateOutDateTime) {
                const d = new Date(fac.factoryGateOutDateTime);
                if (!isNaN(d.getTime())) {
                    facOutTimeIso = d.toISOString();
                    facOutTimeStr = facOutTimeIso.substring(0, 19);
                }
            } else if (oTx.status === "FACTORY_IN" && (!fac || fac.remarks !== "Direct Factory Entry assigned at Security Gate IN")) {
                facOutTimeIso = now.toISOString();
                facOutTimeStr = facOutTimeIso.substring(0, 19);
            }
            const facOutOp = (fac && fac.factoryGateOutOperator) || ((oTx.status === "FACTORY_IN" && (!fac || fac.remarks !== "Direct Factory Entry assigned at Security Gate IN")) ? models.getActiveUser() : "");

            // Determine Gate Out Type
            let gateOutType = "STANDARD";
            const rawRemarks = (fac && fac.remarks) || "";
            if (sec && sec.gatePassType) {
                gateOutType = sec.gatePassType;
            }
            if (rawRemarks) {
                const match = rawRemarks.match(/\[Gate Out Type:\s*([^\]]+)\]/i);
                if (match) {
                    gateOutType = match[1].trim();
                }
            }

            const formObj = {
                gateInNumber: oTx.gateInNumber,
                poNumber: poNumber,
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                supplierName: supplierName,
                transporterName: transporterName,
                factoryArea: (fac && fac.factoryArea) || "Raw Material Yard",
                unloadingPoint: (fac && fac.unloadingPoint) || "",
                gateOutType: gateOutType,
                factoryGateInDateTime: facInTimeIso,
                factoryGateInDateTimeStr: facInTimeStr,
                factoryGateInOperator: facInOp,
                factoryGateOutDateTime: facOutTimeIso,
                factoryGateOutDateTimeStr: facOutTimeStr,
                factoryGateOutOperator: facOutOp,
                materialDescription: (fac && fac.materialDescription) || "",
                deliveryNoteNo: (fac && fac.deliveryNoteNo) || "",
                unloadingStatus: (fac && fac.unloadingStatus) || "COMPLETED",
                unloadedQuantity: (fac && fac.unloadedQuantity != null) ? String(fac.unloadedQuantity) : "",
                goodsInspected: fac ? Boolean(fac.goodsInspected) : true,
                sealVerified: fac ? Boolean(fac.sealVerified) : true,
                remarks: rawRemarks
            };

            this._oFacModel.setProperty("/form", formObj);

            // Fetch PO master details if PO number is present
            await this._fetchPoDetails(poNumber);

            // Set informative process stage note
            let sStageMsg = "";
            let sStageMsgType = "Information";
            if (oTx.status === "GATE_IN") {
                sStageMsg = `Vehicle #${oTx.gateInNumber} is currently at Main Gate IN. Security check-in is required before Factory Gate IN.`;
                sStageMsgType = "Warning";
            } else if (oTx.status === "SECURITY_IN") {
                sStageMsg = `Direct Delivery: Security check complete. Ready for Factory Gate IN.`;
                sStageMsgType = "Success";
            } else if (oTx.status === "WEIGHBRIDGE_IN") {
                sStageMsg = `Weighed Delivery: Inbound Gross weighment complete. Ready for Factory Gate IN.`;
                sStageMsgType = "Success";
            } else if (oTx.status === "FACTORY_IN") {
                if (fac && fac.factoryGateOutDateTime) {
                    sStageMsg = `Factory Yard clearance already completed for this vehicle.`;
                    sStageMsgType = "None";
                } else if (fac && fac.factoryGateInDateTime) {
                    sStageMsg = `Factory Gate IN recorded. Vehicle is inside yard. Ready for Factory Gate OUT on exit.`;
                    sStageMsgType = "Information";
                } else {
                    sStageMsg = `Vehicle #${oTx.gateInNumber} is at Factory Gate. Ready for Factory Gate IN recording.`;
                    sStageMsgType = "Success";
                }
            } else if (oTx.status === "FACTORY_OUT") {
                sStageMsg = `Factory Yard clearance already completed for this vehicle.`;
                sStageMsgType = "None";
            }
            this._oFacModel.setProperty("/vehicleStageMessage", sStageMsg);
            this._oFacModel.setProperty("/vehicleStageMessageType", sStageMsgType);

            if (bNotify) {
                MessageToast.show(`Loaded Gate Pass #${oTx.gateInNumber} (${oTx.vehicleRegNo})`);
            }
        },

        onGateInDateTimeChange: function (oEvt) {
            const oDate = oEvt.getSource().getDateValue();
            if (oDate) {
                this._oFacModel.setProperty("/form/factoryGateInDateTime", oDate.toISOString());
                this._oFacModel.setProperty("/form/factoryGateInDateTimeStr", oDate.toISOString().substring(0, 19));
            }
        },

        onGateOutDateTimeChange: function (oEvt) {
            const oDate = oEvt.getSource().getDateValue();
            if (oDate) {
                this._oFacModel.setProperty("/form/factoryGateOutDateTime", oDate.toISOString());
                this._oFacModel.setProperty("/form/factoryGateOutDateTimeStr", oDate.toISOString().substring(0, 19));
            } else {
                this._oFacModel.setProperty("/form/factoryGateOutDateTime", null);
                this._oFacModel.setProperty("/form/factoryGateOutDateTimeStr", "");
            }
        },

        onRecordFactoryIn: async function () {
            const form = this._oFacModel.getProperty("/form");

            if (!form.gateInNumber) {
                MessageBox.error("Please select or enter a valid Gate IN Number.");
                return;
            }

            const inTime = form.factoryGateInDateTime || (form.factoryGateInDateTimeStr ? new Date(form.factoryGateInDateTimeStr).toISOString() : new Date().toISOString());

            if (!inTime) {
                MessageBox.error("Factory Gate IN Date & Time is mandatory.");
                return;
            }

            if (!form.factoryGateInOperator || !form.factoryGateInOperator.trim()) {
                MessageBox.error("Factory Gate Operator name is mandatory. Please enter your name.");
                return;
            }

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateInDateTime: inTime,
                factoryGateInOperator: form.factoryGateInOperator.trim(),
                factoryArea: form.factoryArea || "Raw Material Yard",
                unloadingPoint: form.unloadingPoint || "",
                poNumber: form.poNumber || "",
                invoiceNumber: form.invoiceNumber || "",
                invoiceDate: form.invoiceDate || null,
                supplierName: form.supplierName || "",
                transporterName: form.transporterName || "",
                materialDescription: form.materialDescription || "",
                deliveryNoteNo: form.deliveryNoteNo || "",
                remarks: form.remarks || ""
            };

            const oForm = this.byId("factoryEntryForm");
            if (oForm) oForm.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const res = await fetch(`${ODATA_BASE}/FactoryGateIn`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errMsg = "Failed to record Factory Gate IN";
                    try {
                        const err = await res.json();
                        errMsg = err.error?.message || errMsg;
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                const oVehicle = this._oFacModel.getProperty("/selectedVehicle");
                const successData = {
                    gateInNumber: form.gateInNumber,
                    vehicleRegNo: oVehicle?.vehicleRegNo || form.gateInNumber,
                    vehicleType: oVehicle?.vehicleType || "TRUCK",
                    driverName: oVehicle?.driverName || "-",
                    transporterName: form.transporterName || oVehicle?.transporter?.transporterName || "-",
                    poNumber: form.poNumber || "N/A",
                    supplierName: form.supplierName || "-",
                    factoryGateInDateTime: inTime,
                    factoryGateInOperator: form.factoryGateInOperator
                };
                this._oFacModel.setProperty("/gateInSuccess", successData);

                MessageToast.show(`Factory Gate IN successfully recorded for #${form.gateInNumber}!`);
                if (this._pGateInDialog) {
                    this._pGateInDialog.then(oDialog => oDialog.close());
                }
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
                this._openFactoryGateInSuccessDialog();
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                if (oForm) oForm.setBusy(false);
            }
        },

        onRecordFactoryOut: async function () {
            const form = this._oFacModel.getProperty("/form");

            if (!form.gateInNumber) {
                MessageBox.error("Please select or enter a valid Gate IN Number.");
                return;
            }

            const oVehicle = this._oFacModel.getProperty("/selectedVehicle");
            if (oVehicle && oVehicle.status !== "FACTORY_IN") {
                if (oVehicle.status === "SECURITY_IN" || oVehicle.status === "WEIGHBRIDGE_IN" || oVehicle.status === "GATE_IN") {
                    MessageBox.warning(`Vehicle #${form.gateInNumber} is currently at '${oVehicle.status}'. Please record Factory Gate IN first before recording Factory Gate OUT.`);
                    return;
                }
            }

            const outTime = form.factoryGateOutDateTime || (form.factoryGateOutDateTimeStr ? new Date(form.factoryGateOutDateTimeStr).toISOString() : new Date().toISOString());
            const outOp = (form.factoryGateInOperator && form.factoryGateInOperator.trim()) || (form.factoryGateOutOperator && form.factoryGateOutOperator.trim()) || models.getActiveUser();

            const sGateOutType = form.gateOutType || "STANDARD";
            const sUserRemarks = (form.remarks && form.remarks.trim()) || "";
            const sPrefixedRemarks = sUserRemarks ? `[Gate Out Type: ${sGateOutType}] ${sUserRemarks}` : `[Gate Out Type: ${sGateOutType}] Factory yard operations completed`;

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                unloadingStatus: form.unloadingStatus || "COMPLETED",
                unloadedQuantity: form.unloadedQuantity ? parseFloat(form.unloadedQuantity) : null,
                quantityUnit: "KG",
                goodsInspected: form.goodsInspected !== undefined ? Boolean(form.goodsInspected) : true,
                sealVerified: form.sealVerified !== undefined ? Boolean(form.sealVerified) : true,
                remarks: sPrefixedRemarks
            };

            const oForm = this.byId("factoryEntryForm");
            if (oForm) oForm.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const res = await fetch(`${ODATA_BASE}/FactoryGateOut`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errMsg = "Failed to record Factory Gate OUT";
                    try {
                        const err = await res.json();
                        errMsg = err.error?.message || errMsg;
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                const successData = {
                    gateInNumber: form.gateInNumber,
                    vehicleRegNo: oVehicle?.vehicleRegNo || form.gateInNumber,
                    vehicleType: oVehicle?.vehicleType || "TRUCK",
                    driverName: oVehicle?.driverName || "-",
                    transporterName: form.transporterName || oVehicle?.transporter?.transporterName || "-",
                    poNumber: form.poNumber || "N/A",
                    supplierName: form.supplierName || "-",
                    gateOutType: sGateOutType,
                    factoryGateInDateTime: form.factoryGateInDateTime,
                    factoryGateInOperator: form.factoryGateInOperator,
                    factoryGateOutDateTime: outTime,
                    factoryGateOutOperator: outOp,
                    remarks: sUserRemarks || "Factory yard operations completed"
                };
                this._oFacModel.setProperty("/gateOutSuccess", successData);

                MessageToast.show(`Factory Gate OUT clearance recorded for #${form.gateInNumber}!`);
                if (this._pGateOutDialog) {
                    this._pGateOutDialog.then(oDialog => oDialog.close());
                }
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
                this._openFactoryGateOutSuccessDialog();
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                if (oForm) oForm.setBusy(false);
            }
        },

        onRecordFullClearance: async function () {
            const form = this._oFacModel.getProperty("/form");

            if (!form.gateInNumber) {
                MessageBox.error("Please select or enter a valid Gate IN Number.");
                return;
            }

            const inTime = form.factoryGateInDateTime || (form.factoryGateInDateTimeStr ? new Date(form.factoryGateInDateTimeStr).toISOString() : new Date().toISOString());
            const inOp = (form.factoryGateInOperator && form.factoryGateInOperator.trim()) || models.getActiveUser();
            const outTime = form.factoryGateOutDateTime || (form.factoryGateOutDateTimeStr ? new Date(form.factoryGateOutDateTimeStr).toISOString() : new Date().toISOString());
            const outOp = (form.factoryGateOutOperator && form.factoryGateOutOperator.trim()) || inOp;

            const sGateOutType = form.gateOutType || "STANDARD";
            const sUserRemarks = (form.remarks && form.remarks.trim()) || "";
            const sPrefixedRemarks = sUserRemarks ? `[Gate Out Type: ${sGateOutType}] ${sUserRemarks}` : `[Gate Out Type: ${sGateOutType}] Full Factory clearance completed`;

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateInDateTime: inTime,
                factoryGateInOperator: inOp,
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                factoryArea: form.factoryArea || "Raw Material Yard",
                unloadingPoint: form.unloadingPoint || "",
                poNumber: form.poNumber || "",
                invoiceNumber: form.invoiceNumber || "",
                invoiceDate: form.invoiceDate || null,
                supplierName: form.supplierName || "",
                transporterName: form.transporterName || "",
                materialDescription: form.materialDescription || "",
                unloadingStatus: form.unloadingStatus || "COMPLETED",
                unloadedQuantity: form.unloadedQuantity ? parseFloat(form.unloadedQuantity) : null,
                quantityUnit: "KG",
                deliveryNoteNo: form.deliveryNoteNo || "",
                goodsInspected: form.goodsInspected !== undefined ? Boolean(form.goodsInspected) : true,
                sealVerified: form.sealVerified !== undefined ? Boolean(form.sealVerified) : true,
                remarks: sPrefixedRemarks
            };

            const oForm = this.byId("factoryEntryForm");
            if (oForm) oForm.setBusy(true);

            try {
                const headers = {
                    "Authorization": models.getAuthHeaderValue(),
                    "Content-Type": "application/json"
                };

                const res = await fetch(`${ODATA_BASE}/RecordFactoryOperation`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errMsg = "Failed to record Factory Clearance";
                    try {
                        const err = await res.json();
                        errMsg = err.error?.message || errMsg;
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                const oVehicle = this._oFacModel.getProperty("/selectedVehicle");
                const successData = {
                    gateInNumber: form.gateInNumber,
                    vehicleRegNo: oVehicle?.vehicleRegNo || form.gateInNumber,
                    vehicleType: oVehicle?.vehicleType || "TRUCK",
                    driverName: oVehicle?.driverName || "-",
                    transporterName: form.transporterName || oVehicle?.transporter?.transporterName || "-",
                    poNumber: form.poNumber || "N/A",
                    supplierName: form.supplierName || "-",
                    gateOutType: sGateOutType,
                    factoryGateInDateTime: inTime,
                    factoryGateInOperator: inOp,
                    factoryGateOutDateTime: outTime,
                    factoryGateOutOperator: outOp,
                    remarks: sUserRemarks || "Full Factory clearance completed"
                };
                this._oFacModel.setProperty("/gateOutSuccess", successData);

                MessageToast.show(`Complete Factory clearance recorded for #${form.gateInNumber}!`);
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
                this._openFactoryGateOutSuccessDialog();
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                if (oForm) oForm.setBusy(false);
            }
        },

        _openFactoryGateInSuccessDialog: function () {
            const oView = this.getView();
            const sId = oView.createId("facGateInSuccessFrag");
            if (!this._pFactoryGateInSuccessDialog) {
                this._pFactoryGateInSuccessDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.FactoryGateInSuccessDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pFactoryGateInSuccessDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseFactoryGateInSuccessDialog: function () {
            if (this._pFactoryGateInSuccessDialog) {
                this._pFactoryGateInSuccessDialog.then(oDialog => oDialog.close());
            }
        },

        onPrintFactoryGateInSlip: function () {
            const data = this._oFacModel.getProperty("/gateInSuccess");
            if (data) {
                this.getOwnerComponent().printFactoryGateInSlip(data);
            }
        },

        _openFactoryGateOutSuccessDialog: function () {
            const oView = this.getView();
            const sId = oView.createId("facGateOutSuccessFrag");
            if (!this._pFactoryGateOutSuccessDialog) {
                this._pFactoryGateOutSuccessDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.FactoryGateOutSuccessDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pFactoryGateOutSuccessDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseFactoryGateOutSuccessDialog: function () {
            if (this._pFactoryGateOutSuccessDialog) {
                this._pFactoryGateOutSuccessDialog.then(oDialog => oDialog.close());
            }
        },

        onPrintFactoryGateOutSlip: function () {
            const data = this._oFacModel.getProperty("/gateOutSuccess");
            if (data) {
                this.getOwnerComponent().printFactoryGateOutSlip(data);
            }
        },

        onResetForm: function () {
            const nowIso = new Date().toISOString();
            const oCombo = this.byId("facGateInComboBox");
            if (oCombo) {
                oCombo.setValueState("None");
                oCombo.setValueStateText("");
                oCombo.setSelectedKey("");
                oCombo.setValue("");
            }
            this._oFacModel.setProperty("/selectedGateInNumber", "");
            this._oFacModel.setProperty("/selectedVehicle", null);
            this._oFacModel.setProperty("/selectedPoDetails", null);
            this._oFacModel.setProperty("/vehicleStageMessage", "");
            this._oFacModel.setProperty("/vehicleStageMessageType", "None");
            this._oFacModel.setProperty("/form", {
                gateInNumber: "",
                poNumber: "",
                invoiceNumber: "",
                invoiceDate: null,
                supplierName: "",
                transporterName: "",
                factoryArea: "Raw Material Yard",
                unloadingPoint: "",
                gateOutType: "STANDARD",
                factoryGateInDateTime: nowIso,
                factoryGateInDateTimeStr: nowIso.substring(0, 19),
                factoryGateInOperator: models.getActiveUser(),
                factoryGateOutDateTime: null,
                factoryGateOutDateTimeStr: "",
                factoryGateOutOperator: "",
                materialDescription: "",
                deliveryNoteNo: "",
                unloadingStatus: "COMPLETED",
                unloadedQuantity: "",
                goodsInspected: true,
                sealVerified: true,
                remarks: ""
            });
            MessageToast.show("Form reset");
        },

        onRowSelectPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (oCtx) {
                const oTx = oCtx.getObject();
                this._populateFormFromVehicle(oTx, true);
            }
        },

        // ============================================================
        // Factory Gate IN Dialog Management
        // ============================================================
        onOpenFactoryGateInDialog: async function (oEvt) {
            let oTx = null;
            if (oEvt && oEvt.getSource) {
                const oCtx = oEvt.getSource().getBindingContext("facModel");
                if (oCtx) {
                    oTx = oCtx.getObject();
                }
            }

            if (oTx) {
                this._oFacModel.setProperty("/isVehicleSelectable", false);
                await this._populateFormFromVehicle(oTx, false);
            } else {
                this._oFacModel.setProperty("/isVehicleSelectable", true);
                const currGateIn = this._oFacModel.getProperty("/selectedGateInNumber");
                const eligible = this._oFacModel.getProperty("/eligibleVehicles") || [];
                if (!currGateIn && eligible.length > 0) {
                    await this._populateFormFromVehicle(eligible[0], false);
                }
            }

            const oView = this.getView();
            const sId = oView.createId("facGateInFrag");
            if (!this._pGateInDialog) {
                this._pGateInDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.FactoryGateInDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pGateInDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCancelFactoryGateIn: function () {
            if (this._pGateInDialog) {
                this._pGateInDialog.then(oDialog => oDialog.close());
            }
        },

        onConfirmFactoryGateIn: async function () {
            await this.onRecordFactoryIn();
        },

        // ============================================================
        // Factory Gate OUT Dialog Management
        // ============================================================
        onOpenFactoryGateOutDialog: async function (oEvt) {
            let oTx = null;
            if (oEvt && oEvt.getSource) {
                const oCtx = oEvt.getSource().getBindingContext("facModel");
                if (oCtx) {
                    oTx = oCtx.getObject();
                }
            }

            if (oTx) {
                this._oFacModel.setProperty("/isOutVehicleSelectable", false);
                await this._populateFormFromVehicle(oTx, false);
            } else {
                this._oFacModel.setProperty("/isOutVehicleSelectable", true);
                const inside = this._oFacModel.getProperty("/insideYardVehicles") || [];
                const currGateIn = this._oFacModel.getProperty("/selectedGateInNumber");
                const currMatch = inside.find(v => v.gateInNumber === currGateIn);
                if (currMatch) {
                    await this._populateFormFromVehicle(currMatch, false);
                } else if (inside.length > 0) {
                    await this._populateFormFromVehicle(inside[0], false);
                }
            }

            // Ensure out date is prefilled
            if (!this._oFacModel.getProperty("/form/factoryGateOutDateTimeStr")) {
                const nowIso = new Date().toISOString();
                this._oFacModel.setProperty("/form/factoryGateOutDateTime", nowIso);
                this._oFacModel.setProperty("/form/factoryGateOutDateTimeStr", nowIso.substring(0, 19));
            }

            const oView = this.getView();
            const sId = oView.createId("facGateOutFrag");
            if (!this._pGateOutDialog) {
                this._pGateOutDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.FactoryGateOutDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pGateOutDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCancelFactoryGateOut: function () {
            if (this._pGateOutDialog) {
                this._pGateOutDialog.then(oDialog => oDialog.close());
            }
        },

        onConfirmFactoryGateOut: async function () {
            await this.onRecordFactoryOut();
        },

        onRowFactoryInPress: function (oEvt) {
            this.onOpenFactoryGateInDialog(oEvt);
        },

        onRowFactoryOutPress: function (oEvt) {
            this.onOpenFactoryGateOutDialog(oEvt);
        },

        onRowPrintPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (!oCtx) return;
            const oTx = oCtx.getObject();
            const fac = oTx.factoryEntry;

            let gateOutType = "STANDARD";
            const rawRemarks = (fac && fac.remarks) || "";
            if (rawRemarks) {
                const match = rawRemarks.match(/\[Gate Out Type:\s*([^\]]+)\]/i);
                if (match) gateOutType = match[1].trim();
            }

            const successData = {
                gateInNumber: oTx.gateInNumber,
                vehicleRegNo: oTx.vehicleRegNo,
                vehicleType: oTx.vehicleType || "TRUCK",
                driverName: oTx.driverName || "-",
                transporterName: oTx.transporter?.transporterName || (fac && fac.transporterName) || "-",
                poNumber: (fac && fac.poNumber) || (oTx.securityEntry && oTx.securityEntry.poNumber) || "N/A",
                supplierName: (fac && fac.supplierName) || (oTx.supplier && oTx.supplier.supplierName) || "-",
                gateOutType: gateOutType,
                factoryGateInDateTime: fac ? fac.factoryGateInDateTime : null,
                factoryGateInOperator: fac ? fac.factoryGateInOperator : "",
                factoryGateOutDateTime: fac ? fac.factoryGateOutDateTime : new Date().toISOString(),
                factoryGateOutOperator: fac ? fac.factoryGateOutOperator : models.getActiveUser(),
                remarks: rawRemarks.replace(/\[Gate Out Type:\s*[^\]]+\]\s*/i, "") || "Factory yard operations completed"
            };
            this._oFacModel.setProperty("/gateOutSuccess", successData);
            this._openFactoryGateOutSuccessDialog();
        },

        onRowViewPress: async function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (!oCtx) return;
            const oTx = oCtx.getObject();
            await this._populateFormFromVehicle(oTx, false);
            if (oTx.canRowFactoryOut) {
                this.onOpenFactoryGateOutDialog(oEvt);
            } else if (oTx.canRowFactoryIn) {
                this.onOpenFactoryGateInDialog(oEvt);
            } else {
                this.onRowPrintPress(oEvt);
            }
        },

        onTxRowPress: function (oEvt) {
            this.onRowViewPress(oEvt);
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavMainGateOps: function () {
            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
        },

        onNavSecurityGateOps: function () {
            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
        },

        onNavWeighbridgeOps: function () {
            this.getOwnerComponent().navigateTo("weighbridgeOpsPage", "slide");
        }
    });
});
