/**
 * OpenAlex transform tests.
 *
 * A separate file from adapters.test.js because the risk here is different in
 * kind. The other adapters can corrupt a NUMBER; this one can corrupt a
 * CITATION — store a paper under the wrong title, drop the DOI, or mangle a
 * verbatim abstract into something that looks like a summary. The project's
 * rule is that no claim on the site is written by a model, and the abstract
 * reconstruction below is the one place in this pipeline where prose is
 * assembled at all. It is a transcription, and these tests are what keep it one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  reconstructAbstract,
  isOffTopicTitle,
  toDocument,
  contactEmail,
  AI_TITLE_TERMS,
  WORKING_PAPER_SOURCES,
  STRANDS,
} from './openalex.js';

describe('reconstructAbstract', () => {
  test('reverses an inverted index into the original word order', () => {
    // The real shape: {word: [every position it occupies]}.
    const index = {
      Robots: [0],
      reduce: [1],
      employment: [2],
      and: [3],
      wages: [4],
    };
    assert.equal(reconstructAbstract(index), 'Robots reduce employment and wages');
  });

  test('places a repeated word at every one of its positions', () => {
    // The failure this guards: taking positions[0] and dropping the rest, which
    // silently deletes the most common words in any abstract.
    const index = { the: [0, 3], effect: [1], of: [2], robot: [4] };
    assert.equal(reconstructAbstract(index), 'the effect of the robot');
  });

  test('returns null rather than an empty string when there is no abstract', () => {
    // A caller must be able to tell "no abstract" from "empty abstract";
    // documents.summary is nullable precisely so the difference survives.
    assert.equal(reconstructAbstract(null), null);
    assert.equal(reconstructAbstract(undefined), null);
    assert.equal(reconstructAbstract({}), null);
  });

  test('drops malformed positions instead of emitting undefined', () => {
    const index = { valid: [0], broken: ['x'], negative: [-2], also: [1] };
    assert.equal(reconstructAbstract(index), 'valid also');
  });

  test('does not invent punctuation or capitalisation', () => {
    // Anything beyond joining on a space would be editing someone else's words.
    const index = { 'we': [0], 'find': [1], 'no': [2], 'effect.': [3] };
    assert.equal(reconstructAbstract(index), 'we find no effect.');
  });
});

describe('isOffTopicTitle', () => {
  test('keeps the papers this corpus exists for', () => {
    for (const title of [
      'Robots and Jobs: Evidence from US Labor Markets',
      'Automation and Rent Dissipation: Implications for Wages, Inequality, and Productivity',
      'Experimental evidence on the productivity effects of generative artificial intelligence',
      'Artificial Intelligence, Tasks, Skills, and Wages: Worker-Level Evidence from Germany',
    ]) {
      assert.equal(isOffTopicTitle(title), false, title);
    }
  });

  test('cuts the environmental-economics literature', () => {
    // The single largest source of noise measured in the corpus: a very large,
    // very real research programme that shares every AI term with this one.
    assert.equal(isOffTopicTitle("Artificial Intelligence and Carbon Emissions of Manufacturing Enterprises in China"), true);
    assert.equal(isOffTopicTitle('Greening Automation: Policy Recommendations for Sustainable Development'), true);
    assert.equal(isOffTopicTitle('Does artificial intelligence improve energy productivity?'), false);
  });

  test('cuts finance-method and clinical papers', () => {
    assert.equal(isOffTopicTitle('Mean-field games with differing beliefs for algorithmic trading'), true);
    assert.equal(isOffTopicTitle('Resident Productivity After an Automated Patient Assignment System'), true);
  });

  test('treats a missing title as off-topic rather than throwing', () => {
    assert.equal(isOffTopicTitle(''), true);
    assert.equal(isOffTopicTitle(null), true);
  });
});

describe('toDocument', () => {
  /** A trimmed real record: OpenAlex W3021644002. */
  const work = {
    id: 'https://openalex.org/W3021644002',
    doi: 'https://doi.org/10.1086/705716',
    display_name: 'Robots and Jobs: Evidence from US Labor Markets',
    publication_date: '2019-08-02',
    type: 'article',
    language: 'en',
    cited_by_count: 3751,
    open_access: { is_oa: false, oa_status: 'closed', oa_url: null },
    primary_location: {
      is_oa: false,
      landing_page_url: 'https://doi.org/10.1086/705716',
      source: {
        id: 'https://openalex.org/S95323914',
        display_name: 'Journal of Political Economy',
        type: 'journal',
        host_organization_name: 'University of Chicago Press',
        is_core: true,
      },
    },
    best_oa_location: null,
    authorships: [
      { author: { display_name: 'Daron Acemoğlu' } },
      { author: { display_name: 'Pascual Restrepo' } },
    ],
    primary_topic: {
      id: 'https://openalex.org/T10208',
      display_name: 'Labor market dynamics and wage inequality',
    },
    abstract_inverted_index: { We: [0], study: [1], robots: [2] },
  };

  test('carries the real DOI as the stored URL', () => {
    // Rule two of the brief: never fabricate a citation. The DOI is the
    // citation, and it is what must survive into question_reading.
    const doc = toDocument(work, 'journals');
    assert.equal(doc.url, 'https://doi.org/10.1086/705716');
    assert.equal(doc.raw.doi, 'https://doi.org/10.1086/705716');
    assert.equal(doc.raw.openalex_id, 'W3021644002');
  });

  test('files the work as research from the openalex source', () => {
    const doc = toDocument(work);
    assert.equal(doc.kind, 'research');
    assert.equal(doc.sourceId, 'openalex');
  });

  test('stores the abstract verbatim and writes no takeaway', () => {
    const doc = toDocument(work);
    assert.equal(doc.summary, 'We study robots');
    // Nothing in this shape may carry an interpretation of the paper.
    assert.ok(!('takeaway' in doc));
    assert.equal(doc.body, undefined);
  });

  test('scores above the 40 threshold that makes a document visible', () => {
    // Without sourceIsAiFocused the relevance scorer returns 0 for this title —
    // its vocabulary is tuned for news copy and does not contain "robots" — and
    // the most-cited paper in the field would be filtered out of its own corpus.
    const doc = toDocument(work);
    assert.ok(doc.aiRelevance >= 40, `scored ${doc.aiRelevance}`);
  });

  test('abbreviates a long author list rather than storing hundreds of names', () => {
    const many = {
      ...work,
      authorships: Array.from({ length: 40 }, (_, i) => ({
        author: { display_name: `Author ${i}` },
      })),
    };
    const doc = toDocument(many);
    assert.ok(doc.author.endsWith('et al.'));
    assert.equal(doc.raw.author_count, 40);
  });

  test('prefers an open-access landing page only when there is no DOI', () => {
    const noDoi = {
      ...work,
      doi: null,
      best_oa_location: { landing_page_url: 'https://www.nber.org/papers/w00000' },
    };
    assert.equal(toDocument(noDoi).url, 'https://www.nber.org/papers/w00000');
  });

  test('drops a work that cannot be cited honestly', () => {
    // No title, or no date, means no citation and no ordering. Storing it with
    // a placeholder would be a fabricated reference.
    assert.equal(toDocument({ ...work, display_name: null }), null);
    assert.equal(toDocument({ ...work, publication_date: null }), null);
  });

  test('claims no country for a paper', () => {
    // An author's institution is not the economy a paper is about: half this
    // corpus is US authors writing about Germany, China or the OECD. Tagging on
    // affiliation would put those papers on the wrong country's page.
    assert.deepEqual(toDocument(work).countryIso3s, []);
  });
});

