import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for auth operations (using anon key for signup)
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, anonKey);
}

// Create Supabase admin client for database operations
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, serviceKey);
}

/**
 * POST /api/auth/signup - Register a new user
 * Creates user in Supabase Auth AND saves to users table
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Signup request body:', JSON.stringify(body, null, 2));
    
    const { email, password, name, phone } = body;
    
    // Validation
    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبين' }, { status: 400 });
    }
    
    if (!name || !name.trim()) {
      console.log('Missing name');
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }
    
    if (password.length < 6) {
      console.log('Password too short');
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Invalid email format');
      return NextResponse.json({ error: 'البريد الإلكتروني غير صالح' }, { status: 400 });
    }

    console.log('Validation passed, creating Supabase client...');
    const supabase = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();
    
    // Check if user already exists in users table
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);

    // If table exists and user found, reject
    if (!checkError && existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' }, { status: 400 });
    }

    // Create auth user with Supabase Auth (using standard signUp)
    // NOTE: If email confirmation is enabled in Supabase, users won't be able to login immediately
    // To fix: Go to Supabase Dashboard > Authentication > Providers > Email > Turn OFF "Confirm email"
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: { 
          name: name.trim(), 
          phone: phone || null,
          language: detectLanguage(name)
        }
      }
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      
      // Handle specific errors
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' }, { status: 400 });
      }
      
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'فشل في إنشاء الحساب' }, { status: 500 });
    }

    // Create user record in users table using admin client
    const userRecord = {
      id: authData.user.id,
      email: email.toLowerCase(),
      name: name.trim(),
      phone: phone || null,
      role: 'customer',
      metadata: { 
        language: detectLanguage(name),
        created_via: 'signup',
        created_at: new Date().toISOString()
      }
    };

    const { error: userTableError } = await supabaseAdmin
      .from('users')
      .insert(userRecord);

    if (userTableError) {
      console.error('User table insert error:', userTableError);
      // Don't fail the signup - auth user is created
      // We can sync later if needed
    }

    // Check if we got a session directly (happens when email confirmation is disabled)
    if (authData.session) {
      return NextResponse.json({ 
        success: true, 
        message: 'تم إنشاء الحساب بنجاح',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: name.trim(),
          phone: phone || null,
          role: 'customer',
          user_metadata: authData.user.user_metadata,
          metadata: userRecord.metadata
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      }, { status: 201 });
    }

    // If no session (email confirmation required), try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (signInError || !signInData.session) {
      // User created but couldn't sign in - they can login manually
      return NextResponse.json({ 
        success: true, 
        message: 'تم إنشاء الحساب بنجاح. يرجى تسجيل الدخول.',
        requiresLogin: true
      }, { status: 201 });
    }

    // Return full session data
    return NextResponse.json({ 
      success: true, 
      message: 'تم إنشاء الحساب بنجاح',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: name.trim(),
        phone: phone || null,
        role: 'customer',
        user_metadata: authData.user.user_metadata,
        metadata: userRecord.metadata
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at
      }
    }, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Signup error:', msg);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء الحساب' }, { status: 500 });
  }
}

// Detect if name is Arabic or English
function detectLanguage(text: string): 'ar' | 'en' {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text) ? 'ar' : 'en';
}
