# HelpDesk NovaTech 2.0

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-optionnel-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![CI](https://github.com/malivert/helpdesk-novatech/actions/workflows/ci.yml/badge.svg)](https://github.com/malivert/helpdesk-novatech/actions/workflows/ci.yml)

Application web professionnelle de gestion de tickets informatiques conçue pour un projet de première année de **BTS SIO option SISR**. La version 2.0 ajoute les rapports, les échéances, les pièces jointes locales, le mode sombre et une interface mobile renforcée.

HelpDesk NovaTech fonctionne immédiatement dans le navigateur et peut ensuite évoluer vers un service partagé avec Supabase. Une panne distante ne bloque jamais la démonstration : l’application bascule automatiquement vers un stockage local persistant.

## Démonstration en ligne

<https://helpdesk-novatech.vercel.app>

## Fonctionnement hybride

### Mode Supabase

Lorsque l’URL et la clé publishable Supabase sont valides et que le service répond :

- session Supabase réutilisée lorsqu’elle existe ;
- base PostgreSQL partagée ;
- profils et rôles demandeur, technicien et administrateur ;
- commentaires et historique d’audit ;
- contrôle des accès avec Row Level Security.

### Mode démonstration

Lorsque Supabase est absent, inaccessible ou renvoie une erreur :

- bascule automatique sans écran bloqué ;
- profil local **Christian Martin**, initiales **CM** ;
- données de démonstration réalistes ;
- persistance dans `localStorage` ;
- indication permanente du mode utilisé ;
- bouton de nouvelle tentative vers Supabase.

Aucun compte n’est nécessaire pour ce mode. Les données restent uniquement dans le navigateur utilisé.
Le site ouvre directement le tableau de bord : aucun panneau de connexion ne bloque l’accès à la démonstration.

## Fonctionnalités

- tableau de bord avec nombre de tickets ouverts, temps moyen de résolution, taux de résolution et urgences réellement calculés ;
- création, modification, fermeture et réouverture des tickets ;
- confirmation explicite avant toute fermeture ;
- date de création, date limite et signalement des échéances dépassées ;
- attribution à un technicien et répartition de charge ;
- commentaires sur chaque ticket et historique complet des changements ;
- jusqu’à trois pièces jointes locales de 1 Mo par ticket dans la démonstration ;
- recherche par numéro, sujet, description, service, demandeur ou technicien ;
- filtres par priorité, statut et technicien ;
- filtre des indicateurs par jour, semaine, mois ou toute la période ;
- tri par mise à jour, numéro, priorité, statut ou sujet ;
- export des tickets en JSON et CSV ;
- import d’une sauvegarde JSON en mode démonstration ;
- page Rapports avec graphiques accessibles et tickets les plus anciens ;
- page Compétences BTS SIO SISR intégrée ;
- notifications dans l’application et message hors ligne ;
- mode sombre persistant ;
- réinitialisation des données locales ;
- interface responsive pour ordinateur, tablette et mobile ;
- navigation clavier, lien d’évitement, libellés accessibles et réduction des animations ;
- messages d’erreur compréhensibles sans divulgation technique sensible.

## Technologies

- Next.js 16, React 19 et TypeScript ;
- Supabase JS et Supabase SSR ;
- PostgreSQL, Auth, RLS et déclencheurs d’audit ;
- CSS responsive personnalisé ;
- Lucide React ;
- Node Test Runner, ESLint, TypeScript et GitHub Actions ;
- Vercel pour l’hébergement.

## Installation

### Prérequis

- Node.js 22 ;
- npm.

```bash
git clone https://github.com/malivert/helpdesk-novatech.git
cd helpdesk-novatech
npm ci
npm run dev
```

Sans fichier d’environnement, le mode démonstration démarre automatiquement.

## Configuration Supabase facultative

```bash
cp .env.example .env.local
```

Renseigner uniquement :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_votre_cle
```

Ces deux informations sont conçues pour le client public lorsqu’elles sont associées à des politiques RLS correctes. Ne jamais placer de clé `service_role`, de secret serveur ou de mot de passe dans une variable `NEXT_PUBLIC_`.

Les migrations versionnées sont disponibles dans `supabase/migrations/`.

## Commandes qualité

```bash
npm test              # tests automatisés
npm run lint          # analyse ESLint
npm run typecheck     # vérification TypeScript
npm run build         # compilation de production Next.js
```

Le workflow `.github/workflows/ci.yml` exécute automatiquement ces quatre contrôles sur chaque push vers `main` et chaque Pull Request.

## Sauvegarde locale

Depuis **Paramètres et sauvegardes** :

1. **Export JSON** crée une sauvegarde complète des tickets, commentaires et historique.
2. **Export CSV** exporte la liste actuellement filtrée.
3. **Importer** restaure un fichier JSON valide dans le mode démonstration.
4. **Réinitialiser la démo** restaure les données pédagogiques initiales.

L’import ne pousse jamais automatiquement des données vers Supabase.

## Structure principale

```text
helpdesk-novatech/
├── .github/workflows/ci.yml
├── app/
│   ├── auth/callback/       # confirmation Supabase Auth
│   ├── login/               # ancienne URL redirigée vers le tableau de bord
│   ├── globals.css          # design responsive et accessible
│   └── page.tsx             # moteur hybride, rapports et interface 2.0
├── lib/supabase/            # clients sécurisés navigateur/serveur/proxy
├── supabase/migrations/     # schéma, audit, index et politiques RLS
├── tests/                   # tests automatisés
├── package.json
├── vercel.json
└── README.md
```

## Sécurité

- aucune clé `service_role` dans le navigateur ou le dépôt ;
- fichiers `.env*` ignorés, sauf le modèle factice `.env.example` ;
- erreurs réseau interceptées et remplacées par des messages utilisateurs ;
- autorisations Supabase contrôlées côté PostgreSQL avec RLS ;
- historique d’audit en lecture seule pour le client ;
- workflow GitHub Actions limité à la lecture du dépôt ;
- import local validé avant utilisation.

## Compétences BTS SIO SISR

Ce projet permet de présenter les compétences suivantes :

- **Gérer le patrimoine informatique** : inventaire logique des incidents, utilisateurs, rôles et services.
- **Répondre aux incidents et aux demandes d’assistance** : cycle complet d’un ticket, priorisation, affectation, traitement et clôture.
- **Développer la présence en ligne de l’organisation** : application responsive, accessible, documentée et déployée.
- **Travailler en mode projet** : Git, branches, Pull Requests, README, tests et intégration continue.
- **Mettre à disposition un service informatique** : déploiement Vercel, contrôle de compilation et stratégie de continuité locale.
- **Organiser son développement professionnel** : documentation des choix, limites, risques et évolutions possibles.

Le fonctionnement hybride illustre aussi une notion importante en SISR : la **continuité de service**. La base distante apporte le travail partagé, tandis que le mode local garantit une démonstration fonctionnelle même en cas d’indisponibilité réseau.

## Présentation pour un recruteur

> J’ai conçu HelpDesk NovaTech 2.0, une application de support informatique capable de fonctionner avec une base Supabase sécurisée ou de basculer automatiquement vers une démonstration locale. Le projet couvre le cycle de vie complet d’un incident, les échéances, les commentaires, les pièces jointes, l’historique, les rapports, les sauvegardes et la continuité de service. J’ai également mis en place les tests, la vérification TypeScript, GitHub Actions et le déploiement Vercel.

## Limites pédagogiques

Le mode démonstration n’est pas synchronisé entre appareils et ne remplace pas une base sauvegardée côté serveur. Pour une exploitation réelle, il faudrait compléter la supervision, la stratégie de sauvegarde PostgreSQL, la gestion des pièces jointes, les notifications et les procédures d’administration.

## Auteur

Projet pédagogique — BTS SIO SISR, première année.
