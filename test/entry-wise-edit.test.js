import cds from '@sap/cds';
import assert from 'node:assert';

async function testEntryWiseEdit() {
    console.log('================================================================');
    console.log(' SAP CAP GateService - Entry-Wise Edit Test (Main Gate vs Security)');
    console.log('================================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries, GateAuditLogs } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const adminUser = new cds.User({ id: 'admin_user', roles: ['Admin', 'Auditor'] });

    // 1. Create a new Gate IN transaction
    const tx = srv.tx({ user: mainGateUser });
    await tx.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'AS-01-AB-1234',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Initial Driver'
    }));
    const createdTx = await tx.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'AS-01-AB-1234' })
    );
    console.log(`[SETUP] Created Gate Transaction: ${createdTx.gateInNumber} (ID: ${createdTx.ID})`);

    // 2. Perform Security Gate IN
    await srv.tx({ user: securityUser }).send('SecurityGateIn', {
        gateInNumber: createdTx.gateInNumber,
        driverLicenseNo: 'DL-ORIGINAL-123',
        driverPhoneNo: '+91 9999900000',
        helperName: 'Helper One',
        securityPersonnel: 'Officer_Alpha',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        poNumber: 'PO-ORIG-100',
        invoiceNumber: 'INV-ORIG-200',
        withoutPO: false,
        remarks: 'Original security check'
    });

    const origSec = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(SecurityGateEntries).where({ gateTransaction_ID: createdTx.ID })
    );
    console.log(`[SETUP] Created Security Gate Entry: ${origSec.ID}`);
    assert.strictEqual(origSec.driverLicenseNo, 'DL-ORIGINAL-123');
    assert.strictEqual(origSec.helperName, 'Helper One');

    // =========================================================================
    // TEST A: MAIN GATE ENTRY EDIT (GateTransactions)
    // =========================================================================
    console.log('\n--- Test A: Editing Main Gate Entry Fields ---');
    const customInTime = new Date('2026-09-14T08:15:00.000Z');
    await srv.tx({ user: mainGateUser }).run(
        UPDATE(GateTransactions)
            .set({
                vehicleRegNo: 'AS-01-AB-9999',
                driverName: 'Updated Driver Name',
                gateInOperator: 'Updated Gate Operator',
                gateOutOperator: 'Updated Exit Operator',
                gateInDateTime: customInTime,
                remarks: 'Corrected vehicle number, operator and driver name at Main Gate'
            })
            .where({ ID: createdTx.ID })
    );

    const updatedTx = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ ID: createdTx.ID })
    );
    assert.strictEqual(updatedTx.vehicleRegNo, 'AS-01-AB-9999', 'Vehicle Reg No updated');
    assert.strictEqual(updatedTx.driverName, 'Updated Driver Name', 'Driver Name updated');
    assert.strictEqual(updatedTx.gateInOperator, 'Updated Gate Operator', 'Gate IN Operator updated');
    assert.strictEqual(updatedTx.gateOutOperator, 'Updated Exit Operator', 'Gate OUT Operator updated');
    assert.strictEqual(updatedTx.remarks, 'Corrected vehicle number, operator and driver name at Main Gate', 'Remarks updated');
    console.log(`[PASS] Main Gate Entry successfully updated: Vehicle=${updatedTx.vehicleRegNo}, Driver=${updatedTx.driverName}, GateInOperator=${updatedTx.gateInOperator}, GateOutOperator=${updatedTx.gateOutOperator}`);

    // Verify Main Gate Audit Log
    const mainAudit = await srv.tx({ user: adminUser }).run(
        SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: createdTx.ID,
            action: 'GATE_ENTRY_UPDATED'
        })
    );
    assert.ok(mainAudit, 'Audit log for GATE_ENTRY_UPDATED exists');
    console.log(`  -> Audit Log confirmed: "${mainAudit.remarks}"`);

    // =========================================================================
    // TEST B: SECURITY GATE ENTRY EDIT (SecurityGateEntries)
    // =========================================================================
    console.log('\n--- Test B: Editing Security Gate Entry Fields ---');
    await srv.tx({ user: securityUser }).run(
        UPDATE(SecurityGateEntries)
            .set({
                driverLicenseNo: 'DL-UPDATED-888',
                helperName: 'Updated Helper Two',
                poNumber: 'PO-UPDATED-450',
                invoiceNumber: 'INV-UPDATED-999',
                securityPersonnel: 'Officer_Beta',
                documentsVerified: true,
                securityInRemarks: 'Updated invoice and driver license details during re-inspection',
                exitGatePassType: 'RGP',
                exitGatePassDocumentNo: 'RGP-EX-2026-01'
            })
            .where({ ID: origSec.ID })
    );

    const updatedSec = await srv.tx({ user: securityUser }).run(
        SELECT.one.from(SecurityGateEntries).where({ ID: origSec.ID })
    );
    assert.strictEqual(updatedSec.driverLicenseNo, 'DL-UPDATED-888', 'Driver License updated');
    assert.strictEqual(updatedSec.helperName, 'Updated Helper Two', 'Helper updated');
    assert.strictEqual(updatedSec.poNumber, 'PO-UPDATED-450', 'PO Number updated');
    assert.strictEqual(updatedSec.invoiceNumber, 'INV-UPDATED-999', 'Invoice updated');
    assert.strictEqual(updatedSec.securityPersonnel, 'Officer_Beta', 'Security officer updated');
    assert.strictEqual(updatedSec.exitGatePassType, 'RGP', 'Exit pass type updated');
    assert.strictEqual(updatedSec.exitGatePassDocumentNo, 'RGP-EX-2026-01', 'Exit pass doc updated');
    console.log(`[PASS] Security Gate Entry successfully updated: DL=${updatedSec.driverLicenseNo}, PO=${updatedSec.poNumber}, Inv=${updatedSec.invoiceNumber}`);

    // Verify Security Gate Audit Log
    const secAudit = await srv.tx({ user: adminUser }).run(
        SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: createdTx.ID,
            action: 'SECURITY_ENTRY_UPDATED'
        })
    );
    assert.ok(secAudit, 'Audit log for SECURITY_ENTRY_UPDATED exists');
    console.log(`  -> Audit Log confirmed: "${secAudit.remarks}"`);

    console.log('\n================================================================');
    console.log(' ALL ENTRY-WISE EDIT TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
}

testEntryWiseEdit().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
