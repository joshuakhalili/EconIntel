/** One-time, idempotent copy migration across Framer authoring/SSR/hydration/search.
 * No DOM, styles, identifiers or CMS byte offsets are changed.
 * Run: node scripts/refresh-landing-evidence-copy.js
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const replacements = [
  ['What this site holds', 'Historical dashboard illustration'],
  ['Read from the database on 3 September 2026.', 'Illustration using the 3 September 2026 database snapshot, not live coverage. Open the app for current scope.'],
  ['Four pages are marked contested, and that is the finding', 'Disagreement needs a scope check, not a vote'],
  ['Where credible sources reach opposite conclusions, the disagreement is reported rather than resolved.', 'Results can differ because populations, outcomes, methods and periods differ. The source scope is checked before treating findings as contradictions.'],
  ['Averaging two opposite findings into a middle number would be the dishonest option.', 'Unlike outcomes and populations are not averaged into a single economic effect.'],
  ['On whether AI-exposed jobs are shrinking, PwC and the IMF point opposite ways, so the page shows both and stays marked contested.', 'For AI and employment, PwC and IMF results cover different populations and outcomes, so they are presented separately, not as opposing estimates of one effect.'],
  ['On whether AI-exposed jobs are shrinking, ', 'For AI and employment, '],
  ['PwC and the IMF point opposite ways', 'PwC and IMF results cover different populations and outcomes'],
  ['so the page shows both and stays marked contested.', 'so they are presented separately, not as opposing estimates of one effect.'],
  ['No number is written by a model', 'Source-linked numbers, explicit review'],
  ['Computed in SQL from a named series, and dated where it is prose.', 'Series calculations and machine-assisted report extractions have different provenance. Review states and source locators show what has actually been checked.'],
  ['134 series · 17 sources · 3 Sep 2026', 'Named sources · Dated evidence · Stated limits'],
  ['Eight publishers behind the series — FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI, the US Federal Register, GDELT and the LBMA — and nine news and research feeds behind the reading list. Every series links back to its publisher with its licence stated.',
    'Statistical agencies, public data services and research publishers supply the evidence. Series link to their sources and state their licences; the source register separates working feeds from unverified or unavailable connections.'],
  ['From seventeen public sources — FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI, the US Federal Register and others. Nothing is redistributed: every series links back to its publisher with its licence stated, so you can take the data on the publisher\'s terms rather than trusting a chart here.',
    'From named public sources including FRED, the World Bank, Census, DBnomics and SEC EDGAR, alongside research publishers. Series link to their sources and state their licences. The source register shows what is implemented, verified and current; a configured connection alone is not evidence of coverage.'],
  ['Country coverage. One country has real depth; thirteen of the forty-four carry six annual World Bank series and nothing else, and only the United States carries more than sixteen. Policy is thin. Occupation-level employment, which is what several questions actually need, is largely missing. All of that is stated on the pages it affects rather than hidden.',
    'Coverage is uneven by country and question. Broad macroeconomic series are not direct evidence of AI adoption or impact. Comparable adoption surveys, occupation-level outcomes and causal identification remain limited. Country pages show usable series, reference dates and source-specific gaps rather than treating every country as equally measured.'],
  ['Ingestion runs nightly. The prose does not — numbers move on their own and sentences do not follow them, so every page shows the date a person last checked its writing against its data.',
    'A scheduled ingestion workflow checks available sources; successful runs and reference dates are shown separately. Data can lag its publication schedule. Numerical summaries are reconstructed from current facts, while research and editorial claims have separate review states.'],
  ['No figure is. Every number is computed in SQL from a named source, and every claim is written by a person and dated. Where a takeaway from an outside report was read out of the document by a machine, the page says so and gives the page number so you can check it.',
    'AI assists research and drafting. Numerical summaries use validated data facts rather than unconstrained generated numbers. Research claims and report extractions carry evidence and review states; machine extraction or a citation alone is not proof that a claim has been verified.'],
  ['That credible sources reach opposite conclusions, and the disagreement is the finding. Four pages currently carry it. The alternative — picking whichever result is tidier — is the thing this site exists not to do.',
    'That evidence supports competing interpretations. Different populations, methods or time periods may explain a disagreement; results are not treated as direct contradictions until their scope is checked. The unresolved question and limitations remain visible.'],
  ['Prose on every question rechecked since 28 August 2026', 'Evidence and review status shown on each question'],
  ['Ten institutional and consulting reports from nine publishers, cited and linked. Labelled by who produced it, never ranked.',
    'Institutional and consulting reports, cited and linked. Claims are distinguished from extracted figures, with evidence scope and review status shown. A publisher name is not a quality guarantee.'],
  ['The share of firms using AI, 2017 to 2025, from national statistical surveys',
    'Enterprise AI-use survey examples. Populations and reference periods differ; these are not a global adoption ranking.'],
  ['of 44 countries', 'country scope varies'],
  ['28 unmeasured', 'gaps remain'],
  ['1 to 6 points', 'uneven histories'],
  ['"+18% emissions": "16"', '"+18% emissions": "Survey"'],
  ['>16</h5>', '>Survey</h5>'],
  ['>16</h6>', '>Survey</h6>'],
  ['xtEFjn3bz:`16`', 'xtEFjn3bz:`Survey`'],
  ['"8.4%","16","gaps remain"', '"8.4%","Survey","gaps remain"'],
];

export function landingCopyTargets(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.html$|\.mjs$|searchIndex-.*\.json$/.test(entry.name)) files.push(path);
    }
  }
  walk(root);
  files.push(resolve(root, 'docs/content_diffusion.py'));
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let changed = 0;
  for (const file of landingCopyTargets(resolve('landing'))) {
    const before = readFileSync(file, 'utf8');
    let after = before;
    for (const [oldText, newText] of replacements) after = after.split(oldText).join(newText);
    if (before !== after) { writeFileSync(file, after); changed++; }
  }
  console.log(`Updated ${changed} landing copy surfaces.`);
}
