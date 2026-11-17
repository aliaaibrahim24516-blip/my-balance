export const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
export const slotNames = {
  breakfast: 'الفطور',
  lunch: 'الغداء',
  dinner: 'العشاء',
  snack: 'وجبة خفيفة'
};
export function localDate(date = new Date()) {
  const y = date.getFullYear(),
    m = String(date.getMonth() + 1).padStart(2, '0'),
    d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function dateAfter(start, days) {
  const d = new Date(start + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function newPlan(recipes, start = localDate()) {
  return Array.from({
    length: 7
  }, (_, day) => slots.map((slot, i) => {
    const choices = recipes.filter(r => r.slot === slot);
    return {
      id: `${start}-${day}-${slot}`,
      date: dateAfter(start, day),
      slot,
      recipeId: choices[(day + i) % choices.length].id,
      cooked: false
    };
  })).flat();
}
export function defaults(recipes) {
  return {
    version: 2,
    backupSince: localDate(),
    startDate: localDate(),
    plan: newPlan(recipes),
    pantry: {},
    prices: {},
    budgetFils: 40000,
    weights: [],
    hideGoal: false,
    pregnancy: false,
    goalStart: null
  };
}
export function requirements(plan, recipes) {
  const total = {};
  for (const meal of plan.filter(m => !m.cooked)) {
    const r = recipes.find(r => r.id === meal.recipeId);
    if (!r) throw Error('Unknown recipe');
    for (const [id, n] of Object.entries(r.ingredients)) total[id] = (total[id] || 0) + n;
  }
  return total;
}
export function shopping(state, recipes) {
  return Object.entries(requirements(state.plan, recipes)).map(([id, needed]) => ({
    id,
    needed,
    available: state.pantry[id] || 0,
    missing: Math.max(0, needed - (state.pantry[id] || 0))
  }));
}
export function cost(rows, prices, key = 'missing') {
  let knownFils = 0,
    unknown = 0;
  for (const r of rows) {
    if (r[key] <= 0) continue;
    const p = prices[r.id];
    if (!p || !Number.isSafeInteger(p.fils)) unknown++;else knownFils += Math.round(r[key] * p.fils / p.size);
  }
  return {
    knownFils,
    unknown
  };
}
export function swapMeal(state, id, recipes) {
  const result = structuredClone(state),
    m = result.plan.find(m => m.id === id);
  if (!m || m.cooked) return result;
  const choices = recipes.filter(r => r.slot === m.slot);
  const i = choices.findIndex(r => r.id === m.recipeId);
  m.recipeId = choices[(i + 1) % choices.length].id;
  return result;
}
export function cookMeal(state, id, recipes) {
  const result = structuredClone(state),
    m = result.plan.find(m => m.id === id);
  if (!m || m.cooked) return result;
  const r = recipes.find(r => r.id === m.recipeId);
  if (!r) throw Error('الوجبة غير موجودة');
  for (const [id, n] of Object.entries(r.ingredients)) result.pantry[id] = Math.max(0, (result.pantry[id] || 0) - n);
  m.cooked = true;
  return result;
}
export function buyMissing(state, recipes) {
  const result = structuredClone(state);
  for (const row of shopping(state, recipes)) result.pantry[row.id] = (result.pantry[row.id] || 0) + row.missing;
  return result;
}
export function monthBoundary(start, offset) {
  const d = new Date(start + 'T12:00:00'),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return localDate(d);
}
export function goal(state, today = localDate()) {
  if (state.pregnancy || state.hideGoal || !state.goalStart || today < state.goalStart) return null;
  if (today < monthBoundary(state.goalStart, 1)) return {
    month: 1,
    low: 3,
    high: 5
  };
  if (today < monthBoundary(state.goalStart, 2)) return {
    month: 2,
    low: 2,
    high: 3
  };
  return null;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDate(new Date(value + 'T12:00:00')) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function validateState(input, catalog) {
  const fail = () => {
    throw Error('ملف البيانات غير صالح أو من إصدار غير مدعوم. لم تتغير بياناتك.');
  };
  const object = x => x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
  const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  if (!object(input) || ![1, 2].includes(input.version) || !validDate(input.startDate) || !Array.isArray(input.plan) || input.plan.length !== 28 || !object(input.pantry) || !object(input.prices) || !integer(input.budgetFils, 10000000) || typeof input.hideGoal !== 'boolean' || typeof input.pregnancy !== 'boolean' || !(input.goalStart === null || validDate(input.goalStart) && input.goalStart <= localDate()) || !Array.isArray(input.weights) || input.weights.length > 5000) fail();
  const ingredients = new Set(catalog.ingredients.map(i => i.id));
  const plan = input.plan.map((m, i) => {
    const day = Math.floor(i / 4),
      slot = slots[i % 4],
      id = `${input.startDate}-${day}-${slot}`;
    if (!object(m) || m.id !== id || m.date !== dateAfter(input.startDate, day) || m.slot !== slot || typeof m.cooked !== 'boolean' || !catalog.recipes.some(r => r.id === m.recipeId && r.slot === slot)) fail();
    return {
      id,
      date: m.date,
      slot,
      recipeId: m.recipeId,
      cooked: m.cooked
    };
  });
  const pantry = {},
    prices = {};
  for (const [id, n] of Object.entries(input.pantry)) {
    if (!ingredients.has(id) || !integer(n, 1000000)) fail();
    pantry[id] = input.version === 1 ? Math.round(n / legacyGrams(id)) : n;
  }
  for (const [id, p] of Object.entries(input.prices)) {
    if (!ingredients.has(id) || !object(p) || !integer(p.fils, 10000000) || !validDate(p.date) || p.date > localDate()) fail();
    if (input.version === 2 && (!integer(p.size, 1000000) || p.size === 0)) fail();
    prices[id] = input.version === 1 && legacyGrams(id) === 1 ? {
      fils: p.fils,
      size: 1000,
      date: p.date
    } : input.version === 1 ? {
      fils: Math.round(p.fils * legacyGrams(id) / 1000),
      size: 1,
      date: p.date
    } : {
      fils: p.fils,
      size: p.size,
      date: p.date
    };
  }
  const ids = new Set(),
    dates = new Set();
  const weights = input.weights.map(w => {
    if (!object(w) || typeof w.id !== 'string' || !/^[-a-zA-Z0-9]{1,80}$/.test(w.id) || ids.has(w.id) || !validDate(w.date) || w.date > localDate() || dates.has(w.date) || !Number.isFinite(w.kg) || w.kg <= 0 || w.kg > 1000) fail();
    ids.add(w.id);
    dates.add(w.date);
    return {
      id: w.id,
      date: w.date,
      kg: w.kg
    };
  });
  const backupSince = input.version === 1 ? localDate() : input.backupSince;
  if (!validDate(backupSince) || backupSince > localDate()) fail();
  return {
    version: 2,
    backupSince,
    startDate: input.startDate,
    plan,
    pantry,
    prices,
    budgetFils: input.budgetFils,
    weights,
    hideGoal: input.hideGoal,
    pregnancy: input.pregnancy,
    goalStart: input.pregnancy ? null : input.goalStart
  };
}
function legacyGrams(id) {
  return {
    egg: 50,
    bread: 60,
    lemon: 80
  }[id] || 1;
}

