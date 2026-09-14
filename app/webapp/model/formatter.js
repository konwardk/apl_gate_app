sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/library"
], function (DateFormat, coreLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const dtFormat = DateFormat.getDateTimeInstance({ style: "medium" });

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

        getStatusState: function (status) {
            switch (status) {
                case "COMPLETED":
                    return ValueState.Success;
                case "SECURITY_OUT":
                    return ValueState.Warning;
                case "SECURITY_IN":
                case "WEIGHBRIDGE_IN":
                case "FACTORY_IN":
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

        getPurposeState: function (purpose) {
            return purpose === "DELIVERY" ? ValueState.Information : ValueState.Warning;
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
            const num = parseFloat(val);
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
        }
    };
});
