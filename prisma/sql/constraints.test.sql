-- Talbi — tests des règles de la base de données
--
-- À lancer sur une base vide où schema.prisma et constraints.sql ont été appliqués :
--   psql -v ON_ERROR_STOP=1 -f prisma/sql/constraints.test.sql
-- Chaque test tente une action interdite et vérifie qu'elle est refusée.
-- Tout se déroule dans une transaction annulée à la fin : la base reste vide.

\set QUIET on
SET client_min_messages = warning;

-- Exécute une requête qui DOIT échouer avec le code d'erreur attendu
-- (23514 = contrôle, 23505 = doublon, 23000 = règle d'intégrité des triggers).
-- Une erreur d'un autre type (faute de frappe, colonne inconnue…) fait échouer le test.
CREATE FUNCTION pg_temp.expect_error(test_name text, expected_state text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  got_state text;
  got_message text;
BEGIN
  BEGIN
    EXECUTE sql;
    -- Les vérifications différées ne s'exécutent qu'à la validation : on les force ici
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS got_state = RETURNED_SQLSTATE, got_message = MESSAGE_TEXT;
    SET CONSTRAINTS ALL DEFERRED;
    IF got_state <> expected_state THEN
      RAISE EXCEPTION 'ÉCHEC : « % » refusé pour une mauvaise raison (% : %)',
        test_name, got_state, got_message;
    END IF;
    RAISE NOTICE 'OK  refusé   : %', test_name;
    RETURN;
  END;
  RAISE EXCEPTION 'ÉCHEC : « % » aurait dû être refusé', test_name;
END;
$$;

-- Exécute une requête qui DOIT réussir.
CREATE FUNCTION pg_temp.expect_ok(test_name text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  RAISE NOTICE 'OK  accepté  : %', test_name;
END;
$$;

SET client_min_messages = notice;
-- Les messages « OK » s'affichent ; les lignes vides renvoyées par les appels sont masquées
\o /dev/null
BEGIN;

-- ── Données de départ ────────────────────────────────────────
-- Identifiants lisibles : ...c1 = client, ...b1 = prestataire, etc.
INSERT INTO wilayas (id, "nameFr", "nameAr") VALUES (16, 'Alger', 'الجزائر');

INSERT INTO users (id, name, email, "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Client', 'client@test.dz', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'Prestataire', 'pro@test.dz', now());

INSERT INTO categories (id, slug, "nameFr", "nameAr", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000ca', 'plomberie', 'Plomberie', 'سباكة', now());

INSERT INTO jobs (id, "clientId", "categoryId", title, description, "serviceMode", "wilayaId",
                  "budgetType", "budgetMin", status, "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000ca', 'Fuite cuisine', 'Réparer une fuite', 'ONSITE', 16,
   'FIXED', 1000000, 'ASSIGNED', now());

INSERT INTO proposals (id, "jobId", "providerId", amount, "durationDays", "coverLetter",
                       status, "tokensSpent", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000b1', 1000000, 2, 'Disponible demain', 'ACCEPTED', 2, now());

INSERT INTO contracts (id, "jobId", "proposalId", "clientId", "providerId", title,
                       "totalAmount", "commissionRateBps", "paymentMode", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b1', 'Fuite cuisine', 1000000, 1000, 'ONLINE_ESCROW', now());

-- Jalon de 10 000,00 DA (1 000 000 centimes)
INSERT INTO milestones (id, "contractId", position, title, amount, "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 1,
   'Réparation', 1000000, now());

INSERT INTO ledger_accounts (id, type, "ownerId") VALUES
  ('00000000-0000-0000-0000-000000000a01', 'EXTERNAL', NULL),
  ('00000000-0000-0000-0000-000000000a02', 'ESCROW', NULL),
  ('00000000-0000-0000-0000-000000000a03', 'PLATFORM_REVENUE', NULL),
  ('00000000-0000-0000-0000-000000000a04', 'PROVIDER_WALLET', '00000000-0000-0000-0000-0000000000b1');

\echo
\echo '── Grand livre : équilibre ──'

SELECT pg_temp.expect_error('opération déséquilibrée (100 sortis, 90 entrés)', '23514', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description)
    VALUES ('00000000-0000-0000-0000-000000000b00', 'ADJUSTMENT', 'test:desequilibre', 'test');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b00', '00000000-0000-0000-0000-000000000a01', -10000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b00', '00000000-0000-0000-0000-000000000a02', 9000);
$q$);

SELECT pg_temp.expect_ok('le client paie le jalon : 10 000 DA bloqués en séquestre', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description, "milestoneId")
    VALUES ('00000000-0000-0000-0000-000000000b01', 'MILESTONE_FUNDED', 'fund:f1', 'Jalon payé',
            '00000000-0000-0000-0000-0000000000f1');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000a01', -1000000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000a02',  1000000);
  UPDATE milestones SET status = 'FUNDED', "fundedAt" = now()
    WHERE id = '00000000-0000-0000-0000-0000000000f1';
$q$);

SELECT pg_temp.expect_error('enregistrer deux fois la même opération (clé d''idempotence)', '23505', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description)
    VALUES (gen_random_uuid(), 'MILESTONE_FUNDED', 'fund:f1', 'doublon');
$q$);

SELECT pg_temp.expect_ok('libération : 9 000 DA au prestataire, 1 000 DA de commission', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description, "milestoneId")
    VALUES ('00000000-0000-0000-0000-000000000b02', 'MILESTONE_RELEASED', 'release:f1', 'Jalon libéré',
            '00000000-0000-0000-0000-0000000000f1');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000a02', -1000000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000a04',   900000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000a03',   100000);
$q$);

\echo
\echo '── Grand livre : soldes jamais négatifs ──'

SELECT pg_temp.expect_error('libérer une seconde fois un séquestre déjà vide', '23514', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description)
    VALUES ('00000000-0000-0000-0000-000000000b03', 'MILESTONE_RELEASED', 'release:f1:bis', 'test');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000a02', -1000000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000a04',  1000000);
