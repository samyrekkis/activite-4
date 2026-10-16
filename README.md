# Talbi (طلبي)

**La plateforme algérienne où le client publie son besoin et où les prestataires lui envoient leurs offres.**

Talbi est un *reverse marketplace* de services, sur le modèle d'Upwork, adapté à l'Algérie :

- services **à distance** (freelance numérique) et **sur place** (artisans, techniciens), filtrés par wilaya ;
- paiement en **dinars** (Edahabia, CIB, BaridiMob) avec séquestre ;
- interface en **français** et en **arabe**.

## Documentation

| Document | Contenu |
|---|---|
| [00 — Analyse de projets de référence](docs/00-analyse-projets-reference.md) | Étude de trois clones d'Upwork open source : idées retenues et failles à éviter |
| [01 — Cahier des charges](docs/01-cahier-des-charges.md) | Vision, acteurs, parcours, fonctionnalités, modèle économique, architecture, feuille de route |
| [02 — Modèle de données](docs/02-modele-de-donnees.md) | Les 42 tables, le grand livre en partie double, les règles garanties par la base et leurs tests |

## Base de données

| Fichier | Contenu |
|---|---|
| [`prisma/schema.prisma`](prisma/schema.prisma) | Structure de la base (PostgreSQL) |
| [`prisma/sql/constraints.sql`](prisma/sql/constraints.sql) | Règles vérifiées par la base : grand livre équilibré et inaltérable, soldes jamais négatifs, montants figés… |
| [`prisma/sql/constraints.test.sql`](prisma/sql/constraints.test.sql) | Tests qui tentent de contourner ces règles |

## État du projet

🟡 Phase de conception (octobre 2026)
