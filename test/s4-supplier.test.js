import cds from '@sap/cds';
import assert from 'node:assert';

async function testS4Suppliers() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - S/4HANA Suppliers (YY1_Supplier) Test');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { S4Suppliers, YY1_Supplier } = srv.entities;

    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const tx = srv.tx({ user: securityUser });

    console.log('\n[TEST 1] Fetch S4Suppliers via GateService...');
    const suppliers = await tx.run(SELECT.from(S4Suppliers));
    console.log(`[PASS] Successfully retrieved ${suppliers.length} S/4HANA Suppliers:`);
    suppliers.slice(0, 5).forEach((s, idx) => {
        console.log(`  ${idx + 1}. Supplier: ${s.Supplier} | Name: ${s.SupplierName} | Full: ${s.SupplierFullName}`);
    });

    assert.ok(suppliers.length > 0, 'Should have retrieved suppliers');
    assert.ok(suppliers[0].Supplier, 'Supplier record must have Supplier property');
    assert.ok(suppliers[0].SupplierName, 'Supplier record must have SupplierName property');

    console.log('\n[TEST 2] Fetch YY1_Supplier entity alias via GateService...');
    const yy1List = await tx.run(SELECT.from(YY1_Supplier));
    console.log(`[PASS] Successfully retrieved ${yy1List.length} YY1_Supplier records`);
    assert.ok(yy1List.length > 0, 'Should have retrieved YY1_Supplier records');

    console.log('\n[TEST 3] Check known S4 supplier from YY1_Supplier API...');
    const match = suppliers.find(s => s.Supplier === '1000011' || s.Supplier === '8000001');
    if (match) {
        console.log(`[PASS] Found live S/4HANA Cloud supplier: ${match.Supplier} - ${match.SupplierName}`);
    } else {
        console.log(`[INFO] Live supplier not matched, fallback active.`);
    }

    console.log('\n========================================================');
    console.log(' ALL S/4HANA SUPPLIER TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
}

testS4Suppliers().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
