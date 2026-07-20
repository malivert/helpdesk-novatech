# HelpDesk NovaTech

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Projet](https://img.shields.io/badge/projet-BTS%20SIO%20SISR-14B8D4)](#présentation-pour-un-recruteur)

Application web professionnelle de gestion de tickets informatiques, réalisée dans le cadre d’un projet de première année de **BTS SIO option SISR**.

HelpDesk NovaTech simule le centre de services d’une PME. Le technicien peut consulter son tableau de bord, créer une demande, rechercher et filtrer les tickets, modifier leur contenu, les assigner puis les clôturer.

## Démonstration fonctionnelle

- tableau de bord avec indicateurs calculés à partir des tickets ;
- liste de tickets avec données réalistes de démonstration ;
- création d’un ticket avec contrôle des champs obligatoires ;
- modification du sujet, du demandeur, du service, de la priorité, du statut, du technicien et de la description ;
- fermeture rapide d’un ticket ;
- recherche par identifiant, sujet, demandeur ou technicien ;
- filtres par priorité et statut ;
- navigation vers les vues Équipe et Paramètres ;
- conservation locale des changements dans le navigateur ;
- réinitialisation des données de démonstration ;
- interface responsive et navigation clavier.

## Technologies

- Next.js 16, React 19 et TypeScript ;
- CSS responsive personnalisé ;
- Lucide React pour les icônes ;
- `localStorage` pour la démonstration locale ;
- Node Test Runner, ESLint et validation de production.

## Prérequis

- Node.js 22.13 ou version plus récente ;
- npm ;
- Linux, macOS ou Windows avec WSL recommandé.

## Installation

```bash
git clone https://github.com/malivert/helpdesk-novatech.git
cd helpdesk-novatech
npm ci
npm run dev
```

Ouvrir ensuite l’adresse indiquée par le terminal.

## Commandes utiles

```bash
npm run dev       # serveur de développement Next.js
npm run lint      # analyse statique
npm test          # tests automatisés
npm run build     # compilation de production
```

## Utilisation

1. Cliquer sur **Nouveau ticket**.
2. Renseigner le sujet, le demandeur et la description.
3. Choisir une priorité, un statut et un technicien.
4. Ouvrir **Tickets** pour rechercher ou filtrer la file.
5. Utiliser l’icône crayon pour modifier une demande.
6. Utiliser l’icône de clôture pour fermer le ticket.
7. Dans **Paramètres**, restaurer les données initiales si nécessaire.

## Structure principale

```text
helpdesk-novatech/
├── app/
│   ├── globals.css       # système visuel Aurora Ops
│   ├── layout.tsx        # métadonnées et structure HTML
│   └── page.tsx          # vues, données et logique métier
├── public/               # ressources publiques
├── tests/                # tests du rendu de production
├── package.json
├── vercel.json           # configuration de déploiement
├── .gitignore
└── README.md
```

## Tests réalisés

- analyse ESLint sans erreur ;
- compilation TypeScript et production ;
- validation de l’artefact déployable ;
- contrôle du rendu HTML ;
- navigation entre les différentes vues ;
- création, modification et fermeture d’un ticket ;
- recherche et filtres ;
- vérification visuelle du tableau de bord.

## Limites pédagogiques

Les données sont stockées dans le navigateur afin que le projet reste installable et démontrable en une journée. Une version destinée à la production utiliserait une base de données, une authentification, une gestion des rôles, un historique d’audit et des sauvegardes serveur.

## Déploiement sur Vercel

1. Importer le dépôt `malivert/helpdesk-novatech` dans Vercel.
2. Conserver le framework **Next.js** détecté automatiquement.
3. Lancer le déploiement. Aucune variable d’environnement n’est nécessaire.

Le fichier `.gitignore` exclut les variables d’environnement, les clés, les certificats, les métadonnées locales et les dossiers de compilation.

## Présentation pour un recruteur

> J’ai conçu HelpDesk NovaTech, une application de support informatique inspirée d’un centre de services réel. Elle permet de gérer le cycle de vie d’un incident, de sa création à sa clôture, avec priorisation, affectation, recherche et tableaux de bord. Ce projet m’a permis de travailler la logique d’un outil ITSM, la qualité des données, l’ergonomie, les tests et la documentation technique. J’ai volontairement séparé la démonstration locale des besoins d’une future version de production afin d’identifier clairement les évolutions nécessaires : base de données, authentification, rôles et journalisation.

## Auteur

Projet pédagogique — BTS SIO SISR, première année.
