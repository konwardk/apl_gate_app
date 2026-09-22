import cds from '@sap/cds';
import assert from 'node:assert';

async function testSecurityRouteAssignment() {
    console.log('================================================================');
    console.log(' SAP CAP GateService - Security Route Assignment & Auth Test');
    console.log('================================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries, FactoryGateEntries, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const factoryUser = new cds.User({ id: 'factory_user', roles: ['FactoryGateUser'] });

    // --- Scenario 1: Security Gate IN with assignedRoute = 'WEIGHBRIDGE' ---
    console.log('\n--- Scenario 1: Security Gate IN with assignedRoute = WEIGHBRIDGE ---');
    const tx1 = srv.tx({ user: mainGateUser });
    await tx1.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-WB-5501',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Rohit Saikia'
    }));
    const gateTx1 = await tx1.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-WB-5501' }));

    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: gateTx1.gateInNumber,
        driverLicenseNo: 'DL-AS-5501',
        securityPersonnel: 'Security_Officer_1',
        poNumber: 'PO-APL-5501',
        invoiceNumber: 'INV-5501',
        assignedRoute: 'WEIGHBRIDGE'
    });

    const txAfterSec1 = await srv.tx({ user: securityUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx1.ID }));
    assert.strictEqual(txAfterSec1.status, 'SECURITY_IN');
    assert.strictEqual(txAfterSec1.currentStage, 'WEIGHBRIDGE_IN');
    assert.strictEqual(txAfterSec1.assignedRoute, 'WEIGHBRIDGE');
    console.log(`[PASS] Vehicle ${txAfterSec1.vehicleRegNo} routed to Weighbridge: Stage=${txAfterSec1.currentStage}, Route=${txAfterSec1.assignedRoute}`);

    // --- Scenario 2: Assign Route to Factory via AssignRoute action by Security User ---
    console.log('\n--- Scenario 2: Assign Route to Factory by SecurityGateUser ---');
    await srv.tx({ user: securityUser }).send('AssignRoute', {
        gateInNumber: gateTx1.gateInNumber,
        route: 'FACTORY',
        remarks: 'Route reassigned directly to Factory Gate'
    });

    const txAfterFacRoute = await srv.tx({ user: securityUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx1.ID }));
    assert.strictEqual(txAfterFacRoute.status, 'SECURITY_IN');
    assert.strictEqual(txAfterFacRoute.currentStage, 'FACTORY');
    assert.strictEqual(txAfterFacRoute.assignedRoute, 'FACTORY');
    console.log(`[PASS] Vehicle ${txAfterFacRoute.vehicleRegNo} routed to Factory Gate: Stage=${txAfterFacRoute.currentStage}, Status=${txAfterFacRoute.status}, Route=${txAfterFacRoute.assignedRoute}`);

    // Verify FactoryGateEntries is NOT created by Security Gate IN (only created when Factory Gate Operator records Factory Gate IN)
    const facEntryBefore = await srv.tx({ user: factoryUser }).run(SELECT.one.from(FactoryGateEntries).where({ gateTransaction_ID: gateTx1.ID }));
    assert.ok(!facEntryBefore, 'FactoryGateEntries must NOT be created by Security Gate IN');
    console.log(`[PASS] Verified Security Gate IN does not create FactoryGateEntries record`);

    // --- Scenario 3: Assign Route to Weighbridge on new vehicle by Security User ---
    console.log('\n--- Scenario 3: Assign Route to Weighbridge on new vehicle ---');
    const tx2 = srv.tx({ user: mainGateUser });
    await tx2.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-WB-5502',
        vehicleType: 'TANKER',
        purpose: 'DELIVERY',
        driverName: 'Pranab Bora'
    }));
    const gateTx2 = await tx2.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-WB-5502' }));

    // Security Gate IN without explicit route
    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: gateTx2.gateInNumber,
        driverLicenseNo: 'DL-AS-5502',
        securityPersonnel: 'Security_Officer_1',
        poNumber: 'PO-APL-5502',
        invoiceNumber: 'INV-5502'
    });

    // Security user explicitly assigns route to WEIGHBRIDGE
    await srv.tx({ user: securityUser }).send('AssignRoute', {
        gateInNumber: gateTx2.gateInNumber,
        route: 'WEIGHBRIDGE'
    });

    const txAfterWbRoute = await srv.tx({ user: securityUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx2.ID }));
    assert.strictEqual(txAfterWbRoute.status, 'SECURITY_IN');
    assert.strictEqual(txAfterWbRoute.currentStage, 'WEIGHBRIDGE_IN');
    assert.strictEqual(txAfterWbRoute.assignedRoute, 'WEIGHBRIDGE');
    console.log(`[PASS] Vehicle ${txAfterWbRoute.vehicleRegNo} route assigned to Weighbridge: Stage=${txAfterWbRoute.currentStage}`);

    // --- Scenario 4: Direct FactoryGateIn called by SecurityGateUser (No Forbidden!) ---
    console.log('\n--- Scenario 4: Direct FactoryGateIn authorized for SecurityGateUser ---');
    const tx3 = srv.tx({ user: mainGateUser });
    await tx3.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-WB-5503',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Kalyan Das'
    }));
    const gateTx3 = await tx3.run(SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-WB-5503' }));

    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: gateTx3.gateInNumber,
        driverLicenseNo: 'DL-AS-5503',
        securityPersonnel: 'Security_Officer_2',
        poNumber: 'PO-APL-5503',
        invoiceNumber: 'INV-5503'
    });

    // Security user calls FactoryGateIn directly - should succeed without forbidden error
    await srv.tx({ user: securityUser }).send('FactoryGateIn', {
        gateInNumber: gateTx3.gateInNumber,
        factoryGateInOperator: 'Security_Officer_2',
        remarks: 'Direct delivery authorized by security chief'
    });

    const txAfterDirectFac = await srv.tx({ user: securityUser }).run(SELECT.one.from(GateTransactions).where({ ID: gateTx3.ID }));
    assert.strictEqual(txAfterDirectFac.status, 'FACTORY_IN');
    console.log(`[PASS] SecurityGateUser successfully executed FactoryGateIn without forbidden error! Status=${txAfterDirectFac.status}`);

    console.log('================================================================');
    console.log(' ALL SECURITY ROUTE ASSIGNMENT & AUTH TESTS PASSED!');
    console.log('================================================================');
}

testSecurityRouteAssignment().catch((err) => {
    console.error('Test FAILED with error:', err);
    process.exit(1);
});
