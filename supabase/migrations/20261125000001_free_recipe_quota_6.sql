-- Offre gratuite : 6 idées de recettes par mois (au lieu de 10).
update public.plans set monthly_recipe_quota = 6, fair_use_recipe_cap = 6 where code = 'free';
