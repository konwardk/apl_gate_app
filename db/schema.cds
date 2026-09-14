namespace factory.gate;

using {
    cuid,
    managed
} from '@sap/cds/common';


/* ============================================================
   1. MAIN GATE TRANSACTION
   ============================================================ */

entity GateTransactions : cuid, managed {

    /* Business Identifier */
    gateInNumber            : String(30) @mandatory;

    /* Vehicle Information */
    vehicleRegNo            : String(20) @mandatory;
    vehicleType             : VehicleType default 'TRUCK';
    driverName              : String(100);

    /* Purpose */
    purpose                 : VisitPurpose @mandatory;

    /* Process Status */
    status                  : GateStatus @mandatory default 'GATE_IN';
    currentStage            : GateStage @mandatory default 'MAIN_GATE_IN';

    /* Main Gate IN */
    gateInDateTime          : Timestamp @mandatory;
    gateInOperator          : String(100) @mandatory;

    /* Main Gate OUT */
    gateOutDateTime         : Timestamp;
    gateOutOperator         : String(100);

    /* General Information */
    remarks                 : String(500);

    /* Master Data References */
    vehicle                 : Association to Vehicles
                                on vehicle.vehicleRegNo = vehicleRegNo;

    driver                  : Association to Drivers;

    transporter             : Association to Transporters;

    supplier                : Association to Suppliers;

    /* Process Data */
    securityEntry           : Association to one SecurityGateEntries
                                on securityEntry.gateTransaction = $self;

    factoryEntry            : Association to one FactoryGateEntries
                                on factoryEntry.gateTransaction = $self;

    deliveryDetails         : Composition of one DeliveryDetails
                                on deliveryDetails.gateTransaction = $self;

    pickupDetails           : Composition of one PickupDetails
                                on pickupDetails.gateTransaction = $self;

    weighments              : Composition of many WeighbridgeTransactions
                                on weighments.gateTransaction = $self;

    factoryGateEvents       : Composition of many FactoryGateEntries
                                on factoryGateEvents.gateTransaction = $self;

    securityExit            : Association to SecurityGateEntries
                                on securityExit.gateTransaction = $self;

    auditLogs               : Composition of many GateAuditLogs
                                on auditLogs.gateTransaction = $self;
}


/* ============================================================
   2. SECURITY GATE OPERATIONS (ENTRY & EXIT CONSOLIDATED)
   ============================================================ */

entity SecurityGateEntries : cuid, managed {

    gateTransaction         : Association to GateTransactions
                                not null;

    gateInNumber            : String(30);

    /* --- Security IN: Driver Details --- */
    driverLicenseNo        : String(30);
    driverPhoneNo          : String(20);
    helperName              : String(100);

    /* --- Security IN: Vehicle Reporting & Inbound Timestamp --- */
    vehicleReportingDateTime : Timestamp;
    securityInDateTime      : Timestamp;
    securityPersonnel       : String(100);

    /* --- Security IN: Verification Checklist --- */
    driverVerified          : Boolean default false;
    vehicleVerified         : Boolean default false;
    documentsVerified       : Boolean default false;

    /* --- Security IN: Delivery Documentation --- */
    poNumber                : String(30);
    soNumber                : String(30);
    invoiceNumber           : String(50);
    invoiceDate             : Date;
    withoutPO               : Boolean default false;

    /* --- Security IN: Pickup Documentation --- */
    rgpDocumentNo           : String(30);
    nrgpDocumentNo          : String(30);
    gatePassType            : GatePassType;

    securityInRemarks       : String(500);

    /* --- Security OUT: Exit Verification & Clearance --- */
    securityOutPersonnel    : String(100);
    securityOutDateTime     : Timestamp;

    /* Security OUT Checklist */
    exitDriverVerified      : Boolean default false;
    exitVehicleVerified     : Boolean default false;
    exitDocumentsVerified   : Boolean default false;
    gatePassVerified        : Boolean default false;
    deliveryDetailsVerified : Boolean default false;
    emptyInspectionVerified : Boolean default false;
    materialInspected       : Boolean default false;

    /* Security OUT Gate Pass Details */
    exitGatePassType        : GatePassType;
    exitGatePassDocumentNo  : String(30);

    securityOutRemarks      : String(500);

    /* General / Combined Remarks */
    remarks                 : String(500);
}


