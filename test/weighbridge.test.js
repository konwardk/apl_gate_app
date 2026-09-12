import cds from '@sap/cds';
import assert from 'node:assert';

console.log('========================================================');
console.log(' SAP CAP GateService - Weighbridge Operations Test Suite');
console.log('========================================================\n');

async function runTests() {
    try {
        await cds.deploy('srv/gate-service.cds').to('sqlite::memory:');
        const srv = await cds.serve('GateService').from('srv/gate-service.cds');
        const { GateTransactions, WeighbridgeTransactions, GateAuditLogs } = srv.entities;

        // Context user with Superadmin / WeighbridgeUser role
        const wbUser = new cds.User({ id: 'weighbridge_user', roles: ['WeighbridgeUser'] });

        // ----------------------------------------------------
        // TEST 1: Weighbridge IN - Delivery Vehicle (GROSS_IN)
        // ----------------------------------------------------
        console.log('[TEST 1] Inbound Weighment for Delivery Vehicle (GROSS_IN)');
        
        // 1a. Create transaction ready for weighbridge (status: SECURITY_IN)
        const delTxId = cds.utils.uuid();
        const delGateIn = 'GI-2026-000088';
        await INSERT.into(GateTransactions).entries({
            ID: delTxId,
            gateInNumber: delGateIn,
            vehicleRegNo: 'MH-12-AB-1234',
            vehicleType: 'TRUCK',
            purpose: 'DELIVERY',
            status: 'SECURITY_IN',
            currentStage: 'SECURITY_GATE_IN',
            gateInDateTime: new Date(),
            gateInOperator: 'maingate_user'
        });

        // 1b. Call RecordWeighment
        const txGrossIn = srv.tx({ user: wbUser });
        const resGrossIn = await txGrossIn.send('RecordWeighment', {
            gateInNumber: delGateIn,
            weight: 34500.50,
            weighbridgeNumber: 'WB-01',
            remarks: 'Loaded raw materials gross weighment'
        });

        assert.strictEqual(resGrossIn.status, 'WEIGHBRIDGE_IN', 'Status should transition to WEIGHBRIDGE_IN');
        assert.strictEqual(resGrossIn.currentStage, 'WEIGHBRIDGE_IN', 'Stage should transition to WEIGHBRIDGE_IN');

        const wbRec1 = await SELECT.one.from(WeighbridgeTransactions).where({ gateTransaction_ID: delTxId });
        assert.ok(wbRec1, 'Weighbridge record should exist');
        assert.strictEqual(wbRec1.weighmentType, 'GROSS_IN', 'Weighment type should be GROSS_IN for delivery inbound');
        assert.strictEqual(Number(wbRec1.weight), 34500.5, 'Weight should match');
        assert.strictEqual(wbRec1.weighbridgeNumber, 'WB-01', 'Scale number should match');
        assert.strictEqual(wbRec1.remarks, 'Loaded raw materials gross weighment', 'Remarks should match');

        const auditGrossIn = await SELECT.one.from(GateAuditLogs).where({
            gateTransaction_ID: delTxId,
            action: 'WEIGHMENT_GROSS_IN'
        });
        assert.ok(auditGrossIn, 'Audit log entry for GROSS_IN should be recorded');
        console.log('  [PASS] GROSS_IN recorded correctly. Status: WEIGHBRIDGE_IN, Weight: 34,500.50 KG\n');

        // ----------------------------------------------------
        // TEST 2: Weighbridge OUT - Delivery Vehicle (TARE_OUT)
        // ----------------------------------------------------
        console.log('[TEST 2] Outbound Weighment for Delivery Vehicle (TARE_OUT)');

        // Simulate factory completion -> status: FACTORY_OUT
        await UPDATE(GateTransactions).set({
            status: 'FACTORY_OUT',
            currentStage: 'FACTORY'
        }).where({ ID: delTxId });

        const txTareOut = srv.tx({ user: wbUser });
        const resTareOut = await txTareOut.send('RecordWeighment', {
            gateInNumber: delGateIn,
            weight: 12200.00,
            weighbridgeNumber: 'WB-02',
            remarks: 'Empty truck tare weighment after unloading'
        });

        assert.strictEqual(resTareOut.status, 'WEIGHBRIDGE_OUT', 'Status should transition to WEIGHBRIDGE_OUT');
        assert.strictEqual(resTareOut.currentStage, 'WEIGHBRIDGE_OUT', 'Stage should transition to WEIGHBRIDGE_OUT');

        const wbRecs = await SELECT.from(WeighbridgeTransactions).where({ gateTransaction_ID: delTxId });
        assert.strictEqual(wbRecs.length, 2, 'Should have 2 weighment records (IN and OUT)');
        const tareRec = wbRecs.find(w => w.weighmentType === 'TARE_OUT');
        assert.ok(tareRec, 'TARE_OUT record should exist');
        assert.strictEqual(Number(tareRec.weight), 12200, 'Tare weight should match');

        // Verify Net Weight: Gross (34500.5) - Tare (12200) = 22300.5 KG
        const netWeight = wbRec1.weight - tareRec.weight;
        assert.strictEqual(netWeight, 22300.5, 'Net cargo weight calculation verified');
        console.log(`  [PASS] TARE_OUT recorded. Net Material Delivered: ${netWeight} KG\n`);

        // ----------------------------------------------------
        // TEST 3: Weighbridge IN - Pickup Vehicle (TARE_IN)
        // ----------------------------------------------------
        console.log('[TEST 3] Inbound Weighment for Pickup Vehicle (TARE_IN)');
        const pickTxId = cds.utils.uuid();
        const pickGateIn = 'GI-2026-000089';
        await INSERT.into(GateTransactions).entries({
            ID: pickTxId,
            gateInNumber: pickGateIn,
            vehicleRegNo: 'KA-05-XY-9999',
            vehicleType: 'CONTAINER',
            purpose: 'PICKUP',
            status: 'SECURITY_IN',
            currentStage: 'SECURITY_GATE_IN',
            gateInDateTime: new Date(),
            gateInOperator: 'maingate_user'
        });

        const txTareIn = srv.tx({ user: wbUser });
        const resTareIn = await txTareIn.send('RecordWeighment', {
            gateInNumber: pickGateIn,
            weight: 11500.00,
            weighbridgeNumber: 'WB-01'
        });

        assert.strictEqual(resTareIn.status, 'WEIGHBRIDGE_IN');
        const pickWb1 = await SELECT.one.from(WeighbridgeTransactions).where({ gateTransaction_ID: pickTxId });
        assert.strictEqual(pickWb1.weighmentType, 'TARE_IN', 'Pickup inbound must be TARE_IN');
        console.log('  [PASS] TARE_IN recorded correctly for pickup vehicle.\n');

        // ----------------------------------------------------
        // TEST 4: Weighbridge OUT - Pickup Vehicle (GROSS_OUT)
        // ----------------------------------------------------
        console.log('[TEST 4] Outbound Weighment for Pickup Vehicle (GROSS_OUT)');
        await UPDATE(GateTransactions).set({
            status: 'FACTORY_OUT',
            currentStage: 'FACTORY'
        }).where({ ID: pickTxId });

        const txGrossOut = srv.tx({ user: wbUser });
        const resGrossOut = await txGrossOut.send('RecordWeighment', {
            gateInNumber: pickGateIn,
            weight: 29800.00,
            weighbridgeNumber: 'WB-02'
        });

        assert.strictEqual(resGrossOut.status, 'WEIGHBRIDGE_OUT');
        const pickWb2 = await SELECT.one.from(WeighbridgeTransactions).where({
            gateTransaction_ID: pickTxId,
            weighmentType: 'GROSS_OUT'
        });
        assert.ok(pickWb2, 'GROSS_OUT record must exist');
        assert.strictEqual(Number(pickWb2.weight), 29800);
        console.log(`  [PASS] GROSS_OUT recorded. Net Material Picked Up: ${pickWb2.weight - pickWb1.weight} KG\n`);

        // ----------------------------------------------------
        // TEST 5: Validations & Error Handling
        // ----------------------------------------------------
        console.log('[TEST 5] Validations: Invalid Stage, Zero/Negative Weight, Missing Scale');

        // 5a. Vehicle not in SECURITY_IN or FACTORY_OUT (e.g. GATE_IN)
        const unreadyGateIn = 'GI-2026-000090';
        await INSERT.into(GateTransactions).entries({
            ID: cds.utils.uuid(),
            gateInNumber: unreadyGateIn,
            vehicleRegNo: 'DL-02-ZZ-1122',
            vehicleType: 'TRUCK',
            purpose: 'DELIVERY',
            status: 'GATE_IN',
            currentStage: 'MAIN_GATE_IN',
            gateInDateTime: new Date(),
            gateInOperator: 'maingate_user'
        });

        let errCaught = false;
        try {
            const txUnready = srv.tx({ user: wbUser });
            await txUnready.send('RecordWeighment', {
                gateInNumber: unreadyGateIn,
                weight: 20000,
                weighbridgeNumber: 'WB-01'
            });
        } catch (e) {
            errCaught = true;
            assert.ok(e.message.includes('not ready for weighbridge'), 'Should reject unready vehicle');
        }
        assert.ok(errCaught, 'Vehicle at GATE_IN stage must be rejected');
        console.log('  [PASS] Correctly blocked weighment for unready vehicle (GATE_IN).');

        // 5b. Invalid / zero weight
        let zeroWeightCaught = false;
        try {
            const txZero = srv.tx({ user: wbUser });
            await txZero.send('RecordWeighment', {
                gateInNumber: delGateIn,
                weight: 0,
                weighbridgeNumber: 'WB-01'
            });
        } catch (e) {
            zeroWeightCaught = true;
            assert.ok(e.message.includes('Valid weight is mandatory'));
        }
        assert.ok(zeroWeightCaught, 'Zero weight must be rejected');
        console.log('  [PASS] Correctly blocked zero weight.');

        // 5c. Missing Weighbridge Number
        let missingScaleCaught = false;
        try {
            const txNoScale = srv.tx({ user: wbUser });
            await txNoScale.send('RecordWeighment', {
                gateInNumber: delGateIn,
                weight: 15000,
                weighbridgeNumber: ''
            });
        } catch (e) {
            missingScaleCaught = true;
            assert.ok(e.message.includes('Weighbridge Number is mandatory'));
        }
        assert.ok(missingScaleCaught, 'Empty scale number must be rejected');
        console.log('  [PASS] Correctly blocked missing weighbridge number.');

        console.log('\n========================================================');
        console.log(' ALL 5 WEIGHBRIDGE TESTS PASSED SUCCESSFULLY!');
        console.log('========================================================');

    } catch (err) {
        console.error('Test Suite Failed:', err);
        process.exit(1);
    }
}

runTests();
