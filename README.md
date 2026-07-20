# HelpDesk NovaTech 2.0

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-optionnel-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![CI](https://github.com/malivert/helpdesk-novatech/actions/workflows/ci.yml/badge.svg)](https://github.com/malivert/helpdesk-novatech/actions/workflows/ci.yml)

Application web professionnelle de gestion de tickets et de parc informatique conçue pour un projet de première année de **BTS SIO option SISR**. La version 2.1 enrichit NovaTech 2.0 avec un inventaire complet des postes, serveurs, imprimantes et équipements réseau.

HelpDesk NovaTech fonctionne de manière autonome dans le navigateur. `localStorage` est le stockage principal et chaque modification est sauvegardée automatiquement. Supabase reste une option facultative, désactivée par défaut : aucune base distante, clé ou connexion n’est nécessaire.

## Démonstration en ligne

<https://helpdesk-novatech.vercel.app>

## Fonctionnement hybride

### Mode Supabase facultatif

Supabase est désactivé au démarrage. Il peut être activé volontairement depuis **Paramètres** lorsque l’environnement est déjà configuré :

- session Supabase réutilisée lorsqu’elle existe ;
- base PostgreSQL partagée ;
- profils et rôles demandeur, technicien et administrateur ;
- commentaires et historique d’audit ;
- contrôle des accès avec Row Level Security.

### Mode démonstration autonome

Ce mode est toujours utilisé au démarrage :

- démarrage direct sans écran de connexion ;
- profil local **Christian Martin**, initiales **CM** ;
- données de démonstration réalistes ;
- `localStorage` utilisé comme stockage principal ;
- sauvegarde automatique après chaque modification ;
- indication permanente du mode utilisé ;
- aucune erreur Supabase tant que l’option n’est pas activée.

Aucun compte n’est nécessaire pour ce mode. Les données restent uniquement dans le navigateur utilisé.
Le site ouvre directement le tableau de bord : aucun panneau de connexion ne bloque l’accès à la démonstration.

## Fonctionnalités

### Parc informatique

- création, modification et suppression contrôlée des équipements ;
- ordinateurs, serveurs, imprimantes, équipements réseau et autres matériels ;
- nom, type, adresse IP, système, utilisateur, emplacement, état, numéro de série, date d’achat et fin de garantie ;
- états disponible, attribué, en panne et maintenance avec repères visuels ;
- recherche multi-champs, filtres par type et état, tri par nom, type, statut, utilisateur ou garantie ;
- statistiques calculées : disponibles, attribués, en panne et hors garantie ;
- liaison directe entre un équipement et un ou plusieurs tickets ;
- historique local horodaté des créations, modifications et suppressions ;
- export de l’inventaire courant en CSV et export complet en JSON ;
- sept équipements de démonstration réalistes couvrant postes, infrastructure et impression.

### Centre de services

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

Sans fichier d’environnement, le mode démonstration autonome démarre automatiquement et toutes les fonctions restent disponibles.

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

1. **Export JSON** crée une sauvegarde complète des tickets, commentaires, équipements et historiques.
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
│   └── page.tsx             # moteur autonome, tickets, parc, rapports et interface 2.1
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

- **Gérer le patrimoine informatique** : inventaire des postes, serveurs, imprimantes et équipements réseau, affectations, adresses IP, garanties, états, historique et tickets associés.
- **Répondre aux incidents et aux demandes d’assistance** : cycle complet d’un ticket, priorisation, affectation, traitement et clôture.
- **Développer la présence en ligne de l’organisation** : application responsive, accessible, documentée et déployée.
- **Travailler en mode projet** : Git, branches, Pull Requests, README, tests et intégration continue.
- **Mettre à disposition un service informatique** : déploiement Vercel, contrôle de compilation et stratégie de continuité locale.
- **Organiser son développement professionnel** : documentation des choix, limites, risques et évolutions possibles.

Le fonctionnement hybride illustre aussi une notion importante en SISR : la **continuité de service**. La base distante apporte le travail partagé, tandis que le mode local garantit une démonstration fonctionnelle même en cas d’indisponibilité réseau.

## Présentation pour un recruteur

> J’ai conçu HelpDesk NovaTech 2.1, une application autonome de support et de gestion de parc informatique. Elle couvre le cycle de vie complet d’un incident et l’inventaire des postes, serveurs, imprimantes et équipements réseau, avec affectations, garanties, liens vers les tickets et traçabilité. Le projet fonctionne immédiatement avec localStorage, propose Supabase en option et intègre tests, TypeScript, GitHub Actions et déploiement Vercel.

## Limites pédagogiques

Le mode démonstration n’est pas synchronisé entre appareils et ne remplace pas une base sauvegardée côté serveur. Pour une exploitation réelle, il faudrait compléter la supervision, la stratégie de sauvegarde PostgreSQL, la gestion des pièces jointes, les notifications et les procédures d’administration.

## Auteur

Projet pédagogique — BTS SIO SISR, première année.
