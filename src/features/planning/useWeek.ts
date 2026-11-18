import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchActiveItems } from '@/features/inventory/api';
import { computeAvailability, type StockLookup } from '@/features/recipes/availability';
import { addDaysIso } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { FoodItem, MealPlanEntry } from '@/lib/types';
import { fetchMeals } from './api';

/** Repas planifiés sur [from, from + days[ + stock actuel, synchronisés en temps réel. */
export function useMeals(from: string, days = 7) {
  const { householdId } = useAuth();
  const [meals, setMeals] = useState<MealPlanEntry[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const instanceId = useId();
  const to = addDaysIso(from, days - 1);

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      setError(null);
      const [m, i] = await Promise.all([fetchMeals(householdId, from, to), fetchActiveItems(householdId)]);
      setMeals(m);
      setItems(i);
    } catch {
      setError('Impossible de charger le planning. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [householdId, from, to]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`meal_plans:${householdId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plans', filter: `household_id=eq.${householdId}` }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, reload, instanceId]);

  const stock: StockLookup = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, { quantity: i.quantity, unit: i.unit, name: i.name }]));
    return { get: (id: string) => map.get(id) };
  }, [items]);

  const missingFor = useCallback(
    (m: MealPlanEntry) => (m.recipes ? computeAvailability(m.recipes.recipe_ingredients, stock).missing.map((i) => i.name) : []),
    [stock],
  );

  return { meals, items, stock, missingFor, loading, error, reload };
}
