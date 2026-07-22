# Sécurité et sauvegardes

## Mesures intégrées

- mots de passe dérivés avec `scrypt`, sel aléatoire et comparaison constante ;
- champs sensibles chiffrés en AES-256-GCM ;
- clé principale aléatoire protégée par le coffre-fort du système via Electron `safeStorage` ;
- contexte Electron isolé, intégration Node désactivée et politique CSP restrictive ;
- listes blanches de ressources et de champs côté processus principal ;
- contrôle des permissions pour chaque appel sensible ;
- expiration des sessions et verrouillage automatique ;
- audit des connexions, changements, exports, sauvegardes et restaurations.

## Sauvegardes

SQLite utilise le mode WAL. Les sauvegardes sont réalisées par l’API de copie cohérente de SQLite, puis enregistrées dans l’historique. Une rotation conserve le nombre de copies configuré.

Avant une restauration, NovaSuite crée automatiquement une copie `avant-restauration`. La session est invalidée après succès.

## Points à respecter en entreprise

- protéger le compte Windows et le dossier des sauvegardes ;
- tester régulièrement une restauration ;
- ne pas envoyer de sauvegarde par e-mail ;
- conserver une copie hors du poste selon la règle 3-2-1 ;
- configurer une signature de code avant une diffusion large ;
- ne pas utiliser le compte de démonstration avec de vraies données.
