# Assam Petro-chemicals Limited (APL) - Gate In / Gate Out Operations Application
## Complete Architecture, Process Flow & File-by-File Technical Documentation

---

## 1. Executive Summary & Application Overview

The **APL Gate In / Gate Out Application** is an enterprise logistics and plant perimeter security management system built using the **SAP Cloud Application Programming Model (CAP - Node.js/CDS)** and **SAP Fiori / SAPUI5**.

The application digitizes, tracks, and audits the end-to-end lifecycle of vehicles entering and leaving the factory premises for two primary operational streams:
1. **DELIVERY**: Inbound raw materials, chemicals (e.g., methanol, process feedstock), packaging, equipment, and general supplies.
2. **PICKUP**: Outbound finished goods, returnable containers, scrap, or equipment dispatched using Returnable Gate Passes (**RGP**) or Non-Returnable Gate Passes (**NRGP**).

The application enforces a multi-tier security and physical workflow across distinct plant operational stations:
- **Main Gate**: Initial vehicle check-in (Gate IN) and final exit clearance (Gate OUT).
- **Security Gate**: Inbound vehicle physical inspection, driver credential verification, consignment documentation clearance (PO/Invoice check), route assignment, and outbound exit pass verification.
- **Weighbridge**: Inbound gross/tare weighing, outbound tare/gross weighing, net cargo weight calculation, and electronic weighment slip generation.
- **Factory Gate / Yard**: Inbound bay arrival, unloading/loading point management, physical goods inspection, seal verification, and yard exit clearance.
- **Master Data & Governance**: Registry of vehicles, drivers, transporters, suppliers, and immutable audit logs.
- **SAP S/4HANA Cloud Integration**: Real-time validation and value help against external S/4HANA Purchase Orders (`CE_PURCHASEORDER_0001`).

---

## 2. System Architecture & Dual Frontend Design

The application adopts a **Dual-Frontend Architecture** on top of a single unified CAP OData V4 backend:

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                         |
+------------------------------------------------------------+----------------------------+
|        Custom SAPUI5 Freestyle Webapp (`/webapp`)          | SAP Fiori Elements V4 App  |
|  - Role-based Fiori Launchpad Dashboard (`Dashboard.view`) |   (`/gate-entry/webapp`)   |
|  - Vehicle Category Selection Hero (`Landing.view`)        |  - List Report Floorplan   |
|  - Main Gate Operations (`Operations.view`)                |  - Object Page Floorplan   |
|  - Security Gate Clearance (`SecurityOperations.view`)     |  - Full Draft Editing      |
|  - Weighbridge Scale Terminal (`WeighbridgeOperations`)    |  - Master Data Views       |
|  - Factory Yard Operations (`FactoryOperations.view`)      |                            |
|  - Dedicated Editors (`EditGateEntry`, `EditSecurityEntry`)|                            |
|  - Embedded Fiori Elements Host (`Viewer.view`)            |                            |
+------------------------------------------------------------+----------------------------+
                                              |
                                              | OData V4 JSON / HTTP Basic Auth
                                              v
+-----------------------------------------------------------------------------------------+
|                                  CAP BACKEND LAYER                                      |
+-----------------------------------------------------------------------------------------+
|  `srv/gate-service.cds` & `srv/gate-service.js`                                         |
|  - OData V4 Path: `/gate`                                                               |
|  - Business Actions: CreateGateIn, SecurityGateIn, AssignRoute, RecordWeighment,        |
|                      FactoryGateIn, FactoryGateOut, SecurityGateOut, MainGateOut        |
|  - Validations, Unique Gate Numbering (`GI-YYYY-NNNNNN`), Concurrency Checks            |
|  - Authorization Rules (`srv/gate-service-auth.cds`)                                    |
|  - External S/4HANA Service Integration with Mock Fallback (`CE_PURCHASEORDER_0001`)    |
+-----------------------------------------------------------------------------------------+
                                              |
                                              v
+-----------------------------------------------------------------------------------------+
|                                  DATABASE LAYER (CDS)                                   |
+-----------------------------------------------------------------------------------------+
|  `db/schema.cds`                                                                        |
|  - Core Entities: GateTransactions, SecurityGateEntries, WeighbridgeTransactions,       |
|                   FactoryGateEntries, DeliveryDetails, PickupDetails, GateAuditLogs     |
|  - Master Entities: Vehicles, Drivers, Transporters, Suppliers                          |
|  - SQLite (Local Development & In-Memory Tests) / SAP HANA Cloud (Production Deploy)    |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Comprehensive Folder and File Structure

Below is the complete inventory of all files and folders in the repository, organized by directory with their functional purpose.

