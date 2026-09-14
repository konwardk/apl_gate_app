sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "factory/gate/model/formatter",
    "factory/gate/model/models"
], function (Controller, JSONModel, MessageToast, MessageBox, formatter, models) {
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
                vehicleStageMessage: "",
                vehicleStageMessageType: "None",
                selectedFilter: "ALL",
                searchQuery: "",
                allCount: 0,
                waitingInCount: 0,
                insideYardCount: 0,
                yardDoneCount: 0,
                form: {
                    gateInNumber: "",
                    poNumber: "",
                    invoiceNumber: "",
                    invoiceDate: null,
                    supplierName: "",
                    transporterName: "",
                    factoryArea: "Methanol Plant - Unloading Bay",
                    unloadingPoint: "",
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
            const isWeighedDelivery = hasGrossIn || tx.status === "WEIGHBRIDGE_IN" || tx.status === "WEIGHBRIDGE_OUT";

            let flowDesc = "Direct Delivery (Scale Bypassed)";
            let flowState = "Warning";
            if (isWeighedDelivery) {
                flowDesc = "Weighed Delivery (Scale Checked)";
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
            const isWaitingIn = (tx.status === "SECURITY_IN" || tx.status === "WEIGHBRIDGE_IN") &&
                (!tx.factoryEntry || !tx.factoryEntry.factoryGateInDateTime);

            const isInsideYard = tx.status === "FACTORY_IN";
            const isYardDone = tx.status === "FACTORY_OUT" ||
                (tx.factoryEntry && tx.factoryEntry.factoryGateOutDateTime);

            return {
                ...tx,
                driverName: driverName,
                isWeighedDelivery: isWeighedDelivery,
                deliveryFlowDesc: flowDesc,
                deliveryFlowState: flowState,
                inboundWeightFormatted: inboundWeightStr,
                inboundWeightText: inboundWeightStr || "No Inbound Weight (Direct Delivery)",
                canRowFactoryIn: isWaitingIn,
                canRowFactoryOut: isInsideYard,
                isWaitingIn: isWaitingIn,
                isInsideYard: isInsideYard,
                isYardDone: isYardDone
            };
        },

        loadFactoryData: async function () {
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const url = `${ODATA_BASE}/GateTransactions?$expand=securityEntry,factoryEntry,weighments,transporter,supplier,driver&$filter=purpose eq 'DELIVERY'&$orderby=createdAt desc`;
                const res = await fetch(url, { headers });
                if (!res.ok) {
                    throw new Error(`Failed to fetch transactions: ${res.statusText}`);
                }

                const data = await res.json();
                const raw = data.value || [];

                // Process records with enriched flow and display attributes
                const processed = raw.map(tx => this._enrichRecord(tx));

                this._oFacModel.setProperty("/allRecords", processed);
                this._oFacModel.setProperty("/eligibleVehicles", processed);

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
                    const url = `${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${sEnc}' or tolower(gateInNumber) eq '${sEncLow}' or tolower(vehicleRegNo) eq '${sEncLow}'&$expand=securityEntry,factoryEntry,weighments,transporter,supplier,driver`;
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
                if (oCombo) {
                    oCombo.setValueState("None");
                    oCombo.setValueStateText("");
                    oCombo.setSelectedKey(match.gateInNumber);
                }
                this._populateFormFromVehicle(match, true);
            } else {
                if (oCombo) {
                    oCombo.setValueState("Warning");
                    oCombo.setValueStateText(`No delivery transaction found matching '${sGateInNo}'`);
                }
                MessageToast.show(`No record found for '${sGateInNo}'`);
            }
        },

        _populateFormFromVehicle: function (oTx, bNotify) {
            // Ensure oTx has enriched properties
            if (!oTx.deliveryFlowDesc) {
                oTx = this._enrichRecord(oTx);
            }

            this._oFacModel.setProperty("/selectedGateInNumber", oTx.gateInNumber);
            this._oFacModel.setProperty("/selectedVehicle", oTx);

            const fac = oTx.factoryEntry;
            const sec = oTx.securityEntry;

            // Auto-collect PO, Invoice, Supplier, Transporter from Security Gate or existing Factory entry
            const poNumber = (fac && fac.poNumber) || (sec && sec.poNumber) || "";
            const invoiceNumber = (fac && fac.invoiceNumber) || (sec && sec.invoiceNumber) || "";
            const invoiceDate = (fac && fac.invoiceDate) || (sec && sec.invoiceDate) || null;
            const supplierName = (fac && fac.supplierName) || (oTx.supplier && oTx.supplier.supplierName) || (sec && sec.supplierName) || "";
            const transporterName = (fac && fac.transporterName) || (oTx.transporter && oTx.transporter.transporterName) || (sec && sec.transporterName) || "";

            const now = new Date();
            let facInTimeIso = now.toISOString();
            if (fac && fac.factoryGateInDateTime) {
                const d = new Date(fac.factoryGateInDateTime);
                if (!isNaN(d.getTime())) facInTimeIso = d.toISOString();
            }
            const facInTimeStr = facInTimeIso.substring(0, 19);
            const facInOp = (fac && fac.factoryGateInOperator) || models.getActiveUser();

            let facOutTimeIso = null;
            let facOutTimeStr = "";
            if (fac && fac.factoryGateOutDateTime) {
                const d = new Date(fac.factoryGateOutDateTime);
                if (!isNaN(d.getTime())) {
                    facOutTimeIso = d.toISOString();
                    facOutTimeStr = facOutTimeIso.substring(0, 19);
                }
            } else if (oTx.status === "FACTORY_IN") {
                facOutTimeIso = now.toISOString();
                facOutTimeStr = facOutTimeIso.substring(0, 19);
            }
            const facOutOp = (fac && fac.factoryGateOutOperator) || (oTx.status === "FACTORY_IN" ? models.getActiveUser() : "");

            const formObj = {
                gateInNumber: oTx.gateInNumber,
                poNumber: poNumber,
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                supplierName: supplierName,
                transporterName: transporterName,
                factoryArea: (fac && fac.factoryArea) || "Methanol Plant - Unloading Bay",
                unloadingPoint: (fac && fac.unloadingPoint) || "",
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
                remarks: (fac && fac.remarks) || ""
            };

            this._oFacModel.setProperty("/form", formObj);

            // Set informative process stage note
            let sStageMsg = "";
            let sStageMsgType = "Information";
            if (oTx.status === "GATE_IN") {
                sStageMsg = `Vehicle #${oTx.gateInNumber} is currently at Main Gate IN. Security check-in is required before Factory Gate IN.`;
                sStageMsgType = "Warning";
            } else if (oTx.status === "SECURITY_IN") {
                sStageMsg = `Direct Delivery: Security check complete. Ready for Factory Gate IN. (Auto-collected PO #${poNumber || 'N/A'}, Inv #${invoiceNumber || 'N/A'})`;
                sStageMsgType = "Success";
            } else if (oTx.status === "WEIGHBRIDGE_IN") {
                sStageMsg = `Weighed Delivery: Inbound Gross weighment complete. Ready for Factory Gate IN. (Auto-collected PO #${poNumber || 'N/A'}, Inv #${invoiceNumber || 'N/A'})`;
                sStageMsgType = "Success";
            } else if (oTx.status === "FACTORY_IN") {
                sStageMsg = `Vehicle is inside Factory Yard. Ready for Factory Gate OUT clearance.`;
                sStageMsgType = "Information";
            } else if (oTx.status === "FACTORY_OUT") {
                sStageMsg = `Factory Yard unloading already completed for this vehicle.`;
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
                MessageBox.error("Factory Gate IN Operator name is mandatory.");
                return;
            }

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateInDateTime: inTime,
                factoryGateInOperator: form.factoryGateInOperator.trim(),
                factoryArea: form.factoryArea,
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

                MessageToast.show(`Factory Gate IN successfully recorded for #${form.gateInNumber}!`);
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
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

            const outTime = form.factoryGateOutDateTime || (form.factoryGateOutDateTimeStr ? new Date(form.factoryGateOutDateTimeStr).toISOString() : new Date().toISOString());
            const outOp = (form.factoryGateOutOperator && form.factoryGateOutOperator.trim()) || models.getActiveUser();

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                unloadingStatus: form.unloadingStatus || "COMPLETED",
                unloadedQuantity: form.unloadedQuantity ? parseFloat(form.unloadedQuantity) : null,
                quantityUnit: "KG",
                goodsInspected: Boolean(form.goodsInspected),
                sealVerified: Boolean(form.sealVerified),
                remarks: form.remarks || "Factory yard operations completed"
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

                MessageToast.show(`Factory Gate OUT clearance recorded for #${form.gateInNumber}!`);
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
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
            const outOp = (form.factoryGateOutOperator && form.factoryGateOutOperator.trim()) || models.getActiveUser();

            const payload = {
                gateInNumber: form.gateInNumber,
                factoryGateInDateTime: inTime,
                factoryGateInOperator: inOp,
                factoryGateOutDateTime: outTime,
                factoryGateOutOperator: outOp,
                factoryArea: form.factoryArea,
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
                goodsInspected: Boolean(form.goodsInspected),
                sealVerified: Boolean(form.sealVerified),
                remarks: form.remarks || "Full Factory clearance completed"
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

                MessageToast.show(`Complete Factory clearance recorded for #${form.gateInNumber}!`);
                this.getOwnerComponent().loadOverviewData();
                await this.loadFactoryData();
            } catch (err) {
                MessageBox.error(err.message);
            } finally {
                if (oForm) oForm.setBusy(false);
            }
        },

        onResetForm: function () {
            const nowIso = new Date().toISOString();
            const oCombo = this.byId("facGateInComboBox");
            if (oCombo) {
                oCombo.setValueState("None");
                oCombo.setValueStateText("");
            }
            this._oFacModel.setProperty("/selectedGateInNumber", "");
            this._oFacModel.setProperty("/selectedVehicle", null);
            this._oFacModel.setProperty("/vehicleStageMessage", "");
            this._oFacModel.setProperty("/vehicleStageMessageType", "None");
            this._oFacModel.setProperty("/form", {
                gateInNumber: "",
                poNumber: "",
                invoiceNumber: "",
                invoiceDate: null,
                supplierName: "",
                transporterName: "",
                factoryArea: "Methanol Plant - Unloading Bay",
                unloadingPoint: "",
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

        onRowFactoryInPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (oCtx) {
                const oTx = oCtx.getObject();
                this._populateFormFromVehicle(oTx, false);
                this.onRecordFactoryIn();
            }
        },

        onRowFactoryOutPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (oCtx) {
                const oTx = oCtx.getObject();
                this._populateFormFromVehicle(oTx, false);
                this.onRecordFactoryOut();
            }
        },

        onRowPrintPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("facModel");
            if (oCtx) {
                const oTx = oCtx.getObject();
                this.getOwnerComponent().printGateInPass(oTx);
            }
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
