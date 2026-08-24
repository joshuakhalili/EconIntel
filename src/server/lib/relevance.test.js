/**
 * Tests for AI-relevance scoring.
 *
 * These are written against the failure modes that actually occur in live news
 * feeds rather than against the implementation. A relevance filter fails
 * SILENTLY — you never see the story it wrongly dropped, and a dashboard full
 * of irrelevant headlines looks like a design problem rather than a bug — so
 * the specific false-positive cases below are the point of the file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreRelevance, normaliseTitle } from './relevance.js';

test('scores AI economics coverage highly', () => {
  const { score } = scoreRelevance({
    title: 'Generative AI is reshaping the labour market, cutting entry-level hiring',
    summary: 'Economists report productivity gains alongside job losses in clerical work.',
  });
  assert.ok(score >= 80, `expected >= 80, got ${score}`);
});

test('rejects "Al Jazeera" — the classic two-letter false positive', () => {
  const { score } = scoreRelevance({
    title: 'Al Jazeera reports on regional election results',
    summary: 'Coverage of the vote continues across the region.',
  });
  assert.equal(score, 0);
});

test('does not match "ai" inside ordinary words', () => {
  // said, retail, chain, Thailand, bail — all contain the letters a-i.
  const { score } = scoreRelevance({
    title: 'Retail chain said Thailand bail terms remain unchanged',
    summary: 'The company said the detail was available on request.',
  });
  assert.equal(score, 0);
});

test('vetoes crime coverage even when it mentions a tech company', () => {
  const { score, reasons } = scoreRelevance({
    title: 'Murder trial opens for former Nvidia engineer, court hears',
    summary: 'The company said it was cooperating. Revenue was not discussed.',
  });
  assert.equal(score, 0);
  assert.match(reasons[0], /vetoed/);
});

test('vetoes sport', () => {
  const { score } = scoreRelevance({
    title: 'Premier League football club signs data analytics deal',
    summary: 'The investment will improve player performance tracking.',
  });
  assert.equal(score, 0);
});

test('catches AI economics stories that never say "AI"', () => {
  // The most important stories often use entity names instead of the acronym.
  const { score } = scoreRelevance({
    title: 'Nvidia and TSMC lift capital expenditure as data centre demand surges',
    summary: 'Semiconductor investment reached record levels, reshaping the supply chain.',
  });
  assert.ok(score >= 70, `expected >= 70, got ${score}`);
});

test('ranks AI product news below AI economics news', () => {
  const product = scoreRelevance({
    title: 'OpenAI releases a new ChatGPT feature for image editing',
    summary: 'The AI model can now edit pictures.',
  });
  const economics = scoreRelevance({
    title: 'OpenAI adoption drives measurable productivity gains, study finds',
    summary: 'Employment and wages shifted across the affected industry.',
  });
  assert.ok(
    economics.score > product.score,
    `economics (${economics.score}) should outrank product (${product.score})`
  );
});

test('an AI-focused feed still needs economic signal for a high score', () => {
  // arXiv cs.AI is entirely AI, so the title need not say so — but a pure
  // methods paper is not economics coverage and must not outrank one.
  const methods = scoreRelevance({
    title: 'Improved gradient descent convergence bounds',
    sourceIsAiFocused: true,
  });
  const econ = scoreRelevance({
    title: 'Measuring the productivity effect of model adoption on the workforce',
    sourceIsAiFocused: true,
  });
  assert.ok(methods.score < 40, `methods paper should fall below the 40 cutoff, got ${methods.score}`);
  assert.ok(econ.score >= 70, `expected >= 70, got ${econ.score}`);
});

test('generic business news without AI scores zero', () => {
  const { score } = scoreRelevance({
    title: 'Central bank holds interest rates amid inflation concerns',
    summary: 'GDP growth and employment figures were revised.',
  });
  assert.equal(score, 0, 'economic words alone must not qualify');
});

test('geopolitics scores when tied to AI supply chains, not otherwise', () => {
  const relevant = scoreRelevance({
    title: 'New export controls on semiconductor and GPU shipments hit trade',
    summary: 'The tariff affects chip supply chain investment.',
  });
  const irrelevant = scoreRelevance({
    title: 'Trade delegation discusses agricultural tariff schedule',
    summary: 'Export controls on produce were reviewed.',
  });
  assert.ok(relevant.score >= 55, `expected >= 55, got ${relevant.score}`);
  assert.equal(irrelevant.score, 0);
});

test('scores never leave the 0-100 range the column allows', () => {
  // ai_relevance is CHECK (0..100); a score outside it aborts the insert.
  const cases = [
    { title: 'artificial intelligence machine learning productivity jobs gdp economy wages' },
    { title: '' },
    { title: 'murder' },
    { title: 'x' },
  ];
  for (const c of cases) {
    const { score } = scoreRelevance(c);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `out of range: ${score}`);
  }
});

test('normaliseTitle collapses syndication differences to one key', () => {
  const a = normaliseTitle('AI Boom Lifts Chip Makers — Reuters');
  const b = normaliseTitle('AI boom lifts chip makers  -  Reuters');
  const c = normaliseTitle('“AI Boom” Lifts Chip Makers … Reuters');
  assert.equal(a, b);
  assert.equal(a, c);
});

test('normaliseTitle keeps genuinely different headlines distinct', () => {
  const a = normaliseTitle('AI boom lifts chip makers');
  const b = normaliseTitle('AI bust hits chip makers');
  assert.notEqual(a, b);
});