```
apl-gate-app/
├── .cdsrc.json                    # CAP runtime configuration & mock authentication definitions
├── .gitignore                     # Git ignore specifications
├── eslint.config.mjs              # ESLint linting configuration
├── package.json                   # Project manifest, dependencies, scripts, and CDS requirements
├── package-lock.json              # Locked dependency tree
├── readme.md                      # Introductory getting-started guide
├── server.js                      # Custom Express server bootstrap, static hosting & mock flexibility
├── xs-security.json               # SAP BTP XSUAA application security descriptor & role templates
├── app/                           # Frontend user interface assets, annotations, and UI projects
│   ├── annotations.cds            # OData UI Annotations (ListReport, ObjectPage, LineItems, FieldGroups)
│   ├── index.html                 # Root redirector pointing to the main webapp launchpad
│   ├── labels.cds                 # Multilingual-ready UI labels and field titles for entities
│   ├── services.cds               # Aggregates UI annotations and labels for service consumption
│   ├── gate-entry/                # SAP Fiori Elements V4 application
│   │   └── webapp/
│   │       ├── Component-preload.js# Empty/optimized preload stub for UI5 loader
│   │       ├── Component.js       # Fiori Elements component loader referencing sap.fe.core.AppComponent
│   │       ├── index.html         # Standalone test runner with SAP Fiori sandbox bootstrap
│   │       ├── manifest.json      # Fiori Elements descriptor configuring ListReport & ObjectPage targets
│   │       └── i18n/
│   │           └── i18n.properties# Translation texts for Fiori Elements floorplan
│   └── webapp/                    # Custom SAPUI5 Freestyle Launchpad & Operational Station application
│       ├── Component-preload.js   # Preload stub
│       ├── Component.js           # Core SAPUI5 Component: State management, API calls, navigation
│       ├── index.html             # Shell launcher with SAPUI5 CDN bootstrap & sap_horizon theme
│       ├── manifest.json          # Application descriptor for the freestyle gate management app
│       ├── controller/            # UI Controllers for all views and operational dialogs
│       │   ├── App.controller.js  # Root controller: Shell header, role switcher, theme toggle
│       │   ├── Dashboard.controller.js # Fiori Launchpad tiles, live KPI metrics & routing
│       │   ├── EditGateEntry.controller.js # Form controller for editing Main Gate entry records
│       │   ├── EditSecurityGateEntry.controller.js # Controller for editing Security Gate details
│       │   ├── FactoryOperations.controller.js # Controller for Factory yard unloading & clearance
│       │   ├── Landing.controller.js # Controller for initial vehicle category selection
│       │   ├── Operations.controller.js # Controller for Main Gate transactions table & Gate In/Out
│       │   ├── SecurityOperations.controller.js # Controller for Security check-in, route & exit check
│       │   ├── Viewer.controller.js # Controller hosting embedded Fiori Elements apps in iframe
│       │   └── WeighbridgeOperations.controller.js # Controller for scale capture & weight slips
│       ├── css/
│       │   └── style.css          # Custom styling: Shellbar, tiles, cards, responsive dialogs
│       ├── fragment/              # Reusable XML dialog fragments for operations and slips
│       │   ├── DetailDialog.fragment.xml          # Read-only transaction overview modal
│       │   ├── FactoryGateInDialog.fragment.xml   # Modal dialog for factory arrival check-in
│       │   ├── FactoryGateInSuccessDialog.fragment.xml # Confirmation dialog for factory check-in
│       │   ├── FactoryGateOutDialog.fragment.xml  # Modal dialog for factory exit clearance
│       │   ├── FactoryGateOutSuccessDialog.fragment.xml # Confirmation dialog with pass printing
│       │   ├── GateInDialog.fragment.xml          # Modal dialog for Main Gate IN vehicle creation
│       │   ├── GateInSuccessDialog.fragment.xml   # Success modal displaying generated Gate IN #
│       │   ├── GateOutDialog.fragment.xml         # Modal dialog for Main Gate OUT clearance
│       │   ├── GateOutSuccessDialog.fragment.xml  # Success modal for completed transaction
│       │   ├── PurchaseOrderValueHelpDialog.fragment.xml # S/4HANA PO selection modal dialog
│       │   ├── SecurityGateInDialog.fragment.xml  # Modal for security inspection & doc clearance
│       │   ├── SecurityGateOutDialog.fragment.xml # Modal for exit security clearance & pass check
│       │   ├── SignInDialog.fragment.xml          # User authentication and password modal
│       │   ├── UserProfilePopover.fragment.xml    # Current active user profile popover
│       │   ├── WeighbridgeDialog.fragment.xml     # Modal for digital scale weighment entry
│       │   └── WeighbridgeSlipDialog.fragment.xml # Printable electronic weighbridge slip
│       ├── i18n/
│       │   └── i18n.properties    # Application resource bundle for UI labels and messages
│       ├── images/
│       │   └── apl-logo.jpg       # Assam Petro-chemicals Limited corporate logo
│       ├── model/
│       │   ├── formatter.js       # UI formatters: Dates, status badges, weights, user initials
│       │   └── models.js          # Client state models, persona permissions, basic auth headers
│       └── view/                  # SAPUI5 XML Views for each operational stage
│           ├── App.view.xml       # Root Shellbar & NavContainer holding all sub-views
│           ├── Dashboard.view.xml # Role-aware Fiori Launchpad with KPI counters and tiles
│           ├── EditGateEntry.view.xml # Form to modify Main Gate transaction fields
│           ├── EditSecurityGateEntry.view.xml # Form to modify Security inspection & PO fields
│           ├── FactoryOperations.view.xml # Factory yard bay queue, arrival and exit clearance
│           ├── Landing.view.xml   # Opening screen: Vehicle Category selection (Tanker vs Other)
│           ├── Operations.view.xml# Main Gate operations queue, Gate IN, Gate OUT actions
│           ├── SecurityOperations.view.xml # Security station queue, physical checks & routing
│           ├── Viewer.view.xml    # Fullscreen host for embedded Fiori Elements List Reports
│           └── WeighbridgeOperations.view.xml # Weighbridge scale queue, gross/tare recording
├── db/                            # Domain Data Models and Initial Seed Data
│   ├── schema.cds                 # Central CDS Data Model (entities, types, enums, relations)
│   └── data/                      # Initial CSV seed files for mock database bootstrapping
│       ├── factory.gate-Drivers.csv               # Seed drivers master data
│       ├── factory.gate-GateAuditLogs.csv         # Initial audit trail entries
│       ├── factory.gate-GateTransactions.csv      # Initial gate transactions
│       ├── factory.gate-SecurityGateEntries.csv   # Initial security inspection records
│       ├── factory.gate-Suppliers.csv             # Seed vendor & supplier master data
│       ├── factory.gate-Transporters.csv          # Seed logistics transporter master data
│       ├── factory.gate-Vehicles.csv              # Seed registered vehicle master data
│       └── factory.gate-WeighbridgeTransactions.csv # Seed weighbridge records
├── srv/                           # Backend Business Logic and Service Definitions
│   ├── gate-service-auth.cds      # RBAC policies, service restrictions, and action annotations
│   ├── gate-service.cds           # OData service definition with entities, projections & actions
│   ├── gate-service.js            # Service implementation: Handlers, validations, numbering
│   └── external/                  # External Service CSN and EDMX descriptors
│       ├── CE_PURCHASEORDER_0001.csn # S/4HANA Cloud Purchase Order Service CSN model
│       └── CE_PURCHASEORDER_0001.edmx# S/4HANA Cloud Purchase Order Service EDMX metadata
└── test/                          # Comprehensive Automated Test Suites (Node.js & SQLite)
    ├── bypass-weighbridge.test.js # Test for direct factory entry bypassing scale measurement
    ├── entry-wise-edit.test.js    # Test verifying segregated editing of Main Gate vs Security
    ├── factory-gate.test.js       # Test for factory yard operations, unloading & clearance
    ├── gate-crud.test.js          # Test for basic Gate Transactions CRUD and validations
    ├── gate-out.test.js           # Test for Main Gate OUT exit processing and stage guards
    ├── po-service.test.js         # Test for external S/4HANA PO integration & fallback
    ├── security-gate-out.test.js  # Test for outbound security clearance checklist
    ├── security-gate.test.js      # Test for inbound security clearance & document checks
    ├── security-route-assign.test.js # Test for route assignment (WEIGHBRIDGE vs FACTORY)
    └── weighbridge.test.js        # Test for gross/tare weighing, calculations & slips
```

