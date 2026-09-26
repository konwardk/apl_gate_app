using { GateService } from './gate-service';

/*
 * ============================================================
 * GATE SERVICE AUTHORIZATION & RBAC POLICIES
 * ============================================================
 */

// 1. Service Level: Require authentication for all endpoints
annotate GateService with @(requires: 'authenticated-user');

// 2. Action Level Authorization
annotate GateService.CreateGateIn            with @(requires: ['MainGateUser', 'maingate_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.SecurityGateIn          with @(requires: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.AssignRoute             with @(requires: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.RecordWeighment         with @(requires: ['WeighbridgeUser', 'weighbridge_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.FactoryGateIn           with @(requires: ['SecurityGateUser', 'security_user', 'FactoryGateUser', 'factory_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.FactoryGateOut          with @(requires: ['SecurityGateUser', 'security_user', 'FactoryGateUser', 'factory_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.RecordFactoryOperation  with @(requires: ['SecurityGateUser', 'security_user', 'FactoryGateUser', 'factory_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.SecurityGateOut         with @(requires: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.MainGateOut             with @(requires: ['MainGateUser', 'maingate_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user']);
annotate GateService.CreateUser             with @(requires: ['Superadmin', 'superadmin_user']);
annotate GateService.UpdateUser             with @(requires: ['Superadmin', 'superadmin_user']);
annotate GateService.ToggleUserStatus       with @(requires: ['Superadmin', 'superadmin_user']);
annotate GateService.DeleteUser             with @(requires: ['Superadmin', 'superadmin_user']);
annotate GateService.userInfo                with @(requires: 'authenticated-user');


// 3. Entity Level Authorization

// Main Transaction Pipeline: Full CRUD for Main Gate, Admin, and Superadmin; Read for others
annotate GateService.GateTransactions with @(restrict: [
    { grant: '*',    to: ['MainGateUser', 'maingate_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] },
    { grant: 'READ', to: ['SecurityGateUser', 'security_user', 'WeighbridgeUser', 'weighbridge_user', 'FactoryGateUser', 'factory_user', 'Auditor', 'audit_user', 'auditor_user'] }
]);

// Master Data: All authenticated users can read, only Admin & Superadmin can modify
annotate GateService.Vehicles with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.Drivers with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.Transporters with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.Suppliers with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

// External Purchase Orders (SAP S/4HANA Cloud)
annotate GateService.PurchaseOrders with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' }
]);

// Security Gate Records
annotate GateService.SecurityGateEntries with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.SecurityGateExits with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.DeliveryDetails with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.PickupDetails with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['SecurityGateUser', 'security_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

// Weighbridge Records
annotate GateService.WeighbridgeTransactions with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['WeighbridgeUser', 'weighbridge_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

// Factory Yard Records
annotate GateService.FactoryGateEntries with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['FactoryGateUser', 'factory_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

annotate GateService.FactoryGateEvents with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['FactoryGateUser', 'factory_user', 'Admin', 'admin_user', 'Superadmin', 'superadmin_user'] }
]);

// Gate Audit Logs: Restricted to Admin, Superadmin, Auditor, and MainGateUser
annotate GateService.GateAuditLogs with @(restrict: [
    { grant: 'READ', to: ['Admin', 'admin_user', 'Superadmin', 'superadmin_user', 'Auditor', 'audit_user', 'auditor_user', 'MainGateUser', 'maingate_user'] }
]);

// Superadmin User Management: Superadmin has full CRUD, authenticated users can read
annotate GateService.Users with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Superadmin', 'superadmin_user'] }
]);

annotate GateService.UserRoles with @(restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: '*',    to: ['Superadmin', 'superadmin_user'] }
]);
