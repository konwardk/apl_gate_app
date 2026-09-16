import cds from '@sap/cds';
import assert from 'node:assert';

async function testSecurityGate() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - Security Gate Operations Test');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { GateTransactions, SecurityGateEntries } = srv.entities;

    const mainGateUser = new cds.User({ id: 'maingate_user', roles: ['MainGateUser'] });
    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });

    // Step 1: Create a fresh delivery gate entry
    const mainTx = srv.tx({ user: mainGateUser });
    const newEntry = {
        vehicleRegNo: 'KA-05-SEC-1001',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Ramesh Security Test'
    };
    await mainTx.run(INSERT.into(GateTransactions).entries(newEntry));
    const createdTx = await mainTx.run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'KA-05-SEC-1001' })
    );
    console.log(`[SETUP] Created Delivery Gate Entry: ${createdTx.gateInNumber} (ID: ${createdTx.ID})`);
    assert.strictEqual(createdTx.status, 'GATE_IN');

    // Step 2: Try SecurityGateIn WITHOUT PO and without checking withoutPO -> should fail with 400
    try {
        const secTxFail = srv.tx({ user: securityUser });
        await secTxFail.send('SecurityGateIn', {
            gateInNumber: createdTx.gateInNumber,
            driverLicenseNo: 'DL-998877',
            securityPersonnel: 'Officer Ramesh',
            withoutPO: false
        });
        assert.fail('Should have failed because PO and Invoice are mandatory for Delivery when withoutPO is false');
    } catch (err) {
        console.log('[TEST 1 PASS] Correctly blocked delivery check-in when PO/Invoice missing and withoutPO is false:', err.message);
        assert.ok(err.message.includes('mandatory'));
    }

    // Step 3: Check-in with withoutPO: true -> should succeed without PO!
    const secTxSuccess = srv.tx({ user: securityUser });
    const resWithoutPO = await secTxSuccess.send('SecurityGateIn', {
        gateInNumber: createdTx.gateInNumber,
        driverLicenseNo: 'DL-998877',
        driverPhoneNo: '+91 9887766554',
        helperName: 'Gopal',
        securityPersonnel: 'Officer Ramesh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        withoutPO: true,
        remarks: 'Emergency delivery approved by plant head without PO'
    });

    console.log('[TEST 2 PASS] Successfully completed SecurityGateIn with withoutPO=true!');
    assert.strictEqual(resWithoutPO.status, 'SECURITY_IN');
    assert.strictEqual(resWithoutPO.currentStage, 'SECURITY_GATE_IN');

    // Verify record in SecurityGateEntries
    const secEntry = await srv.tx({ user: securityUser }).run(SELECT.one.from(SecurityGateEntries).where({ gateInNumber: createdTx.gateInNumber }));
    assert.ok(secEntry, 'SecurityGateEntries record should exist');
    assert.strictEqual(Boolean(secEntry.withoutPO), true);
    assert.strictEqual(secEntry.driverLicenseNo, 'DL-998877');
    console.log(`  -> Verified SecurityGateEntries record ID: ${secEntry.ID}, withoutPO: ${Boolean(secEntry.withoutPO)}`);

    // Step 4: Create second delivery vehicle to test normal check-in WITH PO
    const mainTx2 = srv.tx({ user: mainGateUser });
    await mainTx2.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'MH-12-PO-2002',
        vehicleType: 'CONTAINER',
        purpose: 'DELIVERY',
        driverName: 'Suresh With PO'
    }));
    const createdTx2 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'MH-12-PO-2002' })
    );

    const secTxWithPO = srv.tx({ user: securityUser });
    const resWithPO = await secTxWithPO.send('SecurityGateIn', {
        gateInNumber: createdTx2.gateInNumber,
        driverLicenseNo: 'MH-554433',
        driverPhoneNo: '+91 9123456780',
        securityPersonnel: 'Officer Ramesh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        poNumber: 'PO-4500012345',
        soNumber: 'SO-90001122',
        invoiceNumber: 'INV-2026-999',
        invoiceDate: '2026-09-11',
        withoutPO: false,
        remarks: 'Standard delivery with PO'
    });

    console.log('[TEST 3 PASS] Successfully completed SecurityGateIn with valid PO and Invoice!');
    assert.strictEqual(resWithPO.status, 'SECURITY_IN');

    const secEntry2 = await srv.tx({ user: securityUser }).run(SELECT.one.from(SecurityGateEntries).where({ gateInNumber: createdTx2.gateInNumber }));
    assert.strictEqual(secEntry2.poNumber, 'PO-4500012345');
    assert.strictEqual(secEntry2.invoiceNumber, 'INV-2026-999');
    assert.strictEqual(Boolean(secEntry2.withoutPO), false);
    console.log(`  -> Verified SecurityGateEntries PO: ${secEntry2.poNumber}, Inv: ${secEntry2.invoiceNumber}`);

    // Step 4b: Delivery vehicle check-in WITH PO but WITHOUT Invoice Number (Invoice is optional)
    const mainTx2b = srv.tx({ user: mainGateUser });
    await mainTx2b.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'KA-05-SEC-1003',
        vehicleType: 'TRUCK',
        purpose: 'DELIVERY',
        driverName: 'Suresh Optional Invoice Driver'
    }));
    const createdTx2b = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'KA-05-SEC-1003' })
    );

    const secTxWithPOOnly = srv.tx({ user: securityUser });
    const resWithPOOnly = await secTxWithPOOnly.send('SecurityGateIn', {
        gateInNumber: createdTx2b.gateInNumber,
        driverLicenseNo: 'DL-776655',
        securityPersonnel: 'Officer Ramesh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        poNumber: 'PO-4500099999',
        withoutPO: false
        // invoiceNumber omitted to verify it is optional
    });

    console.log('[TEST 3b PASS] Successfully completed SecurityGateIn with PO and NO Invoice Number (Invoice is optional)!');
    assert.strictEqual(resWithPOOnly.status, 'SECURITY_IN');
    const secEntry2b = await srv.tx({ user: securityUser }).run(SELECT.one.from(SecurityGateEntries).where({ gateInNumber: createdTx2b.gateInNumber }));
    assert.strictEqual(secEntry2b.poNumber, 'PO-4500099999');
    assert.strictEqual(secEntry2b.invoiceNumber, null);
    console.log(`  -> Verified SecurityGateEntries PO: ${secEntry2b.poNumber}, Inv: ${secEntry2b.invoiceNumber || 'null (optional)'}`);

    // Step 5: Pickup vehicle check-in WITHOUT RGP or NRGP (optional at gate entry)
    const mainTx3 = srv.tx({ user: mainGateUser });
    await mainTx3.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'DL-01-PK-3003',
        vehicleType: 'TRUCK',
        purpose: 'PICKUP',
        driverName: 'Vikram Pickup Driver'
    }));
    const createdTx3 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'DL-01-PK-3003' })
    );

    const secTxPickupNoDoc = srv.tx({ user: securityUser });
    const resPickupNoDoc = await secTxPickupNoDoc.send('SecurityGateIn', {
        gateInNumber: createdTx3.gateInNumber,
        driverLicenseNo: 'DL-332211',
        securityPersonnel: 'Officer Ramesh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        // No RGP or NRGP provided - should succeed since optional at gate entry!
        remarks: 'Empty truck entered for scheduled pickup. Documents to be verified at gate exit.'
    });

    console.log('[TEST 4 PASS] Successfully checked in PICKUP vehicle WITHOUT RGP/NRGP documents (optional at entry)!');
    assert.strictEqual(resPickupNoDoc.status, 'SECURITY_IN');
    assert.strictEqual(resPickupNoDoc.currentStage, 'SECURITY_GATE_IN');

    const secEntry3 = await srv.tx({ user: securityUser }).run(SELECT.one.from(SecurityGateEntries).where({ gateInNumber: createdTx3.gateInNumber }));
    assert.strictEqual(secEntry3.rgpDocumentNo, null);
    assert.strictEqual(secEntry3.nrgpDocumentNo, null);
    console.log(`  -> Verified SecurityGateEntries pickup record with optional docs pending at exit`);

    // Step 6: Pickup vehicle check-in WITH RGP document
    const mainTx4 = srv.tx({ user: mainGateUser });
    await mainTx4.run(INSERT.into(GateTransactions).entries({
        vehicleRegNo: 'TN-09-RGP-4004',
        vehicleType: 'CONTAINER',
        purpose: 'PICKUP',
        driverName: 'Murugan RGP Driver'
    }));
    const createdTx4 = await srv.tx({ user: mainGateUser }).run(
        SELECT.one.from(GateTransactions).where({ vehicleRegNo: 'TN-09-RGP-4004' })
    );

    const secTxPickupRGP = srv.tx({ user: securityUser });
    const resPickupRGP = await secTxPickupRGP.send('SecurityGateIn', {
        gateInNumber: createdTx4.gateInNumber,
        driverLicenseNo: 'TN-445566',
        securityPersonnel: 'Officer Ramesh',
        driverVerified: true,
        vehicleVerified: true,
        documentsVerified: true,
        rgpDocumentNo: 'RGP-2026-008899',
        gatePassType: 'RGP',
        remarks: 'RGP verified for returnable packaging pickup'
    });

    console.log('[TEST 5 PASS] Successfully checked in PICKUP vehicle WITH RGP document!');
    assert.strictEqual(resPickupRGP.status, 'SECURITY_IN');

    const secEntry4 = await srv.tx({ user: securityUser }).run(SELECT.one.from(SecurityGateEntries).where({ gateInNumber: createdTx4.gateInNumber }));
    assert.strictEqual(secEntry4.rgpDocumentNo, 'RGP-2026-008899');
    assert.strictEqual(secEntry4.gatePassType, 'RGP');
    console.log(`  -> Verified SecurityGateEntries RGP: ${secEntry4.rgpDocumentNo}, gatePassType: ${secEntry4.gatePassType}`);

    console.log('========================================================');
    console.log(' ALL SECURITY GATE TESTS (DELIVERY + PICKUP) PASSED!');
    console.log('========================================================');
}

testSecurityGate().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
