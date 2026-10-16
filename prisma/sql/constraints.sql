-- Talbi — règles garanties par la base de données
--
-- Prisma ne sait pas exprimer ces règles : elles seront intégrées à la première
-- migration. Elles protègent les données même si le code de l'application
-- contient un bug. Documentation : docs/02-modele-de-donnees.md (§6).

-- ─────────────────────────────────────────────────────────────
-- 1. Contrôles de cohérence (CHECK)
-- ─────────────────────────────────────────────────────────────

-- Missions
ALTER TABLE jobs
  ADD CONSTRAINT jobs_onsite_requires_wilaya
    CHECK ("serviceMode" <> 'ONSITE' OR "wilayaId" IS NOT NULL),
  ADD CONSTRAINT jobs_budget_positive
    CHECK (("budgetMin" IS NULL OR "budgetMin" > 0) AND ("budgetMax" IS NULL OR "budgetMax" > 0)),
  ADD CONSTRAINT jobs_budget_range
    CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMax" >= "budgetMin"),
  ADD CONSTRAINT jobs_budget_by_type
    CHECK (
      ("budgetType" = 'FIXED' AND "budgetMin" IS NOT NULL AND "budgetMax" IS NULL)
      OR ("budgetType" = 'RANGE' AND "budgetMin" IS NOT NULL AND "budgetMax" IS NOT NULL)
      OR ("budgetType" = 'QUOTE' AND "budgetMin" IS NULL AND "budgetMax" IS NULL)
    ),
  ADD CONSTRAINT jobs_token_cost_positive CHECK ("tokenCost" >= 0);

-- Propositions
ALTER TABLE proposals
  ADD CONSTRAINT proposals_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT proposals_duration_positive CHECK ("durationDays" > 0),
  ADD CONSTRAINT proposals_tokens_positive CHECK ("tokensSpent" >= 0);

ALTER TABLE proposal_milestones
  ADD CONSTRAINT proposal_milestones_amount_positive CHECK (amount > 0);

