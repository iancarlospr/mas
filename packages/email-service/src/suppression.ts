import { getServiceClient } from './supabase';

export async function checkSuppression(email: string): Promise<boolean> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from('email_suppression_list')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  return data != null;
}
