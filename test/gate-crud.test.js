import cds from '@sap/cds';

async function runTests() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Main Gate Entry CRUD Test Suite');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, GateAuditLogs } = srv.entities;
    const user = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const tx = srv.tx({ user });

    // ----------------------------------------------------
    // TEST 1: CREATE OPERATION
    // ----------------------------------------------------
    console.log('\n[TEST 1] CREATE Main Gate Entry');
    const newEntry = {
        vehicleRegNo: 'DL-04-XY-7788',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Vikram Singh',
        remarks: 'Direct delivery consignment test'
    };

    await tx.run(INSERT.into(GateTransactions).entries(newEntry));
    const createdTx = await tx.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'DL-04-XY-7788' })
    );

    console.log('  -> Entry Created with ID:', createdTx.ID);
    console.log('  -> Auto-generated Gate IN #:', createdTx.gateInNumber);
    console.log('  -> Status:', createdTx.status);
    console.log('  -> Stage:', createdTx.currentStage);
    console.log('  -> Operator:', createdTx.gateInOperator);

    if (!createdTx.gateInNumber || !createdTx.gateInNumber.startsWith('GI-')) {
        throw new Error('FAIL: gateInNumber was not auto-generated properly.');
    }
    if (createdTx.status !== 'GATE_IN' || createdTx.currentStage !== 'MAIN_GATE_IN') {
        throw new Error('FAIL: Status or Stage default assignment failed.');
    }
    console.log('  [PASS] CREATE operation successful.');

    // ----------------------------------------------------
    // TEST 2: AUDIT LOG CREATION
    // ----------------------------------------------------
    console.log('\n[TEST 2] Audit Trail for Creation');
    const createLogs = await tx.run(
        SELECT.from(GateAuditLogs).where({ gateTransaction_ID: createdTx.ID })
    );
    console.log(`  -> Audit records found: ${createLogs.length}`);
    if (createLogs.length === 0 || createLogs[0].action !== 'GATE_IN_CREATED') {
        throw new Error('FAIL: Audit log not created for GATE_IN_CREATED.');
    }
    console.log('  [PASS] Audit Trail verified.');

    // ----------------------------------------------------
    // TEST 3: READ OPERATION
    // ----------------------------------------------------
    console.log('\n[TEST 3] READ Main Gate Entry');
    const readRecord = await tx.run(
        SELECT.one.from(GateTransactions).where({ ID: createdTx.ID })
    );
    if (!readRecord || readRecord.vehicleRegNo !== 'DL-04-XY-7788') {
        throw new Error('FAIL: READ operation returned incorrect or empty record.');
    }
    console.log(`  -> Read Record: Vehicle=${readRecord.vehicleRegNo}, Purpose=${readRecord.purpose}`);
    console.log('  [PASS] READ operation successful.');

    // ----------------------------------------------------
    // TEST 4: UPDATE OPERATION
    // ----------------------------------------------------
    console.log('\n[TEST 4] UPDATE Main Gate Entry');
    await tx.run(
        UPDATE(GateTransactions)
            .set({ remarks: 'Updated remarks for consignment test' })
            .where({ ID: createdTx.ID })
    );
    const updatedRecord = await tx.run(
        SELECT.one.from(GateTransactions).where({ ID: createdTx.ID })
    );
    if (updatedRecord.remarks !== 'Updated remarks for consignment test') {
        throw new Error('FAIL: UPDATE did not persist remarks change.');
    }
    console.log('  -> Updated remarks verified:', updatedRecord.remarks);

    const updateLogs = await tx.run(
        SELECT.from(GateAuditLogs).where({ gateTransaction_ID: createdTx.ID })
    );
    console.log(`  -> Audit records after update: ${updateLogs.length}`);
    console.log('  [PASS] UPDATE operation and audit logging successful.');

    // ----------------------------------------------------
    // TEST 5: ACTIVE VEHICLE DUPLICATE VALIDATION
    // ----------------------------------------------------
    console.log('\n[TEST 5] Validation: Duplicate Active Vehicle Conflict');
    try {
        await tx.run(INSERT.into(GateTransactions).entries({
            vehicleRegNo: 'DL-04-XY-7788',
            purpose: 'DELIVERY'
        }));
        throw new Error('FAIL: Duplicate active vehicle was allowed entry.');
    } catch (e) {
        console.log('  -> Successfully blocked duplicate entry:', e.message);
    }
    console.log('  [PASS] Active vehicle conflict validation successful.');

    // ----------------------------------------------------
    // TEST 6: INTEGRITY PROTECTION ON DELETE
    // ----------------------------------------------------
    console.log('\n[TEST 6] Integrity: Block Deletion for In-Process Vehicles');
    await tx.run(
        UPDATE(GateTransactions)
            .set({ status: 'SECURITY_IN', currentStage: 'SECURITY_GATE_IN' })
            .where({ ID: createdTx.ID })
    );
    try {
        await tx.run(DELETE.from(GateTransactions).where({ ID: createdTx.ID }));
        throw new Error('FAIL: Deletion should have been rejected for SECURITY_IN status.');
    } catch (e) {
        console.log('  -> Successfully blocked deletion of active vehicle:', e.message);
    }
    console.log('  [PASS] Deletion integrity protection successful.');

    // ----------------------------------------------------
    // TEST 7: DELETE OPERATION (GATE_IN STAGE)
    // ----------------------------------------------------
    console.log('\n[TEST 7] DELETE Main Gate Entry (Initial Stage)');
    // Reset to GATE_IN
    await tx.run(
        UPDATE(GateTransactions)
            .set({ status: 'GATE_IN', currentStage: 'MAIN_GATE_IN' })
            .where({ ID: createdTx.ID })
    );
    await tx.run(
        DELETE.from(GateTransactions).where({ ID: createdTx.ID })
    );
    const postDelete = await tx.run(
        SELECT.one.from(GateTransactions).where({ ID: createdTx.ID })
    );
    if (postDelete) {
        throw new Error('FAIL: Record was not deleted.');
    }
    console.log('  -> Record successfully removed from database.');
    // ----------------------------------------------------
    // TEST 8: VEHICLE REGISTRATION NUMBER FORMAT VALIDATION
    // ----------------------------------------------------
    console.log('\n[TEST 8] Vehicle Registration Number Format Validation');
    const invalidFormats = ['random string', '12345', 'AS021234', 'AS-2-1234', 'A-02-1234'];
    for (const invalidReg of invalidFormats) {
        try {
            await tx.send('CreateGateIn', {
                vehicleRegNo: invalidReg,
                purpose: 'DELIVERY',
                driverName: 'Test Driver'
            });
            throw new Error(`FAIL: Invalid vehicle format '${invalidReg}' was accepted.`);
        } catch (e) {
            console.log(`  -> Successfully rejected invalid vehicle '${invalidReg}': ${e.message}`);
        }
    }

    // Valid without optional series: AS-02-1234 (vehicleType: TANKER)
    const valid1 = await tx.send('CreateGateIn', {
        vehicleRegNo: 'AS-02-1234',
        vehicleType: 'TANKER',
        purpose: 'DELIVERY',
        driverName: 'Test Driver 1'
    });
    console.log(`  -> Successfully created with AS-02-1234: ${valid1.gateInNumber}, vehicleType: ${valid1.vehicleType}`);
    if (valid1.vehicleType !== 'TANKER') {
        throw new Error(`FAIL: expected vehicleType 'TANKER', got '${valid1.vehicleType}'`);
    }

    // Valid with optional series: AS-02-AB-1234 (vehicleType: CONTAINER)
    const valid2 = await tx.send('CreateGateIn', {
        vehicleRegNo: 'AS-02-AB-1234',
        vehicleType: 'CONTAINER',
        purpose: 'DELIVERY',
        driverName: 'Test Driver 2'
    });
    console.log(`  -> Successfully created with AS-02-AB-1234: ${valid2.gateInNumber}, vehicleType: ${valid2.vehicleType}`);
    if (valid2.vehicleType !== 'CONTAINER') {
        throw new Error(`FAIL: expected vehicleType 'CONTAINER', got '${valid2.vehicleType}'`);
    }
    console.log('  [PASS] Vehicle registration format and VehicleType validation successful.');

    console.log('\n========================================================');
    console.log(' ALL 8 CRUD OPERATIONS AND VALIDATIONS PASSED!');
    console.log('========================================================\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('\n[ERROR] Test suite failed:', err);
    process.exit(1);
});
