// ── ÉCRAN HOME ────────────────────────────────────────────────
import { state, changerPeriode } from '../state.js';
import { calculerBilan, fmt, fmtCourt, fmtDate, labelPeriode } from '../budget.js';

export function renderHome() {
  const bilan = calculerBilan(
    state.transactions,
    state.parametres,
    state.chargesFixes,
    state.comptesEpargne,
  );

  // Greeting
  const h = new Date().getHours();
  const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const prenom = state.activeUser === 'G' ? 'Geoffrey' : 'Amandine';
  qs('#greeting').textContent = `${salut}, ${prenom} 👋`;
  qs('#user-avatar').textContent = state.activeUser;

  // Période
  qs('#periode-label-home').textContent = labelPeriode(state.periodeActive);

  // Sync dot
  const dot = qs('#sync-dot');
  dot.className = 'sync-dot ' + state.syncStatus;
  const syncLabel = qs('#sync-label');
  if (syncLabel) {
    syncLabel.textContent = state.syncStatus === 'ok' ? 'Synchronisé'
      : state.syncStatus === 'syncing' ? 'Sync...'
      : state.syncStatus === 'error' ? 'Hors ligne'
      : '';
  }

  // Hero — Reste à vivre
  const heroEl = qs('#hero-reste');
  const resteClass = bilan.reste < 0 ? 'danger' : bilan.pct >= 80 ? 'warn' : '';
  heroEl.className = 'hero-amount' + (resteClass ? ' ' + resteClass : '');
  heroEl.innerHTML = fmtCourt(bilan.reste).replace('\u202f€', '') + '<sup>€</sup>';

  // Badge statut
  const badge = qs('#hero-badge');
  if (bilan.statut === 'BLOQUÉ') {
    badge.className = 'badge badge-danger';
    badge.innerHTML = '<span class="dot"></span>BLOQUÉ';
  } else if (bilan.statut === 'ALERTE') {
    badge.className = 'badge badge-warn';
    badge.innerHTML = '<span class="dot"></span>ALERTE';
  } else {
    badge.className = 'badge badge-ok';
    badge.innerHTML = '<span class="dot"></span>OK';
  }

  // Sub text
  qs('#hero-sub').textContent = `sur ${fmtCourt(bilan.budgetVariable)} de budget mensuel`;

  // Progress bar
  const fill = qs('#hero-bar');
  fill.style.width = bilan.pct + '%';
  fill.className = 'progress-fill' + (bilan.pct >= 100 ? ' danger' : bilan.pct >= 80 ? ' warn' : '');
  qs('#hero-bar-left').textContent = fmt(bilan.depenses) + ' dépensés';
  qs('#hero-bar-pct').textContent = bilan.pct + '%';

  // Alerte banner
  const alertEl = qs('#alert-banner');
  if (bilan.pct >= 100) {
    alertEl.className = 'alert-banner danger'; alertEl.style.display = 'flex';
    qs('#alert-text').textContent = `Budget dépassé de ${fmt(Math.abs(bilan.reste))} — Statut BLOQUÉ`;
  } else if (bilan.pct >= 80) {
    alertEl.className = 'alert-banner'; alertEl.style.display = 'flex';
    qs('#alert-text').textContent = `Budget à ${bilan.pct}% — il reste ${fmtCourt(bilan.reste)}`;
  } else {
    alertEl.style.display = 'none';
  }

  // KPIs
  qs('#kpi-revenus').textContent   = fmtCourt(bilan.revenus);
  qs('#kpi-charges').textContent   = fmtCourt(bilan.totalChargesPrevues);
  qs('#kpi-depense').textContent   = fmtCourt(bilan.depenses);
  qs('#kpi-epargne').textContent   = fmtCourt(bilan.totalEpargne);

  const jourEl = qs('#kpi-jour');
  jourEl.textContent  = fmtCourt(bilan.resteParJour);
  jourEl.className    = 'kpi-value' + (bilan.resteParJour < 0 ? ' red' : bilan.resteParJour < 20 ? ' orange' : ' green');
  qs('#kpi-jour-sub').textContent = `${bilan.joursRestants} jour${bilan.joursRestants > 1 ? 's' : ''} restant${bilan.joursRestants > 1 ? 's' : ''}`;

  // Dernières transactions
  const sorted = [...state.transactions]
    .filter(t => t.type === 'depense')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const list = qs('#home-tx-list');
  if (!sorted.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><div class="empty-text">Aucune dépense cette période</div></div>`;
  } else {
    list.innerHTML = sorted.map(txHtml).join('');
  }
}

export function txHtml(d, withActions = false) {
  const montantPos = d.montant > 0;
  const couleur = state.categories.find(c => c.emoji === d.categorie_emoji)?.couleur || 'rgba(150,150,150,.12)';
  return `
    <div class="tx-item" onclick="openEditTx('${d.id}')" id="tx-${d.id}">
      <div class="tx-icon" style="background:${couleur}">${d.categorie_emoji || '📌'}</div>
      <div class="tx-info">
        <div class="tx-name">${d.libelle || catNom(d.categorie_emoji)}</div>
        <div class="tx-meta">
          <span class="tx-cat">${catNom(d.categorie_emoji)}</span>
          <span class="who-badge who-${(d.personne || 'commun').toLowerCase()}">${nomPersonne(d.personne)}</span>
          ${d.source === 'bancaire' ? '<span class="source-badge" title="Import bancaire">🏦</span>' : ''}
        </div>
      </div>
      <div class="tx-amount ${montantPos ? 'positif' : ''}">${montantPos ? '+' : '-'}${fmt(Math.abs(d.montant))}</div>
    </div>`;
}

function catNom(emoji) {
  return state.categories.find(c => c.emoji === emoji)?.nom || emoji || '—';
}

function nomPersonne(p) {
  if (p === 'G') return 'Geoffrey';
  if (p === 'A') return 'Amandine';
  return 'Commun';
}

// Helper querySelector
function qs(sel) { return document.querySelector(sel); }
