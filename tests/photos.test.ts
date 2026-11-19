import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_RECIPES } from '../supabase/functions/_shared/catalog/engine.ts';
import { RECIPE_PHOTOS } from '../src/features/recipes/photos.ts';

test('chaque recette du catalogue a une photo Unsplash créditée', () => {
  for (const r of ALL_RECIPES) {
    const p = RECIPE_PHOTOS[r.title];
    assert.ok(p, `photo manquante : ${r.title}`);
    assert.match(p.uri, /^https:\/\/images\.unsplash\.com\//);
    assert.ok(p.author.length > 0);
    assert.match(p.authorUrl, /^https:\/\/unsplash\.com\/@/);
  }
  const uris = Object.values(RECIPE_PHOTOS).map((p) => p.uri.split('?')[0]);
  assert.equal(new Set(uris).size, uris.length, 'photo utilisée deux fois');
});
