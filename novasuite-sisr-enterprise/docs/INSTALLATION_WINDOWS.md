# Guide d’installation Windows

## Configuration recommandée

- Windows 10 ou Windows 11 64 bits ;
- 4 Go de mémoire vive minimum ;
- 500 Mo d’espace libre pour l’application et les sauvegardes ;
- un compte Windows protégé par mot de passe.

L’application fonctionne ensuite sans connexion Internet.

## Installation

1. Télécharger l’artefact `NovaSuite-SISR-Setup-3.0.0.exe` produit par GitHub Actions.
2. Ouvrir l’installateur.
3. Choisir le dossier d’installation.
4. Conserver les raccourcis du menu Démarrer et du Bureau si nécessaire.
5. Terminer l’installation puis lancer NovaSuite.

L’installateur ne supprime pas les données lors d’une désinstallation. Cette protection évite une perte accidentelle de la base locale.

## Assistant de première ouverture

Lors du premier lancement, NovaSuite demande le nom complet de l’administrateur, un identifiant local et un mot de passe d’au moins dix caractères.

Le premier compte reçoit le rôle `administrateur`. Il peut ensuite créer des comptes `technicien` ou `lecteur` depuis **Administration**.

## Après l’installation

1. Ouvrir **BackupGuard** et choisir le dossier de sauvegarde.
2. Créer une sauvegarde manuelle de référence.
3. Ajuster l’intervalle automatique et la rétention dans **Administration**.
4. Importer les utilisateurs et les équipements avec les modèles du dossier `samples`.
5. Tester un rapport PDF et CSV.

## Mise à jour

Fermer NovaSuite avant d’installer une nouvelle version. Une sauvegarde préalable est recommandée. Les migrations SQLite sont appliquées automatiquement à l’ouverture.
