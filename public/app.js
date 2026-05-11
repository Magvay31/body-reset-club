// ---------- DEFAULT STATE (Мытищи, зрелая точка через ~6 мес) ----------
const DEFAULT_STATE = {
  tariffs: [
    { id: 'start',    name: 'Start (онлайн питание)', price: 11900, clients: 15, isOffline: false },
    { id: 'bodyclub', name: 'Body Club',              price: 22900, clients: 36, isOffline: true  },
    { id: 'pro',      name: 'Pro',                    price: 29900, clients: 8,  isOffline: true  },
    { id: 'vip',      name: 'VIP',                    price: 44900, clients: 2,  isOffline: true  },
  ],
  fixedCosts: {
    rent: 95000,       // Мытищи, 60-80 м²
    salary: 240000,    // 2 спеца + админ, с налогами 30%
    marketing: 180000, // минимум для Подмосковья (не 0!)
    other: 35000,      // CRM, эквайринг, бухгалтерия, страховка
  },
  variableCostOffline: 5500,
  variableCostOnline:  1500,
  funnel: {
    leadCost: 1200,
    diagnosticPrice: 2500,
    leadToDiagnostic: 0.28,
    diagnosticToSubscription: 0.45,
  },
  retention: {
    m1m2: 0.50,
    m2m3: 0.45,
  },
  capacity: {
    workingDays: 28,
    workingHours: 8,
    clientsPerHour: 4,  // ближе к их схеме с 5 аппаратами
    visitsPerWeek: 2,
  },
};

const SCENARIOS = {
  pdfPlan: {
    name: 'PDF: их план',
    description: '36 кл × 31 350 ₽, маркетинг 0, отток 0',
    apply: (s) => {
      s.tariffs = [
        { id: 'start',    name: 'Start (онлайн питание)', price: 11900, clients: 0,  isOffline: false },
        { id: 'bodyclub', name: 'Pack 16 визитов + допр.', price: 31350, clients: 36, isOffline: true  },
        { id: 'pro',      name: 'Pro',                    price: 29900, clients: 0,  isOffline: true  },
        { id: 'vip',      name: 'VIP',                    price: 44900, clients: 0,  isOffline: true  },
      ];
      s.fixedCosts = { rent: 95000, salary: 182000, marketing: 0, other: 35000 };
      s.variableCostOffline = 8000;
      s.retention = { m1m2: 0.88, m2m3: 0.88 };
      s.funnel.leadCost = 1; // чтобы не сломать формулу при maркетинг=0
    }
  },
  realityCheck: {
    name: 'Реалити-чек PDF',
    description: 'Их структура с реалистичными правками',
    apply: (s) => {
      s.tariffs = [
        { id: 'start',    name: 'Start (онлайн питание)', price: 11900, clients: 0,  isOffline: false },
        { id: 'bodyclub', name: 'Pack 16 визитов + допр.', price: 28900, clients: 30, isOffline: true  },
        { id: 'pro',      name: 'Pro',                    price: 29900, clients: 0,  isOffline: true  },
        { id: 'vip',      name: 'VIP',                    price: 44900, clients: 0,  isOffline: true  },
      ];
      s.fixedCosts = { rent: 95000, salary: 240000, marketing: 180000, other: 35000 };
      s.variableCostOffline = 8000;
      s.retention = { m1m2: 0.55, m2m3: 0.50 };
      s.funnel.leadCost = 1200;
    }
  },
  mityschiM1: {
    name: 'Мытищи · M1',
    description: 'Старт: 15 клиенток',
    apply: (s) => {
      s.tariffs[0].clients = 5;
      s.tariffs[1].clients = 8;
      s.tariffs[2].clients = 2;
      s.tariffs[3].clients = 0;
    }
  },
  mityschiM3: {
    name: 'Мытищи · M3',
    description: 'Разгон: 30 клиенток',
    apply: (s) => {
      s.tariffs[0].clients = 8;
      s.tariffs[1].clients = 22;
      s.tariffs[2].clients = 4;
      s.tariffs[3].clients = 1;
    }
  },
  mityschiM6: {
    name: 'Мытищи · M6',
    description: 'Зрелая точка: 46 клиенток + 15 онлайн',
    apply: (s) => {
      s.tariffs[0].clients = 15;
      s.tariffs[1].clients = 36;
      s.tariffs[2].clients = 8;
      s.tariffs[3].clients = 2;
    }
  },
  stretch: {
    name: 'Мытищи · Stretch',
    description: 'Максимум: 70 офлайн + 30 онлайн',
    apply: (s) => {
      s.tariffs[0].clients = 30;
      s.tariffs[1].clients = 50;
      s.tariffs[2].clients = 15;
      s.tariffs[3].clients = 5;
    }
  },
};

