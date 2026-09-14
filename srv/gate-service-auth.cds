using { GateService } from './gate-service';

/*
 * ============================================================
 * GATE SERVICE AUTHORIZATION & RBAC POLICIES
 * ============================================================
 */

// 1. Service Level: Require authentication for all endpoints
annotate GateService with @(requires: 'authenticated-user');

// 2. Action Level Authorization
annotate GateService.CreateGateIn     with @(requires: ['MainGateUser', 'Superadmin']);
annotate GateService.SecurityGateIn   with @(requires: ['SecurityGateUser', 'Superadmin']);
annotate GateService.RecordWeighment  with @(requires: ['WeighbridgeUser', 'Superadmin']);
annotate GateService.FactoryGateIn           with @(requires: ['FactoryGateUser', 'Superadmin']);
annotate GateService.FactoryGateOut          with @(requires: ['FactoryGateUser', 'Superadmin']);
annotate GateService.RecordFactoryOperation  with @(requires: ['FactoryGateUser', 'Superadmin']);
annotate GateService.SecurityGateOut         with @(requires: ['SecurityGateUser', 'Superadmin']);
annotate GateService.MainGateOut             with @(requires: ['MainGateUser', 'Superadmin']);
annotate GateService.userInfo                with @(requires: 'authenticated-user');

// 3. Entity Level Authorization

// Main Transaction Pipeline: Full CRUD for Main Gate, Admin, and Superadmin; Read for others
annotate GateService.GateTransactions with @(restrict: [
    { grant: '*',    to: ['MainGateUser', 'Admin', 'Superadmin'] },
    { grant: 'READ', to: ['SecurityGateUser', 'WeighbridgeUser', 'FactoryGateUser', 'Auditor'] }
]);

// Master Data: All authenticated users can read, only Admin & Superadmin can modify
annotate GateService.Vehicles with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'Superadmin'] }
]);

annotate GateService.Drivers with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'Superadmin'] }
]);

annotate GateService.Transporters with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'Superadmin'] }
]);

annotate GateService.Suppliers with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'Superadmin'] }
]);

// Security Gate Records
annotate GateService.SecurityGateEntries with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'Admin', 'Superadmin'] }
]);

annotate GateService.SecurityGateExits with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'Admin', 'Superadmin'] }
]);

annotate GateService.DeliveryDetails with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'Admin', 'Superadmin'] }
]);

annotate GateService.PickupDetails with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'Admin', 'Superadmin'] }
]);

// Weighbridge Records
annotate GateService.WeighbridgeTransactions with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['WeighbridgeUser', 'Admin', 'Superadmin'] }
]);

// Factory Yard Records
annotate GateService.FactoryGateEntries with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['FactoryGateUser', 'Admin', 'Superadmin'] }
]);

annotate GateService.FactoryGateEvents with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['FactoryGateUser', 'Admin', 'Superadmin'] }
]);

// Gate Audit Logs: Restricted to Admin, Superadmin, Auditor, and MainGateUser
annotate GateService.GateAuditLogs with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Superadmin', 'Auditor', 'MainGateUser'] }
]);