---

## 4. End-to-End Business Process Flow & Sectional Breakdown

The plant gate operations flow is strictly staged to ensure physical security, cargo integrity, accurate weight auditing, and SAP ERP compliance.

### Lifecycle Statuses and Process Stages

The application tracks each vehicle through standardized **Statuses** and **Stages**:

| Status (`GateStatus`) | Stage (`GateStage`) | Description |
| :--- | :--- | :--- |
| `GATE_IN` | `MAIN_GATE_IN` | Vehicle entered factory perimeter at Main Gate; pending Security Gate check. |
| `SECURITY_IN` | `SECURITY_GATE_IN` or `WEIGHBRIDGE_IN` | Inbound security inspection completed; driver & docs verified. Routed to Weighbridge or Factory. |
| `WEIGHBRIDGE_IN` | `FACTORY` | First weighment recorded (Gross IN for Delivery, Tare IN for Pickup). Proceeding to yard. |
| `FACTORY_IN` | `FACTORY` | Vehicle checked into factory yard / bay; unloading or loading in progress. |
| `FACTORY_OUT` | `WEIGHBRIDGE_OUT` or `SECURITY_GATE_OUT` | Unloading/loading complete; yard clearance granted. Proceeding to 2nd weighment or Security Exit. |
| `WEIGHBRIDGE_OUT` | `SECURITY_GATE_OUT` | Second weighment recorded (Tare OUT for Delivery, Gross OUT for Pickup); net weight finalized. |
| `SECURITY_OUT` | `MAIN_GATE_OUT` | Outbound security inspection complete; exit gate pass verified. Cleared to leave plant. |
| `COMPLETED` | `COMPLETED` | Main Gate OUT clearance granted; vehicle departed plant. Record is locked and archived. |
| `HOLD` | Any Stage | Vehicle temporarily placed on hold for administrative, safety, or legal verification. |
| `CANCELLED` | Any Stage | Entry cancelled (e.g., rejected at gate, duplicate registration, or entry error). |

---

### Detailed Section Breakdown

```
[Arrival]
   │
   ▼
[SECTION 1: MAIN GATE CHECK-IN]
   │  • Capture Vehicle Reg No & Purpose (DELIVERY / PICKUP)
   │  • Auto-generate Gate IN # (GI-YYYY-NNNNNN)
   │  • Status: GATE_IN | Stage: MAIN_GATE_IN
   │
   ▼
[SECTION 2: SECURITY GATE INBOUND]
   │  • Verify Driver License, Vehicle & Helper Details
   │  • Verify PO/Invoice (Delivery) or RGP/NRGP (Pickup)
   │  • Status: SECURITY_IN
   │
   ├─── Route: WEIGHBRIDGE ────────────────┐
   │                                       │ Route: FACTORY (Bypass Scale)
   ▼                                       ▼
[SECTION 3: WEIGHBRIDGE (1ST SCALE)]   [SECTION 4: FACTORY GATE IN]
   │  • Delivery: GROSS_IN                 │  • Record Bay & Unloading Point
   │  • Pickup: TARE_IN                    │  • Status: FACTORY_IN
   │  • Status: WEIGHBRIDGE_IN             │  • Material Unloading / Loading
   │                                       │
   └───────────────────┬───────────────────┘
                       │
                       ▼
         [SECTION 4: FACTORY GATE OUT]
              • Physical Goods Inspection & Seal Verification
              • Record Unloaded Qty & Unloading Status
              • Status: FACTORY_OUT
                       │
   ┌───────────────────┴───────────────────┐
   │ If Weighed                            │ If Bypassed Scale
   ▼                                       │
[SECTION 3: WEIGHBRIDGE (2ND SCALE)]       │
   │  • Delivery: TARE_OUT                 │
   │  • Pickup: GROSS_OUT                  │
   │  • Calculate Net Weight               │
   │  • Generate Electronic Weigh Slip     │
   │  • Status: WEIGHBRIDGE_OUT            │
   │                                       │
   └───────────────────┬───────────────────┘
                       │
                       ▼
         [SECTION 5: SECURITY GATE OUTBOUND]
              • 7-Point Outbound Verification Checklist
              • Exit Gate Pass Authorization (Standard / RGP / NRGP)
              • Status: SECURITY_OUT | Stage: MAIN_GATE_OUT
                       │
                       ▼
         [SECTION 6: MAIN GATE CHECK-OUT]
              • Barrier Release & Exit Timestamp
              • Status: COMPLETED | Stage: COMPLETED
              • Locked from further modifications
```

