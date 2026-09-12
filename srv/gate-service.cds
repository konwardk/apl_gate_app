using factory.gate as db from '../db/schema';

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

    entity SecurityGateEntries
        as projection on db.SecurityGateEntries;

    entity SecurityGateExits
        as projection on db.SecurityGateExits;


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

    entity FactoryGateEvents
        as projection on db.FactoryGateEvents;


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
        remarks                  : String
    ) returns GateTransactions;


    action RecordWeighment(
        gateInNumber : String,
        weight : Decimal(15,3),
        weighbridgeNumber : String
    ) returns GateTransactions;


    action FactoryGateIn(
        gateInNumber : String
    ) returns GateTransactions;


    action FactoryGateOut(
        gateInNumber : String
    ) returns GateTransactions;


    action SecurityGateOut(
        gateInNumber : String,
        securityPersonnel : String,
        gatePassType : String,
        gatePassDocumentNo : String
    ) returns GateTransactions;


    action MainGateOut(
        gateInNumber : String
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