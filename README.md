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
- IP du client : `req.ip` d'Express, réglé par `TRUST_PROXY`. `X-Forwarded-For` n'est pris en compte que s'il vient d'un proxy de confiance.
  - Render (ou tout hébergement avec un seul reverse proxy) : `TRUST_PROXY=1`, valeur par défaut quand `NODE_ENV=production`.
  - Développement : défaut `loopback` (seul le proxy CRA local est cru ; un client du réseau ne peut pas usurper son IP).
  - Contrôle après déploiement : `GET /api/visitors/ip-check` (admin) affiche l'IP retenue, la chaîne `X-Forwarded-For` et le réglage. Si l'IP affichée est celle du proxy, augmenter `TRUST_PROXY` (par ex. `2`).
- Localisation approximative par IP : `https://ipwho.is` (HTTPS, sans clé, cache 24 h).
- Ville GPS (seulement après consentement) : géocodage inverse par Nominatim (HTTPS, User-Agent identifié via `NOMINATIM_CONTACT`, 1 requête/s max, cache).
- Conservation : les visiteurs inactifs sont supprimés après `VISITOR_RETENTION_DAYS` jours (90 par défaut, index TTL MongoDB).
