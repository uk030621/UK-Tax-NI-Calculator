/**
 * The Mongo database name is configurable via MONGODB_DB_NAME so it can be
 * changed without touching code — useful if "tax_calculator" collides with
 * a database name already in use elsewhere in the same MongoDB cluster.
 * Falls back to "tax_calculator" if the env var isn't set.
 */
export const DB_NAME = process.env.MONGODB_DB_NAME || "tax_calculator";
