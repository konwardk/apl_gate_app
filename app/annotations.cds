using GateService as service from '../srv/gate-service';
using from './labels';

/* ============================================================
   GATE TRANSACTIONS ANNOTATIONS
   ============================================================ */

annotate service.GateTransactions with @(

    UI.HeaderInfo : {
        TypeName : 'Gate Entry',
        TypeNamePlural : 'Gate Entries',
        Title : {
            $Type : 'UI.DataField',
            Value : gateInNumber
        },
        Description : {
            $Type : 'UI.DataField',
            Value : vehicleRegNo
        }
    },

    UI.SelectionFields : [
        gateInNumber,
        vehicleRegNo,
        purpose,
        status,
        currentStage
    ],

    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : gateInNumber,
            @UI.Importance : #High
        },
        {
            $Type : 'UI.DataField',
            Value : vehicleRegNo,
            @UI.Importance : #High
        },
        {
            $Type : 'UI.DataField',
            Value : driverName,
            @UI.Importance : #Medium
        },
        {
            $Type : 'UI.DataField',
            Value : vehicleType,
            @UI.Importance : #Medium
        },
        {
            $Type : 'UI.DataField',
            Value : purpose,
            @UI.Importance : #High
        },
        {
            $Type : 'UI.DataField',
            Value : status,
            @UI.Importance : #High
        },
        {
            $Type : 'UI.DataField',
            Value : currentStage,
            @UI.Importance : #Medium
        },
        {
            $Type : 'UI.DataField',
            Value : gateInDateTime,
            @UI.Importance : #Medium
        },
        {
            $Type : 'UI.DataField',
            Value : gateInOperator,
            @UI.Importance : #Low
        },
        {
            $Type : 'UI.DataField',
            Value : gateOutDateTime,
            @UI.Importance : #Low
        }
    ],

    UI.HeaderFacets : [
        {
            $Type : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#StatusHeader'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#StageHeader'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#PurposeHeader'
        }
    ],

    UI.DataPoint #StatusHeader : {
        Title : 'Current Status',
        Value : status
    },

    UI.DataPoint #StageHeader : {
        Title : 'Process Stage',
        Value : currentStage
    },

    UI.DataPoint #PurposeHeader : {
        Title : 'Visit Purpose',
        Value : purpose
    },

    UI.Facets : [
        {
            $Type : 'UI.CollectionFacet',
            ID : 'GeneralFacet',
            Label : 'General Information',
            Facets : [
                {
                    $Type : 'UI.ReferenceFacet',
                    Target : '@UI.FieldGroup#HeaderInfoGroup',
                    Label : 'Entry Details'
                },
                {
                    $Type : 'UI.ReferenceFacet',
                    Target : '@UI.FieldGroup#StatusAndTimestampsGroup',
                    Label : 'Process Stage & Timestamps'
                },
                {
                    $Type : 'UI.ReferenceFacet',
                    Target : '@UI.FieldGroup#VehicleDriverGroup',
                    Label : 'Master Data Associations'
                }
            ]
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'securityEntry/@UI.FieldGroup#SecurityEntryGroup',
            Label : 'Security Check-In'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'deliveryDetails/@UI.FieldGroup#DeliveryDetailsGroup',
            Label : 'Delivery Details (PO/Invoice/Delivery)'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'pickupDetails/@UI.FieldGroup#PickupDetailsGroup',
            Label : 'Pickup Details (RGP/NRGP Pass)'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'weighments/@UI.LineItem',
            Label : 'Weighbridge Weight Records'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'factoryGateEvents/@UI.LineItem',
            Label : 'Factory Yard Movement Events'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'securityExit/@UI.FieldGroup#SecurityExitGroup',
            Label : 'Security Check-Out'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target : 'auditLogs/@UI.LineItem',
            Label : 'Audit Trail Logs'
        }
    ],

    UI.FieldGroup #HeaderInfoGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : gateInNumber },
            { $Type : 'UI.DataField', Value : vehicleRegNo },
            { $Type : 'UI.DataField', Value : vehicleType },
            { $Type : 'UI.DataField', Value : purpose },
            { $Type : 'UI.DataField', Value : driverName },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    },

    UI.FieldGroup #StatusAndTimestampsGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : status },
            { $Type : 'UI.DataField', Value : currentStage },
            { $Type : 'UI.DataField', Value : gateInDateTime },
            { $Type : 'UI.DataField', Value : gateInOperator },
            { $Type : 'UI.DataField', Value : gateOutDateTime },
            { $Type : 'UI.DataField', Value : gateOutOperator }
        ]
    },

    UI.FieldGroup #VehicleDriverGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : vehicle_ID },
            { $Type : 'UI.DataField', Value : driver_ID },
            { $Type : 'UI.DataField', Value : transporter_ID },
            { $Type : 'UI.DataField', Value : supplier_ID }
        ]
    }
);