$q$);

SELECT pg_temp.expect_error('retirer 10 000 DA avec un solde de 9 000 DA', '23514', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description)
    VALUES ('00000000-0000-0000-0000-000000000b04', 'PAYOUT', 'payout:trop', 'test');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b04', '00000000-0000-0000-0000-000000000a04', -1000000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b04', '00000000-0000-0000-0000-000000000a01',  1000000);
$q$);

SELECT pg_temp.expect_ok('retirer 5 000 DA avec un solde de 9 000 DA', $q$
  INSERT INTO ledger_transactions (id, type, "idempotencyKey", description)
    VALUES ('00000000-0000-0000-0000-000000000b05', 'PAYOUT', 'payout:ok', 'Retrait CCP');
  INSERT INTO ledger_entries (id, "transactionId", "accountId", amount) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b05', '00000000-0000-0000-0000-000000000a04', -500000),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000b05', '00000000-0000-0000-0000-000000000a01',  500000);
$q$);

\echo
\echo '── Grand livre : rien ne s''efface ──'

SELECT pg_temp.expect_error('modifier une ligne du grand livre', '23000', $q$
  UPDATE ledger_entries SET amount = amount * 2;
$q$);

SELECT pg_temp.expect_error('supprimer une ligne du grand livre', '23000', $q$
  DELETE FROM ledger_entries;
$q$);

SELECT pg_temp.expect_error('vider le grand livre (TRUNCATE)', '23000', $q$
  TRUNCATE ledger_entries CASCADE;
$q$);

SELECT pg_temp.expect_error('modifier une opération du grand livre', '23000', $q$
  UPDATE ledger_transactions SET description = 'falsifié';
$q$);

SELECT pg_temp.expect_error('créer un second compte de séquestre', '23505', $q$
  INSERT INTO ledger_accounts (id, type) VALUES (gen_random_uuid(), 'ESCROW');
$q$);

SELECT pg_temp.expect_error('portefeuille sans propriétaire', '23514', $q$
  INSERT INTO ledger_accounts (id, type) VALUES (gen_random_uuid(), 'PROVIDER_WALLET');
$q$);

\echo
\echo '── Ce qui est payé ou signé est figé ──'

SELECT pg_temp.expect_error('changer le montant d''un jalon déjà payé', '23000', $q$
  UPDATE milestones SET amount = 5000000 WHERE id = '00000000-0000-0000-0000-0000000000f1';
$q$);

SELECT pg_temp.expect_ok('changer le montant d''un jalon pas encore payé', $q$
  INSERT INTO milestones (id, "contractId", position, title, amount, "updatedAt") VALUES
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', 2, 'Finitions', 200000, now());
  UPDATE milestones SET amount = 250000 WHERE id = '00000000-0000-0000-0000-0000000000f2';
$q$);

SELECT pg_temp.expect_error('changer le taux de commission d''un contrat signé', '23000', $q$
  UPDATE contracts SET "commissionRateBps" = 0 WHERE id = '00000000-0000-0000-0000-0000000000e1';
$q$);

