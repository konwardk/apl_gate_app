import cds from '@sap/cds';
import assert from 'node:assert';

async function runUserManagementTests() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Superadmin User Management Tests');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { Users, UserRoles, GateAuditLogs } = srv.entities;

    const superadminUser = new cds.User({ id: 'superadmin_user', roles: ['Superadmin', 'Admin'] });
    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });

    // ----------------------------------------------------
    // TEST 1: Initial Seed Users Verification
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifying initial seed users in database');
    const allUsers = await srv.tx({ user: superadminUser }).run(SELECT.from(Users));
    console.log(`  -> Total seeded users found: ${allUsers.length}`);
    assert.ok(allUsers.length >= 7, 'Expected at least 7 seeded users');
    
    const superadminDb = allUsers.find(u => u.username === 'superadmin_user');
    assert.ok(superadminDb, 'superadmin_user must exist');
    assert.strictEqual(superadminDb.status, 'ACTIVE');
    assert.strictEqual(superadminDb.serviceStatus, 'IN_SERVICE');
    console.log(`  [PASS] Seed users verified (Primary Superadmin: ${superadminDb.name})`);

    // ----------------------------------------------------
    // TEST 2: Superadmin Creates New User with Multiple Roles
    // ----------------------------------------------------
    console.log('\n[TEST 2] Superadmin creates new user with multiple assigned roles');
    const newUserPayload = {
        username: 'rajesh_kumar',
        password: 'securePassword123',
        name: 'Rajesh Kumar',
        designation: 'Senior Gate Inspector',
        department: 'Main Gate & Security',
        email: 'rajesh.kumar@apl.com',
        phoneNo: '+91 98111 22233',
        serviceStatus: 'IN_SERVICE',
        status: 'ACTIVE',
        assignedRoles: 'MainGateUser, SecurityGateUser',
        remarks: 'Authorized for dual gate operations'
    };

    const createdUser = await srv.tx({ user: superadminUser }).send('CreateUser', newUserPayload);
    assert.ok(createdUser, 'User must be returned');
    assert.strictEqual(createdUser.username, 'rajesh_kumar');
    assert.strictEqual(createdUser.name, 'Rajesh Kumar');
    assert.strictEqual(createdUser.designation, 'Senior Gate Inspector');
    assert.strictEqual(createdUser.department, 'Main Gate & Security');
    assert.strictEqual(createdUser.email, 'rajesh.kumar@apl.com');
    assert.strictEqual(createdUser.phoneNo, '+91 98111 22233');
    assert.strictEqual(createdUser.serviceStatus, 'IN_SERVICE');
    assert.strictEqual(createdUser.status, 'ACTIVE');
    assert.strictEqual(createdUser.active, true);
    assert.strictEqual(createdUser.assignedRoles, 'MainGateUser, SecurityGateUser');
    console.log(`  [PASS] User created with ID: ${createdUser.ID}`);

    // Verify UserRoles child entries
    const roles = await srv.tx({ user: superadminUser }).run(
        SELECT.from(UserRoles).where({ user_ID: createdUser.ID })
    );
    assert.strictEqual(roles.length, 2, 'Expected 2 roles in UserRoles composition');
    const roleCodes = roles.map(r => r.roleCode);
    assert.ok(roleCodes.includes('MainGateUser'));
    assert.ok(roleCodes.includes('SecurityGateUser'));
    console.log(`  [PASS] Verified 2 child role entries: ${roleCodes.join(', ')}`);

    // Verify Audit Log
    const auditCreated = await srv.tx({ user: superadminUser }).run(
        SELECT.one.from(GateAuditLogs).where({ action: 'USER_CREATED', remarks: { like: '%rajesh_kumar%' } })
    );
    assert.ok(auditCreated, 'Audit log for USER_CREATED must be recorded');
    console.log(`  [PASS] Audit log verified: ${auditCreated.remarks}`);

    // ----------------------------------------------------
    // TEST 3: Duplicate Username Rejection
    // ----------------------------------------------------
    console.log('\n[TEST 3] Duplicate username creation must be rejected');
    try {
        await srv.tx({ user: superadminUser }).send('CreateUser', {
            username: 'rajesh_kumar',
            password: 'pwd',
            name: 'Duplicate Rajesh'
        });
        assert.fail('Should have failed for duplicate username');
    } catch (err) {
        console.log(`  [PASS] Correctly rejected duplicate username: ${err.message}`);
        assert.ok(err.message.includes('already exists'));
    }

    // ----------------------------------------------------
    // TEST 4: Superadmin Updates User (Designation, Service Status & Adds Role)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Superadmin updates user profile and expands roles to 3 roles');
    const updatedUser = await srv.tx({ user: superadminUser }).send('UpdateUser', {
        ID: createdUser.ID,
        username: 'rajesh_kumar',
        name: 'Rajesh Kumar Verma',
        designation: 'Operations Shift Lead',
        department: 'Logistics Operations',
        serviceStatus: 'PROBATION',
        status: 'ACTIVE',
        assignedRoles: 'MainGateUser, SecurityGateUser, WeighbridgeUser',
        remarks: 'Promoted to Shift Lead with Scale authorization'
    });

    assert.strictEqual(updatedUser.name, 'Rajesh Kumar Verma');
    assert.strictEqual(updatedUser.designation, 'Operations Shift Lead');
    assert.strictEqual(updatedUser.serviceStatus, 'PROBATION');
    assert.strictEqual(updatedUser.assignedRoles, 'MainGateUser, SecurityGateUser, WeighbridgeUser');

    const updatedRoles = await srv.tx({ user: superadminUser }).run(
        SELECT.from(UserRoles).where({ user_ID: createdUser.ID })
    );
    assert.strictEqual(updatedRoles.length, 3, 'Expected 3 roles after update');
    console.log(`  [PASS] User updated successfully: ${updatedUser.name} (${updatedUser.designation}), Roles: 3`);

    // ----------------------------------------------------
    // TEST 5: Toggle User Account Status (ACTIVE -> INACTIVE -> ACTIVE)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Toggle user account status');
    const toggledOff = await srv.tx({ user: superadminUser }).send('ToggleUserStatus', { ID: createdUser.ID });
    assert.strictEqual(toggledOff.status, 'INACTIVE');
    assert.strictEqual(toggledOff.active, false);
    console.log(`  [PASS] User status toggled to: ${toggledOff.status}`);

    const toggledOn = await srv.tx({ user: superadminUser }).send('ToggleUserStatus', { ID: createdUser.ID });
    assert.strictEqual(toggledOn.status, 'ACTIVE');
    assert.strictEqual(toggledOn.active, true);
    console.log(`  [PASS] User status toggled back to: ${toggledOn.status}`);

    // ----------------------------------------------------
    // TEST 6: Primary Superadmin Protection Rules
    // ----------------------------------------------------
    console.log('\n[TEST 6] Primary Superadmin protection guarantees');
    const primarySuper = allUsers.find(u => u.username === 'superadmin_user');

    // 6a. Cannot deactivate primary superadmin
    try {
        await srv.tx({ user: superadminUser }).send('ToggleUserStatus', { ID: primarySuper.ID });
        assert.fail('Should have prevented deactivating primary superadmin');
    } catch (err) {
        console.log(`  [PASS] Blocked deactivating primary superadmin: ${err.message}`);
        assert.ok(err.message.includes('cannot be deactivated'));
    }

    // 6b. Cannot remove Superadmin role from primary superadmin
    try {
        await srv.tx({ user: superadminUser }).send('UpdateUser', {
            ID: primarySuper.ID,
            assignedRoles: 'MainGateUser'
        });
        assert.fail('Should have prevented removing Superadmin role from primary superadmin');
    } catch (err) {
        console.log(`  [PASS] Blocked stripping Superadmin role: ${err.message}`);
        assert.ok(err.message.includes('Superadmin role cannot be removed'));
    }

    // 6c. Cannot delete primary superadmin
    try {
        await srv.tx({ user: superadminUser }).send('DeleteUser', { ID: primarySuper.ID });
        assert.fail('Should have prevented deleting primary superadmin');
    } catch (err) {
        console.log(`  [PASS] Blocked deleting primary superadmin: ${err.message}`);
        assert.ok(err.message.includes('cannot be deleted'));
    }

    // ----------------------------------------------------
    // TEST 7: Delete User Account
    // ----------------------------------------------------
    console.log('\n[TEST 7] Delete user account and cleanup associated roles');
    const deleteResult = await srv.tx({ user: superadminUser }).send('DeleteUser', { ID: createdUser.ID });
    assert.strictEqual(deleteResult, true);

    const checkUser = await srv.tx({ user: superadminUser }).run(
        SELECT.one.from(Users).where({ ID: createdUser.ID })
    );
    assert.ok(!checkUser, 'User should no longer exist');

    const checkRoles = await srv.tx({ user: superadminUser }).run(
        SELECT.from(UserRoles).where({ user_ID: createdUser.ID })
    );
    assert.strictEqual(checkRoles.length, 0, 'Roles should be cleaned up');
    console.log('  [PASS] User and roles deleted cleanly.');

    console.log('\n========================================================');
    console.log(' ALL 7 SUPERADMIN USER MANAGEMENT TESTS PASSED!');
    console.log('========================================================\n');
}

runUserManagementTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
