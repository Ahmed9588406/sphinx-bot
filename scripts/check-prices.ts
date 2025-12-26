import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function checkPrices() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.error('Supabase not configured');
        return;
    }
    const supabase = createClient(url, key);

    const { data, error } = await supabase
        .from('products')
        .select('title, price')
        .ilike('title', '%Track Pants%');

    if (error) {
        console.error(error);
        return;
    }

    console.log('--- Product Prices ---');
    data.forEach(p => console.log(`${p.title}: ${p.price}`));
}

checkPrices();
