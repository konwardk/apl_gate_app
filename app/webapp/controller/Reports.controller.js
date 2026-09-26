sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "factory/gate/model/formatter",
    "factory/gate/model/models",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat"
], function (Controller, formatter, models, JSONModel, MessageToast, MessageBox, DateFormat) {
    "use strict";

    const ODATA_BASE = "/gate";
    const dtFormat = DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd HH:mm:ss" });
    const dFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

    return Controller.extend("factory.gate.controller.Reports", {
        formatter: formatter,

        onInit: function () {
            const oReportModel = new JSONModel({
                activeTab: "MAIN_GATE",
                filters: {
                    dateFrom: null,
                    dateTo: null,
                    vehicleNumber: "",
                    entryArea: "ALL",
                    status: "ALL",
                    searchQuery: ""
                },
                counts: {
                    mainGate: 0,
                    securityGate: 0,
                    weighbridge: 0,
                    factoryGate: 0,
                    consolidated: 0
                },
                kpi: {
                    totalRecords: 0,
                    uniqueVehicles: 0,
                    inPlant: 0,
                    completed: 0
                },
                mainGateEntries: [],
                securityGateEntries: [],
                weighbridgeEntries: [],
                factoryGateEntries: [],
                consolidatedEntries: [],
                displayedMainGate: [],
                displayedSecurity: [],
                displayedWeighbridge: [],
                displayedFactory: [],
                displayedConsolidated: [],
                displayedItems: [],
                filteredCount: 0,
                isBusy: false
            });

            this.getView().setModel(oReportModel, "reportModel");
            this._getLogoBase64();
        },

        onNavBack: function () {
            this.getOwnerComponent().navigateTo("launchpadPage", "slide");
        },

        onRefreshReports: function () {
            this.loadReportsData();
        },

        loadReportsData: async function () {
            const oView = this.getView();
            const oModel = oView.getModel("reportModel");
            const authHeader = models.getAuthHeaderValue();

            if (!authHeader) {
                MessageBox.error("Authentication required. Please sign in.");
                return;
            }

            try {
                oView.setBusy(true);
                const headers = {
                    "Authorization": authHeader,
                    "Content-Type": "application/json"
                };

                // Fetch data for all operations in parallel
                const [resTx, resSec, resWb, resFac] = await Promise.all([
                    fetch(`${ODATA_BASE}/GateTransactions?$expand=deliveryDetails,pickupDetails,supplier,transporter,weighments,factoryGateEvents,securityEntry&$orderby=gateInDateTime desc`, { headers }),
                    fetch(`${ODATA_BASE}/SecurityGateEntries?$expand=gateTransaction&$orderby=createdAt desc`, { headers }),
                    fetch(`${ODATA_BASE}/WeighbridgeTransactions?$expand=gateTransaction&$orderby=weighbridgeDateTime desc`, { headers }),
                    fetch(`${ODATA_BASE}/FactoryGateEntries?$expand=gateTransaction&$orderby=createdAt desc`, { headers })
                ]);

                const txData = resTx.ok ? (await resTx.json()).value || [] : [];
                const secData = resSec.ok ? (await resSec.json()).value || [] : [];
                const wbData = resWb.ok ? (await resWb.json()).value || [] : [];
                const facData = resFac.ok ? (await resFac.json()).value || [] : [];

                // 1. Process Main Gate Entries
                const aMainGate = txData.map(t => {
                    const po = t.deliveryDetails?.poNumber || "";
                    const inv = t.deliveryDetails?.invoiceNumber || "";
                    const supp = t.supplier?.supplierName || t.deliveryDetails?.supplierName || "";
                    return Object.assign({}, t, {
                        primaryTimestamp: t.gateInDateTime,
                        vehicleRegNo: t.vehicleRegNo || "",
                        poNumber: po,
                        invoiceNumber: inv,
                        supplierName: supp,
                        gateInTimeDisplay: formatter.formatDateTime(t.gateInDateTime),
                        gateOutTimeDisplay: formatter.formatDateTime(t.gateOutDateTime),
                        statusState: formatter.getStatusState(t.status),
                        purposeState: formatter.getPurposeState(t.purpose)
                    });
                });

                // 2. Process Security Gate Entries
                const aSecurity = secData.map(s => {
                    const tx = s.gateTransaction || {};
                    const po = s.poNumber || tx.deliveryDetails?.poNumber || "";
                    const inv = s.invoiceNumber || tx.deliveryDetails?.invoiceNumber || "";
                    const poInv = (po ? "PO: " + po : "") + (inv ? (po ? " | " : "") + "Inv: " + inv : "") || "-";
                    const dl = s.driverLicenseNo || "";
                    const ph = s.driverPhoneNo || "";
                    const dlPh = (dl ? "DL: " + dl : "") + (ph ? (dl ? " | " : "") + "Ph: " + ph : "") || "-";

                    return Object.assign({}, s, {
                        primaryTimestamp: s.securityInDateTime || s.createdAt,
                        gateInNumber: s.gateInNumber || tx.gateInNumber || "-",
                        vehicleRegNo: tx.vehicleRegNo || "-",
                        vehicleType: tx.vehicleType || "-",
                        driverName: tx.driverName || "-",
                        purpose: tx.purpose || "-",
                        status: tx.status || "SECURITY_IN",
                        assignedRoute: s.assignedRoute || tx.assignedRoute || "-",
                        poInvoiceDisplay: poInv,
                        driverContactDisplay: dlPh,
                        securityInTimeDisplay: formatter.formatDateTime(s.securityInDateTime),
                        securityOutTimeDisplay: formatter.formatDateTime(s.securityOutDateTime),
                        statusState: formatter.getStatusState(tx.status || "SECURITY_IN")
                    });
                });

                // 3. Process Weighbridge Scale Entries
                const aWeighbridge = wbData.map(w => {
                    const tx = w.gateTransaction || {};
                    return Object.assign({}, w, {
                        primaryTimestamp: w.weighbridgeDateTime || w.createdAt,
                        gateInNumber: tx.gateInNumber || "-",
                        vehicleRegNo: tx.vehicleRegNo || "-",
                        vehicleType: tx.vehicleType || "-",
                        driverName: tx.driverName || "-",
                        purpose: tx.purpose || "-",
                        status: tx.status || "WEIGHBRIDGE_IN",
                        assignedRoute: tx.assignedRoute || "WEIGHBRIDGE",
                        weightDisplay: formatter.formatWeight(w.weight, w.weightUnit),
                        weighbridgeTimeDisplay: formatter.formatDateTime(w.weighbridgeDateTime),
                        weighmentTypeState: formatter.getWeighmentTypeState(w.weighmentType),
                        statusState: formatter.getStatusState(tx.status || "WEIGHBRIDGE_IN")
                    });
                });

                // 4. Process Factory Yard Gate Entries
                const aFactory = facData.map(f => {
                    const tx = f.gateTransaction || {};
                    const qty = f.unloadedQuantity !== null && f.unloadedQuantity !== undefined ? parseFloat(f.unloadedQuantity) : null;
                    const formattedQty = qty !== null && !isNaN(qty) ? (qty.toLocaleString("en-IN") + " " + (f.quantityUnit || "KG")) : "-";
                    const loc = (f.factoryArea || "-") + (f.unloadingPoint ? " (" + f.unloadingPoint + ")" : "");
                    const suppRem = (f.supplierName ? f.supplierName + (f.remarks ? " - " + f.remarks : "") : f.remarks) || "-";

                    return Object.assign({}, f, {
                        primaryTimestamp: f.factoryGateInDateTime || f.createdAt,
                        gateInNumber: f.gateInNumber || tx.gateInNumber || "-",
                        vehicleRegNo: tx.vehicleRegNo || "-",
                        vehicleType: tx.vehicleType || "-",
                        driverName: tx.driverName || "-",
                        purpose: tx.purpose || "-",
                        status: tx.status || "FACTORY_IN",
                        assignedRoute: tx.assignedRoute || "FACTORY",
                        formattedQty: formattedQty,
                        factoryLocationDisplay: loc,
                        supplierRemarksDisplay: suppRem,
                        factoryInTimeDisplay: formatter.formatDateTime(f.factoryGateInDateTime),
                        factoryOutTimeDisplay: formatter.formatDateTime(f.factoryGateOutDateTime),
                        unloadingStatusState: f.unloadingStatus === "COMPLETED" ? "Success" : "Warning"
                    });
                });

                // 5. Process Consolidated End-to-End Lifecycle
                const aConsolidated = txData.map(t => {
                    const sec = t.securityEntry || {};
                    const wbList = t.weighments || [];
                    const facList = t.factoryGateEvents || [];
                    const grossWb = wbList.find(w => w.weighmentType === "GROSS" || w.weighmentType === "GROSS_IN") || wbList[0];
                    const tareWb = wbList.find(w => w.weighmentType === "TARE" || w.weighmentType === "TARE_OUT") || (wbList.length > 1 ? wbList[wbList.length - 1] : null);

                    const grossWeightVal = grossWb ? parseFloat(grossWb.weight) : null;
                    const tareWeightVal = tareWb ? parseFloat(tareWb.weight) : null;
                    const netWeightVal = (grossWeightVal !== null && tareWeightVal !== null) ? Math.abs(grossWeightVal - tareWeightVal) : null;

                    const facEvt = facList[0] || {};

                    return {
                        ID: t.ID,
                        gateInNumber: t.gateInNumber,
                        vehicleRegNo: t.vehicleRegNo,
                        vehicleType: t.vehicleType,
                        driverName: t.driverName,
                        purpose: t.purpose,
                        purposeState: formatter.getPurposeState(t.purpose),
                        assignedRoute: t.assignedRoute || "-",
                        status: t.status,
                        statusState: formatter.getStatusState(t.status),
                        currentStage: t.currentStage,
                        primaryTimestamp: t.gateInDateTime,

                        gateInTimeDisplay: formatter.formatDateTime(t.gateInDateTime),
                        gateInOperator: t.gateInOperator,

                        securityInTimeDisplay: sec.securityInDateTime ? formatter.formatDateTime(sec.securityInDateTime) : "-",
                        securityPersonnel: sec.securityPersonnel || "-",

                        grossWeight: grossWeightVal,
                        grossWeightDisplay: grossWeightVal !== null ? (grossWeightVal.toLocaleString("en-IN") + " KG") : "-",

                        factoryInTimeDisplay: facEvt.factoryGateInDateTime ? ("IN: " + formatter.formatDateTime(facEvt.factoryGateInDateTime)) : "-",
                        factoryOutTimeDisplay: facEvt.factoryGateOutDateTime ? ("OUT: " + formatter.formatDateTime(facEvt.factoryGateOutDateTime)) : "-",
                        factoryArea: facEvt.factoryArea || "-",

                        tareWeight: tareWeightVal,
                        tareWeightDisplay: tareWeightVal !== null ? (tareWeightVal.toLocaleString("en-IN") + " KG") : "-",
                        netWeight: netWeightVal,
                        netWeightDisplay: netWeightVal !== null ? (netWeightVal.toLocaleString("en-IN") + " KG") : "-",

                        securityOutTimeDisplay: sec.securityOutDateTime ? formatter.formatDateTime(sec.securityOutDateTime) : "-",
                        securityOutPersonnel: sec.securityOutPersonnel || "-",

                        gateOutTimeDisplay: formatter.formatDateTime(t.gateOutDateTime),
                        gateOutOperator: t.gateOutOperator,

                        remarks: t.remarks || ""
                    };
                });

                oModel.setProperty("/mainGateEntries", aMainGate);
                oModel.setProperty("/securityGateEntries", aSecurity);
                oModel.setProperty("/weighbridgeEntries", aWeighbridge);
                oModel.setProperty("/factoryGateEntries", aFactory);
                oModel.setProperty("/consolidatedEntries", aConsolidated);

                this._applyFilters();
            } catch (err) {
                console.error("Error loading operational reports:", err);
                MessageBox.error("Failed to load reports: " + err.message);
            } finally {
                oView.setBusy(false);
            }
        },

        // ============================================================
        // Tab & Filter Handlers
        // ============================================================
        onTabSelect: function (oEvt) {
            const sKey = oEvt.getParameter("key");
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/activeTab", sKey);
            this._applyFilters();
        },

        onDateRangeChange: function (oEvt) {
            const oDrs = oEvt.getSource();
            const dFrom = oDrs.getDateValue();
            const dTo = oDrs.getSecondDateValue();
            const oModel = this.getView().getModel("reportModel");

            oModel.setProperty("/filters/dateFrom", dFrom);
            oModel.setProperty("/filters/dateTo", dTo);
            this._applyFilters();
        },

        onPresetToday: function () {
            const oDrs = this.byId("dateRangeFilter");
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            if (oDrs) {
                oDrs.setDateValue(start);
                oDrs.setSecondDateValue(end);
            }
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters/dateFrom", start);
            oModel.setProperty("/filters/dateTo", end);
            this._applyFilters();
            MessageToast.show("Filtered for Today");
        },

        onPresetLast7Days: function () {
            const oDrs = this.byId("dateRangeFilter");
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 7);
            start.setHours(0, 0, 0, 0);

            if (oDrs) {
                oDrs.setDateValue(start);
                oDrs.setSecondDateValue(end);
            }
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters/dateFrom", start);
            oModel.setProperty("/filters/dateTo", end);
            this._applyFilters();
            MessageToast.show("Filtered for Last 7 Days");
        },

        onPresetLast30Days: function () {
            const oDrs = this.byId("dateRangeFilter");
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 30);
            start.setHours(0, 0, 0, 0);

            if (oDrs) {
                oDrs.setDateValue(start);
                oDrs.setSecondDateValue(end);
            }
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters/dateFrom", start);
            oModel.setProperty("/filters/dateTo", end);
            this._applyFilters();
            MessageToast.show("Filtered for Last 30 Days");
        },

        onPresetAllTime: function () {
            const oDrs = this.byId("dateRangeFilter");
            if (oDrs) {
                oDrs.setDateValue(null);
                oDrs.setSecondDateValue(null);
                oDrs.setValue("");
            }
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters/dateFrom", null);
            oModel.setProperty("/filters/dateTo", null);
            this._applyFilters();
            MessageToast.show("Date filter cleared (All Time)");
        },

        onFilterLiveChange: function () {
            this._applyFilters();
        },

        onFilterChange: function () {
            this._applyFilters();
        },

        onSearchLiveChange: function (oEvt) {
            const sVal = oEvt.getParameter("newValue") || "";
            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters/searchQuery", sVal);
            this._applyFilters();
        },

        onResetFilters: function () {
            const oDrs = this.byId("dateRangeFilter");
            if (oDrs) {
                oDrs.setDateValue(null);
                oDrs.setSecondDateValue(null);
                oDrs.setValue("");
            }

            const oModel = this.getView().getModel("reportModel");
            oModel.setProperty("/filters", {
                dateFrom: null,
                dateTo: null,
                vehicleNumber: "",
                entryArea: "ALL",
                status: "ALL",
                searchQuery: ""
            });

            this._applyFilters();
            MessageToast.show("Filters reset to default.");
        },

        _applyFilters: function () {
            const oModel = this.getView().getModel("reportModel");
            const sTab = oModel.getProperty("/activeTab") || "MAIN_GATE";
            const oFilters = oModel.getProperty("/filters") || {};

            const aMainGateRaw = oModel.getProperty("/mainGateEntries") || [];
            const aSecurityRaw = oModel.getProperty("/securityGateEntries") || [];
            const aWeighbridgeRaw = oModel.getProperty("/weighbridgeEntries") || [];
            const aFactoryRaw = oModel.getProperty("/factoryGateEntries") || [];
            const aConsolidatedRaw = oModel.getProperty("/consolidatedEntries") || [];

            const dFrom = oFilters.dateFrom ? new Date(oFilters.dateFrom).setHours(0, 0, 0, 0) : null;
            const dTo = oFilters.dateTo ? new Date(oFilters.dateTo).setHours(23, 59, 59, 999) : null;
            const sVeh = (oFilters.vehicleNumber || "").trim().toLowerCase();
            const sArea = oFilters.entryArea || "ALL";
            const sStatus = oFilters.status || "ALL";
            const sQuery = (oFilters.searchQuery || "").trim().toLowerCase();

            const fnFilter = item => {
                // 1. Date Range Check
                if (dFrom || dTo) {
                    const itemTs = item.primaryTimestamp || item.gateInDateTime || item.securityInDateTime || item.weighbridgeDateTime || item.factoryGateInDateTime;
                    if (itemTs) {
                        const itemTime = new Date(itemTs).getTime();
                        if (dFrom && itemTime < dFrom) return false;
                        if (dTo && itemTime > dTo) return false;
                    }
                }

                // 2. Vehicle Registration Number Check
                if (sVeh) {
                    const itemVeh = (item.vehicleRegNo || "").toLowerCase();
                    if (!itemVeh.includes(sVeh)) return false;
                }

                // 3. Entry Area / Route Check
                if (sArea !== "ALL") {
                    const itemRoute = (item.assignedRoute || "").toUpperCase();
                    const itemArea = (item.factoryArea || "").toUpperCase();
                    const targetArea = sArea.toUpperCase();

                    if (targetArea === "MAIN_GATE" && itemRoute !== "MAIN_GATE" && !item.gateInNumber) return false;
                    else if (targetArea === "SECURITY" && itemRoute !== "SECURITY" && !item.securityPersonnel) return false;
                    else if (targetArea === "WEIGHBRIDGE" && itemRoute !== "WEIGHBRIDGE" && !item.weighbridgeNumber) return false;
                    else if (targetArea === "FACTORY" && itemRoute !== "FACTORY" && !item.factoryArea) return false;
                    else if (!itemArea.includes(targetArea) && !itemRoute.includes(targetArea)) {
                        return false;
                    }
                }

                // 4. Status Check
                if (sStatus !== "ALL") {
                    if (sStatus === "ACTIVE") {
                        if (item.status === "COMPLETED" || item.status === "CANCELLED") return false;
                    } else if (sStatus === "COMPLETED") {
                        if (item.status !== "COMPLETED") return false;
                    } else if (item.status !== sStatus && item.unloadingStatus !== sStatus) {
                        return false;
                    }
                }

                // 5. Universal Search Query
                if (sQuery) {
                    const matchPass = (item.gateInNumber || "").toLowerCase().includes(sQuery);
                    const matchVeh = (item.vehicleRegNo || "").toLowerCase().includes(sQuery);
                    const matchDriver = (item.driverName || "").toLowerCase().includes(sQuery);
                    const matchPo = (item.poNumber || "").toLowerCase().includes(sQuery);
                    const matchInv = (item.invoiceNumber || "").toLowerCase().includes(sQuery);
                    const matchSupp = (item.supplierName || "").toLowerCase().includes(sQuery);
                    const matchRem = (item.remarks || item.securityInRemarks || "").toLowerCase().includes(sQuery);
                    const matchOp = (item.operator || item.gateInOperator || item.securityPersonnel || item.factoryGateInOperator || "").toLowerCase().includes(sQuery);

                    if (!matchPass && !matchVeh && !matchDriver && !matchPo && !matchInv && !matchSupp && !matchRem && !matchOp) {
                        return false;
                    }
                }

                return true;
            };

            const aFMain = aMainGateRaw.filter(fnFilter);
            const aFSec = aSecurityRaw.filter(fnFilter);
            const aFWb = aWeighbridgeRaw.filter(fnFilter);
            const aFFac = aFactoryRaw.filter(fnFilter);
            const aFCon = aConsolidatedRaw.filter(fnFilter);

            oModel.setProperty("/displayedMainGate", aFMain);
            oModel.setProperty("/displayedSecurity", aFSec);
            oModel.setProperty("/displayedWeighbridge", aFWb);
            oModel.setProperty("/displayedFactory", aFFac);
            oModel.setProperty("/displayedConsolidated", aFCon);

            oModel.setProperty("/counts", {
                mainGate: aFMain.length,
                securityGate: aFSec.length,
                weighbridge: aFWb.length,
                factoryGate: aFFac.length,
                consolidated: aFCon.length
            });

            let aActiveItems = [];
            switch (sTab) {
                case "MAIN_GATE": aActiveItems = aFMain; break;
                case "SECURITY_GATE": aActiveItems = aFSec; break;
                case "WEIGHBRIDGE": aActiveItems = aFWb; break;
                case "FACTORY_GATE": aActiveItems = aFFac; break;
                case "CONSOLIDATED":
                default: aActiveItems = aFCon; break;
            }

            oModel.setProperty("/displayedItems", aActiveItems);
            oModel.setProperty("/filteredCount", aActiveItems.length);

            // Compute KPIs based on Consolidated Lifecycle (representing all gate events) or active tab
            const kpiSource = aFCon.length ? aFCon : aActiveItems;
            const uniqueVehicles = new Set(kpiSource.map(i => (i.vehicleRegNo || "").trim()).filter(Boolean)).size;
            const completedCount = kpiSource.filter(i => i.status === "COMPLETED").length;
            const inPlantCount = kpiSource.length - completedCount;

            oModel.setProperty("/kpi", {
                totalRecords: aActiveItems.length,
                uniqueVehicles: uniqueVehicles,
                inPlant: inPlantCount,
                completed: completedCount
            });
        },

        // ============================================================
        // Export to PDF, Print & CSV Handlers
        // ============================================================
        onExportPDF: async function () {
            const oModel = this.getView().getModel("reportModel");
            const aData = oModel.getProperty("/displayedItems") || [];
            const sTab = oModel.getProperty("/activeTab") || "MAIN_GATE";

            if (aData.length === 0) {
                MessageToast.show("No records available to export for current filters.");
                return;
            }

            const reportConfig = this._getReportExportConfig(sTab);
            const headers = reportConfig.headers;
            const rowExtractors = reportConfig.extractors;
            const aRows = aData.map(row => {
                return rowExtractors.map(fn => {
                    const val = fn(row);
                    return val === null || val === undefined ? "" : String(val);
                });
            });

            const logoBase64 = await this._getLogoBase64();

            try {
                const jspdfModule = await this._ensureJsPdf();
                if (jspdfModule && jspdfModule.jsPDF) {
                    this._generateJsPdfFile(jspdfModule.jsPDF, reportConfig, headers, aRows, oModel, logoBase64);
                    return;
                }
            } catch (err) {
                console.warn("Direct jsPDF export error, falling back to print dialog:", err);
            }

            // Fallback: styled landscape printable window with Save-as-PDF
            this._generatePrintWindow(reportConfig, headers, aRows, oModel, true, logoBase64);
        },

        onPrintReport: async function () {
            const oModel = this.getView().getModel("reportModel");
            const aData = oModel.getProperty("/displayedItems") || [];
            const sTab = oModel.getProperty("/activeTab") || "MAIN_GATE";

            if (aData.length === 0) {
                MessageToast.show("No records available to print for current filters.");
                return;
            }

            const reportConfig = this._getReportExportConfig(sTab);
            const headers = reportConfig.headers;
            const rowExtractors = reportConfig.extractors;
            const aRows = aData.map(row => {
                return rowExtractors.map(fn => {
                    const val = fn(row);
                    return val === null || val === undefined ? "" : String(val);
                });
            });

            const logoBase64 = await this._getLogoBase64();
            this._generatePrintWindow(reportConfig, headers, aRows, oModel, true, logoBase64);
        },

        onExportCSV: function () {
            const oModel = this.getView().getModel("reportModel");
            const aData = oModel.getProperty("/displayedItems") || [];
            const sTab = oModel.getProperty("/activeTab") || "MAIN_GATE";

            if (aData.length === 0) {
                MessageToast.show("No records available to export for current filters.");
                return;
            }

            const reportConfig = this._getReportExportConfig(sTab);
            const headers = reportConfig.headers;
            const rowExtractors = reportConfig.extractors;

            let csvContent = "\uFEFF"; // UTF-8 BOM for Windows Excel compatibility
            csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n";

            aData.forEach(row => {
                const rowValues = rowExtractors.map(fn => {
                    let val = fn(row);
                    if (val === null || val === undefined) val = "";
                    const sStr = String(val).replace(/"/g, '""');
                    return `"${sStr}"`;
                });
                csvContent += rowValues.join(",") + "\r\n";
            });

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const sDate = dFormat.format(new Date());
            const fileName = `APL_${reportConfig.filePrefix}_Report_${sDate}.csv`;

            this._triggerDownload(blob, fileName);
            MessageToast.show(`Downloaded ${fileName} (${aData.length} records)`);
        },

        onExportExcel: function () {
            // Forward to PDF export
            this.onExportPDF();
        },

        _getLogoBase64: async function () {
            if (this._logoBase64) {
                return this._logoBase64;
            }

            const candidateUrls = [
                sap.ui.require.toUrl("factory/gate/images/APL_Logo.jpg"),
                "images/APL_Logo.jpg",
                "/images/APL_Logo.jpg"
            ];

            for (const url of candidateUrls) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const blob = await res.blob();
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = () => resolve(null);
                            reader.readAsDataURL(blob);
                        });
                        if (base64) {
                            this._logoBase64 = base64;
                            return base64;
                        }
                    }
                } catch (e) {
                    // Try next URL candidate
                }
            }
            return null;
        },

        _ensureJsPdf: async function () {
            if (window.jspdf && window.jspdf.jsPDF) {
                return window.jspdf;
            }
            if (typeof window.jsPDF === "function") {
                return { jsPDF: window.jsPDF };
            }

            return new Promise(resolve => {
                const s1 = document.createElement("script");
                s1.src = "lib/jspdf.umd.min.js";
                s1.onload = () => {
                    const s2 = document.createElement("script");
                    s2.src = "lib/jspdf.plugin.autotable.min.js";
                    s2.onload = () => {
                        resolve(window.jspdf || (typeof window.jsPDF === "function" ? { jsPDF: window.jsPDF } : null));
                    };
                    s2.onerror = () => resolve(null);
                    document.head.appendChild(s2);
                };
                s1.onerror = () => resolve(null);
                document.head.appendChild(s1);
            });
        },

        _generateJsPdfFile: function (JsPdfConstructor, reportConfig, headers, aRows, oModel, logoBase64) {
            const doc = new JsPdfConstructor({
                orientation: "landscape",
                unit: "pt",
                format: "a4"
            });

            const sDate = dFormat.format(new Date());
            const sDateTime = dtFormat.format(new Date());
            const fileName = `APL_${reportConfig.filePrefix}_Report_${sDate}.pdf`;
            const activeUser = sessionStorage.getItem("gate_active_user") || localStorage.getItem("gate_active_user") || "Administrator";
            const filters = oModel.getProperty("/filters") || {};
            const kpi = oModel.getProperty("/kpi") || {};

            // 1. Header Section with APL Logo
            let textStartX = 30;
            if (logoBase64) {
                try {
                    // Logo dimensions: 54pt width, 38pt height (aspect ratio ~1.41)
                    doc.addImage(logoBase64, "JPEG", 30, 18, 54, 38);
                    textStartX = 94;
                } catch (imgErr) {
                    console.warn("Could not draw APL logo on PDF:", imgErr);
                }
            }

            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);
            doc.setFont("helvetica", "bold");
            doc.text("ASSAM PETRO-CHEMICALS LIMITED", textStartX, 30);

            doc.setFontSize(8.5);
            doc.setTextColor(90, 90, 90);
            doc.setFont("helvetica", "normal");
            doc.text("Plant Gate Operations & Logistics Management System", textStartX, 42);

            doc.setFontSize(11);
            doc.setTextColor(0, 112, 242);
            doc.setFont("helvetica", "bold");
            doc.text(reportConfig.sheetName.toUpperCase() + " - OPERATIONAL REPORT", textStartX, 56);

            // Right-aligned header badge
            doc.setFontSize(8.5);
            doc.setTextColor(0, 112, 242);
            doc.setFont("helvetica", "bold");
            doc.text("APL GATE MANAGEMENT", 812, 30, { align: "right" });

            doc.setFontSize(7.5);
            doc.setTextColor(110, 110, 110);
            doc.setFont("helvetica", "normal");
            doc.text("Generated: " + sDateTime, 812, 42, { align: "right" });

            // Divider line
            doc.setDrawColor(0, 112, 242);
            doc.setLineWidth(1.2);
            doc.line(30, 64, 812, 64);

            // 2. Metadata Banner
            doc.setFillColor(245, 248, 252);
            doc.setDrawColor(218, 226, 236);
            doc.setLineWidth(0.75);
            doc.roundedRect(30, 70, 782, 42, 3, 3, "FD");

            doc.setFontSize(7.5);
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "normal");

            const filterDateStr = (filters.dateFrom && filters.dateTo) 
                ? `${dFormat.format(filters.dateFrom)} to ${dFormat.format(filters.dateTo)}`
                : (filters.dateFrom ? `From ${dFormat.format(filters.dateFrom)}` : (filters.dateTo ? `To ${dFormat.format(filters.dateTo)}` : "All Time"));
            const filterVehStr = filters.vehicleNumber || "All Vehicles";
            const filterStatusStr = filters.status || "ALL";
            const filterAreaStr = filters.entryArea || "ALL";

            doc.text(`Generated On: ${sDateTime}  |  Generated By: ${activeUser}  |  Operation View: ${reportConfig.sheetName}`, 38, 83);
            doc.text(`Applied Filters: Date: ${filterDateStr}  |  Vehicle: ${filterVehStr}  |  Status: ${filterStatusStr}  |  Area: ${filterAreaStr}`, 38, 94);
            doc.text(`Summary KPIs: Total Records: ${aRows.length}  |  Unique Vehicles: ${kpi.uniqueVehicles || 0}  |  Active In-Plant: ${kpi.inPlant || 0}  |  Completed Exits: ${kpi.completed || 0}`, 38, 105);

            // 3. AutoTable Data Grid
            const isConsolidated = reportConfig.filePrefix.includes("Consolidated");
            const fontSize = isConsolidated ? 6 : 7;
            const headerFontSize = isConsolidated ? 6.5 : 7.5;
            const cellPad = isConsolidated ? 2 : 2.5;

            doc.autoTable({
                startY: 118,
                head: [headers],
                body: aRows,
                theme: "grid",
                headStyles: {
                    fillColor: [0, 112, 242],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: headerFontSize,
                    halign: "center",
                    valign: "middle",
                    cellPadding: 3
                },
                bodyStyles: {
                    fontSize: fontSize,
                    cellPadding: cellPad,
                    textColor: [30, 41, 59],
                    valign: "middle"
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                tableLineColor: [226, 232, 240],
                tableLineWidth: 0.5,
                margin: { left: 30, right: 30, bottom: 35 },
                didDrawPage: data => {
                    const pageCount = doc.internal.getNumberOfPages();
                    const currentPage = data.pageNumber;
                    doc.setFontSize(7);
                    doc.setTextColor(130, 130, 130);
                    doc.setFont("helvetica", "normal");
                    doc.text("Confidential - For Internal Use Only | Assam Petro-chemicals Ltd.", 30, 582);
                    doc.text(`Page ${currentPage} of ${pageCount}`, 765, 582);
                }
            });

            doc.save(fileName);
            MessageToast.show(`Downloaded PDF Report: ${fileName} (${aRows.length} records)`);
        },

        _generatePrintWindow: function (reportConfig, headers, aRows, oModel, bAutoPrint, logoBase64) {
            let iframe = document.getElementById("reportPrintIframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "reportPrintIframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);
            }

            const sDate = dFormat.format(new Date());
            const sDateTime = dtFormat.format(new Date());
            const activeUser = sessionStorage.getItem("gate_active_user") || localStorage.getItem("gate_active_user") || "Administrator";
            const filters = oModel.getProperty("/filters") || {};
            const kpi = oModel.getProperty("/kpi") || {};

            const filterDateStr = (filters.dateFrom && filters.dateTo)
                ? `${dFormat.format(filters.dateFrom)} to ${dFormat.format(filters.dateTo)}`
                : (filters.dateFrom ? `From ${dFormat.format(filters.dateFrom)}` : (filters.dateTo ? `To ${dFormat.format(filters.dateTo)}` : "All Time"));
            const filterVehStr = filters.vehicleNumber || "All Vehicles";
            const filterStatusStr = filters.status || "ALL";
            const filterAreaStr = filters.entryArea || "ALL";

            const thHtml = headers.map(h => `<th>${this._escapeXml(h)}</th>`).join("");
            const tbHtml = aRows.map(row => {
                const tds = row.map(c => `<td>${this._escapeXml(c)}</td>`).join("");
                return `<tr>${tds}</tr>`;
            }).join("");

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>APL ${reportConfig.sheetName} Report - ${sDate}</title>
                <style>
                    @page {
                        size: landscape;
                        margin: 8mm 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    }
                    body {
                        background: #ffffff;
                        color: #0f172a;
                        padding: 12px;
                        font-size: 10px;
                    }
                    .header-box {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #0070f2;
                        padding-bottom: 8px;
                        margin-bottom: 10px;
                    }
                    .company-name {
                        font-size: 16px;
                        font-weight: 800;
                        color: #003366;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .company-sub {
                        font-size: 10px;
                        color: #64748b;
                        font-weight: 600;
                        margin-top: 2px;
                    }
                    .report-title {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0070f2;
                        margin-top: 4px;
                    }
                    .meta-panel {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 4px;
                        padding: 8px 12px;
                        margin-bottom: 12px;
                        font-size: 9.5px;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 8px;
                    }
                    .meta-item {
                        display: flex;
                        flex-direction: column;
                    }
                    .meta-lbl {
                        font-size: 8.5px;
                        color: #64748b;
                        text-transform: uppercase;
                        font-weight: 700;
                    }
                    .meta-val {
                        font-weight: 700;
                        color: #0f172a;
                        margin-top: 1px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 16px;
                        font-size: 9px;
                    }
                    thead {
                        display: table-header-group;
                    }
                    th {
                        background: #0070f2;
                        color: #ffffff;
                        font-weight: 700;
                        text-align: left;
                        padding: 6px 8px;
                        border: 1px solid #0056b3;
                        font-size: 9px;
                    }
                    td {
                        padding: 5px 8px;
                        border: 1px solid #e2e8f0;
                        vertical-align: middle;
                    }
                    tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    .footer-box {
                        display: flex;
                        justify-content: space-between;
                        font-size: 8.5px;
                        color: #94a3b8;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 8px;
                        margin-top: 16px;
                    }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <img src="${logoBase64 || 'images/APL_Logo.jpg'}" style="height: 48px; width: auto; object-fit: contain;" alt="APL Logo" />
                        <div>
                            <div class="company-name">Assam Petro-chemicals Ltd (APL)</div>
                            <div class="company-sub">Plant Gate Operations &amp; Logistics Management System</div>
                            <div class="report-title">${this._escapeXml(reportConfig.sheetName.toUpperCase())} - OPERATIONAL AUDIT REPORT</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 700; color: #0070f2;">APL GATE OPERATIONS</div>
                        <div style="font-size: 9px; color: #64748b;">Generated: ${sDateTime}</div>
                    </div>
                </div>

                <div class="meta-panel">
                    <div class="meta-item">
                        <span class="meta-lbl">Generated By:</span>
                        <span class="meta-val">${this._escapeXml(activeUser)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">Date Filter:</span>
                        <span class="meta-val">${this._escapeXml(filterDateStr)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">Vehicle / Status:</span>
                        <span class="meta-val">${this._escapeXml(filterVehStr)} (${this._escapeXml(filterStatusStr)})</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">KPI Summary:</span>
                        <span class="meta-val">Total: ${aRows.length} | Unique: ${kpi.uniqueVehicles || 0} | In-Plant: ${kpi.inPlant || 0}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>${thHtml}</tr>
                    </thead>
                    <tbody>
                        ${tbHtml}
                    </tbody>
                </table>

                <div class="footer-box">
                    <span>Confidential - For Internal Use Only | Assam Petro-chemicals Ltd.</span>
                    <span>Total Records: ${aRows.length} | Generated: ${sDateTime}</span>
                </div>
            </body>
            </html>
            `;

            const frameDoc = iframe.contentWindow.document;
            frameDoc.open();
            frameDoc.write(htmlContent);
            frameDoc.close();

            if (bAutoPrint) {
                setTimeout(() => {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                }, 300);
            }
        },

        _getReportExportConfig: function (sTab) {
            const formatDT = dt => dt ? dtFormat.format(new Date(dt)) : "-";

            switch (sTab) {
                case "MAIN_GATE":
                    return {
                        filePrefix: "MainGate",
                        sheetName: "Main Gate Entries",
                        headers: [
                            "Gate Pass No", "Vehicle Reg No", "Vehicle Type", "Driver Name",
                            "Purpose", "Assigned Route", "Gate IN Date/Time", "IN Operator",
                            "Gate OUT Date/Time", "OUT Operator", "Status", "Remarks"
                        ],
                        extractors: [
                            r => r.gateInNumber || "",
                            r => r.vehicleRegNo || "",
                            r => r.vehicleType || "",
                            r => r.driverName || "",
                            r => r.purpose || "",
                            r => r.assignedRoute || "",
                            r => formatDT(r.gateInDateTime),
                            r => r.gateInOperator || "",
                            r => formatDT(r.gateOutDateTime),
                            r => r.gateOutOperator || "",
                            r => r.status || "",
                            r => r.remarks || ""
                        ]
                    };

                case "SECURITY_GATE":
                    return {
                        filePrefix: "SecurityGate",
                        sheetName: "Security Gate Records",
                        headers: [
                            "Gate Pass No", "Vehicle Reg No", "Security IN Date/Time", "Security Officer",
                            "Driver License", "Driver Phone", "PO Number", "Invoice Number",
                            "Assigned Route", "Security In Remarks", "Security OUT Date/Time",
                            "Exit Security Officer", "Exit Pass Type", "Remarks"
                        ],
                        extractors: [
                            r => r.gateInNumber || "",
                            r => r.vehicleRegNo || "",
                            r => formatDT(r.securityInDateTime),
                            r => r.securityPersonnel || "",
                            r => r.driverLicenseNo || "",
                            r => r.driverPhoneNo || "",
                            r => r.poNumber || "",
                            r => r.invoiceNumber || "",
                            r => r.assignedRoute || "",
                            r => r.securityInRemarks || "",
                            r => formatDT(r.securityOutDateTime),
                            r => r.securityOutPersonnel || "",
                            r => r.exitGatePassType || "",
                            r => r.remarks || ""
                        ]
                    };

                case "WEIGHBRIDGE":
                    return {
                        filePrefix: "Weighbridge",
                        sheetName: "Weighbridge Scale Records",
                        headers: [
                            "Gate Pass No", "Vehicle Reg No", "Scale ID", "Weighment Type",
                            "Weight (KG)", "Weight Unit", "Weighment Date/Time", "Scale Operator",
                            "Vehicle Type", "Purpose", "Remarks"
                        ],
                        extractors: [
                            r => r.gateInNumber || "",
                            r => r.vehicleRegNo || "",
                            r => r.weighbridgeNumber || "",
                            r => r.weighmentType || "",
                            r => r.weight !== undefined && r.weight !== null ? parseFloat(r.weight) : "",
                            r => r.weightUnit || "KG",
                            r => formatDT(r.weighbridgeDateTime),
                            r => r.operator || "",
                            r => r.vehicleType || "",
                            r => r.purpose || "",
                            r => r.remarks || ""
                        ]
                    };

                case "FACTORY_GATE":
                    return {
                        filePrefix: "FactoryGate",
                        sheetName: "Factory Yard Records",
                        headers: [
                            "Gate Pass No", "Vehicle Reg No", "Factory Plant Area", "Unloading Point",
                            "Material Description", "Unloading Status", "Unloaded Qty", "Quantity Unit",
                            "Factory IN Date/Time", "IN Operator", "Factory OUT Date/Time", "OUT Operator",
                            "PO Number", "Supplier Name", "Goods Inspected", "Seal Verified", "Remarks"
                        ],
                        extractors: [
                            r => r.gateInNumber || "",
                            r => r.vehicleRegNo || "",
                            r => r.factoryArea || "",
                            r => r.unloadingPoint || "",
                            r => r.materialDescription || "",
                            r => r.unloadingStatus || "",
                            r => r.unloadedQuantity !== undefined && r.unloadedQuantity !== null ? parseFloat(r.unloadedQuantity) : "",
                            r => r.quantityUnit || "KG",
                            r => formatDT(r.factoryGateInDateTime),
                            r => r.factoryGateInOperator || "",
                            r => formatDT(r.factoryGateOutDateTime),
                            r => r.factoryGateOutOperator || "",
                            r => r.poNumber || "",
                            r => r.supplierName || "",
                            r => r.goodsInspected ? "Yes" : "No",
                            r => r.sealVerified ? "Yes" : "No",
                            r => r.remarks || ""
                        ]
                    };

                case "CONSOLIDATED":
                default:
                    return {
                        filePrefix: "ConsolidatedGateLifecycle",
                        sheetName: "Consolidated Gate Lifecycle",
                        headers: [
                            "Gate Pass No", "Vehicle Reg No", "Vehicle Type", "Driver Name",
                            "Purpose", "Route", "Current Status", "1. Main Gate IN",
                            "2. Security IN", "3. Gross Weight (KG)", "4. Factory IN",
                            "4. Factory OUT", "5. Tare Weight (KG)", "5. Net Weight (KG)",
                            "6. Security OUT", "7. Main Gate OUT", "Remarks"
                        ],
                        extractors: [
                            r => r.gateInNumber || "",
                            r => r.vehicleRegNo || "",
                            r => r.vehicleType || "",
                            r => r.driverName || "",
                            r => r.purpose || "",
                            r => r.assignedRoute || "",
                            r => r.status || "",
                            r => formatDT(r.gateInDateTime),
                            r => formatDT(r.securityInDateTime),
                            r => r.grossWeight !== null ? r.grossWeight : "",
                            r => formatDT(r.factoryGateInDateTime),
                            r => formatDT(r.factoryGateOutDateTime),
                            r => r.tareWeight !== null ? r.tareWeight : "",
                            r => r.netWeight !== null ? r.netWeight : "",
                            r => formatDT(r.securityOutDateTime),
                            r => formatDT(r.gateOutDateTime),
                            r => r.remarks || ""
                        ]
                    };
            }
        },

        _escapeXml: function (str) {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");
        },

        _triggerDownload: function (blob, fileName) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    });
});
