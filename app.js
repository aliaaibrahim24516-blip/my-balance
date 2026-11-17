import { weightView, bindWeight } from './weight.js';
import { validateState, dateAfter, slots, slotNames, localDate, newPlan, defaults, shopping, cost, swapMeal, cookMeal, buyMissing } from './core.js';
const $ = s => document.querySelector(s),
  view = $('#view'),
  KEY = 'my-balance-v1';
let catalog,
  state,
  page = 'today',
  ready = false;
const money = f => (f / 1000).toLocaleString('ar-KW', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
}) + ' د.ك';
const num = n => n.toLocaleString('ar-KW');
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const notify = text => {
  $('#status').textContent = text;
};
function save(next) {
  try {
    next = validateState(next, catalog);
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    render();
    return true;
  } catch {
    notify('تعذر الحفظ في المتصفح. لم يُحفظ التغيير. صدّري نسخة احتياطية إذا كانت المساحة ممتلئة.');
    return false;
  }
}
function title(eyebrow, heading, description) {
  return `<p class="eyebrow">${eyebrow}</p>
<h1>${heading}</h1>
<p class="lead">${description}</p>`;
}
function plate() {
  return '<div class="plate" role="img" aria-label="نصف خضار، وربع بروتين، وربع نشويات"><span class="veg">½ خضار</span><span class="protein">¼ بروتين</span><span class="carb">¼ نشويات</span></div>';
}
function unit(id) {
  return catalog.ingredients.find(item => item.id === id).unit;
}
function recipeDetails(r) {
  return `<details>
<summary>المكونات وطريقة التحضير • ${r.minutes} دقيقة</summary>
<p class="small">المقادير للأسرة: ${r.servings} أفراد؛ الكميات بوحدة كل صنف.</p>
<ul>${Object.entries(r.ingredients).map(([id, n]) => `<li>${esc(catalog.ingredients.find(i => i.id === id).name)}: ${num(n)} ${unit(id)}</li>`).join('')}</ul>
<ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
<p>${esc(r.portion)}</p>
</details>`;
}
function mealCard(m) {
  const r = catalog.recipes.find(r => r.id === m.recipeId);
  return `<article class="meal">
<div class="meal-title">
<span class="small">${slotNames[m.slot]}</span>
<span class="pill">${r.cuisine}</span>
</div>
<h3>${r.name}</h3>${recipeDetails(r)}<div class="actions">${m.cooked ? '<span class="amount">✓ تم الطبخ والخصم من المخزون</span>' : `<button class="secondary" data-swap="${m.id}">تبديل الوجبة</button>
<button data-cook="${m.id}">اتطبخت • تأكيد الاستهلاك</button>`}</div>
</article>`;
}
function todayView() {
  const today = localDate(),
    hour = new Date().getHours(),
    index = hour < 10 ? 0 : hour < 16 ? 1 : hour < 21 ? 2 : 3;
  const meals = state.plan.filter(m => m.date === today && !m.cooked);
  const next = meals.find(m => slots.indexOf(m.slot) >= index) || meals[0] || state.plan.find(m => m.date > today && !m.cooked);
  return title('مساحة ليوم أهدأ', 'يوم جديد، على مهلك', 'وجبات مرنة من نفس أكلة الأسرة. لا أطعمة ممنوعة، ولا يوم باظ.') + `<div class="card hero">
<div>
<span class="pill">${next ? `الوجبة القادمة • ${slotNames[next.slot]}` : 'كل شيء على مهلك'}</span>
<h2>${next ? catalog.recipes.find(r => r.id === next.recipeId).name : 'لا توجد وجبة قادمة في الخطة'}</h2>
<p>${next ? new Date(next.date + 'T12:00:00').toLocaleDateString('ar-KW', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }) : 'انتهى الأسبوع؟ ابدئي خطة جديدة من قسم الأسبوع.'}</p>
<p class="small">${next ? catalog.recipes.find(r => r.id === next.recipeId).portion : ''}</p>
<button data-go="week" class="secondary">${localDate() > state.plan[27].date ? "ابدئي أسبوعًا جديدًا" : "شوفي خطة الأسبوع ←"}</button>
</div>
<div>${plate()}</div>
</div>
<div class="grid">
<div class="card">
<span class="eyebrow">مع بعض على السفرة</span>
<h2>أكلة واحدة لأربعة</h2>
<p>مصري، شامي وإيطالي. بدّلي أي وجبة من غير ما تبدئي من الأول.</p>
</div>
<div class="card">
<span class="eyebrow">خصوصيتك</span>
<h2>بياناتك في المتصفح</h2>
<p class="small">على هذا الجهاز وهذا المتصفح فقط. مسح بيانات Safari أو الوضع الخاص قد يفقدها. لا تستخدمي جهازًا مشتركًا للبيانات الحساسة.</p>
</div>
</div>`;
}
function weekView() {
  return title('٧ أيام / ٤ وجبات يوميًا', 'أسبوع فيه مساحة للتغيير', 'كل وصفة تكفي أربعة. التبديل داخل نفس نوع الوجبة، دون تغيير بقية الأسبوع.') + `<div class="card actions">
<label>بداية الأسبوع <input id="week-start" type="date" value="${localDate() > state.plan[27].date ? localDate() : state.startDate}">
</label>
<button id="new-week" class="secondary">بدء خطة أسبوع جديدة</button>
<span class="small">بدء خطة جديدة لا يغيّر المخزون.</span>
</div>` + Array.from({
    length: 7
  }, (_, d) => {
    const meals = state.plan.slice(d * 4, d * 4 + 4);
    return `<section class="card week-day">
<h2>${new Date(meals[0].date + 'T12:00:00').toLocaleDateString('ar-KW', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })}</h2>${meals.map(mealCard).join('')}</section>`;
  }).join('');
}
function pantryView() {
  const rows = shopping(state, catalog.recipes),
    missing = rows.filter(r => r.missing > 0),
    total = cost(rows, state.prices),
    whole = cost(rows, state.prices, 'needed');
  return title('المتاح أولًا، ثم ما نحتاجه', 'المخزون والتسوق', 'سجلي سعر العبوة بالفلس وحجمها بوحدة الصنف. نخصم فقط بعد تأكيد الطبخ.') + `<div class="budget">
<label>ميزانية الأسبوع بالدينار <input id="budget" type="number" min="0" step="0.001" value="${state.budgetFils / 1000}">
</label>
<p>تكلفة المشتريات ${total.unknown ? 'المعروفة فقط' : 'التقديرية'}: <b>${money(total.knownFils)}</b>${total.unknown ? ` • ${total.unknown} أصناف سعرها غير معروف` : ''}</p>
<p class="small">تكلفة مكونات الخطة ${whole.unknown ? 'المعروفة فقط' : 'التقديرية'}: ${money(whole.knownFils)}. تُحسب الكميات المستخدمة دون تقريب عبوات المتجر. ${total.unknown ? 'لا يمكن تأكيد ملاءمة الميزانية قبل استكمال الأسعار.' : total.knownFils > state.budgetFils ? 'التقدير أعلى من الميزانية؛ يمكنك تبديل وجبات أو تعديل الميزانية، دون منع أو تغيير تلقائي.' : 'التقدير ضمن الميزانية المسجلة.'}</p>
</div>
<section class="card">
<h2>قائمة التسوق</h2>${missing.length ? `<div class="notice" role="status">${missing.length} أصناف لا تكفي الخطة الحالية.</div>` : '<p>المخزون المسجل يكفي الخطة المتبقية.</p>'}${missing.map(row => `<div class="row">
<div>
<b>${catalog.ingredients.find(i => i.id === row.id).name}</b>
<p class="small">ينقص ${num(row.missing)} ${unit(row.id)}</p>
</div>
<span>${state.prices[row.id] ? money(Math.round(row.missing * state.prices[row.id].fils / state.prices[row.id].size)) : 'غير معروف'}</span>
</div>`).join('')}<button id="buy" ${missing.length ? '' : 'disabled'}>اشتريت كل الكميات الناقصة • إضافة للمخزون</button>
<p class="small">لو اشتريتِ كمية مختلفة، عدّلي الصنف في المخزون أدناه بدل هذا الزر.</p>
</section>
<section class="card">
<h2>المخزون والأسعار</h2>${catalog.ingredients.map(item => `<div class="row">
<div>
<b>${item.name}</b>
<p class="small">${state.prices[item.id] ? `${num(state.prices[item.id].fils / state.prices[item.id].size)} فلس / ${item.unit} • ${state.prices[item.id].date}` : 'السعر غير معروف'}</p>
</div>
<div class="actions">
<label class="field">المتاح (${item.unit})<input type="number" min="0" max="1000000" step="1" data-stock="${item.id}" value="${state.pantry[item.id] || 0}">
</label>
<label class="field">حجم العبوة (${item.unit})<input type="number" min="1" step="1" data-size="${item.id}" value="${state.prices[item.id]?.size ?? 1}">
</label>
<label class="field">سعر العبوة بالفلس<input type="number" min="0" max="10000000" step="1" data-price="${item.id}" placeholder="غير معروف" value="${state.prices[item.id]?.fils ?? ''}">
</label>
</div>
</div>`).join('')}</section>`;
}
function render() {
  if (!ready) return;
  view.innerHTML = page === 'today' ? todayView() : page === 'week' ? weekView() : page === 'pantry' ? pantryView() : weightView(state);
  if (localDate() >= dateAfter(state.backupSince, 14)) view.insertAdjacentHTML("afterbegin", '<p class="notice">مرّ أسبوعان أو أكثر دون نسخة احتياطية. تقدري تصدّري نسخة من قسم الوزن وقت ما يناسبك.</p>');
  document.querySelectorAll('[data-page]').forEach(b => b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'));
}
function go(p) {
  page = p;
  notify('');
  render();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
view.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.go) go(b.dataset.go);else if (b.dataset.swap) save(swapMeal(state, b.dataset.swap, catalog.recipes));else if (b.dataset.cook && confirm('هل طُبخت الوجبة واستخدمتِ كميات الأسرة المسجلة؟ سيُخصم الاستهلاك مرة واحدة.')) {
      const meal = state.plan.find(m => m.id === b.dataset.cook);
      const missing = Object.entries(catalog.recipes.find(r => r.id === meal.recipeId).ingredients).some(([id, n]) => (state.pantry[id] || 0) < n);
      if (save(cookMeal(state, b.dataset.cook, catalog.recipes))) notify(missing ? "تم تسجيل الطبخ. بعض المكونات ناقصة فخصمنا المتاح فقط." : "تم تسجيل الطبخ.");
    } else if (b.id === 'buy' && confirm('إضافة كل الكميات الناقصة للمخزون؟ اضغطي فقط لو اشتريتِها بالفعل.')) save(buyMissing(state, catalog.recipes));else if (b.id === 'new-week') {
      const date = $('#week-start').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('اختاري تاريخ البداية.');
      if (confirm('استبدال خطة الأسبوع؟ سيبقى المخزون كما هو.')) save({
        ...state,
        startDate: date,
        plan: newPlan(catalog.recipes, date)
      });
    }
  } catch (error) {
    notify(error.message);
  }
});
view.addEventListener('change', e => {
  const t = e.target;
  try {
    if (t.dataset.stock) {
      const n = Number(t.value);
      if (t.value === '' || !Number.isSafeInteger(n) || n < 0 || n > 1000000) throw Error('أدخلي كمية صحيحة من صفر إلى مليون وحدة.');
      save({
        ...state,
        pantry: {
          ...state.pantry,
          [t.dataset.stock]: n
        }
      });
    }
    if (t.dataset.size && !state.prices[t.dataset.size]) return;
    if (t.dataset.price || t.dataset.size) {
      const id = t.dataset.price || t.dataset.size;
      const price = view.querySelector(`[data-price="${id}"]`),
        size = Number(view.querySelector(`[data-size="${id}"]`).value);
      if (!Number.isSafeInteger(size) || size <= 0 || size > 1000000) throw Error("راجعي حجم العبوة.");
      const prices = {
        ...state.prices
      };
      if (price.value === '') delete prices[id];else {
        const n = Number(price.value);
        if (!Number.isSafeInteger(n) || n < 0 || n > 10000000) throw Error('السعر يجب أن يكون عددًا صحيحًا بالفلس.');
        prices[id] = {
          fils: n,
          size,
          date: localDate()
        };
      }
      save({
        ...state,
        prices
      });
    }
    if (t.id === 'budget') {
      const n = Number(t.value);
      if (t.value === '' || !Number.isFinite(n) || n < 0 || n > 10000) throw Error('راجعي قيمة الميزانية.');
      save({
        ...state,
        budgetFils: Math.round(n * 1000)
      });
    }
  } catch (error) {
    notify(error.message);
  }
});
const dialog = $('#support');
$('#help').onclick = () => dialog.showModal();
$('#close-support').onclick = () => dialog.close();
$('#before').onclick = () => $('#support-text').textContent = 'لو جعانة، من حقك تاكلي. خدي نفسًا هادئًا لو حابة، واسألي نفسك محتاجة إيه دلوقتي. لا يلزم تأجيل الأكل.';
$('#after').onclick = () => $('#support-text').textContent = 'لا تعويض ولا لوم. ارجعي للوجبة القادمة كما هي، من غير تخطي وجبات أو عقاب.';
bindWeight(view, {
  getState: () => state,
  getCatalog: () => catalog,
  save,
  notify
});
async function init() {
  try {
    const response = await fetch('./data/recipes.json');
    if (!response.ok) throw Error();
    catalog = await response.json();
    const raw = localStorage.getItem(KEY);
    state = raw ? validateState(JSON.parse(raw), catalog) : defaults(catalog.recipes);
    if (!raw || JSON.parse(raw).version === 1) localStorage.setItem(KEY, JSON.stringify(state));
    ready = true;
    render();
  } catch {
    notify('تعذر تحميل الوصفات أو البيانات المحفوظة. افتحي الموقع من رابط الويب ثم أعيدي المحاولة. لن نستبدل بياناتك تلقائيًا.');
  }
}
init();
window.addEventListener("storage", e => {
  if (e.key !== KEY || !e.newValue || !catalog) return;
  try {
    state = validateState(JSON.parse(e.newValue), catalog);
    render();
    notify("تم تحديث البيانات من نافذة أخرى لهذا المتصفح.");
  } catch {
    notify("توجد بيانات غير صالحة في نافذة أخرى؛ لم نستبدل العرض الحالي.");
  }
});

