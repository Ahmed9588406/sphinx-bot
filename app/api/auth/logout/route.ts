import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/auth/logout - Sign out a user
 */
export async function POST(req: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: true, message: 'تم تسجيل الخروج' });
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
    
    if (url && anonKey) {
      const supabase = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      await supabase.auth.signOut();
    }

    return NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });

  } catch (err: unknown) {
    // Even if logout fails, we return success since client will clear tokens
    return NextResponse.json({ success: true, message: 'تم تسجيل الخروج' });
  }
}
