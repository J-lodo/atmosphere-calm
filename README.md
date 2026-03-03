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
