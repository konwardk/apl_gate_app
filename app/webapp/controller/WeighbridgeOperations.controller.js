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
                weighbridgeNumber: "WB-01",
                weighmentType: "GROSS_IN",
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

        loadWeighbridgeData: async function () {
            const oWbModel = this.getView().getModel("wbModel");
            const headers = {
                "Authorization": models.getAuthHeaderValue(),
                "Content-Type": "application/json"
            };

            try {
                // 1. Fetch Inbound Queue (status eq 'SECURITY_IN')
                const resInbound = await fetch(`${ODATA_BASE}/GateTransactions?$filter=status eq 'SECURITY_IN'&$orderby=createdAt desc`, { headers });
                let aInbound = [];
                if (resInbound.ok) {
                    const dataInbound = await resInbound.json();
                    aInbound = dataInbound.value || [];
                    oWbModel.setProperty("/inboundQueue", aInbound);
                }

                // 2. Fetch Outbound Queue (status eq 'FACTORY_OUT' with previous weighments expanded)
                const resOutbound = await fetch(`${ODATA_BASE}/GateTransactions?$filter=status eq 'FACTORY_OUT'&$expand=weighments&$orderby=createdAt desc`, { headers });
                let aOutbound = [];
                if (resOutbound.ok) {
                    const dataOutbound = await resOutbound.json();
                    aOutbound = (dataOutbound.value || []).map(function (v) {
                        const inWb = (v.weighments || []).find(w => w.weighmentType === "GROSS_IN" || w.weighmentType === "TARE_IN");
                        v.inboundWeight = inWb ? inWb.weight : null;
                        v.inboundWeighment = inWb || null;
                        return v;
                    });
                    oWbModel.setProperty("/outboundQueue", aOutbound);
                }

                // 3. Combined eligible vehicles for ComboBox
                const aCombined = [...aInbound, ...aOutbound];
                oWbModel.setProperty("/eligibleVehicles", aCombined);

                // 4. Fetch Completed Weighments History
                const resCompleted = await fetch(`${ODATA_BASE}/WeighbridgeTransactions?$expand=gateTransaction&$orderby=weighbridgeDateTime desc&$top=50`, { headers });
                if (resCompleted.ok) {
                    const dataCompleted = await resCompleted.json();
                    oWbModel.setProperty("/completedWeighments", dataCompleted.value || []);
                }

                // If currently selected vehicle exists in queue, refresh its state
                const currentGateIn = oWbModel.getProperty("/selectedGateInNumber");
                if (currentGateIn) {
                    const matched = aCombined.find(v => v.gateInNumber === currentGateIn);
                    if (matched) {
                        this.selectVehicleByGateIn(matched.gateInNumber);
                    }
                } else if (aCombined.length > 0) {
                    // Auto-select first queue vehicle for convenience
                    this.selectVehicleByGateIn(aCombined[0].gateInNumber);
                }

            } catch (err) {
                console.error("Error loading weighbridge queue data:", err);
            }
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
                            vehicle = data.value[0];
                        }
                    }
                } catch (e) {
                    console.warn("Direct lookup for gate transaction failed:", e);
                }
            }

            oWbModel.setProperty("/selectedGateInNumber", vehicle ? vehicle.gateInNumber : (gateInNumber || ""));
            oWbModel.setProperty("/selectedVehicle", vehicle || null);

            if (!vehicle) {
                oWbModel.setProperty("/isOutboundStage", false);
                oWbModel.setProperty("/inboundWeightRecord", null);
                oWbModel.setProperty("/expectedWeighmentType", "GROSS_IN");
                oWbModel.setProperty("/weighmentType", "GROSS_IN");
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

            if (isSecurityIn) {
                bOutbound = false;
                if (isDelivery) {
                    sExpectedType = "GROSS_IN";
                    sDesc = "Stage 1 (First Weighment - DELIVERY): Vehicle arriving with raw materials. Default Weighment Type: GROSS_IN - Gross Inbound (Truck + Load).";
                    sOpType = "Information";
                } else {
                    sExpectedType = "TARE_IN";
                    sDesc = "Stage 1 (First Weighment - PICKUP): Empty vehicle arriving for material dispatch. Default Weighment Type: TARE_IN - Tare Inbound (Empty Truck).";
                    sOpType = "Information";
                }
            } else if (isFactoryOut) {
                bOutbound = true;
                // Locate previous inbound weighment
                if (vehicle.weighments && vehicle.weighments.length > 0) {
                    oInboundRecord = vehicle.weighments.find(w => w.weighmentType === "GROSS_IN" || w.weighmentType === "TARE_IN") || vehicle.weighments[0];
                } else if (vehicle.inboundWeighment) {
                    oInboundRecord = vehicle.inboundWeighment;
                }

                if (isDelivery) {
                    sExpectedType = "TARE_OUT";
                    sDesc = "Stage 2 (Second Weighment - DELIVERY): Vehicle has unloaded materials in factory. Default Weighment Type: TARE_OUT - Tare Outbound (Empty Truck) to calculate Net Material Delivered.";
                    sOpType = "Warning";
                } else {
                    sExpectedType = "GROSS_OUT";
                    sDesc = "Stage 2 (Second Weighment - PICKUP): Vehicle has been loaded in factory. Default Weighment Type: GROSS_OUT - Gross Outbound (Loaded Truck) to calculate Net Material Picked Up.";
                    sOpType = "Warning";
                }
            } else {
                sExpectedType = isDelivery ? "GROSS_IN" : "TARE_IN";
                sDesc = `Stage 1 (First Weighment): Purpose is ${vehicle.purpose}. Default Weighment Type: ${isDelivery ? "GROSS_IN - Gross Inbound" : "TARE_IN - Tare Inbound (Empty Truck)"}.`;
                sOpType = "Information";
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
            const bOutbound = oWbModel.getProperty("/isOutboundStage");
            const oInbound = oWbModel.getProperty("/inboundWeightRecord");
            const sInput = oWbModel.getProperty("/inputWeight");
            const currentWeight = parseFloat(sInput);

            if (!bOutbound || !oInbound || isNaN(currentWeight) || currentWeight <= 0) {
                oWbModel.setProperty("/calculatedNetWeight", 0);
                oWbModel.setProperty("/calculatedNetWeightMT", "0.00");
                oWbModel.setProperty("/netWeightStatusText", "");
                oWbModel.setProperty("/netWeightStatusState", ValueState.None);
                return;
            }

            const inWeight = Number(oInbound.weight);
            const sExpectedType = oWbModel.getProperty("/expectedWeighmentType");
            let net = 0;
            let isValid = true;

            if (sExpectedType === "TARE_OUT") {
                // Inbound was Gross, current is Tare. Net = Gross - Tare
                net = inWeight - currentWeight;
                isValid = net > 0;
            } else if (sExpectedType === "GROSS_OUT") {
                // Inbound was Tare, current is Gross. Net = Gross - Tare
                net = currentWeight - inWeight;
                isValid = net > 0;
            }

            const netRounded = Math.round(net * 100) / 100;
            const netMT = (netRounded / 1000).toFixed(2);

            oWbModel.setProperty("/calculatedNetWeight", netRounded);
            oWbModel.setProperty("/calculatedNetWeightMT", netMT);

            if (isValid) {
                oWbModel.setProperty("/netWeightStatusText", `Valid Net Consignment: ${netMT} MT`);
                oWbModel.setProperty("/netWeightStatusState", ValueState.Success);
            } else {
                oWbModel.setProperty("/netWeightStatusText", "Tare exceeds Gross! Check scale positioning.");
                oWbModel.setProperty("/netWeightStatusState", ValueState.Error);
            }
        },

        onResetForm: function () {
            const oWbModel = this.getView().getModel("wbModel");
            const activeUser = models.getActiveUser();
            const oVehicle = oWbModel.getProperty("/selectedVehicle");

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
            oWbModel.setProperty("/netWeightStatusText", "");
            oWbModel.setProperty("/netWeightStatusState", ValueState.None);

            if (oVehicle) {
                const oInbound = oWbModel.getProperty("/inboundWeightRecord");
                const estWeight = this.getEstimatedWeight(oVehicle, sDefaultType, oInbound);
                oWbModel.setProperty("/inputWeight", String(estWeight));
            } else {
                oWbModel.setProperty("/inputWeight", "");
            }

            const oWeightInput = this.byId("wbWeightInput");
            if (oWeightInput) oWeightInput.setValueState(ValueState.None);
            const oWbNumInput = this.byId("wbNumberInput");
            if (oWbNumInput) oWbNumInput.setValueState(ValueState.None);
            const oOpInput = this.byId("wbOperatorInput");
            if (oOpInput) oOpInput.setValueState(ValueState.None);

            this.recalculateNetWeight();
            MessageToast.show("Weighbridge entry form reset");
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
            const oWbNumInput = this.byId("wbNumberInput");
            if (!m.weighbridgeNumber || !m.weighbridgeNumber.trim()) {
                if (oWbNumInput) oWbNumInput.setValueState(ValueState.Error);
                MessageBox.error("Weighbridge Number is mandatory.");
                return;
            }
            if (oWbNumInput) oWbNumInput.setValueState(ValueState.None);

            // 3. Validate weight (Decimal(15,3) @mandatory)
            const oWeightInput = this.byId("wbWeightInput");
            const fWeight = parseFloat(m.inputWeight);
            if (isNaN(fWeight) || fWeight <= 0) {
                if (oWeightInput) oWeightInput.setValueState(ValueState.Error);
                MessageBox.error("Valid weight is mandatory and must be greater than zero.");
                return;
            }
            if (oWeightInput) oWeightInput.setValueState(ValueState.None);

            // 4. Validate operator (String(100) @mandatory)
            const oOpInput = this.byId("wbOperatorInput");
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
                    onClose: (sAction) => {
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
                                hasNetCalculation: m.isOutboundStage && m.calculatedNetWeight > 0,
                                grossWeight: sType === "GROSS_OUT" ? fWeight : (m.inboundWeightRecord ? m.inboundWeightRecord.weight : fWeight),
                                tareWeight: sType === "TARE_OUT" ? fWeight : (m.inboundWeightRecord ? m.inboundWeightRecord.weight : 0),
                                netWeight: m.calculatedNetWeight,
                                netWeightMT: m.calculatedNetWeightMT,
                                grossTimestampText: sType === "GROSS_OUT" ? "Just Recorded" : (m.inboundWeightRecord ? formatter.formatDateTime(m.inboundWeightRecord.weighbridgeDateTime) : "-"),
                                tareTimestampText: sType === "TARE_OUT" ? "Just Recorded" : (m.inboundWeightRecord ? formatter.formatDateTime(m.inboundWeightRecord.weighbridgeDateTime) : "-")
                            });
                        }
                        this.onResetForm();
                        this.loadWeighbridgeData();
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
        onViewWeighmentSlip: function (oEvt) {
            const oCtx = oEvt.getSource().getBindingContext("wbModel");
            if (!oCtx) return;
            const item = oCtx.getObject();

            const gateIn = item.gateTransaction ? item.gateTransaction.gateInNumber : (item.gateInNumber || "");
            const regNo = item.gateTransaction ? item.gateTransaction.vehicleRegNo : (item.vehicleRegNo || "");
            const purpose = item.gateTransaction ? item.gateTransaction.purpose : "DELIVERY";
            const driver = item.gateTransaction ? item.gateTransaction.driverName : "";
            const vType = item.gateTransaction ? item.gateTransaction.vehicleType : "TRUCK";

            this.openWeighmentSlipDialog({
                slipNumber: item.ID ? "SLIP-" + item.ID.substring(0, 8).toUpperCase() : "SLIP-WB-001",
                gateInNumber: gateIn,
                vehicleRegNo: regNo,
                vehicleType: vType,
                driverName: driver,
                purpose: purpose,
                weighbridgeNumber: item.weighbridgeNumber,
                weighmentType: item.weighmentType,
                weight: item.weight,
                weightUnit: item.weightUnit || 'KG',
                operator: item.operator,
                remarks: item.remarks,
                weighbridgeDateTime: item.weighbridgeDateTime,
                hasNetCalculation: false
            });
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
                const oSlipModel = new JSONModel(slipData);
                oDialog.setModel(oSlipModel, "slipModel");
                oDialog.open();
            });
        },

        onPrintSlip: function () {
            let d = this._currentSlipData;
            if (!d && this._currentSlipDialog) {
                const oSlipModel = this._currentSlipDialog.getModel("slipModel");
                if (oSlipModel) {
                    d = oSlipModel.getData();
                }
            }

            if (!d) {
                window.print();
                return;
            }

            this._printWeighmentSlipDocument(d);
        },

        _printWeighmentSlipDocument: function (d) {
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
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: 0.5px;
                    }
                    .sub-header {
                        font-size: 11px;
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .slip-badge-box {
                        text-align: right;
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
                            <td>
                                <div class="company-name">APL LOGISTICS &amp; GATE OPERATIONS</div>
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