---

### Section 1: Main Gate Check-In (Gate IN)
- **Primary Persona**: `MainGateUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.Operations` (Main Gate Operations)
- **Dialog Fragment**: `GateInDialog.fragment.xml`
- **Backend Action**: `CreateGateIn(vehicleRegNo, vehicleType, purpose, driverName)`
- **Key Business Rules**:
  - Vehicle Registration Number is mandatory and validated against Indian vehicle registration regex format (`^[A-Z]{2}-\d{2}(?:-[A-Z]{1,3})?-\d{4}$`, e.g., `AS-01-AB-1234`).
  - Purpose is mandatory (`DELIVERY` or `PICKUP`).
  - Active Vehicle Guard: Rejects entry if the same vehicle registration already has an active (uncompleted) transaction in the plant.
  - Automatically queries the `Vehicles` master to resolve transporter links.
  - Automatically generates an immutable business number: `GI-YYYY-NNNNNN` (e.g., `GI-2026-000001`).
  - Records timestamp and operator ID.
  - Emits an initial audit log record: `GATE_IN_CREATED`.
  - Generates a printable Gate Entry Slip for the driver.

---

### Section 2: Security Gate Inbound Operations (Security Gate IN & Route Assignment)
- **Primary Persona**: `SecurityGateUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.SecurityOperations`
- **Dialog Fragment**: `SecurityGateInDialog.fragment.xml`
- **Backend Actions**:
  - `SecurityGateIn(...)`
  - `AssignRoute(gateInNumber, route, remarks)`
- **Key Business Rules**:
  - Validates physical driver identity, driver phone number, driving license, and helper name.
  - Verification Checklist: `driverVerified`, `vehicleVerified`, `documentsVerified`.
  - For **DELIVERY**:
    - Validates Purchase Order (`poNumber`) or Sales Order (`soNumber`).
    - Provides live search/value help against SAP S/4HANA Purchase Orders (`CE_PURCHASEORDER_0001`).
    - Captures Invoice Number and Invoice Date.
    - Supports emergency "Without PO" consignments (`withoutPO: true`).
  - For **PICKUP**:
    - Captures Gate Pass Type (`RGP` or `NRGP`) and Gate Pass Document Number.
  - Route Assignment:
    - Route `WEIGHBRIDGE`: Directs vehicle to Weighbridge Station for gross weight measurement. Sets `currentStage = 'WEIGHBRIDGE_IN'`.
    - Route `FACTORY`: Bypasses weighbridge for packaged or unweighed general materials. Automatically creates `FactoryGateEntries` and sets `status = 'FACTORY_IN'`, `currentStage = 'FACTORY'`.

---

### Section 3: Weighbridge Operations (Gross / Tare Weight Measurement)
- **Primary Persona**: `WeighbridgeUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.WeighbridgeOperations`
- **Dialog Fragment**: `WeighbridgeDialog.fragment.xml`, `WeighbridgeSlipDialog.fragment.xml`
- **Backend Action**: `RecordWeighment(...)`
- **Key Business Rules**:
  - Captures scale readings: `weighbridgeNumber`, `weight`, `weightUnit` (default `KG`), operator ID, timestamp.
  - **1st Weighment (Inbound)**:
    - `DELIVERY`: Records `GROSS_IN`. Vehicle transitions to `WEIGHBRIDGE_IN` status and `FACTORY` stage.
    - `PICKUP`: Records `TARE_IN`. Vehicle transitions to `WEIGHBRIDGE_IN` status and `FACTORY` stage.
  - **2nd Weighment (Outbound)**:
    - `DELIVERY`: Records `TARE_OUT`. Vehicle transitions to `WEIGHBRIDGE_OUT` status and `SECURITY_GATE_OUT` stage.
    - `PICKUP`: Records `GROSS_OUT`. Vehicle transitions to `WEIGHBRIDGE_OUT` status and `SECURITY_GATE_OUT` stage.
  - **Net Weight Calculation**:
    $$\text{Net Cargo Weight} = |\text{Gross Weight} - \text{Tare Weight}|$$
  - Generates an official, printable **Electronic Weighbridge Slip** displaying company header, transaction ID, vehicle details, gross weight, tare weight, calculated net weight, operator signature block, and audit timestamps.

---

### Section 4: Factory Gate & Yard Operations (Unloading / Loading)
- **Primary Persona**: `FactoryGateUser` / `SecurityGateUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.FactoryOperations`
- **Dialog Fragments**: `FactoryGateInDialog.fragment.xml`, `FactoryGateOutDialog.fragment.xml`
- **Backend Actions**:
  - `FactoryGateIn(...)`
  - `FactoryGateOut(...)`
  - `RecordFactoryOperation(...)` (Consolidated IN & OUT for direct operations)
