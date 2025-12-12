/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

async function getUserFromToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
  if (!url || !anonKey) return null;
  
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });

    const user = await getUserFromToken(_req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(url, serviceKey);

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
    }

    // Only allow PDF download for confirmed orders
    if (order.status === 'draft') {
      return NextResponse.json({ error: 'Draft orders cannot be downloaded' }, { status: 403 });
    }

    // Fetch order items with product details
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*, products(id, title, description, price, currency)')
      .eq('order_id', order.id);

    // Generate PDF using jsPDF
    const orderNumber = order.metadata?.order_number || order.id;
    const customerName = order.shipping_address?.name || order.metadata?.customer_name || 'Customer';
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header - Brand name
    doc.setFillColor(5, 150, 105); // Emerald color
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text('Sphinx Fit', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Order Receipt', pageWidth / 2, 32, { align: 'center' });

    yPos = 55;

    // Order Info Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    // Order Number
    doc.setFont('helvetica', 'bold');
    doc.text('Order Number:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(orderNumber, 70, yPos);
    
    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth - 80, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(orderDate, pageWidth - 60, yPos);
    
    yPos += 10;

    // Customer Info
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(customerName, 70, yPos);
    
    // Status
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', pageWidth - 80, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(5, 150, 105);
    doc.text(order.status.toUpperCase(), pageWidth - 60, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 10;

    // Phone
    if (order.shipping_address?.phone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Phone:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(order.shipping_address.phone, 70, yPos);
      yPos += 8;
    }

    // Address
    if (order.shipping_address?.address) {
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      const addressLines = doc.splitTextToSize(order.shipping_address.address, 120);
      doc.text(addressLines, 70, yPos);
      yPos += addressLines.length * 6;
    }

    yPos += 10;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    // Items Table Header
    doc.setFillColor(243, 244, 246);
    doc.rect(20, yPos - 5, pageWidth - 40, 10, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('#', 25, yPos);
    doc.text('Product', 35, yPos);
    doc.text('Qty', 120, yPos);
    doc.text('Price', 140, yPos);
    doc.text('Total', 165, yPos);
    
    yPos += 10;

    // Items
    doc.setFont('helvetica', 'normal');
    (orderItems || []).forEach((item: any, idx: number) => {
      const productTitle = item.products?.title || 'Product';
      const lineTotal = (item.price * item.quantity).toFixed(0);
      
      doc.text(String(idx + 1), 25, yPos);
      
      // Truncate long product names
      const truncatedTitle = productTitle.length > 40 ? productTitle.substring(0, 37) + '...' : productTitle;
      doc.text(truncatedTitle, 35, yPos);
      
      doc.text(String(item.quantity), 120, yPos);
      doc.text(`${item.price} EGP`, 140, yPos);
      doc.text(`${lineTotal} EGP`, 165, yPos);
      
      yPos += 8;
      
      // Add new page if needed
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });

    yPos += 5;

    // Divider line
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    // Summary
    const totalItems = (orderItems || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Total Items:', 120, yPos);
    doc.text(String(totalItems), 165, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(5, 150, 105);
    doc.text('Total:', 120, yPos);
    doc.text(`${order.total.toFixed(0)} EGP`, 165, yPos);

    yPos += 20;

    // Footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for shopping with Sphinx Fit!', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text('Track your order using the order number above.', pageWidth / 2, yPos, { align: 'center' });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${orderNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/[id]/pdf error', message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
