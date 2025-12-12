# 🧪 Order System - Testing Guide

## Pre-Test Checklist

- [ ] Environment variables configured
- [ ] Supabase database connected
- [ ] ChatAnywhere API working
- [ ] User authenticated in chat
- [ ] Browser console open (F12)
- [ ] Network tab visible

---

## Test Case 1: Simple Order Creation

**Objective:** Verify basic order creation and draft state

**Steps:**
1. Open chat widget
2. Type: `"I want to order 1 shirt"`
3. Observe: Draft order created, summary displayed

**Expected Output:**
```
📦 **ملخص الطلب:**
1. shirt × 1 = {price} EGP

**المجموع:** {price} EGP

**هل تأكد الطلب؟** (اكتب "نعم" للتأكيد أو "لا" للإلغاء)
```

**Verify:**
- [ ] Order appears in message history
- [ ] Summary text is visible
- [ ] Confirmation prompt shown
- [ ] No errors in console

---

## Test Case 2: Order with Customer Details

**Objective:** Verify extraction of customer information

**Steps:**
1. Type: `"Order 2 shirts, name Ahmed, phone 0100000000, address downtown Cairo"`
2. Observe: All details extracted and shown

**Expected Output:**
```
📦 **ملخص الطلب:**
1. shirts × 2 = {price} EGP

**المجموع:** {price} EGP

📍 **تفاصيل الشحن:**
الاسم: Ahmed
الهاتف: 0100000000
العنوان: downtown Cairo

**هل تأكد الطلب؟**
```

**Verify:**
- [ ] All customer info extracted
- [ ] Shipping details displayed correctly
- [ ] Arabic formatting preserved
- [ ] No typos in names/addresses

---

## Test Case 3: Order Confirmation

**Objective:** Verify order confirmation process

**Steps:**
1. Complete Test Case 1
2. Type: `"نعم"` (or "yes")
3. Observe: Order status changes to confirmed

**Expected Output:**
```
✅ تم تأكيد طلبك بنجاً! 🎉
رقم الطلب: SFX-{code}
شكراً لاختيارك Sphinx Fit!
```

Then receipt card appears with:
- [ ] ✓ Confirmed badge
- [ ] Order number
- [ ] Customer name
- [ ] Items list
- [ ] Total price
- [ ] Download button

**Database Check:**
```sql
SELECT * FROM orders WHERE status = 'confirmed' ORDER BY created_at DESC LIMIT 1;
-- Should return the order with status='confirmed'
```

---

## Test Case 4: Order Cancellation

**Objective:** Verify user can cancel order

**Steps:**
1. Create a draft order (Test Case 1)
2. Type: `"لا"` (or "no")
3. Observe: Order should not be confirmed

**Expected Output:**
```
No problem, let me know if you need anything else!
```

**Database Check:**
```sql
SELECT * FROM orders WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1;
-- Should still exist with status='draft'
```

---

## Test Case 5: PDF Download

**Objective:** Verify PDF generation and download

**Steps:**
1. Complete a confirmed order (Test Case 3)
2. Receipt card should appear
3. Click "تحميل الفاتورة (PDF)" button
4. Observe: File download starts

**Expected Behavior:**
- [ ] Button changes to "جاري التحميل..." while loading
- [ ] Download completes within 5 seconds
- [ ] File named `receipt-SFX-{code}.pdf`
- [ ] PDF opens/downloads correctly
- [ ] PDF contains all order details

**Manual PDF Check:**
- [ ] Header: "Sphinx Fit" visible
- [ ] Order number correct
- [ ] Customer name correct
- [ ] All items listed
- [ ] Total price shown
- [ ] Formatted properly in Arabic (RTL)

---

## Test Case 6: Print Functionality

**Objective:** Verify print button works

**Steps:**
1. Create confirmed order (Test Case 3)
2. Click "طباعة الفاتورة" button
3. System opens print preview

**Expected Behavior:**
- [ ] Print dialog opens
- [ ] Receipt displays correctly
- [ ] Can print to PDF
- [ ] Can print to physical printer
- [ ] Colors preserved

---

## Test Case 7: Multiple Items Order

**Objective:** Verify order with multiple products

**Steps:**
1. Type: `"I need 2 shirts, 1 pants, 3 socks"`
2. Complete confirmation

**Expected Output:**
```
📦 **ملخص الطلب:**
1. shirts × 2 = {price} EGP
2. pants × 1 = {price} EGP
3. socks × 3 = {price} EGP

**المجموع:** {total} EGP
```

**Verify:**
- [ ] All items listed
- [ ] Individual prices correct
- [ ] Total calculated correctly
- [ ] Receipt shows all items
- [ ] PDF includes all items

---

## Test Case 8: Mobile Display

**Objective:** Verify responsive design on mobile

**Steps:**
1. Open chat on mobile device (or browser dev tools)
2. Set viewport to 375px width (iPhone size)
3. Create an order
4. View receipt

**Expected:**
- [ ] Receipt fits on screen
- [ ] Text is readable
- [ ] Buttons are clickable
- [ ] No horizontal scroll needed
- [ ] Images scale correctly
- [ ] Touch-friendly spacing

---

## Test Case 9: Arabic Support

**Objective:** Verify proper Arabic text handling

**Steps:**
1. Type order in Arabic: `"أطلب 2 جاكيت و 1 سروال باسم محمود"`
2. Complete order
3. Check receipt and PDF

