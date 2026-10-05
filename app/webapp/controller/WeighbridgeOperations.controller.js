sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/core/library",
    "factory/gate/model/formatter",
    "factory/gate/model/models"
], function (Controller, JSONModel, MessageToast, MessageBox, Fragment, coreLibrary, formatter, models) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const ODATA_BASE = "/gate";

    return Controller.extend("factory.gate.controller.WeighbridgeOperations", {
        formatter: formatter,

        onInit: function () {
            const activeUser = models.getActiveUser();
            const nowIso = new Date().toISOString().substring(0, 19);
            const oWbModel = new JSONModel({
                allRecords: [],
                displayedRecords: [],
                selectedFilter: "ALL",
                searchQuery: "",
                allCount: 0,
                awaitingInCount: 0,
                insideYardCount: 0,
                awaitingOutCount: 0,
                completedCount: 0,
                dialogTitle: "Record Inbound Weighment (1st Scale)",
                isVehicleSelectable: true,
                weighbridgeNumber: "WB-01",
                weighmentType: "GROSS_IN",
                availableWeighmentTypes: [
                    { key: "GROSS_IN", text: "Gross IN (Truck + Cargo)" },
                    { key: "TARE_OUT", text: "Tare OUT (Empty Truck)" }
                ],
                weightUnit: "KG",
                weighbridgeDateTimeStr: nowIso,
                operator: activeUser.includes("weighbridge") ? activeUser : "weighbridge_user",
                selectedGateInNumber: "",
                selectedVehicle: null,
                expectedWeighmentType: "GROSS_IN",
                expectedOperationType: "Information",
                expectedOperationDescription: "Select a vehicle from the queue to determine the expected weighment operation.",
                isOutboundStage: false,
                inboundWeightRecord: null,
                inputWeight: "",
                calculatedNetWeight: 0,
                calculatedNetWeightMT: "0.00",
                netWeightDisplay: "",
                netWeightStatusText: "",
                netWeightStatusState: ValueState.None,
                remarks: "",
                eligibleVehicles: [],
                inboundQueue: [],
                outboundQueue: [],
                completedWeighments: []
            });
            this.getView().setModel(oWbModel, "wbModel");

            this.loadWeighbridgeData();
        },

        _enrichRecord: function (tx) {
            const weighments = (tx.weighments || []).slice().sort((a, b) => new Date(a.weighbridgeDateTime || a.createdAt || 0) - new Date(b.weighbridgeDateTime || b.createdAt || 0));
            const inboundWeighment = [...weighments].reverse().find(w => w.weighmentType === "GROSS_IN" || w.weighmentType === "TARE_IN") || null;
            const outboundWeighment = [...weighments].reverse().find(w => w.weighmentType === "TARE_OUT" || w.weighmentType === "GROSS_OUT") || null;

            let grossWeighment = null;
            let tareWeighment = null;

            // Delivery: inbound is Gross, outbound is Tare
            // Pickup: inbound is Tare, outbound is Gross
            if (inboundWeighment && (inboundWeighment.weighmentType === "GROSS_IN" || inboundWeighment.weighmentType === "GROSS_OUT")) {
                grossWeighment = inboundWeighment;
            } else if (outboundWeighment && (outboundWeighment.weighmentType === "GROSS_IN" || outboundWeighment.weighmentType === "GROSS_OUT")) {
                grossWeighment = outboundWeighment;
            }

            if (inboundWeighment && (inboundWeighment.weighmentType === "TARE_IN" || inboundWeighment.weighmentType === "TARE_OUT")) {
                tareWeighment = inboundWeighment;
            } else if (outboundWeighment && (outboundWeighment.weighmentType === "TARE_IN" || outboundWeighment.weighmentType === "TARE_OUT")) {
                tareWeighment = outboundWeighment;
            }

            // Fallback search across all weighments if not resolved
            if (!grossWeighment) {
                grossWeighment = [...weighments].reverse().find(w => w.weighmentType === "GROSS_IN" || w.weighmentType === "GROSS_OUT") || null;
            }
            if (!tareWeighment) {
                tareWeighment = [...weighments].reverse().find(w => w.weighmentType === "TARE_IN" || w.weighmentType === "TARE_OUT") || null;
            }

            // General fallback: if at least 2 weighments exist, heavier is gross, lighter is tare
            if ((!grossWeighment || !tareWeighment) && weighments.length >= 2) {
                const wFirst = weighments[0];
                const wLast = weighments[weighments.length - 1];
                if (Number(wFirst.weight) >= Number(wLast.weight)) {
                    grossWeighment = grossWeighment || wFirst;
                    tareWeighment = tareWeighment || wLast;
                } else {
                    grossWeighment = grossWeighment || wLast;
                    tareWeighment = tareWeighment || wFirst;
                }
            }

            let grossWeight = grossWeighment ? Number(grossWeighment.weight) : null;
            let tareWeight = tareWeighment ? Number(tareWeighment.weight) : null;
            let netWeightKg = null;
            let netWeightMT = "0.00";
            let netWeightFormatted = "";
            let grossTimestampText = grossWeighment ? formatter.formatDateTime(grossWeighment.weighbridgeDateTime) : "-";
            let tareTimestampText = tareWeighment ? formatter.formatDateTime(tareWeighment.weighbridgeDateTime) : "-";
            let hasNetCalculation = false;

            if (grossWeight !== null && tareWeight !== null && (Boolean(inboundWeighment && outboundWeighment) || weighments.length >= 2)) {
                netWeightKg = Math.round(Math.abs(grossWeight - tareWeight) * 100) / 100;
                netWeightMT = (netWeightKg / 1000).toFixed(2);
                netWeightFormatted = `${formatter.formatWeight(netWeightKg, "KG")} (${netWeightMT} MT)`;
                hasNetCalculation = true;
            }

            const driverName = tx.driverName || (tx.driver && tx.driver.driverName) || "";
            const isAssignedWb = (tx.assignedRoute === "WEIGHBRIDGE" || weighments.length > 0 || (!tx.assignedRoute && (tx.purpose === "DELIVERY" || tx.purpose === "PICKUP")));

            const isAwaitingInbound = (tx.status === "SECURITY_IN" && tx.assignedRoute === "WEIGHBRIDGE") ||
                (isAssignedWb && !inboundWeighment && ["GATE_IN", "SECURITY_IN", "WEIGHBRIDGE_IN"].includes(tx.status));
            const isInsideYard = tx.status === "FACTORY_IN" || (inboundWeighment && !outboundWeighment && tx.status !== "FACTORY_OUT");
            const isAwaitingOutbound = tx.status === "FACTORY_OUT" && !outboundWeighment;
            const isScaleCompleted = Boolean(outboundWeighment || tx.status === "WEIGHBRIDGE_OUT" || tx.status === "SECURITY_OUT" || tx.status === "COMPLETED");

            const canWeighIn = isAwaitingInbound;
            const canWeighOut = isAwaitingOutbound;
            const hasAnyWeighment = Boolean(inboundWeighment || outboundWeighment || weighments.length > 0);

            return {
                ...tx,
                driverName: driverName,
                weighments: weighments,
                inboundWeighment: inboundWeighment,
                outboundWeighment: outboundWeighment,
                inboundWeight: inboundWeighment ? inboundWeighment.weight : null,
                outboundWeight: outboundWeighment ? outboundWeighment.weight : null,
                grossWeighment: grossWeighment,
                tareWeighment: tareWeighment,
                grossWeight: grossWeight,
                tareWeight: tareWeight,
                netWeight: netWeightKg,
                netWeightMT: netWeightMT,
                netWeightFormatted: netWeightFormatted,
                grossTimestampText: grossTimestampText,
                tareTimestampText: tareTimestampText,
                hasNetCalculation: hasNetCalculation,
                isAwaitingInbound: isAwaitingInbound,
                isInsideYard: isInsideYard,
                isAwaitingOutbound: isAwaitingOutbound,
                isScaleCompleted: isScaleCompleted,
                canWeighIn: canWeighIn,
                canWeighOut: canWeighOut,
                hasAnyWeighment: hasAnyWeighment,
                isAssignedWb: isAssignedWb
            };
        },

        loadWeighbridgeData: async function () {
            const oWbModel = this.getView().getModel("wbModel");
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const res = await fetch(`${ODATA_BASE}/GateTransactions?$expand=weighments,transporter,supplier,driver&$orderby=createdAt desc`, { headers });
                let raw = [];
                if (res.ok) {
                    const data = await res.json();
                    raw = data.value || [];
                }

                const processed = raw.map(tx => this._enrichRecord(tx)).filter(tx => tx.isAssignedWb || tx.hasAnyWeighment || ["WEIGHBRIDGE_IN", "WEIGHBRIDGE_OUT", "FACTORY_OUT"].includes(tx.status));
                oWbModel.setProperty("/allRecords", processed);

                const eligible = processed.filter(tx => tx.canWeighIn || tx.canWeighOut);
                oWbModel.setProperty("/eligibleVehicles", eligible);

                const awaitingInCount = processed.filter(t => t.isAwaitingInbound).length;
                const insideYardCount = processed.filter(t => t.isInsideYard).length;
                const awaitingOutCount = processed.filter(t => t.isAwaitingOutbound).length;
                const completedCount = processed.filter(t => t.isScaleCompleted).length;

                oWbModel.setProperty("/allCount", processed.length);
                oWbModel.setProperty("/awaitingInCount", awaitingInCount);
                oWbModel.setProperty("/insideYardCount", insideYardCount);
                oWbModel.setProperty("/awaitingOutCount", awaitingOutCount);
                oWbModel.setProperty("/completedCount", completedCount);

                this._applyFilterAndSearch();

                // Fetch Completed Weighments History
                const resCompleted = await fetch(`${ODATA_BASE}/WeighbridgeTransactions?$expand=gateTransaction&$orderby=weighbridgeDateTime desc&$top=50`, { headers });
                if (resCompleted.ok) {
                    const dataCompleted = await resCompleted.json();
                    oWbModel.setProperty("/completedWeighments", dataCompleted.value || []);
                }
            } catch (err) {
                console.error("Error loading weighbridge queue data:", err);
            }
        },

        loadScaleQueue: function () {
            return this.loadWeighbridgeData();
        },

        _applyFilterAndSearch: function () {
            const oWbModel = this.getView().getModel("wbModel");
            const all = oWbModel.getProperty("/allRecords") || [];
            const filterKey = oWbModel.getProperty("/selectedFilter") || "ALL";
            const q = (oWbModel.getProperty("/searchQuery") || "").trim().toLowerCase();

            let filtered = all;

            if (filterKey === "AWAITING_IN") {
                filtered = all.filter(t => t.isAwaitingInbound);
            } else if (filterKey === "INSIDE_YARD") {
                filtered = all.filter(t => t.isInsideYard);
            } else if (filterKey === "AWAITING_OUT") {
                filtered = all.filter(t => t.isAwaitingOutbound);
            } else if (filterKey === "COMPLETED") {
                filtered = all.filter(t => t.isScaleCompleted);
            }

            if (q) {
                filtered = filtered.filter(t =>
                    (t.gateInNumber && t.gateInNumber.toLowerCase().includes(q)) ||
                    (t.vehicleRegNo && t.vehicleRegNo.toLowerCase().includes(q)) ||
                    (t.driverName && t.driverName.toLowerCase().includes(q)) ||
                    (t.transporter && t.transporter.transporterName && t.transporter.transporterName.toLowerCase().includes(q)) ||
                    (t.purpose && t.purpose.toLowerCase().includes(q))
                );
            }

            oWbModel.setProperty("/displayedRecords", filtered);
        },

        onFilterCategoryChange: function (oEvt) {
            const key = oEvt.getParameter("item").getKey();
            this.getView().getModel("wbModel").setProperty("/selectedFilter", key);
            this._applyFilterAndSearch();
        },

        onSearchLiveChange: function (oEvt) {
            const q = oEvt.getParameter("newValue") || "";
            this.getView().getModel("wbModel").setProperty("/searchQuery", q);
            this._applyFilterAndSearch();
        },

        onSearch: function (oEvt) {
            const q = oEvt.getParameter("query") || "";
            this.getView().getModel("wbModel").setProperty("/searchQuery", q);
            this._applyFilterAndSearch();
        },

        onResetSearch: function () {
            this.getView().getModel("wbModel").setProperty("/searchQuery", "");
            this.getView().getModel("wbModel").setProperty("/selectedFilter", "ALL");
            const oSearch = this.byId("wbSearchField");
            if (oSearch) oSearch.setValue("");
            this._applyFilterAndSearch();
        },

        onRefreshQueue: function () {
            this.loadWeighbridgeData();
            MessageToast.show("Weighbridge queues refreshed");
        },

        onGateInSelectChange: function (oEvt) {
            let sKey = "";
            if (oEvt) {
                const oSelectedItem = oEvt.getParameter("selectedItem");
                if (oSelectedItem) {
                    sKey = oSelectedItem.getKey();
                } else {
                    const sTypedVal = (oEvt.getParameter("newValue") || (oEvt.getSource && oEvt.getSource().getValue ? oEvt.getSource().getValue() : "")).trim();
                    const aEligible = this.getView().getModel("wbModel").getProperty("/eligibleVehicles") || [];
                    const matched = aEligible.find(v =>
                        v.gateInNumber.toLowerCase() === sTypedVal.toLowerCase() ||
                        (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === sTypedVal.toLowerCase())
                    );
                    sKey = matched ? matched.gateInNumber : sTypedVal;
                }
            }
            if (!sKey) {
                sKey = this.getView().getModel("wbModel").getProperty("/selectedGateInNumber");
            }
            this.selectVehicleByGateIn(sKey);
        },

        _getWeighmentTypeOptions: function (sPurpose) {
            if (sPurpose === "PICKUP") {
                return [
                    { key: "TARE_IN", text: "Tare IN (Empty Truck)" },
                    { key: "GROSS_OUT", text: "Gross OUT (Loaded Truck)" }
                ];
            }
            if (sPurpose === "DELIVERY") {
                return [
                    { key: "GROSS_IN", text: "Gross IN (Truck + Cargo)" },
                    { key: "TARE_OUT", text: "Tare OUT (Empty Truck)" }
                ];
            }
            return [
                { key: "GROSS_IN", text: "Gross IN (Truck + Cargo)" },
                { key: "TARE_OUT", text: "Tare OUT (Empty Truck)" },
                { key: "TARE_IN", text: "Tare IN (Empty Truck)" },
                { key: "GROSS_OUT", text: "Gross OUT (Loaded Truck)" }
            ];
        },

        _updateAvailableWeighmentTypes: function (vehicle) {
            const oWbModel = this.getView().getModel("wbModel");
            const sPurpose = vehicle ? vehicle.purpose : "DELIVERY";
            const aOptions = this._getWeighmentTypeOptions(sPurpose);
            oWbModel.setProperty("/availableWeighmentTypes", aOptions);

            const currentType = oWbModel.getProperty("/weighmentType");
            const isCurrentValid = aOptions.some(opt => opt.key === currentType);
            if (!isCurrentValid && aOptions.length > 0) {
                oWbModel.setProperty("/weighmentType", aOptions[0].key);
            }
        },

        selectVehicleByGateIn: async function (gateInNumber) {
            const oWbModel = this.getView().getModel("wbModel");
            const aEligible = oWbModel.getProperty("/eligibleVehicles") || [];
            let vehicle = aEligible.find(v =>
                v.gateInNumber.toLowerCase() === (gateInNumber || "").toLowerCase() ||
                (v.vehicleRegNo && v.vehicleRegNo.toLowerCase() === (gateInNumber || "").toLowerCase())
            );

            // If not found in loaded queue, try direct server fetch with expand weighments
            if (!vehicle && gateInNumber && gateInNumber.trim()) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const sQuery = encodeURIComponent(gateInNumber.trim());
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=gateInNumber eq '${sQuery}' or tolower(vehicleRegNo) eq '${sQuery.toLowerCase()}'&$expand=weighments`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.value && data.value.length > 0) {
                            vehicle = this._enrichRecord(data.value[0]);
                        }
                    }
                } catch (e) {
                    console.warn("Direct lookup for gate transaction failed:", e);
                }
            }

            oWbModel.setProperty("/selectedGateInNumber", vehicle ? vehicle.gateInNumber : (gateInNumber || ""));
            oWbModel.setProperty("/selectedVehicle", vehicle || null);

            // Update dropdown options according to vehicle purpose
            this._updateAvailableWeighmentTypes(vehicle);

            if (!vehicle) {
                oWbModel.setProperty("/isOutboundStage", false);
                oWbModel.setProperty("/inboundWeightRecord", null);
                oWbModel.setProperty("/expectedWeighmentType", "GROSS_IN");
                oWbModel.setProperty("/weighmentType", "GROSS_IN");
                oWbModel.setProperty("/netWeightDisplay", "");
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                oWbModel.setProperty("/expectedOperationDescription", "Select a valid vehicle to determine weighment type.");
                oWbModel.setProperty("/expectedOperationType", "Information");
                return;
            }

            const isDelivery = (vehicle.purpose === "DELIVERY");
            const isSecurityIn = (vehicle.status === "SECURITY_IN");
            const isFactoryOut = (vehicle.status === "FACTORY_OUT");

            let sExpectedType = "";
            let sDesc = "";
            let sOpType = "Information";
            let bOutbound = false;
            let oInboundRecord = null;

            // Locate previous inbound weighment
            if (vehicle.weighments && vehicle.weighments.length > 0) {
                oInboundRecord = vehicle.weighments.find(w => w.weighmentType === "GROSS_IN" || w.weighmentType === "TARE_IN") || vehicle.weighments[0];
            } else if (vehicle.inboundWeighment) {
                oInboundRecord = vehicle.inboundWeighment;
            }

            if (isSecurityIn) {
                bOutbound = false;
                if (isDelivery) {
                    sExpectedType = "GROSS_IN";
                    sDesc = "Stage 1 (First Weighment - DELIVERY): Vehicle arriving with raw materials. Default Weighment Type: Gross IN (Truck + Cargo).";
                    sOpType = "Information";
                } else {
                    sExpectedType = "TARE_IN";
                    sDesc = "Stage 1 (First Weighment - PICKUP): Empty vehicle arriving for material dispatch. Default Weighment Type: Tare IN (Empty Truck).";
                    sOpType = "Information";
                }
            } else if (isFactoryOut) {
                bOutbound = true;
                if (isDelivery) {
                    sExpectedType = "TARE_OUT";
                    sDesc = "Stage 2 (Second Weighment - DELIVERY): Vehicle has unloaded materials in factory. Default Weighment Type: Tare OUT (Empty Truck) to calculate Net Material Delivered.";
                    sOpType = "Warning";
                } else {
                    sExpectedType = "GROSS_OUT";
                    sDesc = "Stage 2 (Second Weighment - PICKUP): Vehicle has been loaded in factory. Default Weighment Type: Gross OUT (Loaded Truck) to calculate Net Material Picked Up.";
                    sOpType = "Warning";
                }
            } else {
                if (oInboundRecord) {
                    bOutbound = true;
                    sExpectedType = isDelivery ? "TARE_OUT" : "GROSS_OUT";
                    sDesc = `Stage 2 (Second Weighment - ${vehicle.purpose}): Prior inbound recorded. Default Weighment Type: ${sExpectedType}.`;
                    sOpType = "Warning";
                } else {
                    sExpectedType = isDelivery ? "GROSS_IN" : "TARE_IN";
                    sDesc = `Stage 1 (First Weighment - ${vehicle.purpose}): Default Weighment Type: ${sExpectedType}.`;
                    sOpType = "Information";
                }
            }

            oWbModel.setProperty("/isOutboundStage", bOutbound);
            oWbModel.setProperty("/inboundWeightRecord", oInboundRecord);
            oWbModel.setProperty("/expectedWeighmentType", sExpectedType);
            oWbModel.setProperty("/weighmentType", sExpectedType);
            oWbModel.setProperty("/weighbridgeDateTimeStr", new Date().toISOString().substring(0, 19));
            oWbModel.setProperty("/expectedOperationDescription", sDesc);
            oWbModel.setProperty("/expectedOperationType", sOpType);

            // Pre-fill realistic estimated weight for selected vehicle & type
            const estWeight = this.getEstimatedWeight(vehicle, sExpectedType, oInboundRecord);
            oWbModel.setProperty("/inputWeight", String(estWeight));

            // Re-evaluate net weight
            this.recalculateNetWeight();

            const sTypeLabel = formatter.getWeighmentTypeDesc(sExpectedType);
            MessageToast.show(`Vehicle Selected: ${vehicle.gateInNumber} (${vehicle.vehicleRegNo}) - ${sTypeLabel}`);
        },

        onSelectQueueVehicle: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("wbModel");
            if (oCtx) {
                const sGateIn = oCtx.getProperty("gateInNumber");
                this.selectVehicleByGateIn(sGateIn);
                const oForm = this.byId("weighbridgeEntryForm");
                if (oForm && oForm.getDomRef()) {
                    oForm.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        },

        // ============================================================
        // Weighbridge Input Handlers
        // ============================================================
        onWeighmentTypeChange: function (oEvt) {
            const oSelectedItem = oEvt.getParameter("selectedItem");
            const sType = oSelectedItem ? oSelectedItem.getKey() : "GROSS_IN";
            const oWbModel = this.getView().getModel("wbModel");
            oWbModel.setProperty("/weighmentType", sType);
            oWbModel.setProperty("/expectedWeighmentType", sType);

            // Inbound vs Outbound determination
            const bOutbound = (sType === "TARE_OUT" || sType === "GROSS_OUT");
            oWbModel.setProperty("/isOutboundStage", bOutbound);

            const oVehicle = oWbModel.getProperty("/selectedVehicle");
            const oInbound = oWbModel.getProperty("/inboundWeightRecord");
            const estWeight = this.getEstimatedWeight(oVehicle, sType, oInbound);
            oWbModel.setProperty("/inputWeight", String(estWeight));

            this.recalculateNetWeight();
        },

        getEstimatedWeight: function (vehicle, weighmentType, inboundRecord) {
            if (!vehicle) {
                return 32000.00;
            }
            if (weighmentType === "GROSS_IN") {
                return 34500.00;
            } else if (weighmentType === "TARE_IN") {
                return 12200.00;
            } else if (weighmentType === "TARE_OUT") {
                const grossVal = inboundRecord ? Number(inboundRecord.weight) : 34500.00;
                return Math.max(8500.00, Math.round(grossVal - 22000.00));
            } else if (weighmentType === "GROSS_OUT") {
                const tareVal = inboundRecord ? Number(inboundRecord.weight) : 12200.00;
                return Math.round(tareVal + 22500.00);
            }
            return 28000.00;
        },

        onWeightLiveChange: function (oEvt) {
            const val = oEvt.getParameter("newValue");
            this.getView().getModel("wbModel").setProperty("/inputWeight", val);
            this.recalculateNetWeight();
        },

        recalculateNetWeight: function () {
            const oWbModel = this.getView().getModel("wbModel");
            const sType = oWbModel.getProperty("/weighmentType") || "GROSS_IN";
            const bOutbound = (sType === "TARE_OUT" || sType === "GROSS_OUT");
            const oInbound = oWbModel.getProperty("/inboundWeightRecord");
            const sInput = oWbModel.getProperty("/inputWeight");
            const currentWeight = parseFloat(sInput);
            const oVehicle = oWbModel.getProperty("/selectedVehicle");
            const isDelivery = oVehicle ? (oVehicle.purpose === "DELIVERY") : (sType === "GROSS_IN" || sType === "TARE_OUT");

            // For Stage 1 (First scale: GROSS_IN or TARE_IN)
            if (!bOutbound) {
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                const sPendingStage = isDelivery ? "Pending Tare OUT (Stage 2)" : "Pending Gross OUT (Stage 2)";
                oWbModel.setProperty("/netWeightDisplay", sPendingStage);
                oWbModel.setProperty("/netWeightStatusText", "Net Cargo Weight will be auto-calculated upon 2nd weighment.");
                oWbModel.setProperty("/netWeightStatusState", ValueState.Information);
                return;
            }

            // For Stage 2 (Outbound: TARE_OUT or GROSS_OUT)
            if (!oInbound) {
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                oWbModel.setProperty("/netWeightDisplay", "No Inbound Record Available");
                oWbModel.setProperty("/netWeightStatusText", "Cannot compute net weight without 1st scale inbound reading.");
                oWbModel.setProperty("/netWeightStatusState", ValueState.Warning);
                return;
            }

            if (isNaN(currentWeight) || currentWeight <= 0) {
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                oWbModel.setProperty("/netWeightDisplay", "Enter scale weight (KG)");
                oWbModel.setProperty("/netWeightStatusText", "Enter current scale weight in KG to calculate net weight.");
                oWbModel.setProperty("/netWeightStatusState", ValueState.None);
                return;
            }

            const inWeight = Number(oInbound.weight);
            let net = 0;
            let isValid = true;
            let sErrorMsg = "";

            if (sType === "TARE_OUT") {
                // DELIVERY: Net Weight = Gross IN - Tare OUT
                net = inWeight - currentWeight;
                isValid = (net > 0);
                if (!isValid) {
                    sErrorMsg = "Tare OUT weight cannot exceed or equal Gross IN weight!";
                }
            } else if (sType === "GROSS_OUT") {
                // PICKUP: Net Weight = Gross OUT - Tare IN
                net = currentWeight - inWeight;
                isValid = (net > 0);
                if (!isValid) {
                    sErrorMsg = "Gross OUT weight must be greater than Tare IN weight!";
                }
            }

            if (isValid) {
                const netRounded = Math.round(net * 100) / 100;
                const netMT = (netRounded / 1000).toFixed(2);
                const sFormattedKg = formatter.formatWeight(netRounded, "KG");

                oWbModel.setProperty("/calculatedNetWeight", netRounded);
                oWbModel.setProperty("/calculatedNetWeightMT", netMT);
                oWbModel.setProperty("/netWeightDisplay", `${sFormattedKg} (${netMT} MT)`);

                const sFormulaNote = sType === "TARE_OUT"
                    ? `Gross IN (${formatter.formatWeight(inWeight, "KG")}) − Tare OUT (${formatter.formatWeight(currentWeight, "KG")})`
                    : `Gross OUT (${formatter.formatWeight(currentWeight, "KG")}) − Tare IN (${formatter.formatWeight(inWeight, "KG")})`;

                oWbModel.setProperty("/netWeightStatusText", `Valid Net Consignment: ${netMT} MT [${sFormulaNote}]`);
                oWbModel.setProperty("/netWeightStatusState", ValueState.Success);
            } else {
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                oWbModel.setProperty("/netWeightDisplay", "Invalid Weight: Scale discrepancy");
                oWbModel.setProperty("/netWeightStatusText", sErrorMsg);
                oWbModel.setProperty("/netWeightStatusState", ValueState.Error);
            }
        },

        onResetForm: function () {
            const oWbModel = this.getView().getModel("wbModel");
            const activeUser = models.getActiveUser();
            const oVehicle = oWbModel.getProperty("/selectedVehicle");

            this._updateAvailableWeighmentTypes(oVehicle);

            let sDefaultType = "GROSS_IN";
            if (oVehicle) {
                const isDelivery = (oVehicle.purpose === "DELIVERY");
                const isFactoryOut = (oVehicle.status === "FACTORY_OUT");
                if (isFactoryOut) {
                    sDefaultType = isDelivery ? "TARE_OUT" : "GROSS_OUT";
                } else {
                    sDefaultType = isDelivery ? "GROSS_IN" : "TARE_IN";
                }
            } else {
                sDefaultType = oWbModel.getProperty("/expectedWeighmentType") || "GROSS_IN";
            }

            oWbModel.setProperty("/weighbridgeNumber", "WB-01");
            oWbModel.setProperty("/weighmentType", sDefaultType);
            oWbModel.setProperty("/expectedWeighmentType", sDefaultType);
            oWbModel.setProperty("/weightUnit", "KG");
            oWbModel.setProperty("/weighbridgeDateTimeStr", new Date().toISOString().substring(0, 19));
            oWbModel.setProperty("/operator", activeUser.includes("weighbridge") ? activeUser : "weighbridge_user");
            oWbModel.setProperty("/remarks", "");
            oWbModel.setProperty("/calculatedNetWeight", 0);
            oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
            oWbModel.setProperty("/netWeightDisplay", "");
            oWbModel.setProperty("/netWeightStatusText", "");
            oWbModel.setProperty("/netWeightStatusState", ValueState.None);

            if (oVehicle) {
                const oInbound = oWbModel.getProperty("/inboundWeightRecord");
                const estWeight = this.getEstimatedWeight(oVehicle, sDefaultType, oInbound);
                oWbModel.setProperty("/inputWeight", String(estWeight));
            } else {
                oWbModel.setProperty("/inputWeight", "");
            }

            const oWeightInput = this._getDialogControl("dialogWbWeightInput") || this.byId("wbWeightInput");
            if (oWeightInput) oWeightInput.setValueState(ValueState.None);
            const oWbNumInput = this._getDialogControl("dialogWbNumberInput") || this.byId("wbNumberInput");
            if (oWbNumInput) oWbNumInput.setValueState(ValueState.None);
            const oOpInput = this._getDialogControl("dialogWbOperatorInput") || this.byId("wbOperatorInput");
            if (oOpInput) oOpInput.setValueState(ValueState.None);

            this.recalculateNetWeight();
            MessageToast.show("Weighbridge entry form reset");
        },

        _getDialogControl: function (sLocalId) {
            const oView = this.getView();
            return Fragment.byId(oView.createId("wbFrag"), sLocalId) || this.byId(sLocalId);
        },

        // ============================================================
        // Record Weighment Action
        // ============================================================
        onRecordWeighment: async function () {
            const oWbModel = this.getView().getModel("wbModel");
            const m = oWbModel.getData();

            // 1. Validate vehicle selection
            if (!m.selectedGateInNumber) {
                MessageBox.error("Please select a Gate IN Number to record weighment.");
                return;
            }

            // 2. Validate weighbridge number (String(30) @mandatory)
            const oWbNumInput = this._getDialogControl("dialogWbNumberInput") || this.byId("wbNumberInput");
            if (!m.weighbridgeNumber || !m.weighbridgeNumber.trim()) {
                if (oWbNumInput) oWbNumInput.setValueState(ValueState.Error);
                MessageBox.error("Weighbridge Number is mandatory.");
                return;
            }
            if (oWbNumInput) oWbNumInput.setValueState(ValueState.None);

            // 3. Validate weight (Decimal(15,3) @mandatory)
            const oWeightInput = this._getDialogControl("dialogWbWeightInput") || this.byId("wbWeightInput");
            const fWeight = parseFloat(m.inputWeight);
            if (isNaN(fWeight) || fWeight <= 0) {
                if (oWeightInput) oWeightInput.setValueState(ValueState.Error);
                MessageBox.error("Valid weight is mandatory and must be greater than zero.");
                return;
            }
            if (oWeightInput) oWeightInput.setValueState(ValueState.None);

            // 4. Validate operator (String(100) @mandatory)
            const oOpInput = this._getDialogControl("dialogWbOperatorInput") || this.byId("wbOperatorInput");
            if (!m.operator || !m.operator.trim()) {
                if (oOpInput) oOpInput.setValueState(ValueState.Error);
                MessageBox.error("Weighbridge Operator identifier is mandatory.");
                return;
            }
            if (oOpInput) oOpInput.setValueState(ValueState.None);

            // Execute submission
            await this._executeWeighmentSubmission(m, fWeight);
        },

        _executeWeighmentSubmission: async function (m, fWeight) {
            const sType = m.weighmentType || m.expectedWeighmentType || "GROSS_IN";
            const sUnit = m.weightUnit || "KG";
            const sWbNum = (m.weighbridgeNumber || "WB-01").trim();
            const sOp = (m.operator || "weighbridge_user").trim();
            const dWbTime = m.weighbridgeDateTimeStr ? new Date(m.weighbridgeDateTimeStr) : new Date();

            const payload = {
                gateInNumber: m.selectedGateInNumber,
                weight: fWeight,
                weighbridgeNumber: sWbNum,
                weighmentType: sType,
                weightUnit: sUnit,
                weighbridgeDateTime: dWbTime,
                operator: sOp,
                remarks: m.remarks ? m.remarks.trim() : ""
            };

            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                const response = await fetch(`${ODATA_BASE}/RecordWeighment`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    const sErrMsg = errData.error && errData.error.message ? errData.error.message : "Failed to record weighment";
                    MessageBox.error("Weighbridge Recording Failed: " + sErrMsg);
                    return;
                }

                const updatedTx = await response.json();

                if (this._pWeighbridgeDialog) {
                    this._pWeighbridgeDialog.then(oDialog => oDialog.close());
                }

                // Prepare summary text
                const sTypeDesc = formatter.getWeighmentTypeDesc(sType);
                let sSuccessDetail = `Weighbridge Number: ${sWbNum}\nWeighment Type: ${sTypeDesc}\nRecorded Weight: ${formatter.formatWeight(fWeight)} ${sUnit}\nOperator: ${sOp}\nNew Process Stage: ${updatedTx.currentStage || 'WEIGHBRIDGE'}`;

                if (m.isOutboundStage && m.calculatedNetWeight > 0) {
                    sSuccessDetail += `\nNet Material Weight: ${formatter.formatWeight(m.calculatedNetWeight)} ${sUnit} (${m.calculatedNetWeightMT} MT)`;
                }

                MessageBox.success(`Weighment Successfully Recorded for ${m.selectedGateInNumber}!\n\n${sSuccessDetail}`, {
                    title: "Weighbridge Clearance Recorded",
                    actions: ["View Weight Slip", MessageBox.Action.CLOSE],
                    emphasizedAction: "View Weight Slip",
                    onClose: async (sAction) => {
                        if (sAction === "View Weight Slip") {
                            this.openWeighmentSlipDialog({
                                slipNumber: "WB-" + Math.floor(100000 + Math.random() * 900000),
                                gateInNumber: m.selectedGateInNumber,
                                vehicleRegNo: m.selectedVehicle ? m.selectedVehicle.vehicleRegNo : "",
                                vehicleType: m.selectedVehicle ? m.selectedVehicle.vehicleType : "",
                                driverName: m.selectedVehicle ? m.selectedVehicle.driverName : "",
                                purpose: m.selectedVehicle ? m.selectedVehicle.purpose : "",
                                weighbridgeNumber: sWbNum,
                                weighmentType: sType,
                                weight: fWeight,
                                weightUnit: sUnit,
                                operator: sOp,
                                remarks: m.remarks,
                                weighbridgeDateTime: dWbTime,
                                hasNetCalculation: Boolean(m.isOutboundStage && m.calculatedNetWeight > 0),
                                grossWeight: sType === "GROSS_OUT" ? fWeight : (m.inboundWeightRecord ? Number(m.inboundWeightRecord.weight) : fWeight),
                                tareWeight: sType === "TARE_OUT" ? fWeight : (m.inboundWeightRecord ? Number(m.inboundWeightRecord.weight) : 0),
                                netWeight: m.calculatedNetWeight,
                                netWeightMT: m.calculatedNetWeightMT,
                                grossTimestampText: sType === "GROSS_OUT" ? formatter.formatDateTime(dWbTime) : (m.inboundWeightRecord ? formatter.formatDateTime(m.inboundWeightRecord.weighbridgeDateTime) : "-"),
                                tareTimestampText: sType === "TARE_OUT" ? formatter.formatDateTime(dWbTime) : (m.inboundWeightRecord ? formatter.formatDateTime(m.inboundWeightRecord.weighbridgeDateTime) : "-")
                            });
                        }
                        this.onResetForm();
                        await this.loadWeighbridgeData();
                        this.getOwnerComponent().loadOverviewData();
                    }
                });

            } catch (networkErr) {
                MessageBox.error("Network communication error with GateService: " + networkErr.message);
            }
        },

        // ============================================================
        // Weighment Slip / Certificate Dialog
        // ============================================================
        _buildSlipData: function (oTx, specificWb) {
            if (!oTx) return null;

            const tx = (oTx.grossWeight !== undefined && oTx.hasNetCalculation !== undefined) ? oTx : this._enrichRecord(oTx);
            const weighments = (tx.weighments || []).slice().sort((a, b) => new Date(a.weighbridgeDateTime || a.createdAt || 0) - new Date(b.weighbridgeDateTime || b.createdAt || 0));

            // Target weighment to display in Section 2 (Recorded Weight)
            const targetWb = specificWb || tx.outboundWeighment || tx.inboundWeighment || (weighments.length > 0 ? weighments[weighments.length - 1] : null);

            const sSlipNo = (targetWb && targetWb.ID)
                ? "SLIP-" + targetWb.ID.substring(0, 8).toUpperCase()
                : (tx.ID ? "SLIP-" + tx.ID.substring(0, 8).toUpperCase() : "SLIP-WB-" + Math.floor(100000 + Math.random() * 900000));

            const hasNet = Boolean(tx.hasNetCalculation && tx.grossWeight !== null && tx.tareWeight !== null);

            return {
                slipNumber: sSlipNo,
                gateInNumber: tx.gateInNumber || "",
                vehicleRegNo: tx.vehicleRegNo || "",
                vehicleType: tx.vehicleType || "TRUCK",
                driverName: tx.driverName || (tx.driver && tx.driver.driverName) || "Not Recorded",
                purpose: tx.purpose || "DELIVERY",
                weighbridgeNumber: (targetWb && targetWb.weighbridgeNumber) ? targetWb.weighbridgeNumber : (tx.weighbridgeNumber || "WB-01"),
                weighmentType: (targetWb && targetWb.weighmentType) ? targetWb.weighmentType : (tx.purpose === "PICKUP" ? "TARE_IN" : "GROSS_IN"),
                weight: targetWb ? targetWb.weight : (tx.grossWeight || 0),
                weightUnit: (targetWb && targetWb.weightUnit) ? targetWb.weightUnit : (tx.weightUnit || "KG"),
                operator: (targetWb && targetWb.operator) ? targetWb.operator : (tx.operator || models.getActiveUser()),
                remarks: (targetWb && targetWb.remarks) ? targetWb.remarks : (tx.remarks || "None"),
                weighbridgeDateTime: (targetWb && targetWb.weighbridgeDateTime) ? targetWb.weighbridgeDateTime : (tx.weighbridgeDateTime || new Date()),
                hasNetCalculation: hasNet,
                grossWeight: tx.grossWeight,
                tareWeight: tx.tareWeight,
                netWeight: tx.netWeight,
                netWeightMT: tx.netWeightMT || "0.00",
                grossTimestampText: tx.grossTimestampText || "-",
                tareTimestampText: tx.tareTimestampText || "-"
            };
        },

        onViewWeighmentSlip: async function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("wbModel");
            if (!oCtx) return;
            const item = oCtx.getObject();

            const gateIn = item.gateTransaction ? item.gateTransaction.gateInNumber : (item.gateInNumber || "");
            const allRecords = this.getView().getModel("wbModel").getProperty("/allRecords") || [];
            let parentTx = allRecords.find(t => t.gateInNumber === gateIn || (item.gateTransaction && t.ID === item.gateTransaction.ID));

            if (!parentTx && gateIn) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const sFilter = encodeURIComponent(`gateInNumber eq '${gateIn}'`);
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=${sFilter}&$expand=weighments,transporter,supplier,driver`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.value && data.value.length > 0) {
                            parentTx = this._enrichRecord(data.value[0]);
                        }
                    }
                } catch (e) {
                    console.warn("Could not fetch parent transaction for weighment slip:", e);
                }
            }

            if (parentTx) {
                const slipData = this._buildSlipData(parentTx, item);
                this.openWeighmentSlipDialog(slipData);
            } else {
                const regNo = item.gateTransaction ? item.gateTransaction.vehicleRegNo : (item.vehicleRegNo || "");
                const purpose = item.gateTransaction ? item.gateTransaction.purpose : "DELIVERY";
                const driver = item.gateTransaction ? item.gateTransaction.driverName : "";
                const vType = item.gateTransaction ? item.gateTransaction.vehicleType : "TRUCK";

                this.openWeighmentSlipDialog({
                    slipNumber: item.ID ? "SLIP-" + item.ID.substring(0, 8).toUpperCase() : "SLIP-WB-001",
                    gateInNumber: gateIn,
                    vehicleRegNo: regNo,
                    vehicleType: vType,
                    driverName: driver || "Not Recorded",
                    purpose: purpose,
                    weighbridgeNumber: item.weighbridgeNumber || "WB-01",
                    weighmentType: item.weighmentType,
                    weight: item.weight,
                    weightUnit: item.weightUnit || 'KG',
                    operator: item.operator || models.getActiveUser(),
                    remarks: item.remarks || "None",
                    weighbridgeDateTime: item.weighbridgeDateTime || new Date(),
                    hasNetCalculation: false,
                    grossWeight: null,
                    tareWeight: null,
                    netWeight: 0,
                    netWeightMT: "0.00",
                    grossTimestampText: "-",
                    tareTimestampText: "-"
                });
            }
        },

        openWeighmentSlipDialog: function (slipData) {
            this._currentSlipData = slipData;
            const oView = this.getView();
            const sId = oView.createId("wbSlipFrag");

            if (!this._pSlipDialog) {
                this._pSlipDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.WeighbridgeSlipDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            const that = this;
            this._pSlipDialog.then(function (oDialog) {
                that._currentSlipDialog = oDialog;
                let oSlipModel = oDialog.getModel("slipModel");
                if (!oSlipModel) {
                    oSlipModel = new JSONModel(slipData);
                    oDialog.setModel(oSlipModel, "slipModel");
                } else {
                    oSlipModel.setData(slipData);
                }
                oDialog.open();
            });
        },

        onPrintSlip: async function () {
            let d = this._currentSlipData;
            if (this._currentSlipDialog) {
                const oSlipModel = this._currentSlipDialog.getModel("slipModel");
                if (oSlipModel) {
                    d = oSlipModel.getData();
                }
            }

            if (!d) {
                window.print();
                return;
            }

            await this._printWeighmentSlipDocument(d);
        },

        _printWeighmentSlipDocument: async function (d) {
            let iframe = document.getElementById("wbPrintIframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "wbPrintIframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);
            }

            let sLogoSrc = "images/APL_Logo.jpg";
            if (this.getOwnerComponent && this.getOwnerComponent().getLogoBase64) {
                try {
                    sLogoSrc = (await this.getOwnerComponent().getLogoBase64()) || sLogoSrc;
                } catch (_) {}
            }

            const sTypeDesc = formatter.getWeighmentTypeDesc(d.weighmentType);
            const sFormattedDate = formatter.formatDateTime(d.weighbridgeDateTime);
            const sUnit = d.weightUnit || "KG";
            const sFormattedWeight = formatter.formatWeight(d.weight, sUnit);

            let sNetSectionHtml = "";
            if (d.hasNetCalculation) {
                const sGross = formatter.formatWeight(d.grossWeight, sUnit);
                const sTare = formatter.formatWeight(d.tareWeight, sUnit);
                const sNet = formatter.formatWeight(d.netWeight, sUnit);

                sNetSectionHtml = `
                <div class="net-weight-box">
                    <div class="net-title">NET CARGO WEIGHT CALCULATION SUMMARY</div>
                    <div class="net-row">
                        <div class="metric-item">
                            <span class="metric-label">Gross Weight</span>
                            <span class="metric-val gross">${sGross}</span>
                            <span class="metric-time">${d.grossTimestampText || ""}</span>
                        </div>
                        <div class="operator-symbol">−</div>
                        <div class="metric-item">
                            <span class="metric-label">Tare Weight</span>
                            <span class="metric-val tare">${sTare}</span>
                            <span class="metric-time">${d.tareTimestampText || ""}</span>
                        </div>
                        <div class="operator-symbol">=</div>
                        <div class="metric-item">
                            <span class="metric-label">Net Cargo Weight</span>
                            <span class="metric-val net">${sNet}</span>
                            <span class="metric-time">(${d.netWeightMT || "0.00"} MT)</span>
                        </div>
                    </div>
                </div>
                `;
            }

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>APL Factory Official Weighment Slip - ${d.slipNumber || ""}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    }
                    body {
                        background: #fff;
                        color: #1e293b;
                        padding: 20px;
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    .slip-container {
                        max-width: 700px;
                        margin: 0 auto;
                        border: 2px solid #0f172a;
                        padding: 24px;
                        border-radius: 6px;
                    }
                    .header-table {
                        width: 100%;
                        border-bottom: 2px solid #0284c7;
                        padding-bottom: 14px;
                        margin-bottom: 16px;
                    }
                    .header-logo-cell {
                        width: 80px;
                        vertical-align: middle;
                        text-align: center;
                        padding-right: 14px;
                    }
                    .header-logo {
                        height: 56px;
                        width: auto;
                        max-width: 80px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }
                    .header-text-cell {
                        vertical-align: middle;
                        text-align: left;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        line-height: 1.2;
                    }
                    .company-address {
                        font-size: 11px;
                        font-weight: 500;
                        color: #475569;
                        margin-top: 3px;
                        line-height: 1.35;
                    }
                    .sub-header {
                        font-size: 11px;
                        font-weight: 600;
                        color: #0284c7;
                        margin-top: 3px;
                    }
                    .slip-badge-box {
                        text-align: right;
                        vertical-align: middle;
                        width: 190px;
                    }
                    .verified-badge {
                        display: inline-block;
                        background: #dcfce7;
                        color: #166534;
                        border: 1px solid #86efac;
                        font-size: 10px;
                        font-weight: 700;
                        padding: 3px 8px;
                        border-radius: 4px;
                        margin-bottom: 6px;
                    }
                    .slip-meta {
                        font-size: 11px;
                        color: #334155;
                    }
                    .section-title {
                        font-size: 12px;
                        font-weight: 700;
                        text-transform: uppercase;
                        background: #f1f5f9;
                        padding: 6px 10px;
                        border-left: 4px solid #0284c7;
                        margin: 14px 0 10px 0;
                        letter-spacing: 0.5px;
                    }
                    .info-grid {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    .info-grid td {
                        padding: 6px 8px;
                        vertical-align: top;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 12.5px;
                    }
                    .label-cell {
                        width: 25%;
                        color: #64748b;
                        font-weight: 600;
                    }
                    .val-cell {
                        width: 25%;
                        color: #0f172a;
                        font-weight: 700;
                    }
                    .highlight-val {
                        color: #0284c7;
                        font-size: 13.5px;
                    }
                    .weight-highlight {
                        font-size: 16px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .net-weight-box {
                        background: #f0fdf4;
                        border: 1.5px solid #86efac;
                        border-radius: 6px;
                        padding: 14px;
                        margin: 16px 0;
                        text-align: center;
                    }
                    .net-title {
                        font-size: 11px;
                        font-weight: 700;
                        color: #15803d;
                        letter-spacing: 0.5px;
                        margin-bottom: 10px;
                    }
                    .net-row {
                        display: flex;
                        justify-content: space-around;
                        align-items: center;
                    }
                    .metric-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .metric-label {
                        font-size: 11px;
                        font-weight: 600;
                        color: #475569;
                    }
                    .metric-val {
                        font-size: 15px;
                        font-weight: 800;
                        margin-top: 2px;
                    }
                    .metric-val.gross { color: #1e40af; }
                    .metric-val.tare { color: #b45309; }
                    .metric-val.net { color: #15803d; font-size: 17px; }
                    .metric-time {
                        font-size: 10px;
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .operator-symbol {
                        font-size: 20px;
                        font-weight: 700;
                        color: #94a3b8;
                    }
                    .footer-signatures {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px dashed #cbd5e1;
                        display: flex;
                        justify-content: space-between;
                    }
                    .sig-block {
                        text-align: center;
                        width: 220px;
                    }
                    .sig-line {
                        border-top: 1px solid #334155;
                        margin-bottom: 6px;
                    }
                    .sig-label {
                        font-size: 11px;
                        color: #475569;
                        font-weight: 600;
                    }
                    .watermark-note {
                        text-align: center;
                        font-size: 9.5px;
                        color: #94a3b8;
                        margin-top: 20px;
                        letter-spacing: 0.5px;
                    }
                </style>
            </head>
            <body>
                <div class="slip-container">
                    <table class="header-table">
                        <tr>
                            <td class="header-logo-cell">
                                <img src="${sLogoSrc}" class="header-logo" alt="APL Logo" />
                            </td>
                            <td class="header-text-cell">
                                <div class="company-name">Assam Petro-Chemicals Ltd</div>
                                <div class="company-address">Address: Namprup, Dist: Dibrugarh(ASSAM), PO: Parbatpur-786623.</div>
                                <div class="sub-header">Plant Weighbridge Station • Legal Metrology Certified</div>
                            </td>
                            <td class="slip-badge-box">
                                <div class="verified-badge">VERIFIED &amp; CERTIFIED</div>
                                <div class="slip-meta"><strong>Slip No:</strong> ${d.slipNumber || "-"}</div>
                                <div class="slip-meta"><strong>Date:</strong> ${sFormattedDate}</div>
                            </td>
                        </tr>
                    </table>

                    <div class="section-title">1. Vehicle &amp; Consignment Details</div>
                    <table class="info-grid">
                        <tr>
                            <td class="label-cell">Gate IN Number:</td>
                            <td class="val-cell highlight-val">${d.gateInNumber || "-"}</td>
                            <td class="label-cell">Vehicle Reg No:</td>
                            <td class="val-cell highlight-val">${d.vehicleRegNo || "-"}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Vehicle Type:</td>
                            <td class="val-cell">${d.vehicleType || "-"}</td>
                            <td class="label-cell">Driver Name:</td>
                            <td class="val-cell">${d.driverName || "Not Recorded"}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Purpose of Visit:</td>
                            <td class="val-cell" colspan="3">${d.purpose || "-"}</td>
                        </tr>
                    </table>

                    <div class="section-title">2. Scale &amp; Weighing Metadata</div>
                    <table class="info-grid">
                        <tr>
                            <td class="label-cell">Weighbridge Number:</td>
                            <td class="val-cell">${d.weighbridgeNumber || "-"}</td>
                            <td class="label-cell">Weighment Type:</td>
                            <td class="val-cell">${sTypeDesc}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Recorded Weight:</td>
                            <td class="val-cell weight-highlight">${sFormattedWeight}</td>
                            <td class="label-cell">Operator:</td>
                            <td class="val-cell">${d.operator || "-"}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Scale Remarks:</td>
                            <td class="val-cell" colspan="3">${d.remarks || "None"}</td>
                        </tr>
                    </table>

                    ${sNetSectionHtml}

                    <div class="footer-signatures">
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Driver Signature</div>
                        </div>
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Weighbridge Officer (${d.operator || "Authorized"})</div>
                        </div>
                    </div>

                    <div class="watermark-note">
                        This is an official system-generated Weighbridge Weight Certificate. Any manual alteration renders this certificate invalid.
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

        onCloseSlipDialog: function () {
            if (this._pSlipDialog) {
                this._pSlipDialog.then(oDialog => oDialog.close());
            }
        },

        // ============================================================
        // Weighbridge Dialog Management
        // ============================================================
        onOpenWeighbridgeInDialog: async function (oEvt) {
            let oTx = null;
            if (oEvt && oEvt.getSource) {
                const oCtx = oEvt.getSource().getBindingContext("wbModel");
                if (oCtx) {
                    oTx = oCtx.getObject();
                }
            }

            const oWbModel = this.getView().getModel("wbModel");
            oWbModel.setProperty("/dialogTitle", "Record Inbound Weighment (1st Scale)");

            if (oTx) {
                oWbModel.setProperty("/isVehicleSelectable", false);
                await this.selectVehicleByGateIn(oTx.gateInNumber);
            } else {
                oWbModel.setProperty("/isVehicleSelectable", true);
                const aEligible = oWbModel.getProperty("/eligibleVehicles") || [];
                const awaitingIn = aEligible.filter(v => v.canWeighIn);
                const target = awaitingIn.length > 0 ? awaitingIn[0] : (aEligible[0] || null);
                if (target) {
                    await this.selectVehicleByGateIn(target.gateInNumber);
                }
            }

            const oVehicle = oWbModel.getProperty("/selectedVehicle");
            this._updateAvailableWeighmentTypes(oVehicle);
            if (oVehicle) {
                const isDelivery = (oVehicle.purpose === "DELIVERY");
                const inType = isDelivery ? "GROSS_IN" : "TARE_IN";
                oWbModel.setProperty("/weighmentType", inType);
                oWbModel.setProperty("/expectedWeighmentType", inType);
                oWbModel.setProperty("/isOutboundStage", false);
                const estWeight = this.getEstimatedWeight(oVehicle, inType, null);
                oWbModel.setProperty("/inputWeight", String(estWeight));
                this.recalculateNetWeight();
            }

            this._openWeighbridgeDialog();
        },

        onOpenWeighbridgeOutDialog: async function (oEvt) {
            let oTx = null;
            if (oEvt && oEvt.getSource) {
                const oCtx = oEvt.getSource().getBindingContext("wbModel");
                if (oCtx) {
                    oTx = oCtx.getObject();
                }
            }

            const oWbModel = this.getView().getModel("wbModel");
            oWbModel.setProperty("/dialogTitle", "Record Outbound Weighment (2nd Scale)");

            if (oTx) {
                oWbModel.setProperty("/isVehicleSelectable", false);
                await this.selectVehicleByGateIn(oTx.gateInNumber);
            } else {
                oWbModel.setProperty("/isVehicleSelectable", true);
                const aEligible = oWbModel.getProperty("/eligibleVehicles") || [];
                const awaitingOut = aEligible.filter(v => v.canWeighOut);
                const target = awaitingOut.length > 0 ? awaitingOut[0] : (aEligible[0] || null);
                if (target) {
                    await this.selectVehicleByGateIn(target.gateInNumber);
                }
            }

            const oVehicle = oWbModel.getProperty("/selectedVehicle");
            this._updateAvailableWeighmentTypes(oVehicle);
            if (oVehicle) {
                const isDelivery = (oVehicle.purpose === "DELIVERY");
                const outType = isDelivery ? "TARE_OUT" : "GROSS_OUT";
                oWbModel.setProperty("/weighmentType", outType);
                oWbModel.setProperty("/expectedWeighmentType", outType);
                oWbModel.setProperty("/isOutboundStage", true);
                const estWeight = this.getEstimatedWeight(oVehicle, outType, oWbModel.getProperty("/inboundWeightRecord"));
                oWbModel.setProperty("/inputWeight", String(estWeight));
                this.recalculateNetWeight();
            }

            this._openWeighbridgeDialog();
        },

        _openWeighbridgeDialog: function () {
            const oView = this.getView();
            const sId = oView.createId("wbFrag");
            if (!this._pWeighbridgeDialog) {
                this._pWeighbridgeDialog = Fragment.load({
                    id: sId,
                    name: "factory.gate.fragment.WeighbridgeDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pWeighbridgeDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCancelWeighmentDialog: function () {
            if (this._pWeighbridgeDialog) {
                this._pWeighbridgeDialog.then(oDialog => oDialog.close());
            }
        },

        onConfirmWeighmentDialog: async function () {
            await this.onRecordWeighment();
        },

        // ============================================================
        // Table Row Actions
        // ============================================================
        onRowWeighInPress: function (oEvt) {
            this.onOpenWeighbridgeInDialog(oEvt);
        },

        onRowWeighOutPress: function (oEvt) {
            this.onOpenWeighbridgeOutDialog(oEvt);
        },

        onRowSlipPress: async function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("wbModel");
            if (!oCtx) return;
            let oTx = oCtx.getObject();

            // If weighments array is missing or empty, fetch fresh transaction data from backend
            if (!oTx.weighments || oTx.weighments.length === 0) {
                try {
                    const headers = {
                        "Authorization": models.getAuthHeaderValue(),
                        "Content-Type": "application/json"
                    };
                    const sFilter = encodeURIComponent(`gateInNumber eq '${oTx.gateInNumber}'`);
                    const res = await fetch(`${ODATA_BASE}/GateTransactions?$filter=${sFilter}&$expand=weighments,transporter,supplier,driver`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.value && data.value.length > 0) {
                            oTx = this._enrichRecord(data.value[0]);
                        }
                    }
                } catch (e) {
                    console.warn("Could not fetch fresh weighments for slip dialog:", e);
                }
            }

            if (!oTx.hasAnyWeighment && (!oTx.weighments || oTx.weighments.length === 0)) {
                MessageToast.show("No weighment recorded yet for this vehicle.");
                return;
            }

            const slipData = this._buildSlipData(oTx);
            if (slipData) {
                this.openWeighmentSlipDialog(slipData);
            } else {
                MessageToast.show("No weighment recorded yet for this vehicle.");
            }
        },

        onRowViewPress: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("wbModel");
            if (!oCtx) return;
            const oTx = oCtx.getObject();
            if (oTx.canWeighIn) {
                this.onOpenWeighbridgeInDialog(oEvt);
            } else if (oTx.canWeighOut) {
                this.onOpenWeighbridgeOutDialog(oEvt);
            } else if (oTx.hasAnyWeighment) {
                this.onRowSlipPress(oEvt);
            } else {
                this.selectVehicleByGateIn(oTx.gateInNumber);
            }
        },

        onTxRowPress: function (oEvt) {
            this.onRowViewPress(oEvt);
        },

        // ============================================================
        // Navigation Handlers
        // ============================================================
        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onNavMainGateOps: function () {
            this.getOwnerComponent().navigateTo("mainGateOpsPage", "slide");
        },

        onNavSecurityGateOps: function () {
            this.getOwnerComponent().navigateTo("securityGateOpsPage", "slide");
        },

        onNavFactoryGateOps: function () {
            this.getOwnerComponent().navigateTo("factoryGateOpsPage", "slide");
        }
    });
});
