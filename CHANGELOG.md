# Changelog

Toutes les évolutions notables de HelpDesk NovaTech sont documentées dans ce fichier.

Le format suit les principes de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet utilise une numérotation sémantique.

## [2.1.0] - 2026-07-20

### Ajouté

- module complet de gestion du parc informatique ;
- statistiques des équipements disponibles, attribués, en panne et hors garantie ;
- liaison entre équipements et tickets ;
- historique local des modifications du parc ;
- exports CSV et JSON de l’inventaire ;
- page de présentation du projet et guide utilisateur intégré ;
- documentation des limites et des évolutions futures ;
- données de démonstration réalistes pour le parc.

### Amélioré

- affichage responsive des écrans de tickets, rapports et inventaire ;
- documentation README et correspondance avec les compétences BTS SIO SISR ;
- couverture automatisée du mode autonome et du module Parc informatique.

### Sécurité

- Supabase reste facultatif et désactivé par défaut ;
- aucun secret, mot de passe ou jeton n’est inclus dans le dépôt ;
- les données de démonstration restent sauvegardées localement dans le navigateur.

## [2.0.0] - 2026-07-20

### Ajouté

- mode démonstration autonome avec `localStorage` ;
- cycle complet des tickets, commentaires, pièces jointes et historique ;
- tableaux de bord, rapports, exports et import de sauvegarde ;
- mode sombre, accessibilité et interface mobile ;
- tests automatisés et workflow GitHub Actions.
