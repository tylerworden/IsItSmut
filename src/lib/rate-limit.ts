import { supabaseServer } from './supabase-server';

export function currentWindowStart(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export async function checkAndIncrement(input: {
  ipHash: string;
  limit: number;
}): Promise<{ allowed: boolean; count: number }> {
  const sb = supabaseServer();
  const windowStart = currentWindowStart().toISOString();
  const { data, error } = await sb.rpc('rate_limit_increment', {
    p_ip_hash: input.ipHash,
    p_window_start: windowStart,
  });
  if (error) throw error;
  const count = Number(data);
  return { allowed: count <= input.limit, count };
}
