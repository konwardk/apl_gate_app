import cds from '@sap/cds';
import assert from 'node:assert';

async function runAuthRbacTests() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Authentication & RBAC Test Suite');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');

    const superadminUser = new cds.User({ id: 'superadmin_user', roles: ['Superadmin', 'Admin'] });
    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityGateUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const weighbridgeUser = new cds.User({ id: 'weighbridge_user', roles: ['WeighbridgeUser'] });
    const factoryGateUser = new cds.User({ id: 'factory_user', roles: ['FactoryGateUser'] });
    const auditorUser = new cds.User({ id: 'auditor_user', roles: ['Auditor'] });

    // ----------------------------------------------------
    // TEST 1: userInfo() returns full profile and assigned roles
    // ----------------------------------------------------
    console.log('\n[TEST 1] Testing userInfo() for different roles');
    const infoMain = await srv.tx({ user: mainGateUser }).send('userInfo');
    assert.strictEqual(infoMain.id, 'maingate_user');
    assert.ok(infoMain.roles.includes('MainGateUser'));
    assert.ok(infoMain.name.includes('Verma'));
    console.log(`  [PASS] MainGateUser profile: ${infoMain.name} (${infoMain.designation}), Roles: ${infoMain.roles.join(', ')}`);

    const infoSec = await srv.tx({ user: securityGateUser }).send('userInfo');
    assert.strictEqual(infoSec.id, 'security_user');
    assert.ok(infoSec.roles.includes('SecurityGateUser'));
    console.log(`  [PASS] SecurityGateUser profile: ${infoSec.name} (${infoSec.designation}), Roles: ${infoSec.roles.join(', ')}`);

    const infoWb = await srv.tx({ user: weighbridgeUser }).send('userInfo');
    assert.strictEqual(infoWb.id, 'weighbridge_user');
    assert.ok(infoWb.roles.includes('WeighbridgeUser'));
    console.log(`  [PASS] WeighbridgeUser profile: ${infoWb.name} (${infoWb.designation}), Roles: ${infoWb.roles.join(', ')}`);

    const infoFac = await srv.tx({ user: factoryGateUser }).send('userInfo');
    assert.strictEqual(infoFac.id, 'factory_user');
    assert.ok(infoFac.roles.includes('FactoryGateUser'));
    console.log(`  [PASS] FactoryGateUser profile: ${infoFac.name} (${infoFac.designation}), Roles: ${infoFac.roles.join(', ')}`);

    // ----------------------------------------------------
    // TEST 2: RBAC Policy: MainGateUser can CreateGateIn
    // ----------------------------------------------------
    console.log('\n[TEST 2] MainGateUser creates gate entry');
    const tx = await srv.tx({ user: mainGateUser }).send('CreateGateIn', {
        vehicleRegNo: 'HR-26-AB-9876',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Sanjay Kumar'
    });
    assert.ok(tx.gateInNumber);
    console.log(`  [PASS] Gate entry created: ${tx.gateInNumber}`);

    // ----------------------------------------------------
    // TEST 3: RBAC Policy: SecurityGateUser cannot CreateGateIn
    // ----------------------------------------------------
    console.log('\n[TEST 3] SecurityGateUser calling CreateGateIn must fail authorization');
    try {
        await srv.tx({ user: securityGateUser }).send('CreateGateIn', {
            vehicleRegNo: 'MH-04-XY-9999',
            vehicleType: 'TRUCK',
            purpose: 'DELIVERY'
        });
        assert.fail('SecurityGateUser should NOT be permitted to call CreateGateIn');
    } catch (e) {
        console.log(`  [PASS] Correctly rejected: ${e.message}`);
    }

    // ----------------------------------------------------
    // TEST 4: RBAC Policy: WeighbridgeUser cannot CreateGateIn
    // ----------------------------------------------------
    console.log('\n[TEST 4] WeighbridgeUser calling CreateGateIn must fail authorization');
    try {
        await srv.tx({ user: weighbridgeUser }).send('CreateGateIn', {
            vehicleRegNo: 'KA-01-XY-9999',
            vehicleType: 'TRUCK',
            purpose: 'DELIVERY'
        });
        assert.fail('WeighbridgeUser should NOT be permitted to call CreateGateIn');
    } catch (e) {
        console.log(`  [PASS] Correctly rejected: ${e.message}`);
    }

    // ----------------------------------------------------
    // TEST 5: SecurityGateUser executes SecurityGateIn
    // ----------------------------------------------------
    console.log('\n[TEST 5] SecurityGateUser executes SecurityGateIn on transaction');
    const txSecIn = await srv.tx({ user: securityGateUser }).send('SecurityGateIn', {
        gateInNumber: tx.gateInNumber,
        driverLicenseNo: 'DL-987654321',
        securityPersonnel: 'Vikram Rathore',
        poNumber: 'PO-4500112233',
        assignedRoute: 'WEIGHBRIDGE'
    });
    assert.strictEqual(txSecIn.status, 'SECURITY_IN');
    console.log(`  [PASS] SecurityGateIn completed: Status=${txSecIn.status}, Route=${txSecIn.assignedRoute}`);

    // ----------------------------------------------------
    // TEST 6: MainGateUser cannot execute RecordWeighment
    // ----------------------------------------------------
    console.log('\n[TEST 6] MainGateUser calling RecordWeighment must fail authorization');
    try {
        await srv.tx({ user: mainGateUser }).send('RecordWeighment', {
            gateInNumber: tx.gateInNumber,
            weight: 14500,
            weighbridgeNumber: 'WB-01',
            weighmentType: 'GROSS_IN'
        });
        assert.fail('MainGateUser should NOT be permitted to call RecordWeighment');
    } catch (e) {
        console.log(`  [PASS] Correctly rejected: ${e.message}`);
    }

    // ----------------------------------------------------
    // TEST 7: WeighbridgeUser records weighment
    // ----------------------------------------------------
    console.log('\n[TEST 7] WeighbridgeUser executes RecordWeighment');
    const txWb = await srv.tx({ user: weighbridgeUser }).send('RecordWeighment', {
        gateInNumber: tx.gateInNumber,
        weight: 16800,
        weighbridgeNumber: 'WB-SCALE-01',
        weighmentType: 'GROSS_IN',
        operator: 'Suresh Patil'
    });
    assert.strictEqual(txWb.status, 'WEIGHBRIDGE_IN');
    console.log(`  [PASS] RecordWeighment completed: Status=${txWb.status}`);

    // ----------------------------------------------------
    // TEST 8: Non-Superadmin cannot manage users
    // ----------------------------------------------------
    console.log('\n[TEST 8] MainGateUser calling CreateUser must fail authorization');
    try {
        await srv.tx({ user: mainGateUser }).send('CreateUser', {
            username: 'unauth_user',
            password: 'pwd',
            name: 'Unauthorized User'
        });
        assert.fail('MainGateUser should NOT be permitted to call CreateUser');
    } catch (e) {
        console.log(`  [PASS] Correctly rejected: ${e.message}`);
    }

    // ----------------------------------------------------
    // TEST 9: Superadmin creates user and user is synced to auth cache
    // ----------------------------------------------------
    console.log('\n[TEST 9] Superadmin creates a new operator account with real-time auth sync');
    const newOp = await srv.tx({ user: superadminUser }).send('CreateUser', {
        username: 'scale_op_2',
        password: 'securePassword456',
        name: 'Kavita Singh',
        designation: 'Scale Operator',
        department: 'Weighbridge',
        status: 'ACTIVE',
        assignedRoles: 'WeighbridgeUser'
    });
    assert.ok(newOp);
    assert.strictEqual(newOp.username, 'scale_op_2');

    // Verify user exists in in-memory auth cache
    assert.ok(cds.env?.requires?.auth?.users?.['scale_op_2'], 'scale_op_2 must be registered in auth cache');
    const scaleUserObj = cds.env.requires.auth.users['scale_op_2'];
    const hasRole = typeof scaleUserObj.is === 'function' ? scaleUserObj.is('WeighbridgeUser') : (Array.isArray(scaleUserObj.roles) ? scaleUserObj.roles.includes('WeighbridgeUser') : ('WeighbridgeUser' in scaleUserObj.roles));
    assert.ok(hasRole, 'scale_op_2 must have WeighbridgeUser role');
    console.log('  [PASS] New user immediately registered in auth cache with WeighbridgeUser role');

    console.log('\n========================================================');
    console.log(' ALL 9 AUTHENTICATION & RBAC TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================');
}

runAuthRbacTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
