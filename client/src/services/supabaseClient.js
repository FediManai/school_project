import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_PUBLIC_KEY
)?.trim();

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error('VITE_SUPABASE_URL et une clé publique Supabase sont requises côté frontend.');
}
if (supabasePublicKey.startsWith('sb_secret_')) {
  throw new Error('Une clé secrète Supabase ne peut pas être utilisée dans le frontend.');
}

export const supabase = createClient(supabaseUrl, supabasePublicKey);