sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/library"
], function (DateFormat, coreLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const dtFormat = DateFormat.getDateTimeInstance({ style: "medium" });
    const dFormat = DateFormat.getDateInstance({ style: "medium" });

    return {
        formatDateTime: function (val) {
            if (!val) return "-";
            try {
                const d = new Date(val);
                return isNaN(d.getTime()) ? "-" : dtFormat.format(d);
            } catch (e) {
                return "-";
            }
        },

        formatDate: function (val) {
            if (!val) return "-";
            try {
                const d = new Date(val);
                return isNaN(d.getTime()) ? String(val) : dFormat.format(d);
            } catch (e) {
                return String(val) || "-";
            }
        },

        getStatusState: function (status) {
            switch (status) {
                case "COMPLETED":
                case "GATE_OUT":
                    return ValueState.Success;
                case "SECURITY_OUT":
                    return ValueState.Warning;
                case "SECURITY_IN":
                case "WEIGHBRIDGE_IN":
                case "FACTORY_IN":
                case "FACTORY_OUT":
                case "WEIGHBRIDGE_OUT":
                    return ValueState.Information;
                case "GATE_IN":
                    return ValueState.None;
                case "HOLD":
                    return ValueState.Warning;
                case "CANCELLED":
                    return ValueState.Error;
                default:
                    return ValueState.None;
            }
        },

        getStatusText: function (status) {
            switch (status) {
                case "GATE_IN":
                    return "IN";
                case "SECURITY_IN":
                    return "Security IN";
                case "WEIGHBRIDGE_IN":
                    return "Scale IN";
                case "FACTORY_IN":
                    return "Yard IN";
                case "FACTORY_OUT":
                    return "Yard OUT";
                case "WEIGHBRIDGE_OUT":
                    return "Scale OUT";
                case "SECURITY_OUT":
                    return "Ready Exit";
                case "COMPLETED":
                case "GATE_OUT":
                    return "Exit";
                case "HOLD":
                    return "On Hold";
                case "CANCELLED":
                    return "Cancelled";
                default:
                    return status || "-";
            }
        },

        getStageText: function (stage) {
            switch (stage) {
                case "MAIN_GATE_IN":
                    return "Main Gate";
                case "SECURITY_GATE_IN":
                    return "Security";
                case "WEIGHBRIDGE_IN":
                    return "Weighbridge";
                case "FACTORY":
                case "FACTORY_GATE":
                    return "Factory Yard";
                case "FACTORY_OUT":
                    return "Yard Cleared";
                case "WEIGHBRIDGE_OUT":
                    return "Tare Scale";
                case "SECURITY_GATE_OUT":
                    return "Exit Check";
                case "MAIN_GATE_OUT":
                case "COMPLETED":
                    return "Exit";
                default:
                    return stage || "-";
            }
        },

        getPurposeState: function (purpose) {
            return purpose === "DELIVERY" ? ValueState.Information : ValueState.Warning;
        },

        getPurposeText: function (purpose) {
            switch (purpose) {
                case "DELIVERY":
                    return "Delivery";
                case "PICKUP":
                    return "Pickup";
                default:
                    return purpose || "-";
            }
        },

        getVehicleTypeText: function (type) {
            switch (type) {
                case "TANKER":
                    return "Tanker";
                case "TRUCK":
                    return "Truck";
                case "TRAILER":
                    return "Trailer";
                case "CONTAINER":
                    return "Container";
                case "LCV":
                    return "LCV";
                case "OTHER":
                    return "Other";
                default:
                    return type || "-";
            }
        },

        getUserInitials: function (userId) {
            if (!userId) return "U";
            if (userId.includes("superadmin")) return "SA";
            if (userId.includes("maingate")) return "MG";
            if (userId.includes("security")) return "SG";
            if (userId.includes("weighbridge")) return "WB";
            if (userId.includes("factory")) return "FG";
            if (userId.includes("admin")) return "AD";
            if (userId.includes("auditor")) return "AU";
            return userId.slice(0, 2).toUpperCase();
        },

        getUserAvatarColor: function (userId) {
            if (!userId) return "Accent1";
            if (userId.includes("superadmin")) return "Accent6";
            if (userId.includes("maingate")) return "Accent3";
            if (userId.includes("security")) return "Accent8";
            if (userId.includes("weighbridge")) return "Accent2";
            if (userId.includes("factory")) return "Accent5";
            if (userId.includes("admin")) return "Accent7";
            if (userId.includes("auditor")) return "Accent4";
            return "Accent1";
        },

        formatWeight: function (val, unit) {
            if (val === null || val === undefined || val === "") return "-";
            const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : parseFloat(val);
            if (isNaN(num)) return "-";
            const sFormatted = num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            return sFormatted + (unit ? " " + unit : " KG");
        },

        getWeighmentTypeState: function (type) {
            switch (type) {
                case "GROSS_IN":
                case "GROSS_OUT":
                    return ValueState.Success;
                case "TARE_IN":
                case "TARE_OUT":
                    return ValueState.Information;
                default:
                    return ValueState.None;
            }
        },

        getWeighmentTypeDesc: function (type) {
            switch (type) {
                case "GROSS_IN":
                    return "GROSS_IN - Gross Inbound";
                case "TARE_IN":
                    return "TARE_IN - Tare Inbound (Empty Truck)";
                case "TARE_OUT":
                    return "TARE_OUT - Tare Outbound (Empty Truck)";
                case "GROSS_OUT":
                    return "GROSS_OUT - Gross Outbound (Loaded Truck)";
                default:
                    return type || "-";
            }
        },

        getGateOutTypeDesc: function (type) {
            switch (type) {
                case "RGP":
                    return "RGP - Returnable Gate Pass";
                case "NRGP":
                    return "NRGP - Non-Returnable Gate Pass";
                case "STANDARD":
                    return "STANDARD - Delivery / Consignment Completed";
                case "DELIVERY_NOTE":
                    return "DELIVERY_NOTE - Delivery Note / Consignment Completed";
                case "MATERIAL_RETURN":
                    return "MATERIAL_RETURN - Material Return / Quality Rejection";
                case "EMPTY_VEHICLE":
                    return "EMPTY_VEHICLE - Empty Vehicle Yard Clearance";
                case "OTHER":
                    return "OTHER - Standard Outbound Gate Pass";
                default:
                    return type || "Standard Clearance";
            }
        },

        getGateOutTypeState: function (type) {
            switch (type) {
                case "RGP":
                    return ValueState.Warning;
                case "NRGP":
                    return ValueState.Information;
                case "STANDARD":
                case "DELIVERY_NOTE":
                    return ValueState.Success;
                case "MATERIAL_RETURN":
                    return ValueState.Error;
                case "EMPTY_VEHICLE":
                case "OTHER":
                    return ValueState.None;
                default:
                    return ValueState.None;
            }
        }
    };
});
