# Quotation Status Flow - Issues Fixed

## Problems Identified & Resolved

### 1. **Unclear Status Meanings**
**Before**: Status badges showed colors but no context about what each meant
**After**: Each status now has a tooltip explaining its meaning
- Draft: "Cotización en edición"
- Sent: "Enviada al cliente"  
- Accepted: "Aceptada por cliente"
- Converted: "Convertida en venta"
- Cancelled: "Cancelada/Anulada"

### 2. **Invalid State Transitions Were Possible**
**Before**: Could edit or convert quotations from ANY status, including draft→converted (skipping sent/accepted)
**After**: Strict validation rules:
- **Edit** only available for: draft, sent, accepted
- **Convert to Sale** only available for: sent, accepted
- **Drafts cannot be converted directly** - must be sent/accepted first
- **Prevents** converting already-converted quotations

### 3. **Payment Confirmation Inconsistency**
**Before**: Payment confirmation button appeared for all statuses, even non-converted ones
**After**: Payment operations (confirm payment, select delivery) only available for:
- Status = "converted" (concrete sale)
- Only then can mark as "en ruta" or "entregado"
- Only then can confirm payment

### 4. **Incomplete Status Fields**
**Before**: Some status transitions didn't populate necessary fields
**After**: Full workflow:
```
Draft
  └─ [Edit] → Can adjust quotation details
     └─ [Send/Mark as Sent] → Status: "sent"
        └─ [Edit] → Can still modify
           └─ [Mark as Accepted] → Status: "accepted"
              └─ [Confirm Convert] → Status: "converted" + Sets payment_method
                 └─ [Confirm Payment] → Sets paid: true + Method
                    └─ [Track Delivery] → in_route → delivered
                       └─ Final State: Completed sale
```

### 5. **Cancel Operation Logic**
**Before**: Cancel was universally available but logic was unclear
**After**: Clear behavior:
- **Draft/Sent/Accepted**: Cancel quotation (no stock reversal)
- **Converted**: Anular venta (DOES reverse stock - creates return movement)
- **Cancelled**: No further operations allowed

### 6. **Stock Management Bugs**

#### Bug-020 Fixed: Stock Reversal on Cancel
When cancelling a converted quotation:
1. Iterates each item in the quotation
2. Creates a "return" type movement
3. Restores stock to original quantity
4. Updates product stock count
5. Records reason: "Cancelación: [user-provided reason]"

#### Bug-009 Fixed: Movement Reason Population
When converting to sale:
1. Creates exit movements for each item
2. Sets reason: "Venta a [client_name]"
3. Sets reference: "Venta [folio]"
4. Links quotation_id to movement for traceability

#### Bug-018 Fixed: Stock Validation Before Convert
Before allowing conversion:
1. Fetch current product stock for each item
2. Verify item.quantity ≤ product.stock
3. Block conversion with specific error message
4. Show exact available quantity

### 7. **Payment Method Requirement**
**Before**: Could convert without specifying payment method
**After**: Payment method is REQUIRED to convert:
- User must select method (Efectivo, Transferencia, Tarjeta, etc.)
- Custom method allowed via text input
- Cannot proceed without selection
- Prevents "Por definir" or placeholder values at conversion time

## Status Field Relationships

| Status | Can Edit | Can Convert | Can Pay | Can Track | Can Cancel |
|--------|----------|-------------|---------|-----------|-----------|
| draft | ✅ | ❌ | ❌ | ❌ | ✅ |
| sent | ✅ | ✅ | ❌ | ❌ | ✅ |
| accepted | ✅ | ✅ | ❌ | ❌ | ✅ |
| converted | ❌ | ❌ | ✅ | ✅ | ✅ |
| cancelled | ❌ | ❌ | ❌ | ❌ | ❌ |

## Related Fields Populated on Status Change

### On Convert to Sale
- `status` → "converted"
- `payment_method` → [user selected]
- Creates Movement records (exit type)
- Updates Product.stock

### On Payment Confirmation
- `paid` → true
- `payment_method` → [confirmed method] (if different)
- Updates delivery tracking

### On Delivery Tracking
- `in_route` → true/false
- `delivered` → true/false (only when in_route = false)
- Mutually exclusive: can't be both in_route and delivered

### On Cancellation (Converted)
- `status` → "cancelled"
- `cancellation_reason` → [user provided]
- Creates Movement records (return type)
- Restores Product.stock

## Notes for Future Development

1. **Status History**: Consider adding a separate entity to track status transitions with timestamps
2. **Payment Confirmation**: Should also allow confirming method without marking delivered
3. **Invoice Status**: Separate from quotation status - can change independently
4. **Expiration Logic**: Draft/Sent/Accepted can be auto-expired based on valid_until date
5. **Webhook Notifications**: Send client notifications on status changes (sent, accepted, delivered)

## Testing Checklist

- [ ] Draft quotation cannot be converted directly (must be sent first)
- [ ] Cannot edit converted or cancelled quotations
- [ ] Payment confirmation requires converted status
- [ ] Cancelling converted quotation restores stock correctly
- [ ] Payment method is required before conversion
- [ ] Delivery tracking only available for converted quotations
- [ ] Cancel operation requires cancellation reason
- [ ] Invalid state transitions are blocked with helpful error messages