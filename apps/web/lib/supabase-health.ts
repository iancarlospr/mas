import { createClient } from '@/lib/supabase/client';

export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('scans').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