**Expected:**
- [ ] Arabic text displays correctly (RTL)
- [ ] No character encoding issues
- [ ] Names preserved
- [ ] PDF shows Arabic properly
- [ ] Print shows Arabic correctly

---

## Test Case 10: Authentication Edge Cases

**Objective:** Verify security of order endpoints

**Steps:**

### Test 10a: Without Authentication
1. Unauthenticated user tries to view order
2. Type: `"show my orders"`

**Expected:**
- [ ] Cannot access order details
- [ ] Cannot download PDF
- [ ] Must login first

### Test 10b: Wrong User Accessing Order
1. User A creates order
2. User B tries to access User A's order via API

**Expected:**
```sql
GET /api/orders/{user_a_order_id}/pdf
Authorization: Bearer {user_b_token}
-- Response: 404 Not Found or 403 Forbidden
```

### Test 10c: Draft Order Download Attempt
1. Create draft order (not confirmed)
2. Try to download PDF

**Expected:**
- [ ] Cannot download draft orders
- [ ] API returns 403 Forbidden
- [ ] Error message shown to user

---

## Test Case 11: Database Integrity

**Objective:** Verify data consistency

**After completing orders, run:**

```sql
-- Check orders exist
SELECT COUNT(*) as total_orders FROM orders;

-- Check all confirmed orders have items
SELECT o.id, COUNT(oi.id) as item_count 
FROM orders o 
LEFT JOIN order_items oi ON o.id = oi.order_id 
WHERE o.status = 'confirmed' 
GROUP BY o.id;

-- Check for orphaned items
SELECT * FROM order_items 
WHERE order_id NOT IN (SELECT id FROM orders);

-- Verify totals are correct
SELECT o.id, o.total, SUM(oi.price * oi.quantity) as calculated_total 
FROM orders o 
JOIN order_items oi ON o.id = oi.order_id 
GROUP BY o.id 
HAVING o.total != SUM(oi.price * oi.quantity);
```

**Expected:**
- [ ] Orders table has entries
- [ ] All confirmed orders have items
- [ ] No orphaned order items
- [ ] Totals match calculations

---

## Performance Tests

### Test 12: Load Time

**Objective:** Verify reasonable response times

**Steps:**
1. Open Network tab (F12)
2. Create an order
3. Check response times

**Expected:**
- [ ] Chat response: < 3 seconds
- [ ] Order creation: < 1 second
- [ ] PDF generation: < 5 seconds
- [ ] Total time to confirmed: < 10 seconds

### Test 13: Concurrent Orders

**Objective:** Multiple users creating orders simultaneously

**Steps:**
1. Open 3 chat windows (or users)
2. Each creates an order at same time
3. Verify all complete without errors

**Expected:**
- [ ] All 3 orders created successfully
- [ ] No database conflicts
- [ ] No duplicate order numbers
- [ ] All different IDs

---

## Error Handling Tests

### Test 14: Network Failure

**Steps:**
1. Create order
2. Disconnect internet mid-confirmation
3. Reconnect

**Expected:**
- [ ] Error message shown
- [ ] Graceful recovery
- [ ] Can retry operation
- [ ] No data corruption

### Test 15: Invalid Input

**Steps:**
1. Type: `"order -5 shirts"` (negative quantity)
2. Type: `"order abc shirts"` (non-numeric)

**Expected:**
- [ ] AI either corrects or asks clarification
- [ ] No order created for invalid input
- [ ] Error message is helpful

### Test 16: Missing Product

**Steps:**
1. Type: `"order 2 unicorns"` (product doesn't exist)

**Expected:**
- [ ] Order still created
- [ ] Product marked as null
- [ ] Uses provided name
- [ ] User can still confirm

---

## Browser Compatibility

Test on multiple browsers:

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✓ | ✓ | __ |
| Firefox | ✓ | ✓ | __ |
| Safari | ✓ | ✓ | __ |
| Edge | ✓ | - | __ |
| Opera | ✓ | - | __ |

---

## Console Checks

After each test, verify:
```javascript
// In browser console:

// 1. No error messages
console.log('Errors');

// 2. Check API calls
console.log(performance.getEntriesByType("resource"));

// 3. Storage usage
console.log(localStorage);

// 4. Check for memory leaks
console.log(memory);
```

---

## Sign-Off

When all tests pass:

- [ ] Date: ___________
- [ ] Tester Name: ___________
- [ ] Build Version: ___________
- [ ] Environment: ___________
- [ ] Issues Found: ___________
- [ ] Ready for Production: Yes / No

---

## Issue Tracking Template

For any failures found:

```
TEST CASE: [Number and Name]
SEVERITY: [Critical/High/Medium/Low]
STEPS TO REPRODUCE:
1. ...
2. ...
3. ...

EXPECTED:
...

ACTUAL:
...

CONSOLE ERRORS:
...

ENVIRONMENT:
- Browser: 
- OS: 
- User Agent: 
```

---

## Quick Command Reference

```bash
# Check database
npm run db:console
# OR
supabase db pull

# View logs
supabase functions list
supabase logs --follow

# Test API endpoint
curl -X GET http://localhost:3000/api/orders/[id]/pdf \
  -H "Authorization: Bearer TOKEN"

# Reset test data
supabase db reset
```

---

**Good luck with testing! 🚀**
