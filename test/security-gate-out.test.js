import cds from '@sap/cds';
import assert from 'node:assert';

async function testSecurityGateOut() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Consolidated Security Entity & OUT Test');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const weighbridgeUser = new cds.User({ id: 'weighbridge_user', roles: ['WeighbridgeUser'] });

    // Step 1: Create a fresh delivery gate entry
    const mainTx = srv.tx({ user: mainGateUser });
    const newEntry = {
        vehicleRegNo: 'MH-04-JK-9999',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Sanjay Dutt'
    };
    await mainTx.run(INSERT.into(GateTransactions).entries(newEntry));
    const createdTx = await mainTx.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'MH-04-JK-9999' })
    );
    console.log(`[SETUP] Created Delivery Gate Entry: ${createdTx.gateInNumber} (ID: ${createdTx.ID})`);
    assert.strictEqual(createdTx.status, 'GATE_IN');

    // Step 2: Perform Security Gate IN
    const secInTx = srv.tx({ user: securityUser });
    await secInTx.send('SecurityGateIn', {
        gateInNumber: createdTx.gateInNumber,
        driverLicenseNo: 'MH04-2020-007788',
        driverPhoneNo: '+91 9820011223',
        helperName: 'Bablu',
        securityPersonnel: 'SecurityOfficer_IN',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        poNumber: 'PO-4500998877',
        invoiceNumber: 'INV-2026-888',
        invoiceDate: '2026-09-14',
        withoutPO: false,
        remarks: 'Inbound physical seal and docs checked'
    });

    const secEntriesIn = await srv.tx({ user: securityUser }).run(
        SELECT.from(SecurityGateEntries).where({ gateInNumber: createdTx.gateInNumber })
    );
    assert.strictEqual(secEntriesIn.length, 1, 'Exactly one SecurityGateEntries record should exist after Gate IN');
    const consolidatedId = secEntriesIn[0].ID;
    console.log(`[TEST 1 PASS] Security Gate IN created consolidated record: ID=${consolidatedId}`);
    assert.strictEqual(secEntriesIn[0].securityPersonnel, 'SecurityOfficer_IN');
    assert.strictEqual(secEntriesIn[0].securityOutDateTime, null);

    // Step 3: Weighbridge IN and OUT
    const wbTx1 = srv.tx({ user: weighbridgeUser });
    await wbTx1.send('RecordWeighment', {
        gateInNumber: createdTx.gateInNumber,
        weight: 35000.00,
        weightUnit: 'KG',
        weighbridgeNumber: 'WB-01',
        weighmentType: 'GROSS_IN',
        operator: 'weighbridge_user'
    });

    // Simulate factory completion -> status: FACTORY_OUT
    await UPDATE(GateTransactions).set({
        status: 'FACTORY_OUT',
        currentStage: 'FACTORY'
    }).where({ ID: createdTx.ID });

    const wbTx2 = srv.tx({ user: weighbridgeUser });
    await wbTx2.send('RecordWeighment', {
        gateInNumber: createdTx.gateInNumber,
        weight: 12000.00,
        weightUnit: 'KG',
        weighbridgeNumber: 'WB-01',
        weighmentType: 'TARE_OUT',
        operator: 'weighbridge_user'
    });

    const txWbOut = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(GateTransactions).where({ gateInNumber: createdTx.gateInNumber })
    );
    assert.strictEqual(txWbOut.status, 'WEIGHBRIDGE_OUT');
    console.log(`[TEST 2 PASS] Inbound & Outbound weighments complete. Status: ${txWbOut.status}`);

    // Step 4: Perform Security Gate OUT
    const secOutTx = srv.tx({ user: securityUser });
    await secOutTx.send('SecurityGateOut', {
        gateInNumber: createdTx.gateInNumber,
        securityPersonnel: 'SecurityOfficer_OUT',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        deliveryDetailsVerified: true,
        emptyInspectionVerified: true,
        materialInspected: true,
        remarks: 'Outbound empty truck bed inspected and cleared'
    });

    // Step 5: Verify that the SAME record in SecurityGateEntries now contains BOTH IN and OUT fields
    const secEntriesOut = await srv.tx({ user: securityUser }).run(
        SELECT.from(SecurityGateEntries).where({ gateInNumber: createdTx.gateInNumber })
    );
    assert.strictEqual(secEntriesOut.length, 1, 'Still exactly ONE record exists in SecurityGateEntries');
    assert.strictEqual(secEntriesOut[0].ID, consolidatedId, 'Record ID must remain identical (single consolidated record)');

    const consolidated = secEntriesOut[0];
    assert.strictEqual(consolidated.driverLicenseNo, 'MH04-2020-007788', 'Inbound license preserved');
    assert.strictEqual(consolidated.securityPersonnel, 'SecurityOfficer_IN', 'Inbound officer preserved');
    assert.strictEqual(consolidated.poNumber, 'PO-4500998877', 'Inbound PO preserved');
    assert.strictEqual(consolidated.securityOutPersonnel, 'SecurityOfficer_OUT', 'Outbound officer updated');
    assert.ok(consolidated.securityOutDateTime, 'Outbound timestamp populated');
    assert.strictEqual(consolidated.emptyInspectionVerified, true, 'Empty inspection flag populated');
    assert.strictEqual(consolidated.deliveryDetailsVerified, true, 'Delivery details verified flag populated');
    assert.strictEqual(consolidated.securityOutRemarks, 'Outbound empty truck bed inspected and cleared');

    console.log(`[TEST 3 PASS] Single consolidated entity verified:`);
    console.log(`  -> ID: ${consolidated.ID}`);
    console.log(`  -> IN: ${consolidated.securityInDateTime} by ${consolidated.securityPersonnel}`);
    console.log(`  -> OUT: ${consolidated.securityOutDateTime} by ${consolidated.securityOutPersonnel}`);
    console.log(`  -> Flags: EmptyVerified=${consolidated.emptyInspectionVerified}, DeliveryVerified=${consolidated.deliveryDetailsVerified}`);

    // Step 6: Verify GateTransactions status
    const txFinal = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(GateTransactions).where({ gateInNumber: createdTx.gateInNumber })
    );
    assert.strictEqual(txFinal.status, 'SECURITY_OUT');
    assert.strictEqual(txFinal.currentStage, 'SECURITY_GATE_OUT');
    console.log(`[TEST 4 PASS] Gate Transaction status transitioned to: ${txFinal.status} (${txFinal.currentStage})`);

    console.log('========================================================');
    console.log(' ALL SECURITY GATE OUT TESTS PASSED! MERGED ENTITY VERIFIED!');
    console.log('========================================================\n');
}

testSecurityGateOut().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