/* Field Controls & Readonly/Mandatory annotations */
annotate service.GateTransactions with {
    gateInNumber    @readonly;
    status          @readonly;
    currentStage    @readonly;
    gateInDateTime  @readonly;
    gateInOperator  @readonly;
    gateOutDateTime @readonly;
    gateOutOperator @readonly;
    vehicleRegNo    @mandatory;
    purpose         @mandatory;
};

/* Value Help / Value Lists for Gate Transactions */
annotate service.GateTransactions with {
    vehicle @Common.ValueList : {
        CollectionPath : 'Vehicles',
        Label : 'Vehicles Master',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : vehicle_ID, ValueListProperty : 'ID' },
            { $Type : 'Common.ValueListParameterOut',   LocalDataProperty : vehicleRegNo, ValueListProperty : 'vehicleRegNo' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'vehicleType' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'make' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'model' }
        ]
    };
    driver @Common.ValueList : {
        CollectionPath : 'Drivers',
        Label : 'Drivers Master',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : driver_ID, ValueListProperty : 'ID' },
            { $Type : 'Common.ValueListParameterOut',   LocalDataProperty : driverName, ValueListProperty : 'driverName' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'drivingLicenseNo' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'phoneNo' }
        ]
    };
    transporter @Common.ValueList : {
        CollectionPath : 'Transporters',
        Label : 'Transporters Master',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : transporter_ID, ValueListProperty : 'ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'transporterName' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'contactPerson' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'phoneNo' }
        ]
    };
    supplier @Common.ValueList : {
        CollectionPath : 'Suppliers',
        Label : 'Suppliers Master',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : supplier_ID, ValueListProperty : 'ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'supplierName' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'contactPerson' }
        ]
    };
};


/* ============================================================
   SECURITY GATE ENTRIES ANNOTATIONS
   ============================================================ */

annotate service.SecurityGateEntries with @(
    UI.FieldGroup #SecurityEntryGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : driverLicenseNo },
            { $Type : 'UI.DataField', Value : driverPhoneNo },
            { $Type : 'UI.DataField', Value : helperName },
            { $Type : 'UI.DataField', Value : vehicleReportingDateTime },
            { $Type : 'UI.DataField', Value : securityPersonnel },
            { $Type : 'UI.DataField', Value : driverVerified },
            { $Type : 'UI.DataField', Value : vehicleVerified },
            { $Type : 'UI.DataField', Value : documentsVerified },
            { $Type : 'UI.DataField', Value : securityInDateTime },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    }
);


/* ============================================================
   DELIVERY DETAILS ANNOTATIONS
   ============================================================ */

annotate service.DeliveryDetails with @(
    UI.FieldGroup #DeliveryDetailsGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : poNumber },
            { $Type : 'UI.DataField', Value : poItem },
            { $Type : 'UI.DataField', Value : soNumber },
            { $Type : 'UI.DataField', Value : soItem },
            { $Type : 'UI.DataField', Value : invoiceNumber },
            { $Type : 'UI.DataField', Value : invoiceDate },
            { $Type : 'UI.DataField', Value : deliveryNumber },
            { $Type : 'UI.DataField', Value : deliveryDate },
            { $Type : 'UI.DataField', Value : supplierCode },
            { $Type : 'UI.DataField', Value : supplierName },
            { $Type : 'UI.DataField', Value : documentVerificationStatus },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    }
);


/* ============================================================
   PICKUP DETAILS ANNOTATIONS
   ============================================================ */

annotate service.PickupDetails with @(
    UI.FieldGroup #PickupDetailsGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : gatePassType },
            { $Type : 'UI.DataField', Value : gatePassDocumentNo },
            { $Type : 'UI.DataField', Value : gatePassDocumentDate },
            { $Type : 'UI.DataField', Value : pickupPurpose },
            { $Type : 'UI.DataField', Value : authorizedBy },
            { $Type : 'UI.DataField', Value : gatePassVerified },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    }
);


/* ============================================================
   WEIGHBRIDGE TRANSACTIONS ANNOTATIONS
   ============================================================ */