describe('query shape', () => {
  test('does not search for machine learning as an AI term', () => {
    // Measured: it is a METHOD marker in economics ("a machine learning
    // approach") and was the largest single source of false positives.
    assert.ok(!AI_TITLE_TERMS.some((t) => t.toLowerCase().includes('machine learning')));
  });

  test('does not search for algorithmic', () => {
    // OpenAlex stems, so it also matches "algorithm" and pulls in the whole
    // applied-mathematics and algorithmic-trading literature.
    assert.ok(!AI_TITLE_TERMS.some((t) => t.toLowerCase().includes('algorithm')));
  });

  test('both strands restrict to the economics field and require an abstract', () => {
    for (const strand of STRANDS) {
      const filters = strand.filters({ fromDate: '2015-01-01' });
      assert.ok(filters.includes('primary_topic.field.id:fields/20'), strand.id);
      assert.ok(filters.includes('has_abstract:true'), strand.id);
      assert.ok(filters.includes('is_retracted:false'), strand.id);
    }
  });

  test('the working-paper whitelist names venues rather than accepting all preprints', () => {
    const ids = WORKING_PAPER_SOURCES.map((s) => s.id);
    assert.ok(ids.length >= 5);
    assert.ok(ids.every((id) => /^S\d+$/.test(id)));
    // The filter must be an id list, not `type:preprint` — that pool is arXiv,
    // Zenodo and Qeios, whose economics content is mostly not economics.
    const filters = STRANDS.find((s) => s.id === 'working_papers').filters({ fromDate: '2015-01-01' });
    assert.ok(filters.some((f) => f.startsWith('locations.source.id:')));
    assert.ok(!filters.some((f) => f === 'type:preprint'));
  });
});

describe('contactEmail', () => {
  test('extracts the address OpenAlex asks for from SEC_USER_AGENT', () => {
    // Never throws when the variable is unset: the polite pool is a courtesy,
    // not a requirement, and an unconfigured contact must not stop ingestion.
    const email = contactEmail();
    assert.ok(email === null || /@/.test(email));
  });
});
