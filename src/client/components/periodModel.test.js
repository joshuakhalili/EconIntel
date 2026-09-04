/**
 * The two defects this module exists to close, held down by tests.
 *
 *   1. A partial period compared against a whole one. On 3 September 2026 the
 *      home page said US AI rulemaking had fallen 90.0% and the Policy lens
 *      said 94.4%, because September was three days old and August was not.
 *      Both figures were real arithmetic on real rows and both described the
 *      calendar rather than the world.
 *
 *   2. Two pages, two answers. The overview computed every delta as
 *      percent-of-previous; the ticker strip deliberately did not, returning
 *      percentage POINTS for a rate. The same series read "↑ 22.4%" on one
 *      page and "↑ 11.2pp" on the other.
 *
 * Every case below uses the values that were actually on the site on that
 * date, read from the database rather than invented: derived.ai_binding_rules
 * 1 @ 2026-09-01 against 10 @ 2026-08-01; derived.ai_regulation_volume 2
 * against 36; derived.sec_ai_mention_rate 60.84 @ 2026-01-01 against 49.69 @
 * 2025-01-01; fred.LNS14024887 8.5 @ 2026-07-01 against 9.2 @ 2026-06-01.
 *
 * `now` is passed in everywhere rather than read from the clock, so these
 * assertions still mean something in 2027.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  change,
  figureDelta,
  isFuturePeriod,
  isPeriodRunning,
  isStale,
  periodDays,
  periodSpacingDays,
  toDateLabel,
} from './periodModel.js';

/** The day the audit was taken. Every case below is asked as at this date. */
const THAT_DAY = new Date('2026-09-03T09:00:00Z');

describe('periodSpacingDays', () => {
  test('measures the gap the observations themselves state', () => {
    assert.equal(periodSpacingDays('2026-09-01', '2026-08-01'), 31);
    assert.equal(periodSpacingDays('2026-01-01', '2025-01-01'), 365);
    assert.equal(periodSpacingDays('2026-04-01', '2026-01-01'), 90);
    assert.equal(periodSpacingDays('2026-09-02', '2026-09-01'), 1);
  });

  test('an unknown or out-of-order pair is null, never a default cadence', () => {
    assert.equal(periodSpacingDays('2026-09-01', null), null);
    assert.equal(periodSpacingDays(null, '2026-08-01'), null);
    assert.equal(periodSpacingDays('2026-08-01', '2026-09-01'), null);
    assert.equal(periodSpacingDays('2026-08-01', '2026-08-01'), null);
    assert.equal(periodSpacingDays('not a date', '2026-08-01'), null);
  });

  test('accepts a full timestamp, because the ticker payload sends one', () => {
    assert.equal(periodSpacingDays('2026-09-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'), 31);
  });
});

describe('isPeriodRunning', () => {
  test('September 2026 is still running on 3 September 2026', () => {
    assert.equal(isPeriodRunning('2026-09-01', 31, THAT_DAY), true);
  });

  test('July 2026 is over by then', () => {
    assert.equal(isPeriodRunning('2026-07-01', 30, THAT_DAY), false);
  });

  test('the year 2026 is still running, and 2025 is not', () => {
    assert.equal(isPeriodRunning('2026-01-01', 365, THAT_DAY), true);
    assert.equal(isPeriodRunning('2025-01-01', 365, THAT_DAY), false);
  });

  test('a period that has not started is not "in progress" — it is a forecast', () => {
    assert.equal(isPeriodRunning('2027-01-01', 365, THAT_DAY), false);
  });

  test('the boundary day closes the period rather than extending it', () => {
    // August 2026 spans 1 Aug to 31 Aug. On 1 September it is finished.
    assert.equal(isPeriodRunning('2026-08-01', 31, new Date('2026-08-31T23:00:00Z')), true);
    assert.equal(isPeriodRunning('2026-09-01', 31, new Date('2026-10-02T00:00:00Z')), false);
  });

  test('an unknown spacing makes no claim', () => {
    assert.equal(isPeriodRunning('2026-09-01', null, THAT_DAY), false);
  });
});

describe('toDateLabel', () => {
  test('names the period from its own spacing', () => {
    assert.equal(toDateLabel(31), 'month to date');
    assert.equal(toDateLabel(90), 'quarter to date');
    assert.equal(toDateLabel(365), 'year to date');
  });

  test('below monthly there is nothing to be partway through', () => {
    assert.equal(toDateLabel(1), null);
    assert.equal(toDateLabel(7), null);
    assert.equal(toDateLabel(null), null);
  });
});

describe('change', () => {
  test('a rate moves in percentage points, not in percent', () => {
    // derived.sec_ai_mention_rate, the series that printed two different
    // numbers on two pages.
    assert.deepEqual(
      change({ latest_value: 60.84, previous_value: 49.69, quantity_kind: 'rate' }),
      { value: 60.84 - 49.69, unit: 'pp' }
    );
  });

  test('a count moves in percent', () => {
    const delta = change({ latest_value: 1, previous_value: 10, quantity_kind: 'count' });
    assert.equal(delta.unit, '%');
    assert.equal(delta.value, -90);
  });

  test('an unknown quantity kind reports nothing at all', () => {
    // This is the overview payload today: latest and previous values, no
    // quantity_kind. Reporting -90% here is what put "↓ 90.0%" on the front
    // page under a heading that had no idea whether it was a rate.
    assert.equal(change({ latest_value: 1, previous_value: 10 }), null);
    assert.equal(change({ latest_value: 1, previous_value: 10, quantity_kind: null }), null);
  });

  test('a missing or non-finite side reports nothing', () => {
    assert.equal(change({ latest_value: 1, previous_value: null, quantity_kind: 'count' }), null);
    assert.equal(change({ latest_value: null, previous_value: 10, quantity_kind: 'count' }), null);
    assert.equal(
      change({ latest_value: Number.NaN, previous_value: 10, quantity_kind: 'count' }),
      null
    );
  });

  test('a zero previous value is not divided by, except for a rate', () => {
    assert.equal(change({ latest_value: 5, previous_value: 0, quantity_kind: 'count' }), null);
    assert.deepEqual(change({ latest_value: 5, previous_value: 0, quantity_kind: 'rate' }), {
      value: 5,
      unit: 'pp',
    });
  });
});

