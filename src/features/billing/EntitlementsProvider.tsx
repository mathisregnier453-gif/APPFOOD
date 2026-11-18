import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { PlanCode } from '@/lib/types';
import type { PaywallReason } from './offers';
import { registerPushToken } from '@/features/notifications/notifications';
import { identify } from './purchases';

export type Feature = 'meal_plan' | 'favorites' | 'smart_notifications' | 'consumption_history' | 'shared_household';

interface EntitlementsValue {
  plan: PlanCode;
  can: (feature: Feature) => boolean;
  maxMembers: number;
  /** false = membre d'un foyer partagé sans offre Famille : lecture seule */
  canWrite: boolean;
  isOwner: boolean;
  memberCount: number;
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Exécute l'action si la fonction est incluse dans l'offre, sinon ouvre le paywall. */
  requireFeature: (feature: Feature, reason: PaywallReason, action: () => void) => void;
}

const Ctx = createContext<EntitlementsValue | null>(null);

// Les droits affichés ici ne servent qu'à l'interface : le serveur (RLS et
// edge functions) les vérifie de nouveau pour chaque action.
export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { session, householdId } = useAuth();
  const [plan, setPlan] = useState<PlanCode>('free');
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [maxMembers, setMaxMembers] = useState(1);
  const [isOwner, setIsOwner] = useState(true);
  const [memberCount, setMemberCount] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    const [{ data }, { data: households }] = await Promise.all([
      supabase.rpc('get_entitlements', { p_household: householdId }),
      supabase.rpc('get_my_households'),
    ]);
    const current = (households as { household_id: string; role: string; member_count: number }[] | null)?.find((h) => h.household_id === householdId);
    if (current) {
      setIsOwner(current.role === 'owner');
      setMemberCount(current.member_count);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setPlan(row.plan);
      setFeatures(row.features ?? {});
      setMaxMembers(row.max_members ?? 1);
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    void identify(session?.user.id ?? null).catch(() => undefined);
    if (session?.user.id) void registerPushToken(session.user.id).catch(() => undefined);
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
    // Renouvellement / résiliation pendant que l'app était en arrière-plan.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<EntitlementsValue>(() => {
    const can = (f: Feature) => features[f] === true;
    return {
      plan, can, maxMembers, loaded, refresh, isOwner, memberCount,
      canWrite: isOwner || can('shared_household'),
      requireFeature: (f, reason, action) => (can(f) ? action() : router.push({ pathname: '/paywall', params: { reason } })),
    };
  }, [plan, features, maxMembers, loaded, refresh, isOwner, memberCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): EntitlementsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntitlements doit être utilisé dans EntitlementsProvider');
  return ctx;
}

export function openPaywall(reason: PaywallReason) {
  router.push({ pathname: '/paywall', params: { reason } });
}