annotate service.WeighbridgeTransactions with @(
    UI.HeaderInfo : {
        TypeName : 'Weighment Record',
        TypeNamePlural : 'Weighment Records',
        Title : { $Type : 'UI.DataField', Value : weighbridgeNumber },
        Description : { $Type : 'UI.DataField', Value : weighmentType }
    },
    UI.SelectionFields : [
        weighbridgeNumber,
        weighmentType,
        operator
    ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : weighbridgeNumber },
        { $Type : 'UI.DataField', Value : weighmentType },
        { $Type : 'UI.DataField', Value : weight },
        { $Type : 'UI.DataField', Value : weightUnit },
        { $Type : 'UI.DataField', Value : weighbridgeDateTime },
        { $Type : 'UI.DataField', Value : operator },
        { $Type : 'UI.DataField', Value : remarks }
    ]
);


/* ============================================================
   FACTORY GATE EVENTS ANNOTATIONS
   ============================================================ */

annotate service.FactoryGateEvents with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : factoryGateInDateTime },
        { $Type : 'UI.DataField', Value : factoryGateInOperator },
        { $Type : 'UI.DataField', Value : factoryGateOutDateTime },
        { $Type : 'UI.DataField', Value : factoryGateOutOperator },
        { $Type : 'UI.DataField', Value : factoryArea },
        { $Type : 'UI.DataField', Value : remarks }
    ]
);


/* ============================================================
   SECURITY GATE EXITS ANNOTATIONS
   ============================================================ */

annotate service.SecurityGateExits with @(
    UI.FieldGroup #SecurityExitGroup : {
        Data : [
            { $Type : 'UI.DataField', Value : securityPersonnel },
            { $Type : 'UI.DataField', Value : gatePassType },
            { $Type : 'UI.DataField', Value : gatePassDocumentNo },
            { $Type : 'UI.DataField', Value : gatePassVerified },
            { $Type : 'UI.DataField', Value : deliveryDetailsVerified },
            { $Type : 'UI.DataField', Value : securityOutDateTime },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    }
);


/* ============================================================
   GATE AUDIT LOGS ANNOTATIONS
   ============================================================ */

annotate service.GateAuditLogs with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : action },
        { $Type : 'UI.DataField', Value : oldStatus },
        { $Type : 'UI.DataField', Value : newStatus },
        { $Type : 'UI.DataField', Value : oldStage },
        { $Type : 'UI.DataField', Value : newStage },
        { $Type : 'UI.DataField', Value : actionDateTime },
        { $Type : 'UI.DataField', Value : userName },
        { $Type : 'UI.DataField', Value : remarks }
    ]
);


/* ============================================================
   MASTER DATA ENTITIES ANNOTATIONS
   ============================================================ */

annotate service.Vehicles with @(
    UI.HeaderInfo : {
        TypeName : 'Vehicle',
        TypeNamePlural : 'Vehicles',
        Title : { $Type : 'UI.DataField', Value : vehicleRegNo },
        Description : { $Type : 'UI.DataField', Value : make }
    },
    UI.SelectionFields : [ vehicleRegNo, vehicleType, active ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : vehicleRegNo },
        { $Type : 'UI.DataField', Value : vehicleType },
        { $Type : 'UI.DataField', Value : vehicleCategory },
        { $Type : 'UI.DataField', Value : make },
        { $Type : 'UI.DataField', Value : model },
        { $Type : 'UI.DataField', Value : capacity },
        { $Type : 'UI.DataField', Value : capacityUnit },
        { $Type : 'UI.DataField', Value : active }
    ]
);

annotate service.Drivers with @(
    UI.HeaderInfo : {
        TypeName : 'Driver',
        TypeNamePlural : 'Drivers',
        Title : { $Type : 'UI.DataField', Value : driverName },
        Description : { $Type : 'UI.DataField', Value : drivingLicenseNo }
    },
    UI.SelectionFields : [ driverName, drivingLicenseNo, active ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : driverCode },
        { $Type : 'UI.DataField', Value : driverName },
        { $Type : 'UI.DataField', Value : drivingLicenseNo },
        { $Type : 'UI.DataField', Value : licenseType },
        { $Type : 'UI.DataField', Value : phoneNo },
        { $Type : 'UI.DataField', Value : licenseExpiryDate },
        { $Type : 'UI.DataField', Value : active }
    ]
);

