/** Materialize a router pattern as a known reader URL for hosted smoke tests. */
const EXAMPLES = Object.freeze({
  '/lens/:slug': '/lens/investment',
  '/q/:slug': '/q/adoption',
  '/simulate/:slug': '/simulate/ai-capex-dotcom',
  '/data/:id': '/data/fred.GDPC1',
  '/country/:iso3': '/country/GBR',
});
export function smokeRoute(route) {
  if (!route.includes(':')) return route;
  if (!Object.hasOwn(EXAMPLES, route)) throw new Error(`Missing smoke route example: ${route}`);
  return EXAMPLES[route];
}
