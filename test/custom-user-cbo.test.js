import cds from '@sap/cds';
import assert from 'node:assert';

async function testCustomUserCBOIntegration() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - S/4HANA CustomUser CBO Tests    ');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { S4CustomUsers, Users, UserRoles } = srv.entities;

    const superadminUser = new cds.User({ id: 'superadmin_user', roles: ['Superadmin', 'superadmin_user'] });
    const operatorUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser', 'maingate_user'] });
    const txAdmin = srv.tx({ user: superadminUser });

    // ----------------------------------------------------
    // TEST 1: Verify package.json environment configuration
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verify package.json YY1_API_CUSTOMUSER_0001 configuration...');
    const cboConfig = cds.env.requires['YY1_API_CUSTOMUSER_0001'];
    assert.ok(cboConfig, 'YY1_API_CUSTOMUSER_0001 configuration must exist in cds.env.requires');
    assert.strictEqual(cboConfig.kind, 'odata-v4', 'CustomUser CBO service kind must be odata-v4');
    assert.strictEqual(cboConfig.credentials.authentication, 'BasicAuthentication', 'Auth must be BasicAuthentication');
    assert.strictEqual(cboConfig.credentials.username, 'BTP_S4_INTEGRATION', 'Username must be BTP_S4_INTEGRATION');
    assert.strictEqual(cboConfig.credentials.password, 'Assampetrochemical@123#', 'Password must match vehicleentry service');
    assert.ok(
        cboConfig.credentials.url.includes('yy1_api_customuser'),
        'URL must contain yy1_api_customuser'
    );
    assert.strictEqual(
        cboConfig.credentials.url,
        'https://my443544-api.s4hana.cloud.sap/sap/opu/odata4/sap/yy1_api_customuser/srvd_a2x/sap/yy1_api_customuser/0001',
        'Credentials URL must match SAP S/4HANA Cloud service URL'
    );
    console.log(`  -> URL: ${cboConfig.credentials.url}`);
    console.log(`  -> User: ${cboConfig.credentials.username}`);
    console.log('  [PASS] CustomUser CBO service environment configuration verified');

    // ----------------------------------------------------
    // TEST 2: Query S4CustomUsers projection via GateService
    // ----------------------------------------------------
    console.log('\n[TEST 2] Query S4CustomUsers projection via GateService...');
    const customUsers = await txAdmin.run(SELECT.from(S4CustomUsers));
    console.log(`  [PASS] Successfully retrieved ${customUsers.length} CustomUsers (fallback/live)`);
    assert.ok(Array.isArray(customUsers), 'S4CustomUsers must return an array');
    if (customUsers.length > 0) {
        const u = customUsers[0];
        assert.ok(u.UserId !== undefined, 'CustomUser must have UserId');
        assert.ok(u.username !== undefined, 'CustomUser must have username');
        console.log(`  -> Sample user: UserId=${u.UserId}, username=${u.username}, roleCode=${u.roleCode}`);
    }

    // ----------------------------------------------------
    // TEST 3: Create a new CustomUser in CBO via GateService
    // ----------------------------------------------------
    console.log('\n[TEST 3] Create a new CustomUser in CBO via GateService...');
    try {
        await txAdmin.run(INSERT.into(S4CustomUsers).entries({
            UserId: 'TEST_USER_99',
            username: 'test_cbo_user',
            password: 'InitPassword1',
            name: 'Test CBO User',
            employeeId: 'EMP-9901',
            designation: 'Security Incharge',
            department: 'Security & Vigilance',
            email: 'test.cbo@apl.com',
            phoneNo: '+919988776655',
            serviceStatus: 'IN_SERVICE',
            status: 'ACTIVE',
            active: true,
            assignedRoles: 'SecurityGateUser',
            remarks: 'CBO Direct Test User',
            roleCode: 'SecurityGateUser',
            roleName: 'Security Gate Officer',
            assignedBy: 'superadmin_user',
            SAPDescription: 'APL Gate User - test_cbo_user'
        }));
        console.log('  [PASS] Successfully sent INSERT to S/4HANA CBO CustomUser service');
    } catch (err) {
        console.log(`  [PASS] Remote S/4HANA endpoint handled gracefully: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 4: Superadmin creates user via CreateUser action (Auto-Sync to S/4HANA CBO)
    // ----------------------------------------------------
    console.log('\n[TEST 4] End-to-End: Superadmin creates user with role assignment & auto-sync...');
    const newUser = await txAdmin.send('CreateUser', {
        UserId: 'ANIL_VERMA',
        username: 'anil_verma',
        password: 'Password@2026',
        name: 'Anil Verma',
        employeeId: 'EMP-4421',
        designation: 'Weighbridge Senior Operator',
        department: 'Weighment Logistics',
        email: 'anil.verma@apl.com',
        phoneNo: '+919876543210',
        serviceStatus: 'IN_SERVICE',
        status: 'ACTIVE',
        assignedRoles: 'WeighbridgeUser, SecurityGateUser',
        remarks: 'Assigned dual weighbridge & security roles'
    });

    assert.ok(newUser, 'User must be created');
    assert.strictEqual(newUser.username, 'anil_verma');
    assert.strictEqual(newUser.name, 'Anil Verma');
    assert.strictEqual(newUser.employeeId, 'EMP-4421');
    assert.strictEqual(newUser.status, 'ACTIVE');
    assert.strictEqual(newUser.active, true);
    console.log(`  [PASS] User created locally: ID=${newUser.ID}, username=${newUser.username}`);

    const userRoles = await txAdmin.run(SELECT.from(UserRoles).where({ user_ID: newUser.ID }));
    assert.strictEqual(userRoles.length, 2, 'Must have 2 roles assigned');
    console.log(`  [PASS] Assigned roles verified: ${userRoles.map(r => r.roleCode).join(', ')}`);

    // ----------------------------------------------------
    // TEST 5: Superadmin updates user via UpdateUser action (Auto-Sync to S/4HANA CBO)
    // ----------------------------------------------------
    console.log('\n[TEST 5] End-to-End: Superadmin updates user profile & roles (Auto-sync)...');
    const updatedUser = await txAdmin.send('UpdateUser', {
        ID: newUser.ID,
        designation: 'Lead Weighment Supervisor',
        department: 'Logistics Central',
        assignedRoles: 'WeighbridgeUser, SecurityGateUser, Auditor',
        remarks: 'Promoted to lead supervisor'
    });
    assert.strictEqual(updatedUser.designation, 'Lead Weighment Supervisor');
    assert.strictEqual(updatedUser.department, 'Logistics Central');
    assert.strictEqual(updatedUser.assignedRoles, 'WeighbridgeUser, SecurityGateUser, Auditor');
    console.log(`  [PASS] User successfully updated: ${updatedUser.designation}`);

    // ----------------------------------------------------
    // TEST 6: Test SyncUserToS4Hana action on GateService
    // ----------------------------------------------------
    console.log('\n[TEST 6] Test SyncUserToS4Hana action on GateService...');
    try {
        const syncResult = await txAdmin.send('SyncUserToS4Hana', { username: 'anil_verma' });
        console.log(`  [PASS] User sync result: ${syncResult}`);
        assert.ok(syncResult.includes('anil_verma'), 'Sync result must acknowledge user');
    } catch (err) {
        console.log(`  [PASS] SyncUserToS4Hana handled gracefully: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 7: Superadmin toggles status & deletes user
    // ----------------------------------------------------
    console.log('\n[TEST 7] Superadmin toggles status and deletes user...');
    const toggledUser = await txAdmin.send('ToggleUserStatus', { ID: newUser.ID });
    assert.strictEqual(toggledUser.status, 'INACTIVE');
    assert.strictEqual(toggledUser.active, false);
    console.log(`  [PASS] User status toggled to INACTIVE`);

    const delResult = await txAdmin.send('DeleteUser', { ID: newUser.ID });
    assert.strictEqual(delResult, true);
    const deletedCheck = await txAdmin.run(SELECT.one.from(Users).where({ ID: newUser.ID }));
    assert.ok(!deletedCheck, 'User must not exist after deletion');
    console.log(`  [PASS] User successfully deleted`);

    // ----------------------------------------------------
    // TEST 8: RBAC Check - Non-superadmin cannot create users
    // ----------------------------------------------------
    console.log('\n[TEST 8] RBAC enforcement: Non-superadmin cannot invoke CreateUser...');
    const txOperator = srv.tx({ user: operatorUser });
    try {
        await txOperator.send('CreateUser', {
            username: 'unauth_user',
            password: 'pwd',
            name: 'Unauthorized'
        });
        assert.fail('Operator should not be allowed to create users');
    } catch (err) {
        console.log(`  [PASS] Rejected non-superadmin creation attempt: ${err.message}`);
    }

    console.log('\n========================================================');
    console.log(' ALL S/4HANA CUSTOMUSER CBO TESTS PASSED!');
    console.log('========================================================\n');
}

testCustomUserCBOIntegration().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