- **Key Business Rules**:
  - **Factory Gate IN (Bay Check-In)**:
    - Records arrival timestamp (`factoryGateInDateTime`) and Gate IN supervisor/operator (`factoryGateInOperator`).
    - Designates plant destination: `factoryArea` (e.g., *Methanol Plant*, *Formalin Plant*, *Tank Farm*, *Raw Material Yard*).
    - Designates unloading location: `unloadingPoint` (e.g., *Bay 1*, *Silo 3*, *Storage Yard*).
    - Captures material description, delivery note number, and inbound arrival notes (`factoryGateInRemarks`).
    - Inherits consignment PO and invoice details from Security Check-in.
    - Sets `status = 'FACTORY_IN'`, `currentStage = 'FACTORY'`.
  - **Factory Gate OUT (Yard Clearance)**:
    - Records exit timestamp (`factoryGateOutDateTime`) and Gate OUT operator (`factoryGateOutOperator`), completely decoupled from Gate IN operator to accommodate shift handovers or different duty personnel.
    - Records Gate OUT pass type: `gateOutType` (`STANDARD`, `RGP`, `NRGP`, `MATERIAL_RETURN`, `EMPTY_VEHICLE`).
    - Verifies unloading/loading completion: `unloadingStatus` (`COMPLETED`, `PARTIAL`, `REJECTED`, `IN_PROGRESS`).
    - Records verified unloaded cargo quantity (`unloadedQuantity`) and unit (`quantityUnit`, e.g. `KG`, `MT`, `LTR`).
    - Enforces physical safety checklist: `goodsInspected` (boolean) and `sealVerified` (boolean).
    - Stores dedicated outbound clearance notes (`factoryGateOutRemarks`) without overwriting inbound notes.
    - Sets `status = 'FACTORY_OUT'`, `currentStage = 'FACTORY'`.
    - Generates printable Factory Yard Clearance Pass displaying both Inbound and Outbound operators and timestamps.

---

### Section 5: Security Gate Outbound Operations (Security Gate OUT)
- **Primary Persona**: `SecurityGateUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.SecurityOperations`
- **Dialog Fragment**: `SecurityGateOutDialog.fragment.xml`
- **Backend Action**: `SecurityGateOut(...)`
- **Key Business Rules**:
  - Permitted only after vehicle status reaches `WEIGHBRIDGE_OUT` or `FACTORY_OUT`.
  - 7-Point Physical Exit Checklist:
    1. Driver credentials verified (`exitDriverVerified`)
    2. Vehicle condition verified (`exitVehicleVerified`)
    3. Documentation verified (`exitDocumentsVerified`)
    4. Gate Pass authorized & signed (`gatePassVerified`)
    5. Delivery/consignment details reconciled (`deliveryDetailsVerified`)
    6. Empty vehicle inspection performed (`emptyInspectionVerified`)
    7. Material/return inspection performed (`materialInspected`)
  - Merges outbound exit metadata into the existing `SecurityGateEntries` entity (consolidated inbound/outbound record).
  - Transitions vehicle status to `SECURITY_OUT` and stage to `MAIN_GATE_OUT`.
  - Emits audit log record: `SECURITY_OUT_RECORDED`.

---

### Section 6: Main Gate Check-Out (Gate OUT & Completion)
- **Primary Persona**: `MainGateUser` / `Superadmin`
- **UI Screen**: `factory.gate.view.Operations`
- **Dialog Fragment**: `GateOutDialog.fragment.xml`
- **Backend Action**: `MainGateOut(gateInNumber)`
- **Key Business Rules**:
  - Permitted only when vehicle status is `SECURITY_OUT`.
  - Verifies that security inspection has cleared the vehicle to exit the plant.
  - Records exit timestamp `gateOutDateTime` and operator ID `gateOutOperator`.
  - Transitions vehicle status to `COMPLETED` and stage to `COMPLETED`.
  - Sets transaction to **closed/immutable**: Standard operators cannot modify closed transactions. Only `Admin` or `Superadmin` can make post-exit corrections.
  - Emits final audit log record: `GATE_OUT_COMPLETED`.

---

### Section 7: Entry-Wise Granular Editing & Role Segregation
The application provides two dedicated, segregated editing screens so that each department can update its own data without cross-department contamination:
1. **`EditGateEntry.view.xml` (`EditGateEntry.controller.js`)**:
   - Authorized to `MainGateUser`, `Admin`, `Superadmin`.
   - Modifies Main Gate entry fields: Vehicle Registration, Driver Name, Vehicle Type, Visit Purpose, Gate In Operator, Remarks.
   - Enforces vehicle registration regex and prevents changing the primary identifier `gateInNumber`.
   - Generates an audit trail entry logging the exact fields changed.
2. **`EditSecurityGateEntry.view.xml` (`EditSecurityGateEntry.controller.js`)**:
   - Authorized to `SecurityGateUser`, `Admin`, `Superadmin`.
   - Modifies Security Gate inspection fields: Driver License, Phone Number, Helper Name, Verification Checkboxes, PO Number, Invoice Number, Invoice Date, Route Assignment, Gate Pass Types, and Security Remarks.
   - Generates an audit trail entry for security modifications.

---

