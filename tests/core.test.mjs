import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defaults, shopping, cost, swapMeal, cookMeal, buyMissing, goal } from '../core.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
test('18 recipes, three cuisines and valid ingredients', () => {
  assert.equal(catalog.recipes.length, 18);
  assert.equal(new Set(catalog.recipes.map(r => r.cuisine)).size, 3);
  for (const r of catalog.recipes) {
    assert.equal(r.servings, 4);
    for (const [id, n] of Object.entries(r.ingredients)) {
      assert.ok(catalog.ingredients.some(i => i.id === id));
      assert.ok(n > 0);
    }
  }
});
test('seven days and four slots; swap is isolated and preserves pantry', () => {
  const s = defaults(catalog.recipes);
  assert.equal(s.plan.length, 28);
  const id = s.plan[3].id;
  const swapped = swapMeal(s, id, catalog.recipes);
  assert.notEqual(s.plan[3].recipeId, swapped.plan[3].recipeId);
  assert.deepEqual(s.plan.filter(m => m.id !== id), swapped.plan.filter(m => m.id !== id));
  assert.deepEqual(swapped.pantry, s.pantry);
});
test('unknown prices remain unknown; zero is a deliberate known price', () => {
  assert.deepEqual(cost([{
    id: 'x',
    missing: 1500
  }], {}), {
    knownFils: 0,
    unknown: 1
  });
  assert.deepEqual(cost([{
    id: 'x',
    missing: 1500
  }], {
    x: {
      size: 1000,
      fils: 1200
    }
  }), {
    knownFils: 1800,
    unknown: 0
  });
  assert.equal(cost([{
    id: 'x',
    missing: 1000
  }], {
    x: {
      size: 1,
      fils: 0
    }
  }).unknown, 0);
});
test('planning never consumes stock; cooking is atomic and idempotent', () => {
  const s = defaults(catalog.recipes);
  assert.ok(cookMeal(s, s.plan[0].id, catalog.recipes).plan[0].cooked);
  assert.deepEqual(s.pantry, {});
  const bought = buyMissing(s, catalog.recipes);
  assert.ok(shopping(bought, catalog.recipes).every(r => r.missing === 0));
  assert.deepEqual(buyMissing(bought, catalog.recipes), bought);
  const cooked = cookMeal(bought, bought.plan[0].id, catalog.recipes);
  assert.equal(cooked.plan[0].cooked, true);
  assert.deepEqual(cookMeal(cooked, cooked.plan[0].id, catalog.recipes), cooked);
  assert.ok(Object.values(cooked.pantry).every(n => n >= 0));
  assert.ok(shopping(cooked, catalog.recipes).every(r => r.missing === 0));
});
test('pregnancy and hiding stop goals; first and second month ranges', () => {
  const s = {
    ...defaults(catalog.recipes),
    goalStart: '2026-01-15'
  };
  assert.deepEqual(goal(s, '2026-01-20'), {
    month: 1,
    low: 3,
    high: 5
  });
  assert.deepEqual(goal(s, '2026-02-20'), {
    month: 2,
    low: 2,
    high: 3
  });
  assert.equal(goal({
    ...s,
    pregnancy: true
  }, '2026-01-20'), null);
  assert.equal(goal({
    ...s,
    hideGoal: true
  }, '2026-01-20'), null);
  assert.equal(goal(s, '2026-04-01'), null);
});
import { validateState, monthBoundary } from '../core.js';
test('validated JSON round trip preserves full local state', () => {
  const s = buyMissing(defaults(catalog.recipes), catalog.recipes);
  s.prices.rice = {
    size: 1000,
    fils: 1250,
    date: '2026-01-01'
  };
  s.weights = [{
    id: 'sample-weight',
    date: '2026-01-01',
    kg: 100
  }];
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(s)), catalog), s);
});
test('malformed imports rejected atomically, unknown ingredients and scripts rejected', () => {
  const s = defaults(catalog.recipes);
  assert.throws(() => validateState({
    ...s,
    version: 3
  }, catalog));
  assert.throws(() => validateState({
    ...s,
    plan: s.plan.slice(1)
  }, catalog));
  assert.throws(() => validateState({
    ...s,
    pantry: {
      rice: -1
    }
  }, catalog));
  assert.throws(() => validateState({
    ...s,
    prices: {
      rice: {
        fils: 1.2,
        date: '2026-01-01'
      }
    }
  }, catalog));
  assert.throws(() => validateState({
    ...s,
    pantry: JSON.parse('{"__proto__":3}')
  }, catalog));
  assert.throws(() => validateState({
    ...s,
    weights: [{
      id: '<script>',
      date: '2026-01-01',
      kg: 100
    }]
  }, catalog));
  assert.deepEqual(s.pantry, {});
});
test('month boundaries clamp for short months and leap years', () => {
  assert.equal(monthBoundary('2026-01-31', 1), '2026-02-28');
  assert.equal(monthBoundary('2024-01-31', 1), '2024-02-29');
  assert.deepEqual(goal({
    ...defaults(catalog.recipes),
    goalStart: '2026-01-31'
  }, '2026-02-28'), {
    month: 2,
    low: 2,
    high: 3
  });
});
test('item units, legacy stock and invalid fractional counts', () => {
  assert.deepEqual(['egg', 'bread', 'milk', 'lemon', 'rice'].map(id => catalog.ingredients.find(i => i.id === id).unit), ['بيضة', 'رغيف', 'مل', 'ليمونة', 'جم']);
  const s = defaults(catalog.recipes);
  assert.equal(validateState({
    ...s,
    version: 1,
    pantry: {
      egg: 400
    }
  }, catalog).pantry.egg, 8);
  assert.throws(() => validateState({
    ...s,
    pantry: {
      egg: 1.5
    }
  }, catalog));
});
test('package price uses entered size and rejects empty package', () => {
  assert.equal(cost([{
    id: 'egg',
    missing: 3
  }], {
    egg: {
      size: 6,
      fils: 450
    }
  }).knownFils, 225);
  const s = defaults(catalog.recipes);
  assert.throws(() => validateState({
    ...s,
    prices: {
      egg: {
        size: 0,
        fils: 450,
        date: s.startDate
      }
    }
  }, catalog));
});
test('partial stock cooks once and never becomes negative', () => {
  const s = defaults(catalog.recipes);
  s.pantry = {
    bread: 1,
    tomato: 1000
  };
  const cooked = cookMeal(s, s.plan[0].id, catalog.recipes);
  assert.equal(cooked.pantry.bread, 0);
  assert.equal(cooked.pantry.tomato, 600);
  assert.deepEqual(cookMeal(cooked, s.plan[0].id, catalog.recipes), cooked);
});

