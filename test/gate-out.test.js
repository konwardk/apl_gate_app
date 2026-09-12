import cds from '@sap/cds';
import assert from 'node:assert';

async function runGateOutTests() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Gate OUT Operations Test Suite');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });

    // ----------------------------------------------------
    // TEST 1: Gate OUT for direct General Cargo / Truck (Status: GATE_IN)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Gate OUT for direct GATE_IN vehicle (Main Gate Entry & Exit)');
    const tx1 = srv.tx({ user: mainGateUser });
    const entry1 = {
        vehicleRegNo: 'DL-01-GC-1122',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Harpreet Singh',
        remarks: 'General cargo direct delivery'
    };
    await tx1.run(INSERT.into(GateTransactions).entries(entry1));
    const created1 = await tx1.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'DL-01-GC-1122' }));
    assert.strictEqual(created1.status, 'GATE_IN');
    console.log(`  -> Created Gate IN: ${created1.gateInNumber} (Status: ${created1.status})`);

    const outRes1 = await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: created1.gateInNumber });
    assert.strictEqual(outRes1.status, 'COMPLETED');
    assert.strictEqual(outRes1.currentStage, 'COMPLETED');
    assert.ok(outRes1.gateOutDateTime, 'gateOutDateTime must be populated');
    assert.strictEqual(outRes1.gateOutOperator, 'maingate_user');
    console.log(`  [PASS] Gate OUT succeeded for GATE_IN vehicle. Status: ${outRes1.status}, Exit Time: ${outRes1.gateOutDateTime}`);

    // Verify Audit Log for Test 1
    const audit1 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateAuditLogs).where({ gateTransaction_ID: created1.ID, action: 'MAIN_GATE_OUT' })
    );
    assert.ok(audit1, 'Audit log for MAIN_GATE_OUT must exist');
    assert.strictEqual(audit1.oldStatus, 'GATE_IN');
    assert.strictEqual(audit1.newStatus, 'COMPLETED');
    assert.strictEqual(audit1.oldStage, 'MAIN_GATE_IN');
    assert.strictEqual(audit1.newStage, 'COMPLETED');
    console.log(`  [PASS] Audit log verified: oldStatus=${audit1.oldStatus}, newStatus=${audit1.newStatus}, action=${audit1.action}`);

    // ----------------------------------------------------
    // TEST 2: Gate OUT for standard vehicle completing security clearance (Status: SECURITY_OUT)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Gate OUT for vehicle with SECURITY_OUT status');
    const tx2 = srv.tx({ user: mainGateUser });
    const entry2 = {
        vehicleRegNo: 'KA-04-SO-3344',
        vehicleType: 'CONTAINER',
        purpose: 'DELIVERY',
        driverName: 'Anil Kumar'
    };
    await tx2.run(INSERT.into(GateTransactions).entries(entry2));
    const created2 = await tx2.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'KA-04-SO-3344' }));
    
    // Simulate progression to SECURITY_OUT
    await srv.tx({ user: mainGateUser }).run(
        UPDATE(GateTransactions)
            .set({ status: 'SECURITY_OUT', currentStage: 'SECURITY_GATE_OUT' })
            .where({ ID: created2.ID })
    );

    const outRes2 = await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: created2.gateInNumber });
    assert.strictEqual(outRes2.status, 'COMPLETED');
    assert.strictEqual(outRes2.currentStage, 'COMPLETED');
    assert.ok(outRes2.gateOutDateTime);
    console.log(`  [PASS] Gate OUT succeeded for SECURITY_OUT vehicle. Status: ${outRes2.status}`);

    const audit2 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateAuditLogs).where({ gateTransaction_ID: created2.ID, action: 'MAIN_GATE_OUT' })
    );
    assert.strictEqual(audit2.oldStatus, 'SECURITY_OUT');
    assert.strictEqual(audit2.newStatus, 'COMPLETED');
    assert.strictEqual(audit2.oldStage, 'SECURITY_GATE_OUT');
    console.log(`  [PASS] Audit log verified: oldStatus=${audit2.oldStatus}, newStatus=${audit2.newStatus}`);

    // ----------------------------------------------------
    // TEST 3: Block Gate OUT on already COMPLETED vehicle
    // ----------------------------------------------------
    console.log('\n[TEST 3] Block duplicate Gate OUT on already COMPLETED vehicle');
    try {
        await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: created1.gateInNumber });
        assert.fail('Should have failed because transaction is already COMPLETED');
    } catch (err) {
        console.log(`  [PASS] Correctly blocked duplicate Gate OUT: ${err.message}`);
        assert.ok(err.message.includes('already completed'));
    }

    // ----------------------------------------------------
    // TEST 4: Block Gate OUT on CANCELLED vehicle
    // ----------------------------------------------------
    console.log('\n[TEST 4] Block Gate OUT on CANCELLED vehicle');
    const tx4 = srv.tx({ user: mainGateUser });
    await tx4.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'MH-02-CX-5566',
        vehicleType: 'TRUCK',
        purpose: 'PICKUP',
        driverName: 'Sanjay Dutt'
    }));
    const created4 = await tx4.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'MH-02-CX-5566' }));
    await srv.tx({ user: mainGateUser }).run(
        UPDATE(GateTransactions)
            .set({ status: 'CANCELLED', currentStage: 'COMPLETED' })
            .where({ ID: created4.ID })
    );

    try {
        await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: created4.gateInNumber });
        assert.fail('Should have failed because transaction is CANCELLED');
    } catch (err) {
        console.log(`  [PASS] Correctly blocked Gate OUT on CANCELLED vehicle: ${err.message}`);
        assert.ok(err.message.includes('cancelled'));
    }

    // ----------------------------------------------------
    // TEST 5: Block Gate OUT with non-existent or empty gate pass
    // ----------------------------------------------------
    console.log('\n[TEST 5] Rejection for non-existent and empty Gate Pass');
    try {
        await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: '' });
        assert.fail('Should have failed for empty gateInNumber');
    } catch (err) {
        console.log(`  [PASS] Correctly rejected empty gateInNumber: ${err.message}`);
        assert.ok(err.message.includes('mandatory'));
    }

    try {
        await srv.tx({ user: mainGateUser }).send('MainGateOut', { gateInNumber: 'GI-9999-NOTFOUND' });
        assert.fail('Should have failed for non-existent gateInNumber');
    } catch (err) {
        console.log(`  [PASS] Correctly rejected non-existent gateInNumber: ${err.message}`);
        assert.ok(err.message.includes('does not exist'));
    }

    console.log('\n========================================================');
    console.log(' ALL 5 GATE OUT TESTS PASSED!');
    console.log('========================================================\n');
}

runGateOutTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
