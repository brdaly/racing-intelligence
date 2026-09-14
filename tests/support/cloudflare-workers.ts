/**
 * Stands in for the `cloudflare:workers` module, which only exists inside the
 * Workers runtime. `vitest.config.ts` aliases the module here so the route
 * handlers under test are the same files that ship, rather than copies kept in
 * step by hand.
 *
 * Tests assign `env.DB` and `env.DASHBOARD_UPDATE_TOKEN` before driving a route.
 */
export const env = {} as Cloudflare.Env;