describe('figureDelta — the blocker itself', () => {
  test('"Rules in force" reports no collapse three days into September', () => {
    const result = figureDelta(
      {
        latest_value: 1,
        latest_period: '2026-09-01',
        previous_value: 10,
        previous_period: '2026-08-01',
        quantity_kind: 'count',
      },
      THAT_DAY
    );
    assert.equal(result.delta, null, 'the −90% must not be reported');
    assert.equal(result.toDate, 'month to date');
  });

  test('"All AI documents" likewise reports no 94.4% fall', () => {
    const result = figureDelta(
      {
        latest_value: 2,
        latest_period: '2026-09-01',
        previous_value: 36,
        previous_period: '2026-08-01',
        quantity_kind: 'count',
      },
      THAT_DAY
    );
    assert.equal(result.delta, null);
    assert.equal(result.toDate, 'month to date');
  });

  test('a partial YEAR is suppressed on the same rule', () => {
    // derived.sec_ai_mention_rate: 2026 is eight months old on that date.
    const result = figureDelta(
      {
        latest_value: 60.84,
        latest_period: '2026-01-01',
        previous_value: 49.69,
        previous_period: '2025-01-01',
        quantity_kind: 'rate',
      },
      THAT_DAY
    );
    assert.equal(result.delta, null);
    assert.equal(result.toDate, 'year to date');
  });

  test('a COMPLETE month still reports its change, in the right unit', () => {
    // fred.LNS14024887, US youth unemployment: July 2026 was over.
    const result = figureDelta(
      {
        latest_value: 8.5,
        latest_period: '2026-07-01',
        previous_value: 9.2,
        previous_period: '2026-06-01',
        quantity_kind: 'rate',
      },
      THAT_DAY
    );
    assert.equal(result.toDate, null);
    assert.equal(result.delta.unit, 'pp');
    assert.ok(Math.abs(result.delta.value - -0.7) < 1e-9);
  });

  test('a daily price for yesterday is complete, not "to date"', () => {
    // LBMA gold, 2 September against 1 September.
    const result = figureDelta(
      {
        latest_value: 3400,
        latest_period: '2026-09-02',
        previous_value: 3390,
        previous_period: '2026-09-01',
        quantity_kind: 'currency',
      },
      THAT_DAY
    );
    assert.equal(result.toDate, null);
    assert.equal(result.delta.unit, '%');
  });

  test('with no previous period — the overview payload — nothing is claimed', () => {
    const result = figureDelta(
      { latest_value: 1, latest_period: '2026-09-01', previous_value: 10 },
      THAT_DAY
    );
    assert.equal(result.delta, null);
    assert.equal(result.toDate, null);
  });

  test('the two pages now agree, because they call this', () => {
    const figure = {
      latest_value: 60.84,
      latest_period: '2026-01-01',
      previous_value: 49.69,
      previous_period: '2025-01-01',
      quantity_kind: 'rate',
    };
    // Whatever the caller, the same input gives the same answer. That is the
    // whole point: "↑ 22.4%" beside "↑ 11.2pp" is no longer expressible.
    assert.deepEqual(figureDelta(figure, THAT_DAY), figureDelta({ ...figure }, THAT_DAY));
  });
});

describe('isStale and periodDays', () => {
  test('an annual figure from January is current in September', () => {
    assert.equal(
      isStale({ latest_period: '2026-01-01', previous_period: '2025-01-01' }, THAT_DAY),
      false
    );
  });

  test('a daily price from January is not', () => {
    assert.equal(
      isStale({ latest_period: '2026-01-02', previous_period: '2026-01-01' }, THAT_DAY),
      true
    );
  });

  test('no period at all is stale', () => {
    assert.equal(isStale({}, THAT_DAY), true);
    assert.equal(isStale(null, THAT_DAY), true);
  });

  test('a single point falls back to a month', () => {
    assert.equal(periodDays({ latest_period: '2026-09-01' }), 31);
    assert.equal(periodDays({ latest_period: '2026-09-01', previous_period: '2026-08-01' }), 31);
  });
});

describe('isFuturePeriod', () => {
  test('the AMECO forecast row is in the future', () => {
    // dbn.AMECO.ZVGDF.GBR…: one valued row dated 2027-01-01, value_status
    // 'projected', which /data prints today as "to 2027-01" coverage.
    assert.equal(isFuturePeriod('2027-01-01', THAT_DAY), true);
  });

  test('today is not the future', () => {
    assert.equal(isFuturePeriod('2026-09-03', THAT_DAY), false);
    assert.equal(isFuturePeriod('2026-08-01', THAT_DAY), false);
  });

  test('a missing period makes no claim', () => {
    assert.equal(isFuturePeriod(null, THAT_DAY), false);
    assert.equal(isFuturePeriod(undefined, THAT_DAY), false);
  });
});
