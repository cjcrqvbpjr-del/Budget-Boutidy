// ── ÉCRAN DÉPENSES ────────────────────────────────────────────
import { state } from '../state.js';
import { calculerBilan, fmt, fmtCourt, fmtDate, labelPeriode } from '../budget.js';
import { txHtml } from './home.js';

let filtreActif = 'tous';

export function renderDepenses() {
  const bilan = calculerBilan(
    state.transactions,
    state.parametres,
    state.chargesFixes,
    state.comptesEpargne,
  );

  qs('#depenses-periode').textContent = labelPeriode(state.periodeActive);
  qs('#depenses-total').textContent = fmt(bilan.depenses) + ' dépensés';

  // Gauge
  const fill = qs('#gauge-fill');
  fill.style.width = bilan.pct + '%';
  fill.className = 'gauge-fill' + (bilan.pct >= 100 ? ' danger' : bilan.pct >= 80 ? ' warn' : '');
  qs('#gauge-nums').textContent = `${fmtCourt(bilan.depenses)} / ${fmtCourt(bilan.budgetVariable)}`;

  // Filtre chips
  renderChips();

  // Liste
  let filtered = state.transactions.filter(t => t.type === 'depense' || t.type === 'charge_fixe');

  if (filtreActif === 'G' || filtreActif === 'A') {
    filtered = filtered.filter(t => t.personne === filtreActif);
  } else if (filtreActif !== 'tous') {
    filtered = filtered.filter(t => t.categorie_emoji === filtreActif);
  }

  filtered = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = qs('#depenses-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><div class="empty-text">Aucune dépense</div></div>`;
    return;
  }

  // Grouper par date
  const groups = {};
  filtered.forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  list.innerHTML = Object.keys(groups)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(date => `
      <div class="tx-day">${fmtDate(date)}</div>
      ${groups[date].map(t => txHtml(t, true)).join('')}
    `).join('');
}

function renderChips() {
  const row = qs('#filter-chips');
  const filtres = [
    { val: 'tous', label: 'Toutes' },
    { val: 'G', label: '👤 Geoffrey' },
    { val: 'A', label: '👤 Amandine' },
    ...state.categories.map(c => ({ val: c.emoji, label: c.emoji + ' ' + c.nom })),
  ];

  row.innerHTML = filtres.map(f => `
    <button class="chip ${filtreActif === f.val ? (f.val === 'A' ? 'on-a' : 'on') : ''}"
      onclick="setFiltre('${f.val}', this)">${f.label}</button>
  `).join('');
}

export function setFiltre(val) {
  filtreActif = val;
  renderDepenses();
}

function qs(sel) { return document.querySelector(sel); }
