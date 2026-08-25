import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and add the hosted project values.'
  );
}

if (supabasePublishableKey.startsWith('sb_secret_')) {
  throw new Error(
    'Varta requires a Supabase publishable key. Never use a secret key in the mobile app.'
  );
}

const authStorage =
  typeof localStorage === 'undefined' ? undefined : localStorage;

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...(authStorage ? { storage: authStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
