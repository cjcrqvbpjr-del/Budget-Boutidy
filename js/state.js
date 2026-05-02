// ── ÉTAT GLOBAL (source de vérité = Supabase) ─────────────────
import { dbSelect, dbInsert, dbUpdate, dbDelete, dbUpsert, subscribeRealtime, startRealtimeConnection } from './supabase.js';
import { getPeriodeCourante, periodeVoisine } from './budget.js';

// State réactif — toutes les données viennent de Supabase
export const state = {
  // Données partagées (depuis Supabase)
  transactions:     [],
  transactionsPrev: [],   // Période précédente → calcul du report
  parametres:       {},
  chargesFixes:     [],
  comptesEpargne:   [],
  categories:       [],

  // Préférences locales (localStorage)
  activeUser:   localStorage.getItem('bb_user')  || 'G',
  theme:        localStorage.getItem('bb_theme') || 'dark',
  notifEnabled: localStorage.getItem('bb_notif') === '1',

  // Navigation
  periodeActive: getPeriodeCourante(),
  screenActive:  'home',

  // UI
  syncStatus: 'idle', // 'idle' | 'syncing' | 'ok' | 'error'
};

// Callbacks UI à déclencher au changement de données
const listeners = new Set();
export function onStateChange(cb) { listeners.add(cb); }
function notify() { listeners.forEach(cb => cb()); }

// ── CHARGEMENT INITIAL ────────────────────────────────────────
export async function loadAll() {
  state.syncStatus = 'syncing';
  notify();
  try {
    const periodePrev = periodeVoisine(state.periodeActive, -1);
    const [tx, txPrev, params, charges, epargne, cats] = await Promise.all([
      dbSelect('transactions', `periode=eq.${state.periodeActive}&order=date.desc`),
      dbSelect('transactions', `periode=eq.${periodePrev}&order=date.desc`),
      dbSelect('parametres'),
      dbSelect('charges_fixes', 'actif=eq.true&order=ordre.asc'),
      dbSelect('comptes_epargne', 'order=created_at.asc'),
      dbSelect('categories', 'order=ordre.asc'),
    ]);

    state.transactions     = tx;
    state.transactionsPrev = txPrev;
    state.parametres       = Object.fromEntries(params.map(p => [p.cle, JSON.parse(p.valeur)]));
    state.chargesFixes     = charges;
    state.comptesEpargne   = epargne;
    state.categories       = cats;
    state.syncStatus       = 'ok';
  } catch (e) {
    console.error('[State] Erreur chargement:', e);
    state.syncStatus = 'error';
  }
  notify();
}

// Charge les transactions d'une période (+ la précédente pour le report)
export async function loadTransactions(periode = state.periodeActive) {
  const periodePrev = periodeVoisine(periode, -1);
  const [tx, txPrev] = await Promise.all([
    dbSelect('transactions', `periode=eq.${periode}&order=date.desc`),
    dbSelect('transactions', `periode=eq.${periodePrev}&order=date.desc`),
  ]);
  state.transactions     = tx;
  state.transactionsPrev = txPrev;
  notify();
}

// ── REALTIME ──────────────────────────────────────────────────
export function startRealtime() {
  // Enregistrer les callbacks avant de démarrer la connexion
  subscribeRealtime('transactions', async ({ event, record, old }) => {
    if (record?.periode !== state.periodeActive && old?.periode !== state.periodeActive) return;
    if (event === 'INSERT') {
      if (!state.transactions.find(t => t.id === record.id)) {
        state.transactions = [record, ...state.transactions];
      }
    } else if (event === 'UPDATE') {
      state.transactions = state.transactions.map(t => t.id === record.id ? record : t);
    } else if (event === 'DELETE') {
      state.transactions = state.transactions.filter(t => t.id !== old.id);
    }
    notify();
  });

  subscribeRealtime('parametres', async () => {
    const params = await dbSelect('parametres');
    state.parametres = Object.fromEntries(params.map(p => [p.cle, JSON.parse(p.valeur)]));
    notify();
  });

  subscribeRealtime('charges_fixes', async () => {
    state.chargesFixes = await dbSelect('charges_fixes', 'actif=eq.true&order=ordre.asc');
    notify();
  });

  subscribeRealtime('comptes_epargne', async () => {
    state.comptesEpargne = await dbSelect('comptes_epargne', 'order=created_at.asc');
    notify();
  });

  // Démarrer UNE SEULE connexion WebSocket pour tout
  startRealtimeConnection();
}