annotate service.Transporters with @(
    UI.HeaderInfo : {
        TypeName : 'Transporter',
        TypeNamePlural : 'Transporters',
        Title : { $Type : 'UI.DataField', Value : transporterName },
        Description : { $Type : 'UI.DataField', Value : transporterCode }
    },
    UI.SelectionFields : [ transporterCode, transporterName, active ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : transporterCode },
        { $Type : 'UI.DataField', Value : transporterName },
        { $Type : 'UI.DataField', Value : gstin },
        { $Type : 'UI.DataField', Value : contactPerson },
        { $Type : 'UI.DataField', Value : phoneNo },
        { $Type : 'UI.DataField', Value : email },
        { $Type : 'UI.DataField', Value : active }
    ]
);

annotate service.Suppliers with @(
    UI.HeaderInfo : {
        TypeName : 'Supplier',
        TypeNamePlural : 'Suppliers',
        Title : { $Type : 'UI.DataField', Value : supplierName },
        Description : { $Type : 'UI.DataField', Value : supplierCode }
    },
    UI.SelectionFields : [ supplierCode, supplierName, active ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : supplierCode },
        { $Type : 'UI.DataField', Value : supplierName },
        { $Type : 'UI.DataField', Value : gstin },
        { $Type : 'UI.DataField', Value : contactPerson },
        { $Type : 'UI.DataField', Value : phoneNo },
        { $Type : 'UI.DataField', Value : sapBusinessPartner },
        { $Type : 'UI.DataField', Value : active }
    ]
);

/* ============================================================
   SECURITY GATE ENTRIES ANNOTATIONS
   ============================================================ */

annotate service.SecurityGateEntries with @(
    UI.HeaderInfo : {
        TypeName : 'Security Gate Entry',
        TypeNamePlural : 'Security Gate Entries',
        Title : { $Type : 'UI.DataField', Value : gateInNumber },
        Description : { $Type : 'UI.DataField', Value : driverLicenseNo }
    },
    UI.SelectionFields : [
        gateInNumber,
        driverLicenseNo,
        poNumber,
        withoutPO,
        securityPersonnel
    ],
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : gateInNumber, @UI.Importance : #High },
        { $Type : 'UI.DataField', Value : driverLicenseNo, @UI.Importance : #High },
        { $Type : 'UI.DataField', Value : driverPhoneNo, @UI.Importance : #Medium },
        { $Type : 'UI.DataField', Value : helperName, @UI.Importance : #Low },
        { $Type : 'UI.DataField', Value : withoutPO, @UI.Importance : #High },
        { $Type : 'UI.DataField', Value : poNumber, @UI.Importance : #High },
        { $Type : 'UI.DataField', Value : soNumber, @UI.Importance : #Low },
        { $Type : 'UI.DataField', Value : invoiceNumber, @UI.Importance : #Medium },
        { $Type : 'UI.DataField', Value : securityPersonnel, @UI.Importance : #Medium },
        { $Type : 'UI.DataField', Value : securityInDateTime, @UI.Importance : #High }
    ],
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'SecurityGeneralFacet',
            Label : 'Security Check-In & Physical Inspection',
            Target : '@UI.FieldGroup#SecurityGeneral'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'SecurityDeliveryFacet',
            Label : 'Delivery Documentation & PO Verification',
            Target : '@UI.FieldGroup#SecurityDelivery'
        }
    ],
    UI.FieldGroup #SecurityGeneral : {
        Data : [
            { $Type : 'UI.DataField', Value : gateInNumber },
            { $Type : 'UI.DataField', Value : driverLicenseNo },
            { $Type : 'UI.DataField', Value : driverPhoneNo },
            { $Type : 'UI.DataField', Value : helperName },
            { $Type : 'UI.DataField', Value : securityPersonnel },
            { $Type : 'UI.DataField', Value : driverVerified },
            { $Type : 'UI.DataField', Value : vehicleVerified },
            { $Type : 'UI.DataField', Value : documentsVerified },
            { $Type : 'UI.DataField', Value : securityInDateTime },
            { $Type : 'UI.DataField', Value : remarks }
        ]
    },
    UI.FieldGroup #SecurityDelivery : {
        Data : [
            { $Type : 'UI.DataField', Value : withoutPO },
            { $Type : 'UI.DataField', Value : poNumber },
            { $Type : 'UI.DataField', Value : soNumber },
            { $Type : 'UI.DataField', Value : invoiceNumber },
            { $Type : 'UI.DataField', Value : invoiceDate }
        ]
    }
);