// ---------- FORMATTERS ----------
const fmtMoney = (n) => {
  if (!isFinite(n)) return '—';
  const v = Math.round(n);
  return v.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
};
const fmtMoneyShort = (n) => {
  if (!isFinite(n)) return '—';
  const v = Math.round(n);
  return v.toLocaleString('ru-RU').replace(/,/g, ' ');
};
const fmtPct = (n) => isFinite(n) ? (n * 100).toFixed(1) + ' %' : '—';
const fmtNum = (n) => isFinite(n) ? Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') : '—';

// ---------- STATE ----------
let state = clone(DEFAULT_STATE);

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// ---------- CALCULATION CORE ----------
function calculate(s) {
  let revenue = 0, offline = 0, online = 0, total = 0;
  s.tariffs.forEach(t => {
    revenue += t.price * t.clients;
    if (t.isOffline) offline += t.clients; else online += t.clients;
    total += t.clients;
  });

  const variableCosts = offline * s.variableCostOffline + online * s.variableCostOnline;
  const fixedCosts = s.fixedCosts.rent + s.fixedCosts.salary + s.fixedCosts.marketing + s.fixedCosts.other;

  const grossProfit = revenue - variableCosts;
  const operatingProfit = grossProfit - fixedCosts;
  const margin = revenue > 0 ? operatingProfit / revenue : 0;

  const avgPrice = total > 0 ? revenue / total : 0;
  const avgVariable = total > 0 ? variableCosts / total : 0;
  const marginPerClient = avgPrice - avgVariable;

  const breakEvenClients = marginPerClient > 0 ? Math.ceil(fixedCosts / marginPerClient) : Infinity;

  // capacity
  const capMax = s.capacity.workingDays * s.capacity.workingHours * s.capacity.clientsPerHour;
  const visitsNeeded = offline * s.capacity.visitsPerWeek * 4;
  const utilization = capMax > 0 ? visitsNeeded / capMax : 0;

  // funnel
  const leads = s.funnel.leadCost > 0 ? s.fixedCosts.marketing / s.funnel.leadCost : 0;
  const diagnostics = leads * s.funnel.leadToDiagnostic;
  const newClients = diagnostics * s.funnel.diagnosticToSubscription;
  const cac = newClients > 0 ? s.fixedCosts.marketing / newClients : 0;
  const diagRevenue = diagnostics * s.funnel.diagnosticPrice;

  // LTV: cohort sum of contribution margin
  const lifetime = 1 + s.retention.m1m2 + s.retention.m1m2 * s.retention.m2m3;
  const ltv = marginPerClient * lifetime;
  const ltvCac = cac > 0 ? ltv / cac : 0;
  const paybackMonths = marginPerClient > 0 ? cac / marginPerClient : Infinity;

  return {
    revenue, variableCosts, fixedCosts, grossProfit, operatingProfit, margin,
    avgPrice, avgVariable, marginPerClient, breakEvenClients,
    capMax, visitsNeeded, utilization,
    leads, diagnostics, newClients, cac, lifetime, ltv, ltvCac, paybackMonths, diagRevenue,
    total, offline, online,
  };
}

