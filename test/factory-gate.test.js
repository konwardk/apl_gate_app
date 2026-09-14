import cds from '@sap/cds';
import assert from 'node:assert';

async function testFactoryGateOperations() {
    console.log('================================================================');
    console.log(' SAP CAP GateService - Factory Gate Delivery Operations Test');
    console.log('================================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries, FactoryGateEntries, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const weighbridgeUser = new cds.User({ id: 'weighbridge_user', roles: ['WeighbridgeUser'] });
    const factoryUser = new cds.User({ id: 'factory_user', roles: ['FactoryGateUser'] });

    // =========================================================================
    // FLOW 1: WEIGHED DELIVERY (SECURITY_IN -> WEIGHBRIDGE_IN -> FACTORY)
    // =========================================================================
    console.log('\n--- Flow 1: Weighed Delivery (Security -> Weighbridge -> Factory Yard) ---');

    // 1. Create Main Gate IN
    const tx1 = srv.tx({ user: mainGateUser });
    await tx1.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-WB-1001',
        vehicleType: 'TANKER',
        purpose: 'DELIVERY',
        driverName: 'Bipul Gogoi'
    }));
    const gateTx1 = await tx1.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-WB-1001' }));
    console.log(`[Step 1] Gate IN Created: ${gateTx1.gateInNumber} (ID: ${gateTx1.ID})`);

    // 2. Security Gate IN with PO and Invoice
    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: gateTx1.gateInNumber,
        driverLicenseNo: 'DL-AS-2022-999',
        driverPhoneNo: '+91 9435012345',
        securityPersonnel: 'Inspector Sharma',
        poNumber: 'PO-APL-7788',
        invoiceNumber: 'INV-CHEM-9900',
        invoiceDate: '2026-09-10',
        withoutPO: false,
        remarks: 'Tanker checked at Security Gate IN'
    });
    console.log('[Step 2] Security Gate IN complete (PO: PO-APL-7788, Inv: INV-CHEM-9900)');

    // 3. Inbound Weighment (Gross)
    await srv.tx({ user: weighbridgeUser }).send('RecordWeighment', {
        gateInNumber: gateTx1.gateInNumber,
        weight: 35400.000,
        weighbridgeNumber: 'WB-01',
        weighmentType: 'GROSS_IN',
        weightUnit: 'KG',
        operator: 'ScaleOperator1',
        remarks: 'Gross Inbound Weight'
    });
    const afterGross = await srv.tx({ user: factoryUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx1.ID }));
    assert.strictEqual(afterGross.status, 'WEIGHBRIDGE_IN', 'Vehicle reached WEIGHBRIDGE_IN');
    console.log(`[Step 3] Weighbridge IN complete: Status=${afterGross.status}, Stage=${afterGross.currentStage}`);

    // 4. Factory Gate IN (Auto-pulls PO & Invoice from Security)
    const facInTime = new Date('2026-09-14T11:00:00.000Z');
    await srv.tx({ user: factoryUser }).send('FactoryGateIn', {
        gateInNumber: gateTx1.gateInNumber,
        factoryGateInDateTime: facInTime,
        factoryGateInOperator: 'FactoryOfficer_Pranab',
        factoryArea: 'Methanol Plant - Unloading Bay',
        unloadingPoint: 'Storage Tank Farm T-02',
        materialDescription: 'Methanol Crude Feedstock',
        deliveryNoteNo: 'DN-2026-044',
        remarks: 'Tanker connected to discharge pump line'
    });

    const afterFacIn = await srv.tx({ user: factoryUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx1.ID }));
    assert.strictEqual(afterFacIn.status, 'FACTORY_IN', 'Vehicle entered FACTORY_IN');
    assert.strictEqual(afterFacIn.currentStage, 'FACTORY', 'Current stage is FACTORY');

    // Verify FactoryGateEntries record was created and auto-populated
    const facEntry1 = await srv.tx({ user: factoryUser }).run(
        SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: gateTx1.ID })
    );
    assert.ok(facEntry1, 'FactoryGateEntries record must exist');
    assert.strictEqual(facEntry1.poNumber, 'PO-APL-7788', 'PO Number auto-populated from Security');
    assert.strictEqual(facEntry1.invoiceNumber, 'INV-CHEM-9900', 'Invoice Number auto-populated from Security');
    assert.strictEqual(facEntry1.factoryGateInOperator, 'FactoryOfficer_Pranab');
    assert.strictEqual(facEntry1.factoryArea, 'Methanol Plant - Unloading Bay');
    assert.strictEqual(facEntry1.unloadingPoint, 'Storage Tank Farm T-02');
    console.log(`[Step 4 PASS] Factory Gate IN recorded: Status=${afterFacIn.status}, PO=${facEntry1.poNumber}, Inv=${facEntry1.invoiceNumber}`);

    // 5. Factory Gate OUT (Unloading finished)
    const facOutTime = new Date('2026-09-14T12:30:00.000Z');
    await srv.tx({ user: factoryUser }).send('FactoryGateOut', {
        gateInNumber: gateTx1.gateInNumber,
        factoryGateOutDateTime: facOutTime,
        factoryGateOutOperator: 'FactoryOfficer_Pranab',
        unloadingStatus: 'COMPLETED',
        unloadedQuantity: 22000.000,
        quantityUnit: 'KG',
        goodsInspected: true,
        sealVerified: true,
        remarks: 'Discharge completed into Tank T-02 without leakage'
    });

    const afterFacOut = await srv.tx({ user: factoryUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx1.ID }));
    assert.strictEqual(afterFacOut.status, 'FACTORY_OUT', 'Vehicle reached FACTORY_OUT');
    assert.strictEqual(afterFacOut.currentStage, 'FACTORY', 'Current stage is FACTORY');

    const updatedFacEntry1 = await srv.tx({ user: factoryUser }).run(
        SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: gateTx1.ID })
    );
    assert.strictEqual(updatedFacEntry1.unloadingStatus, 'COMPLETED');
    assert.strictEqual(Number(updatedFacEntry1.unloadedQuantity), 22000);
    assert.ok(updatedFacEntry1.factoryGateOutDateTime, 'Factory Gate OUT timestamp recorded');
    console.log(`[Step 5 PASS] Factory Gate OUT recorded: Status=${afterFacOut.status}, Unloaded=${updatedFacEntry1.unloadedQuantity} ${updatedFacEntry1.quantityUnit}`);

    // Verify Audit Trail
    const adminUser = new cds.User({ id: 'admin_user', roles: ['Admin', 'Auditor'] });
    const audits = await srv.tx({ user: adminUser }).run(
        SELECT.from(GateAuditLogs).where({ gateTransaction_ID: gateTx1.ID }).orderBy('actionDateTime asc')
    );
    const inAudit = audits.find(a => a.action === 'FACTORY_GATE_IN');
    const outAudit = audits.find(a => a.action === 'FACTORY_GATE_OUT');
    assert.ok(inAudit, 'Audit log for FACTORY_GATE_IN exists');
    assert.ok(outAudit, 'Audit log for FACTORY_GATE_OUT exists');
    console.log(`  -> IN Audit: "${inAudit.remarks}"`);
    console.log(`  -> OUT Audit: "${outAudit.remarks}"`);


    // =========================================================================
    // FLOW 2: DIRECT DELIVERY (SECURITY_IN -> FACTORY, WEIGHBRIDGE BYPASSED)
    // =========================================================================
    console.log('\n--- Flow 2: Direct Delivery (Weighbridge Bypassed) ---');

    const tx2 = srv.tx({ user: mainGateUser });
    await tx2.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-DIR-2002',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Ramesh Das'
    }));
    const gateTx2 = await tx2.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-DIR-2002' }));

    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: gateTx2.gateInNumber,
        driverLicenseNo: 'DL-AS-2021-555',
        securityPersonnel: 'Inspector Das',
        poNumber: 'PO-DIRECT-8899',
        invoiceNumber: 'INV-PKG-101',
        withoutPO: false
    });

    const afterSec2 = await srv.tx({ user: factoryUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx2.ID }));
    assert.strictEqual(afterSec2.status, 'SECURITY_IN');

    // Direct Factory Gate Operation using RecordFactoryOperation
    await srv.tx({ user: factoryUser }).send('RecordFactoryOperation', {
        gateInNumber: gateTx2.gateInNumber,
        factoryGateInDateTime: new Date('2026-09-14T13:00:00.000Z'),
        factoryGateInOperator: 'Officer_Store',
        factoryGateOutDateTime: new Date('2026-09-14T14:15:00.000Z'),
        factoryGateOutOperator: 'Officer_Store',
        factoryArea: 'Central Warehouse / Stores',
        unloadingPoint: 'Bay 4 (Packaging Materials)',
        materialDescription: 'Packing Drums & HDPE Carboys',
        unloadingStatus: 'COMPLETED',
        unloadedQuantity: 500.000,
        quantityUnit: 'NOS',
        remarks: 'Packing materials delivered directly to store warehouse'
    });

    const afterDirectFac = await srv.tx({ user: factoryUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx2.ID }));
    assert.strictEqual(afterDirectFac.status, 'FACTORY_OUT', 'Direct delivery transitioned directly to FACTORY_OUT');

    const directEntry = await srv.tx({ user: factoryUser }).run(
        SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: gateTx2.ID })
    );
    assert.strictEqual(directEntry.poNumber, 'PO-DIRECT-8899', 'Auto-collected PO from security');
    assert.strictEqual(directEntry.invoiceNumber, 'INV-PKG-101', 'Auto-collected Invoice from security');
    assert.strictEqual(directEntry.factoryArea, 'Central Warehouse / Stores');
    console.log(`[Flow 2 PASS] Direct Delivery completed: Status=${afterDirectFac.status}, PO=${directEntry.poNumber}, Inv=${directEntry.invoiceNumber}`);

    // =========================================================================
    // VALIDATIONS: PREVENT INVALID STAGE FACTORY GATE IN
    // =========================================================================
    console.log('\n--- Test 3: Validations & Stage Guards ---');

    // Vehicle still in GATE_IN (has not passed Security Gate)
    const tx3 = srv.tx({ user: mainGateUser });
    await tx3.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-ERR-3003',
        purpose: 'DELIVERY',
        driverName: 'Prem'
    }));
    const gateTx3 = await tx3.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-ERR-3003' }));

    let blocked = false;
    try {
        await srv.tx({ user: factoryUser }).send('FactoryGateIn', { gateInNumber: gateTx3.gateInNumber });
    } catch (e) {
        blocked = true;
        console.log(`[Validation PASS] Correctly blocked Factory Gate IN for GATE_IN vehicle: ${e.message}`);
    }
    assert.ok(blocked, 'Factory Gate IN must be rejected for vehicle that has not cleared Security Gate');

    console.log('\n================================================================');
    console.log(' ALL FACTORY GATE DELIVERY OPERATIONS TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
}

testFactoryGateOperations().catch(err => {
    console.error('Factory Gate Test Failed:', err);
    process.exit(1);
});
