-- 003_seed_dummy_data.sql
-- Seed script to populate Supabase with dummy users, conversations, messages,
-- products, orders, and documents (with placeholder embeddings).
-- Run after applying schema migration 001 and 002.

DO $$
DECLARE
  u1 uuid;
  u2 uuid;
  agent_uuid uuid;
  p1 uuid;
  p2 uuid;
  v1 uuid;
  v2 uuid;
  img1 uuid;
  doc1 uuid;
  doc2 uuid;
  conv1 uuid;
  conv2 uuid;
  ord1 uuid;
BEGIN
  -- Users: insert separately so each RETURNING returns a single row
  INSERT INTO public.users(email, name, phone, role, metadata)
    VALUES ('alice@example.com', 'Alice', '+201234567890', 'customer', '{"loyalty":"gold"}')
    RETURNING id INTO u1;

  INSERT INTO public.users(email, name, phone, role, metadata)
    VALUES ('mohamed@example.com', 'Mohamed', '+201234567891', 'customer', '{}')
    RETURNING id INTO u2;

  INSERT INTO public.users(email, name, phone, role, metadata)
    VALUES ('agent@sphinxfit.com','Sphinx Agent',NULL,'agent','{"team":"support"}')
    RETURNING id INTO agent_uuid;

  -- Products: insert separately
  INSERT INTO public.products (shopify_id, title, handle, description, price, currency, tags, metadata)
    VALUES (1001, 'Classic Tee', 'classic-tee', 'Comfortable cotton tee, breathable and soft.', 199.00, 'EGP', ARRAY['tshirt','cotton'], '{"category":"tops"}')
    RETURNING id INTO p1;

  INSERT INTO public.products (shopify_id, title, handle, description, price, currency, tags, metadata)
    VALUES (1002, 'Performance Leggings', 'perf-leggings', 'Stretchy leggings for workouts.', 349.00, 'EGP', ARRAY['leggings','sport'], '{"category":"bottoms"}');

  -- Insert third product and capture id
  INSERT INTO public.products (shopify_id, title, handle, description, price, currency, tags, metadata)
    VALUES (1003, 'Light Hoodie', 'light-hoodie', 'Lightweight hoodie for chilly mornings.', 299.00, 'EGP', ARRAY['hoodie','outerwear'], '{"category":"outer"}')
    RETURNING id INTO p2;

  -- Variants and images
  INSERT INTO public.product_variants(product_id, shopify_variant_id, sku, price, inventory_quantity)
    VALUES (p1, 20011, 'CT-001', 199.00, 50) RETURNING id INTO v1;
  INSERT INTO public.product_variants(product_id, shopify_variant_id, sku, price, inventory_quantity)
    VALUES (p2, 20021, 'LG-001', 349.00, 25) RETURNING id INTO v2;

  INSERT INTO public.product_images(product_id, url, alt, position)
    VALUES (p1, 'https://example.com/images/classic-tee.jpg', 'Classic Tee', 1) RETURNING id INTO img1;

  -- Documents with placeholder embeddings (zero vector of length 1536)
  INSERT INTO public.documents (source, source_id, content, metadata, embedding)
    VALUES
      ('product', '1001', 'Classic Tee - comfortable cotton t-shirt available in sizes S-XL', '{"product_id":1001}'::jsonb, array_fill(0.0::double precision, ARRAY[1536])::vector)
    RETURNING id INTO doc1;

  INSERT INTO public.documents (source, source_id, content, metadata, embedding)
    VALUES ('product', '1002', 'Performance Leggings - breathable, high-waist, sizes S-XL', '{"product_id":1002}'::jsonb, array_fill(0.0::double precision, ARRAY[1536])::vector);

  -- FAQ / policy document
  INSERT INTO public.documents (source, source_id, content, metadata, embedding)
    VALUES ('faq', 'refund_policy', 'Refunds available within 14 days with original receipt.', '{"type":"policy"}'::jsonb, array_fill(0.0::double precision, ARRAY[1536])::vector)
    RETURNING id INTO doc2;

  -- Conversations
  INSERT INTO public.conversations (user_id, title, status, metadata) VALUES (u1, 'Order status inquiry', 'open', '{}') RETURNING id INTO conv1;
  INSERT INTO public.conversations (user_id, title, status, metadata) VALUES (u2, 'Product question', 'open', '{}') RETURNING id INTO conv2;

  -- Messages (use append_message helper to keep last_message_at updated)
  PERFORM public.append_message(conv1, 'user', 'انا عايز اعرف حالة طلبي رقم 12345', u1, NULL, '{}'::jsonb);
  PERFORM public.append_message(conv1, 'agent', 'تمام يا فندم، هاجيب حالة طلبك دلوقتي — طلبك في مرحلة التجهيز', agent_uuid, NULL, '{}'::jsonb);

  PERFORM public.append_message(conv2, 'user', 'الكالوج وصللي ولا لسه؟', u2, NULL, '{}'::jsonb);
  PERFORM public.append_message(conv2, 'agent', 'المنتج موجود في المخزون، تقدر تطلبه الآن', agent_uuid, NULL, '{}'::jsonb);

  -- Orders and order items
  INSERT INTO public.orders (shopify_id, user_id, status, total, currency, shipping_address, billing_address, metadata)
    VALUES (5001, u1, 'processing', 199.00, 'EGP', '{"address1":"Nasr City","city":"Cairo"}'::jsonb, '{"address1":"Nasr City"}'::jsonb, '{"shopify_order_number":"12345"}'::jsonb)
  RETURNING id INTO ord1;

  INSERT INTO public.order_items (order_id, product_id, variant_id, quantity, price)
    VALUES (ord1, p1, v1, 1, 199.00);

  RAISE NOTICE 'Seed: users %, %, agent %; products %, %; conversations %, %; order %', u1, u2, agent_uuid, p1, p2, conv1, conv2, ord1;
END$$;
