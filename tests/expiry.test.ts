import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysUntil, getExpiryStatus, parseFrDate } from '../src/lib/expiry.ts';

const today = '2026-11-18';

test('sans date : aucune alerte, rien inventé', () => {
  assert.equal(getExpiryStatus(null, null, today).level, 'none');
});

test('niveaux d\'alerte', () => {
  assert.equal(getExpiryStatus('2026-11-18', 'dlc', today).level, 'urgent');
  assert.equal(getExpiryStatus('2026-11-19', 'dlc', today).level, 'urgent');
  assert.equal(getExpiryStatus('2026-11-20', 'dlc', today).level, 'soon');
  assert.equal(getExpiryStatus('2026-11-25', 'dlc', today).level, 'ok');
  assert.equal(getExpiryStatus('2026-11-25', 'dlc', today, 7).level, 'soon');
});

test('date dépassée : message de vérification, jamais "dangereux"', () => {
  for (const kind of ['dlc', 'ddm', null] as const) {
    const s = getExpiryStatus('2026-11-10', kind, today);
    assert.equal(s.level, 'passed');
    assert.ok(s.advice && /vérifiez/i.test(s.advice));
    assert.ok(!/dangereu|toxique|interdit/i.test(s.advice!));
  }
});

test('DDM et DLC ont des conseils distincts', () => {
  const dlc = getExpiryStatus('2026-11-10', 'dlc', today).advice;
  const ddm = getExpiryStatus('2026-11-10', 'ddm', today).advice;
  assert.notEqual(dlc, ddm);
  assert.match(ddm!, /durabilité minimale/);
});

test('calcul des jours robuste au changement d\'heure', () => {
  assert.equal(daysUntil('2027-03-29', '2027-03-27'), 2);
});

test('saisie JJ/MM/AAAA', () => {
  assert.equal(parseFrDate('05/12/2026'), '2026-12-05');
  assert.equal(parseFrDate('5.12.26'), '2026-12-05');
  assert.equal(parseFrDate('31/02/2026'), null);
  assert.equal(parseFrDate('demain'), null);
});
