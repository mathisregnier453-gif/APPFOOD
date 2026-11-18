import { supabase } from '@/lib/supabase';
import type { PlanCode } from '@/lib/types';

// Toutes ces fonctions sont refusées par le serveur si l'utilisateur n'est pas administrateur.

export interface Dashboard {
  period: { from: string; to: string; days: number };
  users: { total: number; new: number; active_30d: number; suspended: number; free: number };
  subscriptions: { premium: number; family: number; monthly: number; yearly: number; not_renewing: number };
  revenue: { mrr_gross_eur: number; mrr_net_eur: number };
  ai: {
    cost_eur: number; scans: number; cost_per_scan_eur: number | null;
    cost_per_paying_sub_month_eur: number | null; cost_per_free_user_month_eur: number | null;
    by_feature: { feature: string; calls: number; failures: number; cost_eur: number }[];
  };
  costs: { hosting_month_eur: number; hosting_per_user_month_eur: number | null };
  margin: { premium_net_price_eur: number; per_premium_sub_month_eur: number; target_eur: number };
  conversion: { paying_rate: number | null; cohort_rate: number | null };
  churn: { expired_in_period: number; rate: number | null };
  anomalies: {
    avg_cost_per_active_user_eur: number;
    top_users: { user_id: string; email: string | null; calls: number; cost_eur: number; ratio_to_avg: number | null; abnormal: boolean }[];
    failing_features: string[];
  };
  errors: { server_errors: number; ai_failures: number; billing_events_failed: number };
}

export async function fetchDashboard(from: string, to: string): Promise<Dashboard> {
  const { data, error } = await supabase.rpc('admin_dashboard', { p_from: from, p_to: to });
  if (error) throw error;
  return data as Dashboard;
}

export interface AdminUser {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
  household_id: string | null;
  plan: PlanCode;
  scans_used: number;
  ai_cost_month_eur: number;
  suspended: boolean;
  is_admin: boolean;
}

export async function listUsers(search: string, offset = 0): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: search.trim() || null, p_limit: 50, p_offset: offset });
  if (error) throw error;
  return data as AdminUser[];
}

export async function setSuspension(userId: string, suspended: boolean, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_set_suspension', { p_user: userId, p_suspended: suspended, p_reason: reason });
  if (error) throw error;
}

export async function giftScans(householdId: string, count: number): Promise<void> {
  const { error } = await supabase.rpc('admin_gift_scans', { p_household: householdId, p_count: count });
  if (error) throw error;
}

export interface AdminPlan {
  code: PlanCode;
  label: string;
  monthly_scan_quota: number;
  monthly_recipe_quota: number | null;
  fair_use_recipe_cap: number;
  max_members: number;
  max_photos_per_scan: number;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  features: Record<string, boolean>;
}

export async function fetchPlansAdmin(): Promise<AdminPlan[]> {
  const { data, error } = await supabase.from('plans')
    .select('code, label, monthly_scan_quota, monthly_recipe_quota, fair_use_recipe_cap, max_members, max_photos_per_scan, price_monthly_cents, price_yearly_cents, features')
    .order('position');
  if (error) throw error;
  return data as AdminPlan[];
}

export async function updatePlan(code: PlanCode, patch: Partial<AdminPlan>): Promise<void> {
  const { error } = await supabase.rpc('admin_update_plan', { p_code: code, p_patch: patch });
  if (error) throw error;
}

export interface FinanceSettings {
  vat_rate: number;
  store_commission_rate: number;
  eur_per_usd: number;
  hosting_cost_monthly_cents: number;
  target_margin_per_premium_cents: number;
}

export async function fetchFinance(): Promise<FinanceSettings> {
  const { data, error } = await supabase.from('finance_settings')
    .select('vat_rate, store_commission_rate, eur_per_usd, hosting_cost_monthly_cents, target_margin_per_premium_cents').single();
  if (error) throw error;
  return data as FinanceSettings;
}

export async function updateFinance(patch: Partial<FinanceSettings>): Promise<void> {
  const { error } = await supabase.rpc('admin_update_finance', { p_patch: patch });
  if (error) throw error;
}

export interface ErrorEntry { at: string; source: string; code: string; message: string | null; user_id: string | null }

export async function fetchErrors(): Promise<ErrorEntry[]> {
  const { data, error } = await supabase.rpc('admin_recent_errors', { p_limit: 100 });
  if (error) throw error;
  return data as ErrorEntry[];
}

export const eur = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(1).replace('.', ',')} %`);
