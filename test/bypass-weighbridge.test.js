import cds from '@sap/cds';
import assert from 'node:assert';

async function testBypassWeighbridgeFlow() {
    console.log('================================================================');
    console.log(' SAP CAP GateService - Unweighed Vehicle & Direct Factory Flow');
    console.log('================================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const factoryUser = new cds.User({ id: 'factory_user', roles: ['FactoryGateUser'] });
    const adminUser = new cds.User({ id: 'admin_user', roles: ['Admin', 'Auditor'] });

    // =========================================================================
    // SCENARIO 1: DIRECT TO FACTORY GATE (BYPASSING INBOUND & OUTBOUND SCALE)
    // =========================================================================
    console.log('\n--- Scenario 1: Direct to Factory Gate (Weighbridge Bypassed) ---');

    // 1. Create Gate IN
    const tx1 = srv.tx({ user: mainGateUser });
    await tx1.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'DL-01-AB-1234',
        vehicleType: 'CONTAINER',
        purpose: 'DELIVERY',
        driverName: 'Rajesh Kumar'
    }));
    const rec1 = await tx1.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'DL-01-AB-1234' })
    );
    console.log(`[Step 1] Main Gate In created: ${rec1.gateInNumber}, Status=${rec1.status}`);
    assert.strictEqual(rec1.status, 'GATE_IN');

    // 2. Security Gate IN
    const secTx1 = srv.tx({ user: securityUser });
    await secTx1.send('SecurityGateIn', {
        gateInNumber: rec1.gateInNumber,
        driverLicenseNo: 'DL-9988776655',
        driverPhoneNo: '+91 9999888811',
        helperName: 'Ramesh',
        securityPersonnel: 'Inspector_Singh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        poNumber: 'PO-4500112233',
        invoiceNumber: 'INV-101',
        withoutPO: false,
        remarks: 'Physical security checks passed'
    });

    const txAfterSecIn = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec1.ID })
    );
    console.log(`[Step 2] Security Gate IN complete: Status=${txAfterSecIn.status}, Stage=${txAfterSecIn.currentStage}`);
    assert.strictEqual(txAfterSecIn.status, 'SECURITY_IN');
    assert.strictEqual(txAfterSecIn.currentStage, 'SECURITY_GATE_IN');

    // 3. Direct Factory Gate IN (Bypassing Weighbridge from SECURITY_IN)
    const facInTx = srv.tx({ user: factoryUser });
    await facInTx.send('FactoryGateIn', { gateInNumber: rec1.gateInNumber });

    const txAfterFacIn = await srv.tx({ user: factoryUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec1.ID })
    );
    console.log(`[Step 3] Direct Factory Gate IN recorded: Status=${txAfterFacIn.status}, Stage=${txAfterFacIn.currentStage}`);
    assert.strictEqual(txAfterFacIn.status, 'FACTORY_IN');
    assert.strictEqual(txAfterFacIn.currentStage, 'FACTORY');

    // Verify Audit Log records that weighbridge was bypassed
    const facInAudit = await srv.tx({ user: adminUser }).run(
        SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: rec1.ID,
            action: 'FACTORY_GATE_IN'
        })
    );
    assert.ok(facInAudit, 'Audit log for FACTORY_GATE_IN must exist');
    assert.ok(facInAudit.remarks.includes('Weighbridge bypassed'), 'Audit log notes weighbridge bypass');
    console.log(`  -> Audit Log confirmed: "${facInAudit.remarks}"`);

    // 4. Factory Gate OUT (Release from Factory)
    const facOutTx = srv.tx({ user: factoryUser });
    await facOutTx.send('FactoryGateOut', { gateInNumber: rec1.gateInNumber });

    const txAfterFacOut = await srv.tx({ user: factoryUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec1.ID })
    );
    console.log(`[Step 4] Factory Gate OUT recorded: Status=${txAfterFacOut.status}, Stage=${txAfterFacOut.currentStage}`);
    assert.strictEqual(txAfterFacOut.status, 'FACTORY_OUT');

    // 5. Security Gate OUT directly from FACTORY_OUT (Bypassing Outbound Weighbridge)
    const secOutTx1 = srv.tx({ user: securityUser });
    await secOutTx1.send('SecurityGateOut', {
        gateInNumber: rec1.gateInNumber,
        securityPersonnel: 'Inspector_Sharma',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        emptyInspectionVerified: true,
        deliveryDetailsVerified: true,
        remarks: 'Empty inspection verified, direct exit without outbound scale'
    });

    const txAfterSecOut = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec1.ID })
    );
    console.log(`[Step 5] Security Gate OUT authorized: Status=${txAfterSecOut.status}, Stage=${txAfterSecOut.currentStage}`);
    assert.strictEqual(txAfterSecOut.status, 'SECURITY_OUT');
    assert.strictEqual(txAfterSecOut.currentStage, 'SECURITY_GATE_OUT');

    // Verify consolidated security entry has both IN and OUT data
    const secEntry1 = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(SecurityGateEntries).where({ gateTransaction_ID: rec1.ID })
    );
    assert.strictEqual(secEntry1.securityPersonnel, 'Inspector_Singh');
    assert.strictEqual(secEntry1.securityOutPersonnel, 'Inspector_Sharma');
    assert.strictEqual(secEntry1.emptyInspectionVerified, true);
    console.log(`  -> Merged Security Entry verified with both Inbound and Outbound records!`);

    // 6. Main Gate Out
    const mainOutTx1 = srv.tx({ user: mainGateUser });
    await mainOutTx1.send('MainGateOut', { gateInNumber: rec1.gateInNumber });

    const txCompleted1 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec1.ID })
    );
    console.log(`[Step 6] Final Main Gate OUT completed: Status=${txCompleted1.status}`);
    assert.strictEqual(txCompleted1.status, 'COMPLETED');

    // =========================================================================
    // SCENARIO 2: DIRECT EXIT FROM SECURITY_IN (NO FACTORY / NO WEIGHBRIDGE)
    // =========================================================================
    console.log('\n--- Scenario 2: Direct Exit Authorization from SECURITY_IN ---');

    const tx2 = srv.tx({ user: mainGateUser });
    await tx2.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'KA-05-MM-5678',
        vehicleType: 'VAN',
        purpose: 'DELIVERY',
        driverName: 'Vikram Seth'
    }));
    const rec2 = await tx2.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'KA-05-MM-5678' })
    );

    const secTx2 = srv.tx({ user: securityUser });
    await secTx2.send('SecurityGateIn', {
        gateInNumber: rec2.gateInNumber,
        driverLicenseNo: 'KA05-2019-12345',
        securityPersonnel: 'Inspector_Verma',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        withoutPO: true,
        remarks: 'Sample delivery vehicle entered without PO'
    });

    // Authorize Security Gate OUT directly from SECURITY_IN
    const secOutTx2 = srv.tx({ user: securityUser });
    await secOutTx2.send('SecurityGateOut', {
        gateInNumber: rec2.gateInNumber,
        securityPersonnel: 'Inspector_Verma',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        remarks: 'Visitor visit concluded, direct exit cleared'
    });

    const txAfterSecOut2 = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec2.ID })
    );
    console.log(`Direct Exit from SECURITY_IN authorized: Status=${txAfterSecOut2.status}`);
    assert.strictEqual(txAfterSecOut2.status, 'SECURITY_OUT');

    const secOutAudit2 = await srv.tx({ user: adminUser }).run(
        SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: rec2.ID,
            action: 'SECURITY_GATE_OUT'
        })
    );
    assert.ok(secOutAudit2.remarks.includes('Direct Exit'), 'Audit log reflects direct exit');
    console.log(`  -> Audit Log confirmed: "${secOutAudit2.remarks}"`);

    // Complete Main Gate Out
    await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: rec2.gateInNumber });
    const txCompleted2 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: rec2.ID })
    );
    assert.strictEqual(txCompleted2.status, 'COMPLETED');
    console.log(`Final Main Gate OUT completed: Status=${txCompleted2.status}`);

    console.log('\n================================================================');
    console.log(' ALL UNWEIGHED & DIRECT-TO-FACTORY FLOW TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
}

testBypassWeighbridgeFlow().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
