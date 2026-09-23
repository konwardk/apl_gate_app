using { CE_PURCHASEORDER_0001 as external } from './external/CE_PURCHASEORDER_0001';

@path: '/po'
service POService {
    @readonly
    entity PurchaseOrders as projection on external.PurchaseOrder {
        key PurchaseOrder,
            PurchaseOrderType,
            Supplier,
            CompanyCode,
            PurchasingOrganization,
            PurchasingGroup,
            PurchaseOrderDate,
            DocumentCurrency
    };

    @readonly
    entity PurchaseOrderItems as projection on external.PurchaseOrderItem {
        key PurchaseOrder,
        key PurchaseOrderItem,
            PurchaseOrderItemText,
            Plant,
            StorageLocation,
            OrderQuantity,
            PurchaseOrderQuantityUnit,
            NetPriceAmount,
            DocumentCurrency
    };
}