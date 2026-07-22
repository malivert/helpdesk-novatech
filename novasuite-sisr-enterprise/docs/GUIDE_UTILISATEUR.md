# Guide utilisateur NovaSuite SISR

## Connexion et modes

- **Entreprise** ouvre la base professionnelle SQLite de l’ordinateur.
- **Démonstration** ouvre une base séparée contenant uniquement des données fictives.

Après une période d’inactivité, NovaSuite verrouille automatiquement la session.

## Rôles

| Rôle | Consultation | Création / modification | Imports / sauvegardes | Comptes / restauration |
|---|---:|---:|---:|---:|
| Administrateur | Oui | Oui | Oui | Oui |
| Technicien | Oui | Oui | Oui | Non |
| Lecteur | Oui | Non | Rapports uniquement | Non |

## Modules

- **HelpDesk** : créer et suivre les tickets liés aux utilisateurs.
- **NetWatch** : gérer l’inventaire commun et signaler les pannes.
- **ADLab** : créer ou importer les utilisateurs Active Directory.
- **IPPlan** : calculer et enregistrer les réseaux IPv4/CIDR et VLAN.
- **BackupGuard** : sauvegarder, choisir la destination et restaurer.
- **DeployDesk** : suivre les postes de la préparation à la livraison.
- **PatchPilot** : prioriser les correctifs et suivre leur déploiement.
- **WiFiScope** : centraliser les relevés et recommandations Wi-Fi.
- **LogSentinel** : qualifier les incidents et corréler les journaux.
- **InfraDiagram** : générer la cartographie depuis l’inventaire commun.
- **AutoAdmin** : préparer les paramètres et exécuter uniquement un Dry-Run.

## Rapports

Les boutons `PDF` et `CSV` enregistrent le rapport dans le dossier choisi. Chaque export est tracé dans l’historique d’audit.

## Bonne pratique quotidienne

1. Lire les notifications critiques.
2. Contrôler les tickets et incidents actifs.
3. Mettre à jour les équipements concernés.
4. Générer le rapport nécessaire.
5. Vérifier la dernière sauvegarde réussie.