// ── ACTIONS TRANSACTIONS ──────────────────────────────────────
import { getPeriode } from './budget.js';

export async function ajouterTransaction(data) {
  const periode = getPeriode(new Date(data.date));
  const tx = await dbInsert('transactions', { ...data, periode });
  if (tx?.[0]) {
    state.transactions = [tx[0], ...state.transactions];
    notify();
  }
  return tx?.[0];
}

export async function modifierTransaction(id, data) {
  const tx = await dbUpdate('transactions', id, data);
  state.transactions = state.transactions.map(t => t.id === id ? { ...t, ...data } : t);
  notify();
  return tx;
}

export async function supprimerTransaction(id) {
  await dbDelete('transactions', id);
  state.transactions = state.transactions.filter(t => t.id !== id);
  notify();
}

// ── ACTIONS PARAMETRES ────────────────────────────────────────
export async function sauvegarderParametre(cle, valeur) {
  await dbUpsert('parametres', { cle, valeur: JSON.stringify(valeur) }, 'cle');
  state.parametres[cle] = valeur;
  notify();
}

// ── ACTIONS CHARGES FIXES ─────────────────────────────────────
export async function ajouterCharge(data) {
  const [charge] = await dbInsert('charges_fixes', data);
  state.chargesFixes = [...state.chargesFixes, charge];
  notify();
  return charge;
}

export async function modifierCharge(id, data) {
  await dbUpdate('charges_fixes', id, data);
  state.chargesFixes = state.chargesFixes.map(c => c.id === id ? { ...c, ...data } : c);
  notify();
}

export async function supprimerCharge(id) {
  await dbDelete('charges_fixes', id);
  state.chargesFixes = state.chargesFixes.filter(c => c.id !== id);
  notify();
}

// ── ACTIONS EPARGNE ───────────────────────────────────────────
export async function ajouterCompteEpargne(data) {
  const [compte] = await dbInsert('comptes_epargne', data);
  state.comptesEpargne = [...state.comptesEpargne, compte];
  notify();
  return compte;
}

export async function modifierCompteEpargne(id, data) {
  await dbUpdate('comptes_epargne', id, data);
  state.comptesEpargne = state.comptesEpargne.map(c => c.id === id ? { ...c, ...data } : c);
  notify();
}

export async function supprimerCompteEpargne(id) {
  await dbDelete('comptes_epargne', id);
  state.comptesEpargne = state.comptesEpargne.filter(c => c.id !== id);
  notify();
}

// ── ACTIONS CATEGORIES ────────────────────────────────────────
export async function ajouterCategorie(data) {
  const [cat] = await dbInsert('categories', data);
  state.categories = [...state.categories, cat];
  notify();
  return cat;
}

export async function supprimerCategorie(id) {
  await dbDelete('categories', id);
  state.categories = state.categories.filter(c => c.id !== id);
  notify();
}

// ── NAVIGATION PÉRIODE ────────────────────────────────────────
export async function changerPeriode(direction) {
  state.periodeActive = periodeVoisine(state.periodeActive, direction);
  state.syncStatus = 'syncing';
  notify();
  await loadTransactions(state.periodeActive);
  state.syncStatus = 'ok';
  notify();
}

// ── PRÉFÉRENCES LOCALES ───────────────────────────────────────
export function setActiveUser(user) {
  state.activeUser = user;
  localStorage.setItem('bb_user', user);
  notify();
}

export function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('bb_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  notify();
}