// ---------- RENDER ----------
function render() {
  const r = calculate(state);

  // KPI
  set('m-revenue', fmtMoney(r.revenue));
  set('m-revenue-sub', `${r.total} клиенток · ${r.offline} офлайн / ${r.online} онлайн`);

  setColored('m-profit', fmtMoney(r.operatingProfit), r.operatingProfit > 0 ? 'pos' : 'neg');
  set('m-margin', `Маржа ${fmtPct(r.margin)}`);

  set('m-breakeven', isFinite(r.breakEvenClients) ? r.breakEvenClients : '∞');

  const utilCls = r.utilization > 1 ? 'neg' : r.utilization > 0.85 ? 'warn' : 'pos';
  setColored('m-utilization', fmtPct(r.utilization), utilCls);
  set('m-utilization-sub', `${fmtNum(r.visitsNeeded)} из ${fmtNum(r.capMax)} визитов`);

  // P&L
  set('pl-revenue', fmtMoney(r.revenue));
  set('pl-variable', '−' + fmtMoney(r.variableCosts));
  set('pl-gross', fmtMoney(r.grossProfit));
  set('pl-fixed', '−' + fmtMoney(r.fixedCosts));
  setColored('pl-operating', fmtMoney(r.operatingProfit), r.operatingProfit > 0 ? 'pos' : 'neg');
  set('pl-margin', fmtPct(r.margin));
  set('pl-yearly', fmtMoney(r.operatingProfit * 12));

  // Unit econ
  set('ue-avg-price', fmtMoney(r.avgPrice));
  set('ue-margin-per', fmtMoney(r.marginPerClient));
  set('ue-cac', fmtMoney(r.cac));
  set('ue-lifetime', r.lifetime.toFixed(2) + ' мес');
  set('ue-ltv', fmtMoney(r.ltv));

  const ltvCls = r.ltvCac >= 3 ? 'pos' : r.ltvCac >= 1 ? 'warn' : 'neg';
  setColored('ue-ltv-cac', r.ltvCac.toFixed(2) + 'x', ltvCls);
  set('ue-payback', isFinite(r.paybackMonths) ? r.paybackMonths.toFixed(2) + ' мес' : '∞');

  // Funnel
  set('fn-budget', fmtMoney(state.fixedCosts.marketing));
  set('fn-leads', fmtNum(r.leads));
  set('fn-diagnostics', fmtNum(r.diagnostics));
  set('fn-new', fmtNum(r.newClients));
  set('fn-diag-revenue', fmtMoney(r.diagRevenue));

  // Fixed costs total
  set('fc-total', fmtMoney(r.fixedCosts));

  // Tariffs total header
  set('t-total', `${r.total} клиенток · ${fmtMoney(r.revenue)}`);

  // Update subtotals on tariff rows
  document.querySelectorAll('[data-subtotal]').forEach(el => {
    const i = parseInt(el.dataset.subtotal);
    el.textContent = fmtMoney(state.tariffs[i].price * state.tariffs[i].clients);
  });

  renderSensitivity(r);
  renderCohort(r);
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setColored(id, val, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('pos', 'neg', 'warn');
  if (cls) el.classList.add(cls);
}

// ---------- TARIFFS UI ----------
function renderTariffs() {
  const c = document.getElementById('tariffs-list');
  c.innerHTML = state.tariffs.map((t, i) => `
    <div class="grid grid-cols-12 gap-3 items-center">
      <div class="col-span-4 text-sm font-medium">${t.name}</div>
      <div class="col-span-3">
        <input type="number" value="${t.price}" data-tariff="${i}" data-field="price" class="field">
      </div>
      <div class="col-span-2">
        <input type="number" value="${t.clients}" data-tariff="${i}" data-field="clients" class="field">
      </div>
      <div class="col-span-3 text-right text-sm font-semibold num" data-subtotal="${i}">—</div>
    </div>
  `).join('');

  c.querySelectorAll('input[data-tariff]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.tariff);
      const field = e.target.dataset.field;
      state.tariffs[i][field] = parseFloat(e.target.value) || 0;
      save();
      render();
    });
  });
}

