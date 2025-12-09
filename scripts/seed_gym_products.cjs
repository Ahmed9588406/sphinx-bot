/* eslint-disable @typescript-eslint/no-require-imports */
// Seed script (CommonJS) to avoid ts-node/ESM loader issues
// Run with: node scripts/seed_gym_products.cjs

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generateProduct(index) {
  const baseNames = [
    'Performance Tee',
    'Training Tank',
    'Compression Short',
    'Gym Shorts',
    'Workout Hoodie',
    'Track Pants',
    'Squat Tee',
    'Running Shorts',
    'Athletic Joggers',
    'Warm-Up Jacket'
  ];
  const materials = ['polyester', 'cotton blend', 'nylon', 'spandex', 'merino blend'];
  const colors = ['black', 'navy', 'gray', 'olive', 'red', 'white', 'charcoal'];

  const name = `${baseNames[index % baseNames.length]} - Men's ${colors[index % colors.length]}`;
  const handle = slugify(name) + `-${Date.now().toString(36).slice(-4)}${index}`;
  const description = `High-quality ${materials[index % materials.length]} ${name}. Designed for gym workouts, weightlifting, and high-intensity training. Breathable, quick-dry fabric with ergonomic seams for improved mobility.`;
  const priceEGP = (randInt(199, 1499)).toFixed(2);

  return {
    shopify_id: Number(`${Date.now().toString().slice(-6)}${index}`),
    title: name,
    handle,
    description,
    price: Number(priceEGP),
    currency: process.env.SEED_CURRENCY || 'EGP',
    tags: ['men', 'gym', 'sportswear', name.split(' ')[0].toLowerCase()],
    metadata: {
      gender: 'male',
      category: 'gym-clothing',
      material: materials[index % materials.length],
      color: colors[index % colors.length],
      size_examples: ['S', 'M', 'L', 'XL']
    }
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or API_KEY) in env or .env');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const total = Number(process.env.SEED_COUNT || 100);
  const batchSize = Number(process.env.SEED_BATCH_SIZE || 25);

  const products = [];
  for (let i = 0; i < total; i++) products.push(generateProduct(i + 1));

  console.log(`Inserting ${products.length} products in batches of ${batchSize}...`);
  let inserted = 0;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { data, error } = await supabase.from('products').upsert(batch, { onConflict: 'shopify_id' }).select('*');
    if (error) {
      console.error('Products upsert error:', error);
      process.exit(1);
    }

    if (Array.isArray(data) && data.length > 0) {
      const variantsToInsert = [];
      const imagesToInsert = [];
      for (const p of data) {
        const numVariants = Math.max(1, Math.min(3, Math.ceil(Math.random() * 3)));
        for (let v = 0; v < numVariants; v++) {
          const sku = `${(p.handle || 'prd').slice(0, 8).toUpperCase()}-${v + 1}`;
          const price = Number((Number(p.price || 0) + (v * 20)).toFixed(2));
          variantsToInsert.push({
            product_id: p.id,
            shopify_variant_id: Number(String(p.shopify_id) + String(v + 1)),
            sku,
            price,
            inventory_quantity: randInt(10, 200),
            metadata: { size: ['S', 'M', 'L', 'XL'][v % 4] }
          });
        }
        const numImages = Math.max(1, Math.min(3, Math.ceil(Math.random() * 3)));
        for (let im = 0; im < numImages; im++) {
          const urlImg = `https://picsum.photos/seed/${encodeURIComponent(p.handle || p.id)}-${im}/800/800`;
          imagesToInsert.push({ product_id: p.id, url: urlImg, alt: `${p.title} image ${im + 1}`, position: im + 1 });
        }
      }

      if (variantsToInsert.length > 0) {
        const { error: varErr } = await supabase.from('product_variants').upsert(variantsToInsert, { onConflict: 'shopify_variant_id' });
        if (varErr) console.warn('Variants upsert warning:', varErr.message || varErr);
      }
      if (imagesToInsert.length > 0) {
        const { error: imgErr } = await supabase.from('product_images').insert(imagesToInsert);
        if (imgErr) console.warn('Images insert warning:', imgErr.message || imgErr);
      }
    }

    inserted += Array.isArray(data) ? data.length : 0;
    console.log(`Inserted/Upserted batch ${Math.floor(i / batchSize) + 1}: ${Array.isArray(data) ? data.length : 0}`);
  }

  console.log(`Done. Upserted ${inserted} products.`);
}

main().catch(err => {
  console.error('Fatal error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
