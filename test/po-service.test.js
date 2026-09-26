import cds from '@sap/cds';
import assert from 'node:assert';

async function testPurchaseOrders() {
    console.log('========================================================');
    console.log(' SAP CAP GateService - External Purchase Orders Test');
    console.log('========================================================');

    await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
    const srv = await cds.serve('GateService').from('srv/gate-service.cds');
    const { PurchaseOrders } = srv.entities;

    const securityUser = new cds.User({ id: 'security_user', roles: ['SecurityGateUser'] });
    const tx = srv.tx({ user: securityUser });

    console.log('\n[TEST 1] Fetch Purchase Orders via GateService...');
    const pos = await tx.run(SELECT.from(PurchaseOrders));
    console.log(`[PASS] Successfully retrieved ${pos.length} Purchase Orders:`);
    pos.forEach((po, idx) => {
        console.log(`  ${idx + 1}. PO: ${po.PurchaseOrder} | Type: ${po.PurchaseOrderType} | Supplier: ${po.Supplier} | Date: ${po.PurchaseOrderDate}`);
    });

    assert.ok(pos.length > 0, 'Should have retrieved purchase orders');
    assert.ok(pos[0].PurchaseOrder, 'PO should have PurchaseOrder property');

    console.log('\n[TEST 2] Filter Purchase Orders by Supplier SUPP-01...');
    const filtered = await tx.run(SELECT.from(PurchaseOrders).where({ Supplier: 'SUPP-01' }));
    console.log(`[PASS] Filtered ${filtered.length} POs for SUPP-01`);
    assert.ok(filtered.every(p => p.Supplier === 'SUPP-01'));

    console.log('\n[TEST 3] Order Purchase Orders by Date desc with limit 5...');
    const sorted = await tx.run(SELECT.from(PurchaseOrders).orderBy('PurchaseOrderDate desc').limit(5));
    console.log(`[PASS] Retrieved ${sorted.length} sorted POs`);
    assert.strictEqual(sorted.length, 5, 'Should return exactly 5 POs');
    for (let i = 0; i < sorted.length - 1; i++) {
        assert.ok(sorted[i].PurchaseOrderDate >= sorted[i + 1].PurchaseOrderDate, 'Dates should be descending');
    }

    console.log('\n[TEST 4] Single PO lookup using SELECT.one...');
    const testPoNumber = pos[0].PurchaseOrder;
    const single = await tx.run(SELECT.one.from(PurchaseOrders).where({ PurchaseOrder: testPoNumber }));
    console.log(`[PASS] Retrieved single PO: ${single?.PurchaseOrder} (${single?.Supplier})`);
    assert.ok(single && single.PurchaseOrder === testPoNumber, 'Should return specific PO object');
    assert.strictEqual(Array.isArray(single), false, 'SELECT.one must return an object, not an array');

    console.log('\n[TEST 5] Search with contains and OR expressions...');
    const searchMatch = await tx.run(SELECT.from(PurchaseOrders).where(`contains(PurchaseOrder, '${testPoNumber.slice(-4)}') or Supplier = '${pos[0].Supplier}'`));
    console.log(`[PASS] Search match count: ${searchMatch.length}`);
    assert.ok(searchMatch.length >= 1, 'Should match PO containing digits or supplier');

    console.log('\n========================================================');
    console.log(' ALL PURCHASE ORDER TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
}

testPurchaseOrders().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
