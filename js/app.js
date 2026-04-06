// ── POINT D'ENTRÉE DE L'APP ───────────────────────────────────
import { state, loadAll, startRealtime, onStateChange,
         ajouterTransaction, modifierTransaction, supprimerTransaction,
         changerPeriode, setActiveUser } from './state.js';
import { getPeriode } from './budget.js';
import { renderHome } from './ui/home.js';
import { renderDepenses, setFiltre } from './ui/depenses.js';
import { renderEpargne } from './ui/epargne.js';
import { renderReglages } from './ui/reglages.js';

// ── NAVIGATION ────────────────────────────────────────────────
const screens = ['home', 'depenses', 'epargne', 'reglages'];

window.goTo = function(screen) {
  screens.forEach(s => {
    document.getElementById('screen-' + s)?.classList.toggle('active', s === screen);
    document.getElementById('nav-' + s)?.classList.toggle('active', s === screen);
  });
  state.screenActive = screen;

  const fab = document.getElementById('fab');
  if (fab) fab.style.display = (screen === 'home' || screen === 'depenses') ? 'flex' : 'none';

  // Render de l'écran actif
  renderScreen(screen);
};

function renderScreen(screen) {
  if (screen === 'home')     renderHome();
  if (screen === 'depenses') renderDepenses();
  if (screen === 'epargne')  renderEpargne();
  if (screen === 'reglages') renderReglages();
}

// Re-render automatique sur changement d'état
onStateChange(() => renderScreen(state.screenActive));

// ── PÉRIODE ───────────────────────────────────────────────────
window.prevPeriode = () => changerPeriode(-1);
window.nextPeriode = () => changerPeriode(+1);

// ── FILTRE DÉPENSES ───────────────────────────────────────────
window.setFiltre = setFiltre;

// ── MODALES ───────────────────────────────────────────────────
window.openModal = function(id) {
  document.getElementById(id)?.classList.add('open');
};
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
};

// Fermer modale en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ── MODAL AJOUT DÉPENSE ───────────────────────────────────────
let addState = { amount: '', cat: null, who: state.activeUser, date: '' };

window.openAddTx = function() {
  addState = {
    amount: '',
    cat: state.categories[0] || { emoji: '📌', nom: 'Autre' },
    who: state.activeUser,
    date: new Date().toISOString().split('T')[0],
  };
  updateKeypadDisplay();
  buildCatsGrid('add-cats-grid', 'selectAddCat', addState.cat.emoji);
  updateWhoButtons('add-who-g', 'add-who-a', addState.who);
  document.getElementById('add-label').value = '';
  document.getElementById('add-date').value = addState.date;
  openModal('modal-add');
};

window.keyPress = function(v) {
  if (v === 'del') {
    addState.amount = addState.amount.slice(0, -1);
  } else if (v === '.') {
    if (!addState.amount.includes('.')) addState.amount += '.';
  } else {
    if (addState.amount.includes('.') && addState.amount.split('.')[1]?.length >= 2) return;
    if (addState.amount === '0') addState.amount = v;
    else addState.amount += v;
  }
  updateKeypadDisplay();
};

function updateKeypadDisplay() {
  const el = document.getElementById('keypad-display');
  if (!el) return;
  const v = addState.amount || '0';
  el.innerHTML = `${v}<span class="cursor">|</span><span style="font-size:24px;color:var(--text3)"> €</span>`;
}

window.selectAddCat = function(emoji, nom) {
  addState.cat = { emoji, nom };
  buildCatsGrid('add-cats-grid', 'selectAddCat', emoji);
};

window.selectAddWho = function(who) {
  addState.who = who;
  updateWhoButtons('add-who-g', 'add-who-a', who);
};

window.confirmAddTx = async function() {
  const montant = parseFloat(addState.amount.replace(',', '.'));
  if (!montant || montant <= 0) { showToast('Entrez un montant valide'); return; }

  const date = document.getElementById('add-date').value || new Date().toISOString().split('T')[0];
  const libelle = document.getElementById('add-label').value.trim();

  try {
    await ajouterTransaction({
      date,
      libelle,
      montant: -montant,
      categorie_emoji: addState.cat?.emoji || '📌',
      personne: addState.who,
      type: 'depense',
      source: 'manuel',
    });
    closeModal('modal-add');
    showToast('✓ Dépense ajoutée');
  } catch (e) {
    console.error(e);
    showToast('Erreur lors de l\'ajout');
  }
};

// ── MODAL ÉDITION DÉPENSE ─────────────────────────────────────
let editState = { id: null, cat: null, who: 'G' };

window.openEditTx = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  editState = { id, cat: { emoji: tx.categorie_emoji }, who: tx.personne };
  document.getElementById('edit-id').value         = id;
  document.getElementById('edit-montant').value    = Math.abs(tx.montant);
  document.getElementById('edit-libelle').value    = tx.libelle || '';
  document.getElementById('edit-date').value       = tx.date;
  buildCatsGrid('edit-cats-grid', 'selectEditCat', tx.categorie_emoji);
  updateWhoButtons('edit-who-g', 'edit-who-a', tx.personne);
  openModal('modal-edit');
};

window.selectEditCat = function(emoji) {
  editState.cat = { emoji };
  buildCatsGrid('edit-cats-grid', 'selectEditCat', emoji);
};

window.selectEditWho = function(who) {
  editState.who = who;
  updateWhoButtons('edit-who-g', 'edit-who-a', who);
};

window.confirmEditTx = async function() {
  const id      = document.getElementById('edit-id').value;
  const montant = parseFloat(document.getElementById('edit-montant').value);
  const libelle = document.getElementById('edit-libelle').value.trim();
  const date    = document.getElementById('edit-date').value;
  if (!montant) { showToast('Montant invalide'); return; }

  await modifierTransaction(id, {
    montant: -Math.abs(montant),
    libelle,
    date,
    categorie_emoji: editState.cat?.emoji,
    personne: editState.who,
  });
  closeModal('modal-edit');
  showToast('✓ Dépense modifiée');
};

window.deleteEditTx = async function() {
  const id = document.getElementById('edit-id').value;
  if (!confirm('Supprimer cette dépense ?')) return;
  await supprimerTransaction(id);
  closeModal('modal-edit');
  showToast('🗑 Dépense supprimée');
};

// ── HELPERS UI ────────────────────────────────────────────────
function buildCatsGrid(gridId, handlerName, selectedEmoji) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = state.categories.map(c => `
    <button class="cat-btn ${c.emoji === selectedEmoji ? 'sel' : ''}"
      onclick="${handlerName}('${c.emoji}')">
      <span class="cat-btn-emoji">${c.emoji}</span>
      <span class="cat-btn-name">${c.nom}</span>
    </button>`).join('');
}

function updateWhoButtons(idG, idA, who) {
  const btnG = document.getElementById(idG);
  const btnA = document.getElementById(idA);
  if (btnG) btnG.className = 'who-btn g' + (who === 'G' ? ' active' : '');
  if (btnA) btnA.className = 'who-btn a' + (who === 'A' ? ' active' : '');
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
window.showToast = function(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
};

// Expose showToast pour les autres modules
window.closeModal = window.closeModal;

// ── INITIALISATION ────────────────────────────────────────────
async function init() {
  // Appliquer le thème sauvegardé
  document.documentElement.setAttribute('data-theme', state.theme);

  // Masquer l'écran de chargement dès que les données sont prêtes
  await loadAll();
  document.getElementById('loading-screen')?.remove();

  // Démarrer le Realtime (sync live)
  startRealtime();

  // Afficher l'écran home par défaut
  goTo('home');
}

init().catch(console.error);