// ---------- GENERIC INPUT BINDING ----------
function bindInputs() {
  document.querySelectorAll('[data-bind]').forEach(input => {
    const path = input.dataset.bind.split('.');
    let v = state;
    path.forEach(p => v = v[p]);
    input.value = v;

    input.addEventListener('input', (e) => {
      let obj = state;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = parseFloat(e.target.value) || 0;
      save();
      render();
    });
  });
}

function refreshBoundInputs() {
  document.querySelectorAll('[data-bind]').forEach(input => {
    const path = input.dataset.bind.split('.');
    let v = state;
    path.forEach(p => v = v[p]);
    input.value = v;
  });
}

// ---------- SENSITIVITY ----------
function renderSensitivity(base) {
  const cases = [
    { label: 'Базовый', mod: null },
    { label: '+10 Body Club',       mod: s => { s.tariffs[1].clients += 10; } },
    { label: '−10 Body Club',       mod: s => { s.tariffs[1].clients = Math.max(0, s.tariffs[1].clients - 10); } },
    { label: 'Цены −10%',           mod: s => { s.tariffs.forEach(t => t.price = Math.round(t.price * 0.9)); } },
    { label: 'Цены +10%',           mod: s => { s.tariffs.forEach(t => t.price = Math.round(t.price * 1.1)); } },
    { label: 'Маркетинг −100 000 ₽', mod: s => { s.fixedCosts.marketing = Math.max(0, s.fixedCosts.marketing - 100000); } },
    { label: 'Аренда +50 000 ₽',    mod: s => { s.fixedCosts.rent += 50000; } },
    { label: 'Удержание M1→M2 +10пп', mod: s => { s.retention.m1m2 = Math.min(1, s.retention.m1m2 + 0.10); } },
    { label: 'CAC −20% (лид −20%)', mod: s => { s.funnel.leadCost *= 0.8; } },
  ];

  const tbody = document.getElementById('sensitivity-table');
  tbody.innerHTML = cases.map(c => {
    const s = clone(state);
    if (c.mod) c.mod(s);
    const r = calculate(s);
    const isBase = !c.mod;
    const delta = r.operatingProfit - base.operatingProfit;
    const profitCls = r.operatingProfit > 0 ? 'pos' : 'neg';
    const dCls = isBase ? 'text-gray-300' : delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'text-gray-400';
    return `
      <tr class="border-t border-gray-100">
        <td class="text-left py-2 ${isBase ? 'font-semibold' : ''}">${c.label}</td>
        <td class="text-right py-2 ${profitCls}">${fmtMoney(r.operatingProfit)}</td>
        <td class="text-right py-2 text-xs ${dCls}">
          ${isBase ? '—' : (delta >= 0 ? '+' : '') + fmtMoney(delta)}
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- COHORT ----------
function renderCohort(r) {
  const startCohort = 100;
  const monthlyMargin = r.marginPerClient;
  const m1m2 = state.retention.m1m2;
  const m2m3 = state.retention.m2m3;
  // beyond M3 — extrapolate using m2m3 as steady decay
  const decay = m2m3;

  const months = [];
  let active = startCohort;
  let cumMargin = 0;
  for (let m = 1; m <= 6; m++) {
    if (m === 1) active = startCohort;
    else if (m === 2) active = startCohort * m1m2;
    else if (m === 3) active = startCohort * m1m2 * m2m3;
    else active = active * decay;
    const revenue = active * r.avgPrice;
    const margin = active * monthlyMargin;
    cumMargin += margin;
    months.push({ m, active, revenue, margin, cumMargin });
  }

  const tbody = document.getElementById('cohort-table');
  tbody.innerHTML = months.map(row => `
    <tr class="border-t border-gray-100">
      <td class="text-left py-2 font-medium">M${row.m}</td>
      <td class="text-right py-2">${row.active.toFixed(1)}</td>
      <td class="text-right py-2">${fmtMoney(row.revenue)}</td>
      <td class="text-right py-2 pos">${fmtMoney(row.margin)}</td>
      <td class="text-right py-2 font-semibold">${fmtMoney(row.cumMargin)}</td>
    </tr>
  `).join('');
}

// ---------- SCENARIOS ----------
function renderScenarios() {
  const c = document.getElementById('scenarios-list');
  c.innerHTML = Object.entries(SCENARIOS).map(([id, sc]) => `
    <button data-scenario="${id}" class="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
      <div class="font-semibold text-sm">${sc.name}</div>
      <div class="text-xs text-gray-500 mt-1">${sc.description}</div>
    </button>
  `).join('');

  c.querySelectorAll('button[data-scenario]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.scenario;
      const ns = clone(DEFAULT_STATE);
      SCENARIOS[id].apply(ns);
      state = ns;
      save();
      renderAll();
    });
  });
}

// ---------- PERSIST ----------
const STORAGE_KEY = 'bodyclub-state-v1';
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      // shallow-validate
      if (loaded && loaded.tariffs && loaded.fixedCosts) state = loaded;
    }
  } catch (e) {}
}

// ---------- EXPORT ----------
function exportCSV() {
  const r = calculate(state);
  const lines = [];
  lines.push('Раздел;Параметр;Значение');
  state.tariffs.forEach(t => {
    lines.push(`Тарифы;${t.name} — цена;${t.price}`);
    lines.push(`Тарифы;${t.name} — клиенток;${t.clients}`);
    lines.push(`Тарифы;${t.name} — выручка;${t.price * t.clients}`);
  });
  lines.push(`Фикс;Аренда;${state.fixedCosts.rent}`);
  lines.push(`Фикс;ФОТ;${state.fixedCosts.salary}`);
  lines.push(`Фикс;Маркетинг;${state.fixedCosts.marketing}`);
  lines.push(`Фикс;Прочее;${state.fixedCosts.other}`);
  lines.push(`Переменные;Офлайн ₽/клиентка;${state.variableCostOffline}`);
  lines.push(`Переменные;Онлайн ₽/клиентка;${state.variableCostOnline}`);
  lines.push(`Воронка;Лид ₽;${state.funnel.leadCost}`);
  lines.push(`Воронка;Пробник ₽;${state.funnel.diagnosticPrice}`);
  lines.push(`Воронка;Лид→Диагностика;${state.funnel.leadToDiagnostic}`);
  lines.push(`Воронка;Диагностика→Абонемент;${state.funnel.diagnosticToSubscription}`);
  lines.push(`Удержание;M1→M2;${state.retention.m1m2}`);
  lines.push(`Удержание;M2→M3;${state.retention.m2m3}`);
  lines.push(`Итог;Выручка;${r.revenue}`);
  lines.push(`Итог;Переменные;${r.variableCosts}`);
  lines.push(`Итог;Фикс;${r.fixedCosts}`);
  lines.push(`Итог;Валовая прибыль;${r.grossProfit}`);
  lines.push(`Итог;Операционная прибыль;${r.operatingProfit}`);
  lines.push(`Итог;Маржа %;${(r.margin * 100).toFixed(2)}`);
  lines.push(`Итог;Break-even клиенток;${r.breakEvenClients}`);
  lines.push(`Итог;Загрузка %;${(r.utilization * 100).toFixed(2)}`);
  lines.push(`Юнит;CAC;${r.cac}`);
  lines.push(`Юнит;LTV;${r.ltv}`);
  lines.push(`Юнит;LTV/CAC;${r.ltvCac.toFixed(2)}`);

  const csv = '﻿' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `body-reset-club-model-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- INIT ----------
function renderAll() {
  renderTariffs();
  bindInputs();
  renderScenarios();
  refreshBoundInputs();
  render();
}

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Сбросить все значения к дефолтным?')) return;
  state = clone(DEFAULT_STATE);
  save();
  renderAll();
});

document.getElementById('btn-export').addEventListener('click', exportCSV);

load();
renderAll();
