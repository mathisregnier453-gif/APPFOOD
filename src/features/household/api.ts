import { ApiError, supabase } from '@/lib/supabase';
import type { PlanCode } from '@/lib/types';

export interface HouseholdMember {
  user_id: string;
  display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
  is_me: boolean;
}

export interface MyHousehold {
  household_id: string;
  name: string;
  role: 'owner' | 'member';
  member_count: number;
  plan: PlanCode;
}

export interface ActivityEntry {
  id: string;
  actor_id: string | null;
  kind: 'items_added' | 'shopping_added' | 'shopping_purchased' | 'member_joined' | 'member_left';
  item_count: number;
  sample: string[];
  created_at: string;
}

function rpcError(error: { message: string } | null): never {
  const known = ['feature_locked', 'household_full', 'too_many_attempts', 'already_member', 'last_member', 'forbidden'];
  const code = known.find((k) => error?.message.includes(k)) ?? 'server_error';
  throw new ApiError(code);
}

export async function fetchMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase.rpc('get_household_members', { p_household: householdId });
  if (error) rpcError(error);
  return data as HouseholdMember[];
}

export async function fetchMyHouseholds(): Promise<MyHousehold[]> {
  const { data, error } = await supabase.rpc('get_my_households');
  if (error) rpcError(error);
  return data as MyHousehold[];
}

export async function fetchActiveInvite(householdId: string): Promise<{ code: string; expires_at: string } | null> {
  const { data } = await supabase
    .from('household_invitations').select('code, expires_at')
    .eq('household_id', householdId).is('accepted_at', null).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

export async function createInvite(householdId: string): Promise<{ code: string; expires_at: string }> {
  const { data, error } = await supabase.rpc('create_household_invitation', { p_household: householdId });
  if (error) rpcError(error);
  return (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string };
}

export async function revokeInvite(householdId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_household_invitation', { p_household: householdId });
  if (error) rpcError(error);
}

/** Renvoie l'id du foyer rejoint ; ApiError('invalid_code') si le code est invalide ou expiré. */
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_household_invitation', { p_code: code });
  if (error) rpcError(error);
  if (!data) throw new ApiError('invalid_code');
  return data as string;
}

export async function leaveHousehold(householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('leave_household', { p_household: householdId });
  if (error) rpcError(error);
  return data as string;
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_household_member', { p_household: householdId, p_user: userId });
  if (error) rpcError(error);
}

export async function switchHousehold(userId: string, householdId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ current_household_id: householdId }).eq('id', userId);
  if (error) rpcError(error);
}

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  const { error } = await supabase.from('households').update({ name: name.trim().slice(0, 60) }).eq('id', householdId);
  if (error) rpcError(error);
}

export async function fetchActivity(householdId: string, limit = 10): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('household_activity').select('id, actor_id, kind, item_count, sample, created_at')
    .eq('household_id', householdId).order('created_at', { ascending: false }).limit(limit);
  if (error) rpcError(error);
  return data as ActivityEntry[];
}

export { activityText, relativeTime } from './activity';
