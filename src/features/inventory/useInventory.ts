import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { FoodItem, QuotaStatus, StorageLocation } from '@/lib/types';
import { fetchActiveItems, fetchLocations, fetchQuota } from './api';

/**
 * Stock du foyer courant + emplacements + quota de scans.
 * Rechargé à chaque retour sur l'écran et synchronisé en temps réel
 * (utile dès qu'un foyer a plusieurs membres).
 */
export function useInventory() {
  const { householdId } = useAuth();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const instanceId = useId();

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      setError(null);
      const [nextItems, nextLocations, nextQuota] = await Promise.all([
        fetchActiveItems(householdId),
        loadedOnce.current ? Promise.resolve(null) : fetchLocations(householdId),
        fetchQuota(householdId),
      ]);
      setItems(nextItems);
      if (nextLocations) setLocations(nextLocations);
      setQuota(nextQuota);
      loadedOnce.current = true;
    } catch {
      setError('Impossible de charger votre stock. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`food_items:${householdId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_items', filter: `household_id=eq.${householdId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, reload, instanceId]);

  return { items, locations, quota, loading, error, reload };
}
