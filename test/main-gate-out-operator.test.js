import cds from '@sap/cds';
import assert from 'node:assert';

async function testMainGateOutOperator() {
    console.log('================================================================');
    console.log(' SAP CAP GateService - Main Gate Out Operator Persistence Test');
    console.log('================================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser', 'Admin'] });

    // Step 1: Create transaction ready for Main Gate OUT
    const tx = srv.tx({ user: mainGateUser });
    await tx.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-MG-5566',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Suresh Das',
        gateInOperator: 'Officer_Inbound',
        status: 'SECURITY_OUT',
        currentStage: 'SECURITY_GATE_OUT'
    }));

    const created = await tx.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-MG-5566' }));
    assert.ok(created, 'Transaction created');
    assert.strictEqual(created.gateInOperator, 'Officer_Inbound');
    assert.strictEqual(created.gateOutOperator, null);

    // Step 2: Authorize Main Gate OUT with custom Operator Name
    const sOutOperator = 'Inspector_Baruah_Exit';
    const outResult = await srv.tx({ user: mainGateUser }).send('MainGateOut', {
        gateInNumber: created.gateInNumber,
        gateOutOperator: sOutOperator
    });

    assert.strictEqual(outResult.status, 'COMPLETED');
    assert.strictEqual(outResult.currentStage, 'COMPLETED');
    assert.strictEqual(outResult.gateOutOperator, sOutOperator, 'MainGateOut action response must return assigned gateOutOperator');
    console.log(`[PASS 1] MainGateOut returned gateOutOperator='${outResult.gateOutOperator}'`);

    // Step 3: Verify directly from DB
    const dbRow = await srv.tx({ user: mainGateUser }).run(SELECT.one.from(GateTransactions).where({ ID: created.ID }));
    assert.strictEqual(dbRow.gateOutOperator, sOutOperator, 'Database GateTransactions record must store gateOutOperator');
    console.log(`[PASS 2] DB row verified: gateOutOperator='${dbRow.gateOutOperator}', status='${dbRow.status}'`);

    // Step 4: Verify Audit Log has MAIN_GATE_OUT with the operator
    const logs = await srv.tx({ user: mainGateUser }).run(SELECT.from(GateAuditLogs).where({ gateTransaction_ID: created.ID }));
    const outLog = logs.find(l => l.action === 'MAIN_GATE_OUT');
    assert.ok(outLog, 'MAIN_GATE_OUT audit log exists');
    assert.strictEqual(outLog.userName, sOutOperator, 'Audit log userName matches gateOutOperator');
    console.log(`[PASS 3] Audit log verified: action='${outLog.action}', userName='${outLog.userName}'`);

    // Step 5: Test PATCH / UPDATE GateTransactions retains or updates gateOutOperator
    await srv.tx({ user: mainGateUser }).run(
        UPDATE(GateTransactions)
            .set({ gateOutOperator: 'Supervisor_Updated_Exit', remarks: 'Gate exit validated' })
            .where({ ID: created.ID })
    );

    const updatedRow = await srv.tx({ user: mainGateUser }).run(SELECT.one.from(GateTransactions).where({ ID: created.ID }));
    assert.strictEqual(updatedRow.gateOutOperator, 'Supervisor_Updated_Exit', 'PATCH / UPDATE must successfully update gateOutOperator');
    console.log(`[PASS 4] Updated row verified: gateOutOperator='${updatedRow.gateOutOperator}'`);

    console.log('================================================================');
    console.log(' ALL MAIN GATE OUT OPERATOR PERSISTENCE TESTS PASSED!');
    console.log('================================================================\n');
}

testMainGateOutOperator().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