/* ============================================================
   3. DELIVERY DETAILS
   ============================================================ */

entity DeliveryDetails : cuid, managed {

    gateTransaction         : Association to GateTransactions
                                not null;

    /* Purchase / Sales Order */
    poNumber                : String(20);
    poItem                  : String(10);

    soNumber                : String(20);
    soItem                  : String(10);

    /* Invoice */
    invoiceNumber           : String(30);
    invoiceDate             : Date;

    /* Delivery */
    deliveryNumber          : String(20);
    deliveryDate            : Date;

    /* Supplier */
    supplierCode            : String(20);
    supplierName            : String(100);

    /* Document Verification */
    documentVerificationStatus : VerificationStatus
                                default 'PENDING';

    remarks                 : String(500);
}


/* ============================================================
   4. PICKUP DETAILS
   ============================================================ */

entity PickupDetails : cuid, managed {

    gateTransaction         : Association to GateTransactions
                                not null;

    /* RGP / NRGP */
    gatePassType            : GatePassType;
    gatePassDocumentNo      : String(30);
    gatePassDocumentDate    : Date;

    /* Pickup Information */
    pickupPurpose           : String(250);

    authorizedBy            : String(100);

    /* Verification */
    gatePassVerified        : Boolean default false;

    remarks                 : String(500);
}


/* ============================================================
   5. WEIGHBRIDGE TRANSACTION
   ============================================================ */

entity WeighbridgeTransactions : cuid, managed {

    gateTransaction         : Association to GateTransactions
                                not null;

    /* Weighbridge Machine Number */
    weighbridgeNumber       : String(30) @mandatory;

    /* Type of Weight */
    weighmentType           : WeighmentType @mandatory;

    /* Weight */
    weight                  : Decimal(15,3) @mandatory;

    weightUnit              : WeightUnit @mandatory default 'KG';

    /* Weighbridge Timestamp */
    weighbridgeDateTime     : Timestamp @mandatory;

    /* Operator */
    operator                : String(100) @mandatory;

    remarks                 : String(250);
}


/* ============================================================
   6. FACTORY GATE OPERATIONS (ENTRY & EXIT CONSOLIDATED)
   ============================================================ */

entity FactoryGateEntries : cuid, managed {

    gateTransaction         : Association to GateTransactions
                                not null;

    gateInNumber            : String(30);

    /* Factory Gate IN */
    factoryGateInDateTime   : Timestamp;
    factoryGateInOperator   : String(100);

    /* Factory Gate OUT */
    factoryGateOutDateTime  : Timestamp;
    factoryGateOutOperator  : String(100);

    /* Delivery Consignment Details (Collected from Security Gate or operator) */
    poNumber                : String(30);
    invoiceNumber           : String(50);
    invoiceDate             : Date;
    supplierName            : String(100);
    transporterName         : String(100);
    deliveryNoteNo          : String(50);

    /* Factory Yard & Unloading Details */
    factoryArea             : String(100); // e.g. Methanol Plant, Formalin Plant, Tank Farm, Raw Material Yard
    unloadingPoint          : String(100); // e.g. Bay 1, Silo 3, Storage Yard
    materialDescription     : String(200);
    unloadingStatus         : String(30) default 'COMPLETED'; // IN_PROGRESS, COMPLETED, PARTIAL, REJECTED
    unloadedQuantity        : Decimal(15,3);
    quantityUnit            : String(10) default 'KG';

    /* Physical Inspection */
    goodsInspected          : Boolean default true;
    sealVerified            : Boolean default true;

    remarks                 : String(500);
}

entity FactoryGateEvents as projection on FactoryGateEntries;





/* ============================================================
   8. VEHICLE MASTER
   ============================================================ */