-- Contrats et jalons
ALTER TABLE contracts
  ADD CONSTRAINT contracts_amount_positive CHECK ("totalAmount" > 0),
  ADD CONSTRAINT contracts_commission_range CHECK ("commissionRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT contracts_distinct_parties CHECK ("clientId" <> "providerId");

ALTER TABLE milestones
  ADD CONSTRAINT milestones_amount_positive CHECK (amount > 0);

-- Paiements et retraits
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_purpose_target CHECK (
    ("purpose" = 'MILESTONE_FUNDING' AND "milestoneId" IS NOT NULL AND "tokenPackId" IS NULL)
    OR ("purpose" = 'TOKEN_PURCHASE' AND "tokenPackId" IS NOT NULL AND "milestoneId" IS NULL)
  );

-- Un jalon ne peut avoir qu'un seul paiement en cours ou réussi (pas de double paiement)
CREATE UNIQUE INDEX payments_one_active_per_milestone
  ON payments ("milestoneId")
  WHERE "milestoneId" IS NOT NULL AND status IN ('PENDING', 'AWAITING_REVIEW', 'SUCCEEDED');

ALTER TABLE payouts
  ADD CONSTRAINT payouts_amount_positive CHECK (amount > 0);

-- Jetons
ALTER TABLE token_packs
  ADD CONSTRAINT token_packs_values_positive CHECK (tokens > 0 AND price > 0);

ALTER TABLE token_transactions
  ADD CONSTRAINT token_transactions_delta_nonzero CHECK (delta <> 0);

-- Avis
ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_subratings_range CHECK (
    ("qualityRating" IS NULL OR "qualityRating" BETWEEN 1 AND 5)
    AND ("punctualityRating" IS NULL OR "punctualityRating" BETWEEN 1 AND 5)
    AND ("communicationRating" IS NULL OR "communicationRating" BETWEEN 1 AND 5)
    AND ("valueRating" IS NULL OR "valueRating" BETWEEN 1 AND 5)
  ),
  ADD CONSTRAINT reviews_not_self CHECK ("authorId" <> "targetId");

-- Fichiers : rattachés à au plus un élément
ALTER TABLE file_assets
  ADD CONSTRAINT file_assets_single_parent CHECK (
    num_nonnulls("jobId", "proposalId", "messageId", "submissionId", "portfolioItemId",
                 "identityVerificationId", "paymentId", "disputeMessageId") <= 1
  ),
  ADD CONSTRAINT file_assets_size_positive CHECK ("sizeBytes" > 0);

-- Grand livre : un portefeuille a un propriétaire, les comptes système n'en ont pas
ALTER TABLE ledger_accounts
  ADD CONSTRAINT ledger_accounts_owner_matches_type
    CHECK (("type" = 'PROVIDER_WALLET') = ("ownerId" IS NOT NULL));

-- Un seul compte système de chaque type (NULL n'est pas couvert par l'index unique Prisma)
CREATE UNIQUE INDEX ledger_accounts_one_system_account
  ON ledger_accounts ("type")
  WHERE "ownerId" IS NULL;

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_amount_nonzero CHECK (amount <> 0);

-- ─────────────────────────────────────────────────────────────
-- 2. Tables en ajout seul : aucune ligne modifiée ni supprimée
-- ─────────────────────────────────────────────────────────────

CREATE FUNCTION talbi_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La table % est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER ledger_transactions_append_only
  BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER token_transactions_append_only
  BEFORE UPDATE OR DELETE ON token_transactions
  FOR EACH ROW EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION talbi_forbid_change();

-- TRUNCATE contourne les triggers de ligne : on l'interdit aussi
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER ledger_transactions_no_truncate
  BEFORE TRUNCATE ON ledger_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER token_transactions_no_truncate
  BEFORE TRUNCATE ON token_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION talbi_forbid_change();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION talbi_forbid_change();

-- ─────────────────────────────────────────────────────────────
-- 3. Grand livre : chaque opération s'équilibre à zéro
-- (vérifié à la fin de la transaction SQL, une fois toutes les lignes insérées)
-- ─────────────────────────────────────────────────────────────

CREATE FUNCTION talbi_check_ledger_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  total bigint;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM ledger_entries
  WHERE "transactionId" = NEW."transactionId";

  IF total <> 0 THEN
    RAISE EXCEPTION 'Opération % déséquilibrée (somme = %)', NEW."transactionId", total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION talbi_check_ledger_balanced();

-- ─────────────────────────────────────────────────────────────
-- 4. Grand livre : un portefeuille ou le séquestre ne passe jamais en négatif
-- Le verrou sur le compte met en file d'attente les opérations simultanées
-- (ex. : deux retraits envoyés en même temps) : la seconde voit le solde mis à jour.
-- ─────────────────────────────────────────────────────────────

CREATE FUNCTION talbi_check_account_non_negative() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  account_type "LedgerAccountType";
  balance bigint;
BEGIN
  -- NO KEY UPDATE et non UPDATE : l'insertion de la ligne a déjà pris un verrou
  -- KEY SHARE (clé étrangère) ; FOR UPDATE provoquerait un interblocage entre
  -- deux opérations simultanées au lieu de les mettre en file d'attente.
  SELECT "type" INTO account_type
  FROM ledger_accounts
  WHERE id = NEW."accountId"
  FOR NO KEY UPDATE;

  IF account_type NOT IN ('PROVIDER_WALLET', 'ESCROW') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO balance
  FROM ledger_entries
  WHERE "accountId" = NEW."accountId";

  IF balance < 0 THEN
    RAISE EXCEPTION 'Solde insuffisant sur le compte % (solde = %)', NEW."accountId", balance
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_entries_non_negative
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.amount < 0)
  EXECUTE FUNCTION talbi_check_account_non_negative();

-- ─────────────────────────────────────────────────────────────
-- 5. Ce qui est payé ou signé est figé
-- ─────────────────────────────────────────────────────────────

CREATE FUNCTION talbi_freeze_milestone_amount() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount <> OLD.amount AND OLD.status <> 'AWAITING_FUNDING' THEN
    RAISE EXCEPTION 'Le montant du jalon % est figé (statut %)', OLD.id, OLD.status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."contractId" <> OLD."contractId" THEN
    RAISE EXCEPTION 'Un jalon ne peut pas changer de contrat'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER milestones_freeze_amount
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION talbi_freeze_milestone_amount();

CREATE FUNCTION talbi_freeze_contract_terms() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."commissionRateBps" <> OLD."commissionRateBps"
     OR NEW."clientId" <> OLD."clientId"
     OR NEW."providerId" <> OLD."providerId"
     OR NEW."proposalId" <> OLD."proposalId"
     OR NEW."paymentMode" <> OLD."paymentMode" THEN
    RAISE EXCEPTION 'Les termes du contrat % sont figés', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_freeze_terms
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION talbi_freeze_contract_terms();