### Section 8: External S/4HANA Cloud Integration
- **Service Name**: `CE_PURCHASEORDER_0001`
- **Definition**: `srv/gate-service.cds` (Entity `PurchaseOrders`)
- **Metadata**: `srv/external/CE_PURCHASEORDER_0001.csn` & `.edmx`
- **Destination Configuration**: `package.json` (`S4HANA_CLOUD_PO` destination on SAP BTP).
- **Resilience & Fallback Handler** (`srv/gate-service.js`):
  - When the external SAP system or destination is reachable, queries live S/4HANA purchase orders using `@sap-cloud-sdk/connectivity` and `@sap-cloud-sdk/http-client`.
  - If the external S/4HANA destination is offline or running in local development mode without cloud credentials, it automatically falls back to an embedded sample PO catalog (`4500001001`, `4500001002`, `4500001003`, `PO-4500112233`, `PO-APL-7788`, `PO-DIRECT-8899`), preventing application failures.
  - Searchable in the UI via the `PurchaseOrderValueHelpDialog.fragment.xml`.

---

## 5. Security, Roles & Authorization Matrix (RBAC)

The system implements Role-Based Access Control (RBAC) across three layers:
1. **SAP BTP XSUAA** (`xs-security.json`): Scope definitions, role templates, and role collections.
2. **CAP CDS Authorization Policies** (`srv/gate-service-auth.cds`): Action-level `@(requires)` annotations and entity-level `@(restrict)` policies.
3. **Frontend Fiori Launchpad Permissions** (`app/webapp/model/models.js`): Dynamic UI tile, button, and action visibility based on authenticated roles.

### Role & Permission Matrix

| Role Collection | CDS Role Scope | Permitted Stations / Actions | Station UI Visibility |
| :--- | :--- | :--- | :--- |
| `Gate_MainGate_Operator` | `MainGateUser` | Create Gate IN (`CreateGateIn`), Final Gate OUT (`MainGateOut`), Edit Gate Entry (`EditGateEntry`). Line item delete for draft/cancelled entries. | **Main Gate Operations Only** (Other station tiles and tabs hidden) |
| `Gate_Security_Officer` | `SecurityGateUser` | Inbound Security Inspection (`SecurityGateIn`), Route Assignment (`AssignRoute`), Direct Factory Gate In, Factory Release, Outbound Security Clearance (`SecurityGateOut`), Edit Security Entry (`EditSecurityGateEntry`). | **Security Gate Operations Only** (Factory Gate and Weighbridge tiles/tabs hidden) |
| `Gate_Weighbridge_Operator` | `WeighbridgeUser` | Record Inbound & Outbound Scale Weighments (`RecordWeighment`), Generate and Print Weighment Slips. | **Weighbridge Operations Only** (Other station tiles and tabs hidden) |
| `Gate_Factory_Supervisor` | `FactoryGateUser` | Factory Yard Check-In (`FactoryGateIn`), Factory Yard Clearance (`FactoryGateOut`), Record Factory Operations (`RecordFactoryOperation`). | **Factory Gate Operations Only** (Security Gate and Weighbridge tiles/tabs hidden) |
| `Gate_Administrator` | `Admin` | Full CRUD on Master Data (Vehicles, Drivers, Transporters, Suppliers), Modify Completed/Cancelled Transactions, View System Audit Trail. | All Station Tiles & Master Data |
| `Gate_Super_Administrator` | `Superadmin` | Unrestricted operational, administrative, and audit access across all stations and all actions. | All Station Tiles & Master Data |
| `Gate_Auditor` | `Auditor` | Read-only access to all Gate Transactions, Weighments, Factory Events, and Security Logs. | Compliance & Audit Trail Only |

---

## 6. Entity Data Model Reference (`db/schema.cds`)

### 1. `GateTransactions` (Main Transaction Header)
- `ID`: UUID (Key)
- `gateInNumber`: String(30) (Unique business identifier, e.g. `GI-2026-000001`)
- `vehicleRegNo`: String(20) (e.g. `AS-01-AB-1234`)
- `vehicleType`: `VehicleType` enum (`TRUCK`, `TANKER`, `TRAILER`, `CONTAINER`, `LCV`, `OTHER`)
- `driverName`: String(100)
- `purpose`: `VisitPurpose` enum (`DELIVERY`, `PICKUP`)
- `status`: `GateStatus` enum (`GATE_IN`, `SECURITY_IN`, `WEIGHBRIDGE_IN`, `FACTORY_IN`, `FACTORY_OUT`, `WEIGHBRIDGE_OUT`, `SECURITY_OUT`, `COMPLETED`, `HOLD`, `CANCELLED`)
- `currentStage`: `GateStage` enum (`MAIN_GATE_IN`, `SECURITY_GATE_IN`, `WEIGHBRIDGE_IN`, `FACTORY`, `WEIGHBRIDGE_OUT`, `SECURITY_GATE_OUT`, `MAIN_GATE_OUT`, `COMPLETED`)
- `gateInDateTime`: Timestamp
- `gateInOperator`: String(100)
- `gateOutDateTime`: Timestamp
- `gateOutOperator`: String(100)
- `assignedRoute`: String(50) (`WEIGHBRIDGE` or `FACTORY`)
- `remarks`: String(500)
- **Associations & Compositions**:
  - `vehicle`: Association to `Vehicles`
  - `driver`: Association to `Drivers`
  - `transporter`: Association to `Transporters`
  - `supplier`: Association to `Suppliers`
  - `securityEntry`: Association to one `SecurityGateEntries`
  - `factoryEntry`: Association to one `FactoryGateEntries`
  - `deliveryDetails`: Composition of one `DeliveryDetails`
  - `pickupDetails`: Composition of one `PickupDetails`
  - `weighments`: Composition of many `WeighbridgeTransactions`
  - `factoryGateEvents`: Composition of many `FactoryGateEntries`
  - `securityExit`: Association to `SecurityGateEntries`
  - `auditLogs`: Composition of many `GateAuditLogs`