entity Vehicles : cuid, managed {

    vehicleRegNo            : String(20) @mandatory;
    vehicleType             : VehicleType @mandatory;

    vehicleCategory         : String(30);

    make                    : String(50);
    model                   : String(50);

    capacity                : Decimal(15,3);
    capacityUnit            : WeightUnit;

    /* Transporter */
    transporter             : Association to Transporters;

    /* Vehicle Documents */
    insuranceNo             : String(50);
    insuranceExpiry         : Date;

    fitnessCertificateNo   : String(50);
    fitnessExpiry           : Date;

    pollutionCertificateNo : String(50);
    pollutionExpiry         : Date;

    permitNo                : String(50);
    permitExpiry            : Date;

    active                  : Boolean default true;
}


/* ============================================================
   9. DRIVER MASTER
   ============================================================ */

entity Drivers : cuid, managed {

    driverCode              : String(20);

    driverName              : String(100) @mandatory;

    drivingLicenseNo        : String(30) @mandatory;

    licenseType             : String(20);

    licenseExpiryDate       : Date;

    phoneNo                 : String(20);

    alternatePhoneNo        : String(20);

    address                 : String(250);

    transporter             : Association to Transporters;

    active                  : Boolean default true;
}


/* ============================================================
   10. TRANSPORTER MASTER
   ============================================================ */

entity Transporters : cuid, managed {

    transporterCode         : String(20) @mandatory;

    transporterName         : String(100) @mandatory;

    gstin                   : String(20);

    pan                     : String(20);

    contactPerson           : String(100);

    phoneNo                 : String(20);

    email                   : String(100);

    address                 : String(250);

    active                  : Boolean default true;
}


/* ============================================================
   11. SUPPLIER MASTER / SAP REFERENCE
   ============================================================ */

entity Suppliers : cuid, managed {

    supplierCode            : String(20) @mandatory;

    supplierName            : String(100);

    gstin                   : String(20);

    contactPerson           : String(100);

    phoneNo                 : String(20);

    address                 : String(250);

    /* SAP Business Partner / Supplier Reference */
    sapBusinessPartner      : String(20);

    active                  : Boolean default true;
}


/* ============================================================
   12. AUDIT LOG
   ============================================================ */

entity GateAuditLogs : cuid {

    gateTransaction         : Association to GateTransactions
                                not null;

    action                  : String(50) @mandatory;

    oldStatus               : GateStatus;

    newStatus               : GateStatus;

    oldStage                : GateStage;

    newStage                : GateStage;

    actionDateTime          : Timestamp @mandatory;

    userId                  : String(100);

    userName                : String(100);

    remarks                 : String(500);
}


/* ============================================================
   13. ENUMERATIONS
   ============================================================ */

type VisitPurpose : String enum {
    DELIVERY;
    PICKUP;
}

type VehicleType : String enum {
    TANKER;
    TRUCK;
    TRAILER;
    CONTAINER;
    LCV;
    OTHER;
}

type GateStatus : String enum {
    GATE_IN;
    SECURITY_IN;
    WEIGHBRIDGE_IN;
    FACTORY_IN;
    FACTORY_OUT;
    WEIGHBRIDGE_OUT;
    SECURITY_OUT;
    COMPLETED;
    HOLD;
    CANCELLED;
}

type GateStage : String enum {
    MAIN_GATE_IN;
    SECURITY_GATE_IN;
    WEIGHBRIDGE_IN;
    FACTORY;
    WEIGHBRIDGE_OUT;
    SECURITY_GATE_OUT;
    MAIN_GATE_OUT;
    COMPLETED;
}

type WeighmentType : String enum {
    GROSS_IN;
    TARE_IN;
    GROSS_OUT;
    TARE_OUT;
}

type WeightUnit : String enum {
    KG;
    MT;
    TON;
}

type GatePassType : String enum {
    RGP;
    NRGP;
}

type VerificationStatus : String enum {
    PENDING;
    VERIFIED;
    REJECTED;
}