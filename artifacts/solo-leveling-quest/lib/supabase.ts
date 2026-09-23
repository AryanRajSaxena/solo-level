import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://zcuemsvsonsmbzttdodq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdWVtc3Zzb25zbWJ6dHRkb2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTc2ODYsImV4cCI6MjEwNTM5MzY4Nn0.r_-AFzCZpzgl_oxgXLhndomknA7YWotWWWIlZmXjtgw';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured =
  Boolean(rawUrl) &&
  !rawUrl.includes('placeholder') &&
  !rawUrl.includes('YOUR_PROJECT_REF') &&
  Boolean(rawKey) &&
  rawKey.length > 20 &&
  !rawKey.includes('placeholder');

export const supabase = createClient(rawUrl, rawKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
