using factory.gate as db from '../db/schema';

annotate db.GateTransactions with {
    gateInNumber    @title: 'Gate IN Number' @label: 'Gate IN Number';
    vehicleRegNo    @title: 'Vehicle Reg No' @label: 'Vehicle Reg No';
    vehicleType     @title: 'Vehicle Type' @label: 'Vehicle Type';
    purpose         @title: 'Visit Purpose' @label: 'Visit Purpose';
    status          @title: 'Status' @label: 'Status';
    currentStage    @title: 'Current Process Stage' @label: 'Process Stage';
    gateInDateTime  @title: 'Gate IN Date & Time' @label: 'Gate IN Time';
    gateInOperator  @title: 'Gate IN Operator' @label: 'Gate IN Operator';
    gateOutDateTime @title: 'Gate OUT Date & Time' @label: 'Gate OUT Time';
    gateOutOperator @title: 'Gate OUT Operator' @label: 'Gate OUT Operator';
    remarks         @title: 'Remarks' @label: 'Remarks';
};

annotate db.Vehicles with {
    vehicleRegNo    @title: 'Vehicle Registration No' @label: 'Vehicle Reg No';
    vehicleType     @title: 'Vehicle Type' @label: 'Vehicle Type';
    vehicleCategory @title: 'Vehicle Category' @label: 'Category';
    make            @title: 'Make / Manufacturer' @label: 'Make';
    model           @title: 'Vehicle Model' @label: 'Model';
    capacity        @title: 'Carrying Capacity' @label: 'Capacity';
    capacityUnit    @title: 'Capacity Unit' @label: 'Unit';
    insuranceNo     @title: 'Insurance Policy No' @label: 'Insurance No';
    insuranceExpiry @title: 'Insurance Expiry Date' @label: 'Insurance Expiry';
    fitnessCertificateNo @title: 'Fitness Certificate No' @label: 'Fitness Cert No';
    fitnessExpiry   @title: 'Fitness Expiry Date' @label: 'Fitness Expiry';
    pollutionCertificateNo @title: 'PUC Certificate No' @label: 'PUC Cert No';
    pollutionExpiry @title: 'PUC Expiry Date' @label: 'PUC Expiry';
    permitNo        @title: 'Permit Number' @label: 'Permit No';
    permitExpiry    @title: 'Permit Expiry Date' @label: 'Permit Expiry';
    active          @title: 'Active Status' @label: 'Active';
};

annotate db.Drivers with {
    driverCode        @title: 'Driver Code' @label: 'Driver Code';
    driverName        @title: 'Driver Name' @label: 'Driver Name';
    drivingLicenseNo  @title: 'Driving License No' @label: 'License No';
    licenseType       @title: 'License Type' @label: 'License Type';
    licenseExpiryDate @title: 'License Expiry Date' @label: 'License Expiry';
    phoneNo           @title: 'Contact Phone No' @label: 'Phone No';
    alternatePhoneNo  @title: 'Alternate Phone No' @label: 'Alt Phone No';
    address           @title: 'Address' @label: 'Address';
    active            @title: 'Active Status' @label: 'Active';
};

annotate db.Transporters with {
    transporterCode @title: 'Transporter Code' @label: 'Transporter Code';
    transporterName @title: 'Transporter Name' @label: 'Transporter Name';
    gstin           @title: 'GSTIN' @label: 'GSTIN';
    pan             @title: 'PAN' @label: 'PAN';
    contactPerson   @title: 'Contact Person' @label: 'Contact Person';
    phoneNo         @title: 'Phone Number' @label: 'Phone No';
    email           @title: 'Email Address' @label: 'Email';
    address         @title: 'Address' @label: 'Address';
    active          @title: 'Active Status' @label: 'Active';
};

annotate db.Suppliers with {
    supplierCode       @title: 'Supplier Code' @label: 'Supplier Code';
    supplierName       @title: 'Supplier Name' @label: 'Supplier Name';
    gstin              @title: 'GSTIN' @label: 'GSTIN';
    contactPerson      @title: 'Contact Person' @label: 'Contact Person';
    phoneNo            @title: 'Phone Number' @label: 'Phone No';
    address            @title: 'Address' @label: 'Address';
    sapBusinessPartner @title: 'SAP BP Number' @label: 'SAP BP';
    active             @title: 'Active Status' @label: 'Active';
};

annotate db.WeighbridgeTransactions with {
    weighbridgeNumber   @title: 'Weighbridge No' @label: 'Weighbridge No';
    weighmentType       @title: 'Weighment Type' @label: 'Weighment Type';
    weight              @title: 'Weight' @label: 'Weight';
    weightUnit          @title: 'Unit' @label: 'Unit';
    weighbridgeDateTime @title: 'Weighing Timestamp' @label: 'Weighing Time';
    operator            @title: 'Operator' @label: 'Operator';
    remarks             @title: 'Remarks' @label: 'Remarks';
};

annotate db.GateAuditLogs with {
    action         @title: 'Action Performed' @label: 'Action';
    oldStatus      @title: 'Previous Status' @label: 'Old Status';
    newStatus      @title: 'New Status' @label: 'New Status';
    oldStage       @title: 'Previous Stage' @label: 'Old Stage';
    newStage       @title: 'New Stage' @label: 'New Stage';
    actionDateTime @title: 'Timestamp' @label: 'Timestamp';
    userId         @title: 'User ID' @label: 'User ID';
    userName       @title: 'User Name' @label: 'User Name';
    remarks        @title: 'Remarks' @label: 'Remarks';
};
