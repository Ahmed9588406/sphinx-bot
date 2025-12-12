# 💻 Code Snippets & Quick Reference

## 🎯 Quick Integration Guide

### 1. Import OrderReceipt in Your Components

```typescript
import OrderReceipt from '@/app/components/OrderReceipt';

// Use it
<OrderReceipt order={confirmedOrder} />
```

### 2. Download Order as PDF

```typescript
// Button to trigger PDF download
<button onClick={handlePDFDownload}>
  تحميل الفاتورة (PDF)
</button>

// Handler function
const handlePDFDownload = async () => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`/api/orders/${orderId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${orderNumber}.pdf`;
  link.click();
};
```

### 3. Create Order via Chat

```typescript
// Chat message
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: "I want to order 2 shirts",
    userId: user.id,
    userName: user.name
  })
});

const data = await response.json();

// Check if order was created
if (data.draftOrder) {
  console.log('Draft order created:', data.draftOrder);
}

// Check if order was confirmed
if (data.confirmedOrder) {
  console.log('Order confirmed:', data.confirmedOrder);
  // Display receipt
  <OrderReceipt order={data.confirmedOrder} />
}
```

---

## 🔧 API Endpoints

### Chat API
```
POST /api/chat
Content-Type: application/json
Authorization: Bearer {token}

{
  "message": "I want to order 2 shirts",
  "userId": "user-123",
  "userName": "Ahmed",
  "conversationHistory": []
}

Response:
{
  "reply": "AI response text",
  "docs": [],
  "draftOrder": { /* order object */ },
  "confirmedOrder": { /* order object */ }
}
```

### Create Order API
```
POST /api/orders
Content-Type: application/json
Authorization: Bearer {token}

{
  "items": [
    {
      "product_id": "prod-123",
      "quantity": 2,
      "unit_price": 100
    }
  ],
  "shipping": {
    "name": "Ahmed",
    "phone": "0100000000",
    "address": "Cairo"
  }
}

Response:
{
  "order": { /* order details */ }
}
```

### Get Order Details
```
GET /api/orders/{id}
Authorization: Bearer {token}

Response:
{
  "order": { /* order object */ },
  "items": [ /* order items */ ]
}
```

### Download PDF
```
GET /api/orders/{id}/pdf
Authorization: Bearer {token}

Response:
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-SFX-abc123.pdf"

[PDF Binary Content]
```

---

## 🎨 Component Props

### OrderReceipt Props
```typescript
interface Props {
  order: {
    id: string;
    created_at: string;
    status: 'draft' | 'confirmed' | 'pending' | 'shipped' | 'delivered';
    total: number;
    currency: string;
    shipping_address?: {
      name?: string;
      address?: string;
      phone?: string;
    };
    metadata?: {
      order_number?: string;
      customer_name?: string;
    };
    order_items: Array<{
      id: string;
      quantity: number;
      price: number;
      products?: {
        title: string;
        description?: string;
        product_images?: Array<{ url?: string }>;
      };
    }>;
  };
}
```

### ChatWidget Props
```typescript
interface ChatWidgetProps {
  conversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  onMessageSent?: () => void;
}
```

---

## 🎯 Extract Order Details Function

```typescript
import { extractOrderDetails } from '@/lib/agent';

// Extract from message
const orderData = await extractOrderDetails(
  "I want to order 2 black shirts and 1 pants for Ahmed at downtown Cairo"
);

console.log(orderData);
// Output:
{
  "items": [
    {
      "product_title": "black shirts",
      "quantity": 2,
      "unit_price": null
    },
    {
      "product_title": "pants",
      "quantity": 1,
      "unit_price": null
    }
  ],
  "shipping": {
    "name": "Ahmed",
    "address": "downtown Cairo",
    "phone": null
  }
}
```

---

## 📱 CSS Classes Used

### Tailwind Classes for Styling
```tailwind
/* Colors */
bg-gradient-to-r from-emerald-600 to-teal-600
text-white
bg-white
border border-slate-200

/* Spacing */
px-6 py-6
p-4
m-2
gap-3

/* Typography */
text-sm
font-semibold
font-bold
font-mono
text-slate-900
text-slate-600

/* Layout */
flex
grid
grid-cols-2
flex-col
justify-between

/* Responsive */
md:items-center
max-w-2xl
w-full

/* Effects */
rounded-lg
rounded-2xl
shadow-lg
shadow-xl
hover:shadow-lg
hover:scale-105
transition-all
animate-pulse
```

---

## 🔐 Security Checks

### Check User Authentication
```typescript
const user = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Verify Order Ownership
```typescript
const { data: order } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .eq('user_id', user.id) // ← Ensures user owns the order
  .single();

if (!order) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

### Validate Order Status
```typescript
// Draft orders cannot be downloaded
if (order.status === 'draft') {
  return NextResponse.json(
    { error: 'Draft orders cannot be downloaded' },
    { status: 403 }
  );
}
```

---

## 📊 Database Queries

### Create Order
```sql
INSERT INTO orders (user_id, status, total, currency, shipping_address, metadata)
VALUES (
  'user-123',
  'draft',
  650.00,
  'EGP',
  '{"name": "Ahmed", "address": "Cairo", "phone": "0100000000"}',
  '{"order_number": "SFX-abc123-5678", "created_via": "chat"}'
)
RETURNING id;
```

### Add Order Items
```sql
INSERT INTO order_items (order_id, product_id, quantity, price)
VALUES
  ('order-123', 'prod-456', 2, 100.00),
  ('order-123', 'prod-789', 1, 200.00);
```

### Confirm Order
```sql
UPDATE orders
SET status = 'confirmed', updated_at = NOW()
WHERE id = 'order-123' AND user_id = 'user-456';
```

### Fetch Order with Items
```sql
SELECT 
  o.*,
  json_agg(
    json_build_object(
      'id', oi.id,
      'quantity', oi.quantity,
      'price', oi.price,
      'product_id', oi.product_id
    )
  ) as order_items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.id = 'order-123'
GROUP BY o.id;
```

---

## 🎨 Styling Reference

### Modern Card Design
```tsx
<div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
  {/* Header */}
  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 text-white">
    <h2 className="text-3xl font-bold">Title</h2>
  </div>
  
  {/* Content */}
  <div className="px-6 py-6">
    <p className="text-slate-800">Content</p>
  </div>
  
  {/* Footer */}
  <div className="px-6 py-4 bg-slate-900 text-white">
    Footer
  </div>
</div>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
  {/* Items */}
</div>
```

### Icon Integration
```tsx
import { Download, CheckCircle, Package, MapPin } from 'lucide-react';

<Download className="w-5 h-5 text-emerald-600" />
<CheckCircle className="w-5 h-5 text-white" />
<Package className="w-5 h-5 text-slate-700" />
<MapPin className="w-5 h-5 text-purple-600" />
```

---

## 🔄 State Management

### Chat Message State
```typescript
type Message = {
  role: "user" | "assistant";
  content: string;
  order?: {
    id: string;
    status: string;
    total: number;
    order_items: OrderItem[];
  };
};

const [messages, setMessages] = useState<Message[]>([]);

// Add message with order
const newMessage: Message = {
  role: 'assistant',
  content: 'Order confirmed!',
  order: confirmedOrder
};

setMessages(prev => [...prev, newMessage]);
```

### Order State
```typescript
type Order = {
  id: string;
  created_at: string;
  status: 'draft' | 'confirmed';
  total: number;
  order_items: OrderItem[];
};

const [order, setOrder] = useState<Order | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

---

## 📝 Form Example

### Order Creation Form
```tsx
<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    {/* Items */}
    <div>
      <label className="block text-sm font-semibold mb-2">
        Products
      </label>
      <input
        type="text"
        placeholder="Product name"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
      />
    </div>
    
    {/* Shipping */}
    <div>
      <label className="block text-sm font-semibold mb-2">
        Shipping Address
      </label>
      <textarea
        placeholder="Your address"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
      />
    </div>
    
    {/* Submit */}
    <button
      type="submit"
      className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-semibold hover:shadow-lg"
    >
      Create Order
    </button>
  </div>
</form>
```

---

## 🧪 Testing Snippets

### Test Order Creation
```typescript
const testOrderCreation = async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'I want to order 2 shirts'
    })
  });
  
  const data = await response.json();
  console.assert(data.draftOrder, 'Draft order should be created');
  console.log('✓ Order created:', data.draftOrder.id);
};
```

### Test PDF Download
```typescript
const testPDFDownload = async (orderId: string) => {
  const response = await fetch(`/api/orders/${orderId}/pdf`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.assert(response.ok, 'PDF should download successfully');
  console.assert(
    response.headers.get('Content-Type') === 'application/pdf',
    'Response should be PDF'
  );
  console.log('✓ PDF downloaded successfully');
};
```

---

## 📚 Type Definitions

```typescript
// Order Types
type OrderStatus = 'draft' | 'confirmed' | 'pending' | 'shipped' | 'delivered';

type Order = {
  id: string;
  user_id: string;
  status: OrderStatus;
  total: number;
  currency: string;
  shipping_address: ShippingAddress | null;
  metadata: OrderMetadata | null;
  order_items: OrderItem[];
  created_at: string;
  updated_at: string;
};

type ShippingAddress = {
  name?: string;
  address?: string;
  phone?: string;
};

type OrderMetadata = {
  order_number?: string;
  customer_name?: string;
  created_via?: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price: number;
  metadata?: Record<string, any>;
  products?: {
    title: string;
    description: string | null;
    price: number;
    currency: string;
    product_images?: Array<{ url: string | null }>;
  };
};
```

---

## 🚀 Deployment Checklist

```bash
# 1. Build the project
npm run build

# 2. Run tests
npm run test

# 3. Check linting
npm run lint

# 4. Deploy to production
vercel deploy --prod

# 5. Verify endpoints
curl -I https://yourdomain.com/api/orders/[id]/pdf

# 6. Check database
supabase db pull
```

---

## 💡 Pro Tips

1. **Use TypeScript** - Prevents bugs, better IDE support
2. **Validate Inputs** - Always validate user and API inputs
3. **Handle Errors** - Never ignore promise rejections
4. **Log Everything** - Use console.log for debugging
5. **Test Thoroughly** - Run all test cases before deploying
6. **Monitor Performance** - Track API response times
7. **Document Code** - Add comments for complex logic
8. **Use Environment Variables** - Never hardcode secrets
9. **Cache Strategically** - Cache user data when appropriate
10. **Optimize Images** - Use next/image for automatic optimization

---

**Happy coding! 🎉**
