import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityText, relativeTime } from '../src/features/household/activity.ts';

test('fil d\'activité : textes', () => {
  assert.equal(activityText({ kind: 'items_added', item_count: 5, sample: ['Beurre', 'Lait', 'Oeufs'] }, 'Dana'), 'Dana a ajouté 5 aliments : Beurre, Lait, Oeufs…');
  assert.equal(activityText({ kind: 'shopping_added', item_count: 1, sample: ['Pain'] }, 'Vous'), 'Vous a ajouté 1 article à la liste : Pain');
  assert.equal(activityText({ kind: 'member_joined', item_count: 1, sample: [] }, 'Eli'), 'Eli a rejoint le foyer');
});

test('temps relatif', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  assert.equal(relativeTime('2026-11-22T11:59:40Z', now), "à l'instant");
  assert.equal(relativeTime('2026-11-22T11:45:00Z', now), 'il y a 15 min');
  assert.equal(relativeTime('2026-11-22T09:00:00Z', now), 'il y a 3 h');
  assert.equal(relativeTime('2026-11-21T10:00:00Z', now), 'hier');
});
