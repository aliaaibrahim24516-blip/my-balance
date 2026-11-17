import { monthBoundary, goal, localDate, validDate, validateState } from './core.js';
const number = n => n.toLocaleString('ar-KW', {
  maximumFractionDigits: 2
});
export function weightView(state) {
  const g = goal(state),
    weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const periodStart = g ? monthBoundary(state.goalStart, g.month - 1) : null;
  const relevant = g ? weights.filter(w => w.date >= periodStart).reverse() : [];
  const change = relevant.length > 1 ? relevant[0].kg - relevant.at(-1).kg : null;
  return `<p class="eyebrow">أرقام للملاحظة، مش للحكم</p>
<h1>متابعة بدون ضغط</h1>
<p class="lead">الوزن الأسبوعي اختياري. لا لوم ولا تعديل تلقائي للأكل بناءً على النتيجة.</p>
<section class="card">
<label>
<input id="pregnancy" type="checkbox" ${state.pregnancy ? 'checked' : ''}> حمل محتمل أو مؤكد</label>${state.pregnancy ? '<div class="notice">هدف إنقاص الوزن متوقف. لا تعرض الصفحة نطاقًا أو تقدمًا لخسارة الوزن أثناء تفعيل هذا الخيار. تسجيل الوزن يظل اختياريًا.</div>' : `<label>
<input id="hide-goal" type="checkbox" ${state.hideGoal ? 'checked' : ''}> إخفاء هدف الوزن</label>${state.hideGoal ? '' : g ? `<div class="budget">
<span>نطاق الشهر ${g.month === 1 ? 'الأول' : 'الثاني'} • من تاريخ بدء المتابعة</span>
<div class="metric">${g.low}–${g.high} كجم</div>
<p>نطاق رغبة مرن، وليس وعدًا أو معيار نجاح. عدم الوصول إليه لا يستدعي تقليلًا حادًا للأكل.</p>${change === null ? '<p class="small">يلزم تسجيلان خلال هذا الشهر لملاحظة التغير.</p>' : `<p>التغير بين أول وآخر تسجيل في هذا الشهر: ${number(Math.abs(change))} كجم ${change > 0 ? 'انخفاض' : change < 0 ? 'زيادة' : 'دون تغير'}. لا نغيّر الخطة تلقائيًا.</p>`}</div>` : `<p>ابدئي عرض النطاق عندما يناسبك: ٣–٥ كجم للشهر الأول و٢–٣ للثاني. الشهور من تاريخ تفعيل المتابعة. بعدهما نراجع الهدف دون تمديد تلقائي.</p>
<button id="start-goal" class="secondary">بدء فترة متابعة اختيارية من اليوم</button>`}`}</section>
<form id="weight-form" class="card">
<h2>تسجيل وزن • اختياري</h2>
<div class="actions">
<label class="field">التاريخ<input id="weight-date" type="date" max="${localDate()}" value="${localDate()}" required>
</label>
<label class="field">الوزن (كجم)<input id="weight-value" type="number" inputmode="decimal" min="0.1" max="1000" step="0.1" placeholder="بدون وزن افتراضي" required>
</label>
</div>
<button type="submit">حفظ التسجيل</button>
<p class="small">يمكن تسجيل مرة أسبوعيًا أو التوقف تمامًا، حسب راحتك.</p>
</form>
<section class="card">
<h2>سجلك</h2>${weights.length ? weights.map(w => `<div class="row">
<div>
<b>${number(w.kg)} كجم</b>
<p class="small">${w.date}</p>
</div>
<button class="quiet" data-delete-weight="${w.id}">حذف التسجيل</button>
</div>`).join('') : '<p>لا توجد قياسات مسجلة. لا حاجة للبدء الآن إن لم ترغبي.</p>'}</section>
<section class="card">
<h2>نسختك من البيانات</h2>
<p class="export-note">ملف التصدير يحتوي الوزن والمخزون والأسعار وحالة الحمل. يُحفظ على جهازك أو وجهة التنزيل التي تختارينها، وهو غير مشفر. احفظيه بمكان خاص ولا ترفعيه إلى المستودع. التخزين في المتصفح ليس نسخة احتياطية.</p>
<div class="actions">
<button id="export" class="secondary">تصدير JSON</button>
<label class="field">استيراد نسخة JSON<input id="import" type="file" accept="application/json,.json">
</label>
</div>
<p class="small">الاستيراد يستبدل البيانات الحالية بعد التحقق والتأكيد. صدّري نسخة أولًا إن احتجتِها.</p>
</section>`;
}
export function bindWeight(view, api) {
  view.addEventListener('submit', e => {
    if (e.target.id !== 'weight-form') return;
    e.preventDefault();
    const kg = Number(view.querySelector('#weight-value').value),
      date = view.querySelector('#weight-date').value;
    const s = api.getState();
    if (!Number.isFinite(kg) || kg <= 0 || kg > 1000 || !validDate(date) || date > localDate()) {
      api.notify('راجعي الوزن والتاريخ.');
      return;
    }
    if (s.weights.some(w => w.date === date) && !confirm('يوجد وزن لهذا اليوم. هل تستبدلينه؟')) return;
    const next = {
      ...s,
      weights: [...s.weights.filter(w => w.date !== date), {
        id: Array.from(crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2, '0')).join(''),
        date,
        kg
      }]
    };
    api.save(next);
  });
  view.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const s = api.getState();
    if (b.id === 'start-goal' && !s.pregnancy) api.save({
      ...s,
      goalStart: localDate()
    });
    if (b.dataset.deleteWeight && confirm('حذف تسجيل الوزن هذا؟')) api.save({
      ...s,
      weights: s.weights.filter(w => w.id !== b.dataset.deleteWeight)
    });
    if (b.id === 'export') {
      try {
        const blob = new Blob([JSON.stringify({
            ...s,
            backupSince: localDate()
          }, null, 2)], {
            type: 'application/json'
          }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = `my-balance-backup-${localDate()}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        api.save({
          ...s,
          backupSince: localDate()
        });
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        api.notify('تم تجهيز ملف التصدير. تأكدي من حفظه في تنزيلات المتصفح.');
      } catch {
        api.notify('تعذر تجهيز التصدير.');
      }
    }
  });
  view.addEventListener('change', async e => {
    const t = e.target,
      s = api.getState();
    if (t.id === 'hide-goal') api.save({
      ...s,
      hideGoal: t.checked
    });
    if (t.id === 'pregnancy') api.save({
      ...s,
      pregnancy: t.checked,
      goalStart: t.checked ? null : s.goalStart
    });
    if (t.id === 'import') {
      const file = t.files?.[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw Error('الملف أكبر من الحد المسموح: ٢ ميجابايت.');
        const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, '')),
          validated = validateState(parsed, api.getCatalog());
        if (confirm('تم التحقق من الملف. استبدال كل البيانات الحالية بهذه النسخة؟')) {
          if (api.save(validated)) api.notify('تم استيراد البيانات وحفظها في هذا المتصفح.');
        }
      } catch (error) {
        api.notify(error instanceof SyntaxError ? 'هذا ليس ملف JSON صالحًا. لم تتغير بياناتك.' : error.message);
      } finally {
        t.value = '';
      }
    }
  });
}

