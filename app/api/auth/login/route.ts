import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for auth
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, anonKey);
}

// Create Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, serviceKey);
}

/**
 * POST /api/auth/login - Sign in a user
 * Returns session tokens and user data from users table
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبين' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();
    
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (error) {
      console.error('Login error:', error);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ error: 'فشل في تسجيل الدخول' }, { status: 401 });
    }

    // Get user profile from users table
    let userProfile = null;
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, metadata')
      .eq('id', data.user.id)
      .single();

    if (profile) {
      userProfile = profile;
    } else {
      // User exists in auth but not in users table - create record
      const newUser = {
        id: data.user.id,
        email: data.user.email?.toLowerCase(),
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        phone: data.user.user_metadata?.phone || null,
        role: 'customer',
        metadata: {
          language: data.user.user_metadata?.language || 'ar',
          synced_from_auth: true,
          synced_at: new Date().toISOString()
        }
      };

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(newUser)
        .select()
        .single();

      if (!insertError && insertedUser) {
        userProfile = insertedUser;
      }
    }

    // Build user response
    const userResponse = {
      id: data.user.id,
      email: data.user.email,
      name: userProfile?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0],
      phone: userProfile?.phone || data.user.user_metadata?.phone || null,
      role: userProfile?.role || 'customer',
      user_metadata: data.user.user_metadata || {},
      metadata: userProfile?.metadata || {}
    };

    return NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      user: userResponse,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Login error:', msg);
    return NextResponse.json({ error: 'حدث خطأ في تسجيل الدخول' }, { status: 500 });
  }
}