### 2. `SecurityGateEntries` (Consolidated Inbound & Outbound Security)
- `ID`: UUID (Key)
- `gateTransaction`: Association to `GateTransactions`
- `gateInNumber`: String(30)
- **Inbound Fields**:
  - `driverLicenseNo`, `driverPhoneNo`, `helperName`
  - `vehicleReportingDateTime`, `securityInDateTime`, `securityPersonnel`
  - `driverVerified`, `vehicleVerified`, `documentsVerified` (Booleans)
  - `poNumber`, `soNumber`, `invoiceNumber`, `invoiceDate`, `withoutPO`
  - `rgpDocumentNo`, `nrgpDocumentNo`, `gatePassType`
  - `assignedRoute`, `securityInRemarks`
- **Outbound Fields**:
  - `securityOutPersonnel`, `securityOutDateTime`
  - `exitDriverVerified`, `exitVehicleVerified`, `exitDocumentsVerified`, `gatePassVerified`, `deliveryDetailsVerified`, `emptyInspectionVerified`, `materialInspected` (Booleans)
  - `exitGatePassType`, `exitGatePassDocumentNo`, `securityOutRemarks`, `remarks`

### 3. `WeighbridgeTransactions` (Scale Weighments)
- `ID`: UUID (Key)
- `gateTransaction`: Association to `GateTransactions`
- `weighbridgeNumber`: String(30) (Scale station identifier)
- `weighmentType`: `WeighmentType` enum (`GROSS_IN`, `TARE_IN`, `GROSS_OUT`, `TARE_OUT`)
- `weight`: Decimal(15,3)
- `weightUnit`: `WeightUnit` enum (`KG`, `MT`, `TON` - default `KG`)
- `weighbridgeDateTime`: Timestamp
- `operator`: String(100)
- `remarks`: String(250)

### 4. `FactoryGateEntries` (Yard & Unloading Operations)
- `ID`: UUID (Key)
- `gateTransaction`: Association to `GateTransactions`
- `gateInNumber`: String(30)
- `factoryGateInDateTime`, `factoryGateInOperator`
- `factoryGateOutDateTime`, `factoryGateOutOperator`
- `poNumber`, `invoiceNumber`, `invoiceDate`, `supplierName`, `transporterName`, `deliveryNoteNo`
- `factoryArea`: String(100) (Plant area)
- `unloadingPoint`: String(100) (Bay or silo)
- `materialDescription`: String(200)
- `unloadingStatus`: String(30) (`COMPLETED`, `PARTIAL`, `REJECTED`)
- `unloadedQuantity`: Decimal(15,3), `quantityUnit`: String(10)
- `goodsInspected`: Boolean, `sealVerified`: Boolean
- `remarks`: String(500)

### 5. `DeliveryDetails` & `PickupDetails`
- Specific consignment details for purchase orders, supplier information, document verification statuses (`PENDING`, `VERIFIED`, `REJECTED`), and returnable/non-returnable gate pass records (`RGP`/`NRGP`).

### 6. `GateAuditLogs` (Immutable Process Audit Log)
- `ID`: UUID (Key)
- `gateTransaction`: Association to `GateTransactions`
- `action`: String(50) (e.g., `GATE_IN_CREATED`, `SECURITY_IN_COMPLETED`, `ROUTE_ASSIGNED`, `WEIGHMENT_RECORDED`, `FACTORY_GATE_IN`, `FACTORY_GATE_OUT`, `SECURITY_OUT_RECORDED`, `GATE_OUT_COMPLETED`, `TRANSACTION_UPDATED`)
- `oldStatus`, `newStatus`: `GateStatus`
- `oldStage`, `newStage`: `GateStage`
- `actionDateTime`: Timestamp
- `userId`, `userName`: String(100)
- `remarks`: String(500)

### 7. Master Data Entities
- `Vehicles`: Registration number, vehicle type, make, model, capacity, insurance, fitness, pollution certificate, permit.
- `Drivers`: Driver code, name, license number, license type, expiry date, phone, address.
- `Transporters`: Transporter code, name, GSTIN, PAN, contact person, phone, email, address.
- `Suppliers`: Supplier code, name, GSTIN, contact person, phone, address, SAP Business Partner reference.

---

## 7. Frontend User Interface Architecture (`app/webapp`)

The frontend application in `app/webapp` provides a responsive SAP Fiori experience designed for rapid, touch-friendly, and keyboard-friendly plant operations.

### Views & Controllers Guide