SELECT pg_temp.expect_error('contrat où le client est aussi le prestataire', '23514', $q$
  INSERT INTO jobs (id, "clientId", "categoryId", title, description, "serviceMode",
                    "budgetType", "updatedAt") VALUES
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1',
     '00000000-0000-0000-0000-0000000000ca', 'Test', 'Test', 'REMOTE', 'QUOTE', now());
  INSERT INTO proposals (id, "jobId", "providerId", amount, "durationDays", "coverLetter",
                         "tokensSpent", "updatedAt") VALUES
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2',
     '00000000-0000-0000-0000-0000000000c1', 1000, 1, 'Test', 0, now());
  INSERT INTO contracts (id, "jobId", "proposalId", "clientId", "providerId", title,
                         "totalAmount", "commissionRateBps", "paymentMode", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2',
     '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1',
     'Test', 1000, 1000, 'CASH', now());
$q$);

\echo
\echo '── Paiements ──'

SELECT pg_temp.expect_ok('premier paiement du jalon 1', $q$
  INSERT INTO payments (id, "payerId", purpose, "milestoneId", amount, method, provider,
                        "idempotencyKey", status, "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'MILESTONE_FUNDING',
     '00000000-0000-0000-0000-0000000000f1', 1000000, 'EDAHABIA', 'CHARGILY', 'pay:f1:1', 'SUCCEEDED', now());
$q$);

SELECT pg_temp.expect_error('payer deux fois le même jalon', '23505', $q$
  INSERT INTO payments (id, "payerId", purpose, "milestoneId", amount, method, provider,
                        "idempotencyKey", status, "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'MILESTONE_FUNDING',
     '00000000-0000-0000-0000-0000000000f1', 1000000, 'CIB', 'CHARGILY', 'pay:f1:2', 'PENDING', now());
$q$);

SELECT pg_temp.expect_error('paiement de jalon sans jalon', '23514', $q$
  INSERT INTO payments (id, "payerId", purpose, amount, method, provider, "idempotencyKey", "updatedAt")
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'MILESTONE_FUNDING',
            1000, 'CIB', 'CHARGILY', 'pay:orphelin', now());
$q$);

SELECT pg_temp.expect_error('paiement de montant négatif', '23514', $q$
  INSERT INTO payments (id, "payerId", purpose, "milestoneId", amount, method, provider,
                        "idempotencyKey", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'MILESTONE_FUNDING',
     '00000000-0000-0000-0000-0000000000f2', -100, 'CIB', 'CHARGILY', 'pay:negatif', now());
$q$);

\echo
\echo '── Missions, propositions, avis ──'

SELECT pg_temp.expect_error('deux propositions du même prestataire sur une mission', '23505', $q$
  INSERT INTO proposals (id, "jobId", "providerId", amount, "durationDays", "coverLetter",
                         "tokensSpent", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
     900000, 1, 'Encore moi', 2, now());
$q$);

SELECT pg_temp.expect_error('mission sur place sans wilaya', '23514', $q$
  INSERT INTO jobs (id, "clientId", "categoryId", title, description, "serviceMode",
                    "budgetType", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ca',
     'Test', 'Test', 'ONSITE', 'QUOTE', now());
$q$);

SELECT pg_temp.expect_error('budget « prix fixe » avec un maximum', '23514', $q$
  INSERT INTO jobs (id, "clientId", "categoryId", title, description, "serviceMode",
                    "budgetType", "budgetMin", "budgetMax", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ca',
     'Test', 'Test', 'REMOTE', 'FIXED', 1000, 2000, now());
$q$);

SELECT pg_temp.expect_error('fourchette de budget inversée', '23514', $q$
  INSERT INTO jobs (id, "clientId", "categoryId", title, description, "serviceMode",
                    "budgetType", "budgetMin", "budgetMax", "updatedAt") VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ca',
     'Test', 'Test', 'REMOTE', 'RANGE', 5000, 1000, now());
$q$);

SELECT pg_temp.expect_error('note de 6 étoiles', '23514', $q$
  INSERT INTO reviews (id, "contractId", "authorId", "targetId", direction, rating) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
     '00000000-0000-0000-0000-0000000000b1', 'CLIENT_TO_PROVIDER', 6);
$q$);

SELECT pg_temp.expect_error('se noter soi-même', '23514', $q$
  INSERT INTO reviews (id, "contractId", "authorId", "targetId", direction, rating) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
     '00000000-0000-0000-0000-0000000000c1', 'CLIENT_TO_PROVIDER', 5);
$q$);

\echo
\echo '── Soldes calculés à partir du grand livre ──'
\o
SELECT a.type AS compte, (SUM(e.amount) / 100.0)::numeric(14, 2) AS solde_da
FROM ledger_entries e JOIN ledger_accounts a ON a.id = e."accountId"
GROUP BY a.type ORDER BY a.type;

ROLLBACK;
\echo 'Tous les tests sont passés.'
