using factory.gate as db from '../db/schema';
using { CE_PURCHASEORDER_0001 as externalPO } from './external/CE_PURCHASEORDER_0001';

@path: '/gate'
service GateService {

    /*
     * ============================================================
     * MAIN TRANSACTION
     * ============================================================
     */

    @odata.draft.enabled
    entity GateTransactions
        as projection on db.GateTransactions;


    /*
     * ============================================================
     * SECURITY
     * ============================================================
     */

    @cds.redirection.target
    entity SecurityGateEntries
        as projection on db.SecurityGateEntries;

    entity SecurityGateExits
        as projection on db.SecurityGateEntries;


    /*
     * ============================================================
     * DELIVERY / PICKUP
     * ============================================================
     */

    entity DeliveryDetails
        as projection on db.DeliveryDetails;

    entity PickupDetails
        as projection on db.PickupDetails;


    /*
     * ============================================================
     * WEIGHBRIDGE
     * ============================================================
     */

    entity WeighbridgeTransactions
        as projection on db.WeighbridgeTransactions;


    /*
     * ============================================================
     * FACTORY GATE
     * ============================================================
     */

    @cds.redirection.target
    entity FactoryGateEntries
        as projection on db.FactoryGateEntries;

    entity FactoryGateEvents
        as projection on db.FactoryGateEntries;


    /*
     * ============================================================
     * MASTER DATA
     * ============================================================
     */

    @readonly
    entity Vehicles
        as projection on db.Vehicles;

    @readonly
    entity Drivers
        as projection on db.Drivers;

    @readonly
    entity Transporters
        as projection on db.Transporters;

    @readonly
    entity Suppliers
        as projection on db.Suppliers;

    /*
     * ============================================================
     * SAP S/4HANA CLOUD EXTERNAL PURCHASE ORDERS
     * ============================================================
     */

    @readonly
    entity PurchaseOrders
        as projection on externalPO.PurchaseOrder {
            key PurchaseOrder,
                PurchaseOrderType,
                Supplier,
                CompanyCode,
                PurchasingOrganization,
                PurchasingGroup,
                PurchaseOrderDate,
                DocumentCurrency
        };


    /*
     * ============================================================
     * AUDIT
     * ============================================================
     */

    @readonly
    entity GateAuditLogs
        as projection on db.GateAuditLogs;


    /*
     * ============================================================
     * ACTIONS
     * ============================================================
     */

    action CreateGateIn(
        vehicleRegNo : String,
        vehicleType  : String,
        purpose      : String,
        driverName   : String
    ) returns GateTransactions;


    action SecurityGateIn(
        gateInNumber             : String,
        driverLicenseNo          : String,
        driverPhoneNo            : String,
        helperName               : String,
        vehicleReportingDateTime : Timestamp,
        securityPersonnel        : String,
        driverVerified           : Boolean,
        vehicleVerified          : Boolean,
        documentsVerified        : Boolean,
        poNumber                 : String,
        soNumber                 : String,
        invoiceNumber            : String,
        invoiceDate              : Date,
        withoutPO                : Boolean,
        rgpDocumentNo            : String,
        nrgpDocumentNo           : String,
        gatePassType             : String,
        assignedRoute            : String,
        remarks                  : String
    ) returns GateTransactions;


    action AssignRoute(
        gateInNumber : String,
        route        : String,
        remarks      : String
    ) returns GateTransactions;


    action RecordWeighment(
        gateInNumber        : String,
        weight              : Decimal(15,3),
        weighbridgeNumber   : String,
        weighmentType       : String,
        weightUnit          : String,
        weighbridgeDateTime : Timestamp,
        operator            : String,
        remarks             : String
    ) returns GateTransactions;


    action FactoryGateIn(
        gateInNumber            : String,
        factoryGateInDateTime   : Timestamp,
        factoryGateInOperator   : String,
        factoryArea             : String,
        unloadingPoint          : String,
        poNumber                : String,
        invoiceNumber           : String,
        invoiceDate             : Date,
        supplierName            : String,
        transporterName         : String,
        materialDescription     : String,
        deliveryNoteNo          : String,
        factoryGateInRemarks    : String,
        remarks                 : String
    ) returns GateTransactions;


    action FactoryGateOut(
        gateInNumber            : String,
        factoryGateOutDateTime  : Timestamp,
        factoryGateOutOperator  : String,
        unloadingStatus         : String,
        unloadedQuantity        : Decimal(15,3),
        quantityUnit            : String,
        goodsInspected          : Boolean,
        sealVerified            : Boolean,
        gateOutType             : String,
        factoryGateOutRemarks   : String,
        remarks                 : String
    ) returns GateTransactions;


    action RecordFactoryOperation(
        gateInNumber            : String,
        factoryGateInDateTime   : Timestamp,
        factoryGateInOperator   : String,
        factoryGateOutDateTime  : Timestamp,
        factoryGateOutOperator  : String,
        gateOutType             : String,
        factoryArea             : String,
        unloadingPoint          : String,
        poNumber                : String,
        invoiceNumber           : String,
        invoiceDate             : Date,
        supplierName            : String,
        transporterName         : String,
        materialDescription     : String,
        unloadingStatus         : String,
        unloadedQuantity        : Decimal(15,3),
        quantityUnit            : String,
        deliveryNoteNo          : String,
        goodsInspected          : Boolean,
        sealVerified            : Boolean,
        factoryGateInRemarks    : String,
        factoryGateOutRemarks   : String,
        remarks                 : String
    ) returns GateTransactions;


    action SecurityGateOut(
        gateInNumber             : String,
        securityPersonnel        : String,
        gatePassType             : String,
        gatePassDocumentNo       : String,
        driverVerified           : Boolean,
        vehicleVerified          : Boolean,
        documentsVerified        : Boolean,
        gatePassVerified         : Boolean,
        deliveryDetailsVerified  : Boolean,
        emptyInspectionVerified  : Boolean,
        materialInspected        : Boolean,
        remarks                  : String
    ) returns GateTransactions;


    action MainGateOut(
        gateInNumber    : String,
        gateOutOperator : String
    ) returns GateTransactions;


    /*
     * ============================================================
     * USER & ROLE CONTEXT
     * ============================================================
     */

    type UserInfo {
        id    : String;
        roles : array of String;
    };

    function userInfo() returns UserInfo;

}

using from './gate-service-auth';