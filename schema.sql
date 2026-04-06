-- ============================================================
-- BUDGET BOUTIDY — Schéma Supabase
-- À coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ── 1. PARAMETRES (réglages partagés) ────────────────────────
CREATE TABLE IF NOT EXISTS parametres (
  cle     TEXT PRIMARY KEY,
  valeur  JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. CATEGORIES (catégories custom) ────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji   TEXT NOT NULL,
  nom     TEXT NOT NULL,
  couleur TEXT DEFAULT 'rgba(150,150,150,.12)',
  ordre   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. CHARGES FIXES (mensualités récurrentes) ───────────────
CREATE TABLE IF NOT EXISTS charges_fixes (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom      TEXT NOT NULL,
  montant_prevu  NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_reel   NUMERIC(10,2),          -- ajusté depuis la banque
  emoji    TEXT DEFAULT '📌',
  type     TEXT DEFAULT 'Autre',
  actif    BOOLEAN DEFAULT TRUE,
  ordre    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. COMPTES EPARGNE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptes_epargne (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom               TEXT NOT NULL,
  emoji             TEXT DEFAULT '💰',
  solde             NUMERIC(10,2) DEFAULT 0,
  versement_mensuel NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. TRANSACTIONS (toutes les écritures financières) ────────
--   type     : 'depense' | 'revenu' | 'epargne' | 'charge_fixe'
--   source   : 'manuel' | 'bancaire' | 'auto'
--   personne : 'G' (Geoffrey) | 'A' (Amandine) | 'commun'
--   periode  : 'YYYY-MM' — période budgétaire démarrant le 28
--              ex: avril = du 28/03 au 27/04 → periode = '2026-03'
--   hash_doublon : empreinte pour déduplication bancaire
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  libelle         TEXT,
  montant         NUMERIC(10,2) NOT NULL,   -- négatif = dépense, positif = revenu
  categorie_emoji TEXT DEFAULT '📌',
  personne        TEXT CHECK (personne IN ('G','A','commun')) DEFAULT 'commun',
  type            TEXT CHECK (type IN ('depense','revenu','epargne','charge_fixe')) DEFAULT 'depense',
  source          TEXT CHECK (source IN ('manuel','bancaire','auto')) DEFAULT 'manuel',
  periode         TEXT NOT NULL,             -- 'YYYY-MM'
  charge_fixe_id  UUID REFERENCES charges_fixes(id) ON DELETE SET NULL,
  hash_doublon    TEXT UNIQUE,               -- null = pas de déduplication
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEX ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_periode    ON transactions(periode);
CREATE INDEX IF NOT EXISTS idx_tx_date       ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_personne   ON transactions(personne);
CREATE INDEX IF NOT EXISTS idx_tx_type       ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_hash       ON transactions(hash_doublon);

-- ── REALTIME ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE parametres;
ALTER PUBLICATION supabase_realtime ADD TABLE charges_fixes;
ALTER PUBLICATION supabase_realtime ADD TABLE comptes_epargne;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- App privée : accès complet avec la clé anon (accès par URL uniquement)
ALTER TABLE parametres      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges_fixes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptes_epargne ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_total" ON parametres      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON categories      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON charges_fixes   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON comptes_epargne FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON transactions    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── DONNÉES PAR DÉFAUT ────────────────────────────────────────

-- Paramètres
INSERT INTO parametres (cle, valeur) VALUES
  ('salaire_g',          '2200'),
  ('salaire_a',          '1800'),
  ('foncier',            '301'),
  ('jour_debut_periode', '28')
ON CONFLICT (cle) DO NOTHING;

-- Catégories
INSERT INTO categories (emoji, nom, couleur, ordre) VALUES
  ('🛒','Courses',    'rgba(91,140,255,.15)',  1),
  ('🍽️','Restau',     'rgba(255,184,77,.15)', 2),
  ('⛽','Essence',    'rgba(200,241,53,.12)',  3),
  ('💊','Santé',      'rgba(255,92,92,.15)',   4),
  ('🏠','Maison',     'rgba(160,140,255,.15)', 5),
  ('👗','Vêtements',  'rgba(255,100,180,.15)', 6),
  ('🎮','Loisirs',    'rgba(100,220,200,.15)', 7),
  ('🐾','Animaux',    'rgba(255,150,80,.15)',  8),
  ('📦','Amazon',     'rgba(91,140,255,.12)',  9),
  ('👶','Enfants',    'rgba(255,220,100,.15)', 10),
  ('✂️','Coiffeur',   'rgba(200,200,200,.12)', 11),
  ('📌','Autre',      'rgba(150,150,150,.12)', 12),
  ('💰','Épargne',    'rgba(200,241,53,.10)',  13)
ON CONFLICT DO NOTHING;

-- Charges fixes
INSERT INTO charges_fixes (nom, montant_prevu, emoji, type, ordre) VALUES
  ('Loyer',      850,  '🏠', 'Logement',   1),
  ('Eau',         35,  '💧', 'Logement',   2),
  ('Électricité', 80,  '⚡', 'Logement',   3),
  ('Assurances', 120,  '🛡️', 'Assurances', 4),
  ('Camping-car', 90,  '🚐', 'Véhicules',  5),
  ('Tesla',      650,  '🚗', 'Véhicules',  6),
  ('Impôts',       0,  '📋', 'Taxes',      7),
  ('Bouygues',    45,  '📱', 'Télécom',    8),
  ('Eurocompte',   6,  '🏦', 'Banque',     9),
  ('Cantine',     80,  '🍽️', 'Enfants',   10),
  ('Spotify',     10,  '🎵', 'Loisirs',   11),
  ('iPhone',      35,  '📱', 'Télécom',   12)
ON CONFLICT DO NOTHING;

-- Comptes épargne
INSERT INTO comptes_epargne (nom, emoji, solde, versement_mensuel) VALUES
  ('LEP',               '💰', 8200, 150),
  ('Livret Bleu Cassie','💙', 3400, 100)
ON CONFLICT DO NOTHING;

-- ── FONCTION CALCUL PERIODE ───────────────────────────────────
-- Retourne la période budgétaire (YYYY-MM) pour une date donnée
-- Le mois démarre le 28 → si date >= 28, on est dans le mois courant
-- si date < 28, on est dans la période du mois précédent
CREATE OR REPLACE FUNCTION get_periode(p_date DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(
    CASE WHEN EXTRACT(DAY FROM p_date) >= 28
      THEN date_trunc('month', p_date)
      ELSE date_trunc('month', p_date) - INTERVAL '1 month'
    END,
    'YYYY-MM'
  );
$$;

-- ── TRIGGER updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_charges_fixes_updated
  BEFORE UPDATE ON charges_fixes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comptes_epargne_updated
  BEFORE UPDATE ON comptes_epargne
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
