import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchActiveItems } from '@/features/inventory/api';
import type { FoodItem, Recipe } from '@/lib/types';
import { fetchFavoriteIds, fetchRecipes } from './api';
import { type Availability, computeAvailability, type StockLookup } from './availability';

/** Recettes du foyer + favoris + disponibilité calculée sur le stock actuel. */
export function useRecipes() {
  const { session, householdId } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!householdId || !session) return;
    try {
      setError(null);
      const [r, i, f] = await Promise.all([fetchRecipes(householdId), fetchActiveItems(householdId), fetchFavoriteIds(session.user.id)]);
      setRecipes(r);
      setItems(i);
      setFavorites(f);
    } catch {
      setError('Impossible de charger les recettes. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [householdId, session]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const stock: StockLookup = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, { quantity: i.quantity, unit: i.unit, name: i.name }]));
    return { get: (id: string) => map.get(id) };
  }, [items]);

  const availability = useMemo(() => {
    const cache = new Map<string, Availability>();
    for (const r of recipes) cache.set(r.id, computeAvailability(r.recipe_ingredients, stock));
    return (r: Recipe) => cache.get(r.id) ?? computeAvailability(r.recipe_ingredients, stock);
  }, [recipes, stock]);

  return { recipes, favorites, setFavorites, stock, availability, loading, error, reload, hasStock: items.length > 0 };
}