| View / Controller | Purpose & Operational Flow |
| :--- | :--- |
| `Landing` (`Landing.view.xml`, `Landing.controller.js`) | Opening screen presenting the **Vehicle Category Selection Hero**. Allows operators to choose between **TANKER** (TMS system) and **OTHER VEHICLE** (General Cargo, Trucks, Containers, LCV). Displays live real-time KPI overview counters across the plant. |
| `Dashboard` (`Dashboard.view.xml`, `Dashboard.controller.js`) | Role-based SAP Fiori Launchpad displaying live operations tiles for each station (Main Gate, Security Gate, Weighbridge, Factory Gate), Master Data tiles, and compliance links. Filters tiles automatically based on the logged-in user's roles. |
| `Operations` (`Operations.view.xml`, `Operations.controller.js`) | **Main Gate Operations Station**: Lists all active gate entries. Features live search, filtering, Gate IN creation dialog, Gate OUT exit clearance dialog, slip printing, and deep links to station operations. |
| `SecurityOperations` (`SecurityOperations.view.xml`, `SecurityOperations.controller.js`) | **Security Gate Station**: Filterable queue segmented by *Awaiting Gate IN*, *Inside Plant*, *Awaiting Gate OUT*, and *Cleared*. Enables physical inspection, PO/invoice verification, route assignment (`To Weighbridge` or `To Factory`), and outbound security exit clearance. |
| `WeighbridgeOperations` (`WeighbridgeOperations.view.xml`, `WeighbridgeOperations.controller.js`) | **Weighbridge Station**: Filterable scale queue segmented by *Awaiting Inbound*, *Inside Yard*, *Awaiting Outbound*, and *Scale Done*. Captures scale readings for gross/tare weighments, computes net cargo weight, and displays the electronic Weighbridge Slip. |
| `FactoryOperations` (`FactoryOperations.view.xml`, `FactoryOperations.controller.js`) | **Factory Gate / Yard Station**: Tracks arrival at factory bays, assignment of plant areas and unloading points, goods physical inspection, unloaded quantity entry, and yard exit clearance. |
| `EditGateEntry` (`EditGateEntry.view.xml`, `EditGateEntry.controller.js`) | Dedicated form for Main Gate operators and administrators to edit vehicle registration numbers, drivers, purposes, and operators. Generates audit trail logs. |
| `EditSecurityGateEntry` (`EditSecurityGateEntry.view.xml`, `EditSecurityGateEntry.controller.js`) | Dedicated form for Security officers to update driver credentials, verification checklist flags, PO numbers, invoice details, and gate passes. Generates audit trail logs. |
| `Viewer` (`Viewer.view.xml`, `Viewer.controller.js`) | Embedded iframe host allowing operators to open SAP Fiori Elements List Report and Object Page applications directly inside the Fiori Launchpad shell without opening external tabs. |

---

## 8. Verification and Automated Testing Reference

The application includes 10 automated test suites located in the `test/` directory. All tests run in-memory against SQLite (`sqlite::memory:`):

| Test File | Test Suite Name | Scenarios Covered |
| :--- | :--- | :--- |
| `gate-crud.test.js` | Gate Transactions CRUD | Creation, mandatory field checks, vehicle registration regex validation, active transaction duplication prevention, auto-numbering (`GI-YYYY-NNNNNN`), status update guards, and audit log generation. |
| `security-gate.test.js` | Security Gate Operations | Security Gate IN check-in, driver/vehicle/document verification, delivery PO capture, pickup RGP/NRGP capture, status transition to `SECURITY_IN`. |
| `security-route-assign.test.js` | Route Assignment & Auth | Route assignment to `WEIGHBRIDGE` (stage `WEIGHBRIDGE_IN`) or `FACTORY` (stage `FACTORY`), direct execution of `FactoryGateIn` by `SecurityGateUser`. |
| `weighbridge.test.js` | Weighbridge Scale Operations | Inbound `GROSS_IN` and `TARE_IN`, outbound `TARE_OUT` and `GROSS_OUT`, net weight calculation, stage validation guards, weighbridge slip data. |
| `factory-gate.test.js` | Factory Gate Delivery Flow | Weighed delivery vs direct delivery, plant area assignment, unloading status, seal verification, and stage guards. |
| `bypass-weighbridge.test.js` | Weighbridge Bypass Flows | Unweighed direct factory entry from `SECURITY_IN` to `FACTORY_IN` to `FACTORY_OUT` to `SECURITY_OUT` to `COMPLETED`, audit logging of scale bypass. |
| `entry-wise-edit.test.js` | Granular Entry-Wise Editing | Independent modification of Main Gate fields vs Security Gate fields, authorization checks, and audit logging. |
| `security-gate-out.test.js` | Outbound Security Clearance | 7-point outbound security checklist, gate pass verification, status transition to `SECURITY_OUT`. |
| `gate-out.test.js` | Main Gate OUT Clearance | Final gate out clearance, transition to `COMPLETED`, locking of closed transactions. |
| `po-service.test.js` | External Purchase Orders | S/4HANA PO query execution, filtering by supplier, and local fallback catalog resilience. |

### Running the Test Suite

Execute all tests with:
```bash
npm test
```
All 10 test suites pass completely and synchronously.

---

## 9. How to Run and Preview the Application Locally

1. **Start the CAP Development Server**:
   ```bash
   cds watch
   ```
2. **Access the Custom Fiori Freestyle Launchpad**:
   Open browser at:
   ```
   http://localhost:4004/webapp/index.html
   ```
   *(Or navigate to `http://localhost:4004/`, which automatically redirects to `/webapp/index.html`).*

3. **Switch Between Operational Personas**:
   In the top Shellbar, select any of the preconfigured mock personas:
   - `⚡ superadmin_user (Superadmin)` - Full operational access
   - `🚪 maingate_user (MainGateUser)` - Main Gate check-in and check-out
   - `🛡️ security_user (SecurityGateUser)` - Security check-in, route assignment, exit clearance
   - `⚖️ weighbridge_user (WeighbridgeUser)` - Scale gross/tare weighing
   - `🏭 factory_user (FactoryGateUser)` - Factory yard unloading and bay clearance

4. **Access the SAP Fiori Elements Floorplan App**:
   Navigate to:
   ```
   http://localhost:4004/gate-entry/webapp/index.html#preview-app
   ```
   Or click the **"Fiori Elements App"** button inside Main Gate Operations.
