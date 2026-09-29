# Atmosphere Backend

API for managing cantiques and languages. Built with Node.js, Express and MongoDB.

## Getting started

1. Copy `.env.example` to `.env` and set values.
2. Run `npm install`.
3. Start with `npm run dev` (requires nodemon) or `npm start`.

## Structure

- `src/index.js` - entry point
- `src/config` - database connection
- `src/models` - Mongoose schemas
- `src/controllers` - request handlers
- `src/routes` - Express routers
- `src/middleware` - authentication, error handling

## Notes

Will connect to MongoDB using environment variable `MONGODB_URI`.

## Visiteurs (admin)

- `POST /api/visitors/heartbeat` (public, limité) enregistre la présence ; `GET /api/visitors` (admin) liste les visiteurs.
- `DELETE /api/visitors/:id` et `DELETE /api/visitors` (admin, JWT) suppriment une visite ou toutes.
- Aucune adresse IP n'est enregistrée. `req.ip` (réglé par `TRUST_PROXY`, `1` par défaut en production) sert, en mémoire, à la limitation de débit et à la localisation approximative.
  Au démarrage, les anciens champs `ip` et `locatedIp` sont retirés des fiches existantes (`$unset`).
- Ville et pays estimés par le réseau pour chaque visiteur, même sans GPS : `https://ipwho.is` (HTTPS, sans clé, cache mémoire 24 h). Seul le lieu est enregistré.
- Position précise : GPS du téléphone, seulement après consentement.
- Ville GPS (seulement après consentement) : géocodage inverse par Nominatim (HTTPS, User-Agent identifié via `NOMINATIM_CONTACT`, 1 requête/s max, cache).
- Conservation : les visiteurs inactifs sont supprimés après `VISITOR_RETENTION_DAYS` jours (90 par défaut, index TTL MongoDB).
