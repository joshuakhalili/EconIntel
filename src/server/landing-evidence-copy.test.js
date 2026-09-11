import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { landingCopyTargets } from '../../scripts/refresh-landing-evidence-copy.js';

test('all served Framer copy surfaces reject obsolete scope and human-only claims', () => {
  for (const file of landingCopyTargets(resolve('landing'))) {
    const content = readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /From seventeen public sources|One country has real depth|thirteen of the forty-four|28 unmeasured|of 44 countries|every claim is written by a person|Four pages currently carry it|Eight publishers behind the series|Four pages are marked contested|PwC and the IMF point opposite ways|No number is written by a model|Computed in SQL from a named series/,
      `Stale public claim in ${file}`);
  }
});

test('SSR, hydration and search all carry the revised coverage and AI provenance caveats', () => {
  const files = landingCopyTargets(resolve('landing'));
  for (const file of files.filter((file) => file.endsWith('/landing/index.html') || file.includes('searchIndex-') || (file.includes('VuFJ2JeM7NTvopS9yPPBl8nqw8qqR1DA-c7cIYKw9tI.Bw_fTdDN') && file.endsWith('.mjs')))) {
    const content = readFileSync(file, 'utf8');
    assert.match(content, /Broad macroeconomic series are not direct evidence of AI adoption or impact/, file);
    assert.match(content, /AI assists research and drafting/, file);
    assert.match(content, /a configured connection alone is not evidence of coverage/, file);
    assert.match(content, /not as opposing estimates of one effect/, file);
    assert.match(content, /Series calculations and machine-assisted report extractions have different provenance/, file);
    assert.match(content, /Historical dashboard illustration/, file);
    assert.match(content, /not live coverage/, file);
  }
});
