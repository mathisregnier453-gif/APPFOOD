import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type ActivityRow, buildPushMessages, chunk, describe } from '../functions/_shared/household-push.ts';

const H = 'h1';
const act = (p: Partial<ActivityRow>): ActivityRow => ({ id: Math.random().toString(), household_id: H, actor_id: 'dana', kind: 'items_added', item_count: 1, sample: [], ...p });
const names = (id: string | null) => ({ dana: 'Dana', eli: 'Eli' } as Record<string, string>)[id ?? ''] ?? 'Un membre';

test('messages lisibles', () => {
  assert.equal(describe('items_added', 'Dana', 12, ['Beurre', 'Lait', 'Oeufs']).body, 'Dana a ajouté 12 aliments : Beurre, Lait, Oeufs….');
  assert.equal(describe('shopping_added', 'Eli', 1, ['Pain']).body, 'Eli a ajouté 1 article : Pain.');
  assert.equal(describe('member_joined', 'Eli', 1, []).title, 'Nouveau membre');
});

test('regroupement par auteur et type, jamais envoyé à l\'auteur', () => {
  const messages = buildPushMessages(
    [act({ item_count: 2, sample: ['Lait', 'Oeufs'] }), act({ item_count: 3, sample: ['Beurre'] })],
    [
      { user_id: 'dana', household_id: H, prefs: null, tokens: ['tok-dana'] },
      { user_id: 'eli', household_id: H, prefs: null, tokens: ['tok-eli-1', 'tok-eli-2'] },
    ],
    names,
  );
  assert.deepEqual(messages.map((m) => m.to), ['tok-eli-1', 'tok-eli-2']);
  assert.match(messages[0].body, /^Dana a ajouté 5 aliments : Lait, Oeufs, Beurre/);
  assert.equal(messages[0].data.url, '/stock');
});

test('préférences respectées, autres foyers ignorés', () => {
  const messages = buildPushMessages(
    [act({ kind: 'shopping_added', sample: ['Pain'] }), act({ kind: 'items_added', sample: ['Riz'] })],
    [
      { user_id: 'eli', household_id: H, prefs: { shopping_update: false, household_activity: true }, tokens: ['tok-eli'] },
      { user_id: 'zoe', household_id: 'autre', prefs: null, tokens: ['tok-zoe'] },
    ],
    names,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].title, 'Stock mis à jour');
});

test('lots de 100 (limite Expo Push)', () => {
  assert.deepEqual(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length), [100, 100, 50]);
});
