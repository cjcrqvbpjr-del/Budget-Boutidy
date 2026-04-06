// ── ÉCRAN ÉPARGNE ─────────────────────────────────────────────
import { state } from '../state.js';
import { fmt, fmtCourt } from '../budget.js';

export function renderEpargne() {
  const comptes = state.comptesEpargne;
  const totalSolde     = comptes.reduce((s, c) => s + Number(c.solde || 0), 0);
  const totalVersement = comptes.reduce((s, c) => s + Number(c.versement_mensuel || 0), 0);

  qs('#epargne-total-solde').textContent     = fmtCourt(totalSolde);
  qs('#epargne-total-versement').textContent = fmtCourt(totalVersement) + '/mois';

  // Cartes comptes
  qs('#epargne-comptes-list').innerHTML = comptes.length
    ? comptes.map(compteHtml).join('')
    : `<div class="empty"><div class="empty-icon">💰</div><div class="empty-text">Aucun compte d'épargne</div></div>`;

  // Graphique répartition dépenses par catégorie
  drawPie();
}

function compteHtml(c) {
  return `
    <div class="epargne-card">
      <div class="epargne-header">
        <div>
          <div class="epargne-name">${c.emoji} ${c.nom}</div>
          <div class="epargne-versement">+${fmtCourt(c.versement_mensuel)}/mois</div>
        </div>
        <div class="epargne-solde">${fmtCourt(c.solde)}</div>
      </div>
    </div>`;
}

function drawPie() {
  const canvas = qs('#pie-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const H = canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.clearRect(0, 0, W, H);

  // Calculer totaux par catégorie
  const totaux = {};
  state.transactions
    .filter(t => t.type === 'depense' && t.montant < 0)
    .forEach(t => {
      const k = t.categorie_emoji || '📌';
      totaux[k] = (totaux[k] || 0) + Math.abs(t.montant);
    });

  const entries = Object.entries(totaux).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return;

  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * 0.38;
  const colors = ['#c8f135','#5b8cff','#ff5c5c','#ffb84d','#a08cff','#64dcc8'];

  let angle = -Math.PI / 2;
  entries.forEach(([emoji, val], i) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    angle += slice;
  });

  // Trou central
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#111116';
  ctx.fill();

  // Légende
  const legend = qs('#pie-legend');
  if (legend) {
    legend.innerHTML = entries.map(([emoji, val], i) => {
      const cat = state.categories.find(c => c.emoji === emoji);
      const nom = cat?.nom || emoji;
      const pct = Math.round(val / total * 100);
      return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${colors[i]};flex-shrink:0;display:inline-block"></span>
        <span style="color:var(--text2)">${emoji} ${nom}</span>
        <span style="margin-left:auto;color:var(--text3);font-family:'JetBrains Mono',monospace">${pct}%</span>
      </div>`;
    }).join('');
  }
}

function qs(sel) { return document.querySelector(sel); }
