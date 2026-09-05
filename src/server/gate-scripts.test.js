/**
 * The build gates, tested the only way a gate can be tested: by breaking
 * something and checking it notices.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS
 *
 * Four scripts stand between a change and production, and a gate that has never
 * failed has proved nothing. Two of them shipped holes that lasted months, and
 * both holes were of the same kind — the gate ran, printed a tick, and was
 * blind to the thing it existed to catch:
 *
 *   check-routes    matched single-quoted route paths only, so a route written
 *                   `{ path: "methodology" }` was invisible to it. It printed
 *                   `✓ every app route has a deploy rewrite` while the deep
 *                   link 404'd in production.
 *   check-contrast  asserted contrast ratios but never the palette, so a
 *                   seventh hue could be added to SERIES_COLORS and every
 *                   runtime guard that reads `palette.length` would quietly
 *                   permit a seventh series nobody had scored for colour-vision
 *                   separation.
 *
 * Neither could have survived this file, because every test below asserts a
 * NON-ZERO exit on a deliberately broken fixture — and asserts a zero exit on
 * the same fixture unbroken, which is what stops a test passing because the
 * fixture is malformed rather than because the gate is working.
 *
 * WHY IT LIVES UNDER src/server RATHER THAN NEXT TO THE SCRIPTS
 *
 * `npm test` runs `node --test "src/**\/*.test.js"`. A test file outside `src`
 * would not run, and a gate test that does not run is worth less than none.
 *
 * HOW THE FIXTURES WORK
 *
 * Each gate computes its root from its own `import.meta.url`, so pointing one
 * at different input means giving it a different tree to live in. Node resolves
 * symlinks before reading `import.meta.url`, so the scripts themselves are
 * COPIED — a symlinked script would report the real repository as its root and
 * silently check the real files. Bulk inputs that are only ever read (`public`,
 * `landing`) are symlinked, which is safe for the same reason.
 *
 * Nothing here writes inside the repository.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { APP_ROUTES } from '../../scripts/vercel-config.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let root;

before(() => {
  /*
   * `realpathSync` is load-bearing on macOS, where os.tmpdir() is
   * /var/folders/… and /var is a symlink to /private/var. `vercel-config.js`
   * decides whether it was invoked directly by comparing `process.argv[1]`
   * against its own resolved `import.meta.url`; through the symlink those two
   * differ, the script decides it was imported, and it exits 0 having done
   * nothing — which would make the mutation tests below pass for no reason.
   */
  root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'diffusion-gates-'));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A fixture tree with its own package.json, so Node reads the copies as ESM. */
function tree(name) {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  return {
    dir,
    /** Copy a repository file to the same relative path inside the fixture. */
    copy(relative) {
      const target = path.join(dir, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(path.join(REPO, relative), target, { recursive: true });
    },
    link(relative) {
      symlinkSync(path.join(REPO, relative), path.join(dir, relative), 'dir');
    },
    write(relative, contents) {
      const target = path.join(dir, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, contents);
    },
    read(relative) {
      return readFileSync(path.join(dir, relative), 'utf8');
    },
    /** Run one of the copied gates. Returns its exit status and its output. */
    run(script, args = []) {
      const result = spawnSync(process.execPath, [path.join(dir, script), ...args], {
        encoding: 'utf8',
      });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    },
  };
}

/**
 * Break something, run the gate, put it back.
 *
 * Restoring inside the helper is what lets each test state one mutation and
 * nothing else — and it means a test that throws mid-assertion cannot leave the
 * fixture broken for the next one.
 */
function withMutation(fixture, relative, mutate, run) {
  const original = fixture.read(relative);
  try {
    fixture.write(relative, mutate(original));
    return run();
  } finally {
    fixture.write(relative, original);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('check:routes — App.jsx and vercel.json must agree', () => {
  let fixture;

  before(() => {
    fixture = tree('routes');
    fixture.copy('scripts/check-routes.js');
    fixture.copy('scripts/vercel-config.js');
    fixture.copy('src/server/lib/security.js'); // vercel-config imports it

    /*
     * The App.jsx under test is GENERATED from APP_ROUTES rather than copied,
     * so this file asserts the gate's detection mechanism and not today's route
     * list. Adding a real route to the app changes both sides at once and
     * leaves these tests saying exactly what they said before.
     */
    const rows = APP_ROUTES.map((p) => `      { path: '${p}', element: null },`).join('\n');
    fixture.write(
      'src/client/App.jsx',
      `export const routes = [\n  { path: '/', element: null, children: [\n${rows}\n` +
        "      { path: '*', element: null },\n  ] },\n];\n"
    );
  });

  test('the unbroken fixture passes, so a failure below means something', () => {
    const { status, output } = fixture.run('scripts/check-routes.js');
    assert.equal(status, 0, output);
    assert.match(output, /every app route has a deploy rewrite/);
  });

  test('a DOUBLE-QUOTED route with no rewrite fails the gate', () => {
    /*
     * The exact hole. For its whole life the regex was `'([^']+)'`, so this
     * fixture produced `✓ every app route has a deploy rewrite (10 routes)`
     * and the route 404'd in production. Which quote a route is written with is
     * a paste or an editor setting, never a decision.
     */
    const { status, output } = withMutation(
      fixture,
      'src/client/App.jsx',
      (src) => src.replace("{ path: '*'", '{ path: "methodology", element: null },\n      { path: \'*\''),
      () => fixture.run('scripts/check-routes.js')
    );

    assert.equal(status, 1);
    assert.match(output, /\/methodology/);
    assert.match(output, /NOT in vercel\.json/);
  });

  test('a BACKTICKED route with no rewrite fails the gate', () => {
    const { status, output } = withMutation(
      fixture,
      'src/client/App.jsx',
      (src) => src.replace("{ path: '*'", '{ path: `analysis`, element: null },\n      { path: \'*\''),
      () => fixture.run('scripts/check-routes.js')
    );

    assert.equal(status, 1);
    assert.match(output, /\/analysis/);
  });

  test('a rewrite with no route behind it fails the gate too', () => {
    // The other direction: vercel.json claiming a path the app does not serve
    // hands back the shell, which then redirects to the landing page.
    const dropped = APP_ROUTES[0];
    const { status, output } = withMutation(
      fixture,
      'src/client/App.jsx',
      (src) => src.replace(`      { path: '${dropped}', element: null },\n`, ''),
      () => fixture.run('scripts/check-routes.js')
    );

    assert.equal(status, 1);
    assert.match(output, /NOT in App\.jsx/);
    assert.ok(output.includes(dropped), `expected ${dropped} to be named`);
  });
});

describe('check:contrast — six validated hues, in order', () => {
  let fixture;

  before(() => {
    fixture = tree('contrast');
    fixture.copy('scripts/check-contrast.js');
    fixture.copy('src/client/lib/format.js'); // where SERIES_COLORS lives
    // The four stylesheets the gate reads, in the cascade order it reads them.
    for (const sheet of ['theme.css', 'charts.css', 'atmos.css', 'app.css']) {
      fixture.copy(`src/client/styles/${sheet}`);
    }
  });

  test('the unbroken fixture passes', () => {
    const { status, output } = fixture.run('scripts/check-contrast.js');
    assert.equal(status, 0, output);
    assert.match(output, /6 hues, in order, at their validated values/);
  });

  test('a SEVENTH hue in SERIES_COLORS fails the gate', () => {
    /*
     * The hole this half of the gate was written to close. A seventh entry
     * means a chart can draw a seventh series whose separation against the
     * other six was never measured, and every runtime guard that asks
     * `palette.length` quietly permits it.
     */
    const { status, output } = withMutation(
      fixture,
      'src/client/lib/format.js',
      (src) => src.replace("'--c6'];", "'--c6', '--c7'];"),
      () => fixture.run('scripts/check-contrast.js')
    );

    assert.equal(status, 1);
    assert.match(output, /SERIES_COLORS holds 7 hues, not 6/);
    assert.match(output, /palette integrity problem/);
  });

  test('REORDERING two hues fails the gate', () => {
    // Adjacency is what CVD separation is measured on, and a reorder silently
    // repaints every chart on the site — the same green line means one country
    // on Monday and another on Tuesday.
    const { status, output } = withMutation(
      fixture,
      'src/client/lib/format.js',
      (src) => src.replace("['--c1', '--c2',", "['--c2', '--c1',"),
      () => fixture.run('scripts/check-contrast.js')
    );

    assert.equal(status, 1);
    assert.match(output, /hue ORDER is fixed/);
  });

  test('a hue defined in the stylesheet but not in the palette fails the gate', () => {
    // It draws nothing today and is one line in format.js away from drawing a
    // seventh series, so it is caught where it is cheap.
    const { status, output } = withMutation(
      fixture,
      'src/client/styles/charts.css',
      (css) => `${css}\n:root { --c7: #123456; }\n`,
      () => fixture.run('scripts/check-contrast.js')
    );

    assert.equal(status, 1);
    assert.match(output, /--c7, which is not in the validated set/);
  });
});

describe('check:tokens — a class that generates no CSS', () => {
  let fixture;

  before(() => {
    fixture = tree('tokens');
    fixture.copy('scripts/check-tokens.js');
    // The gate walks the whole client tree, so the whole client tree is the
    // fixture. It is ~1 MB of source and no dependencies.
    fixture.copy('src/client');
  });

  test('the unbroken fixture passes', () => {
    const { status, output } = fixture.run('scripts/check-tokens.js');
    assert.equal(status, 0, output);
  });

  test('a className naming a token nothing defines fails the gate', () => {
    /*
     * The failure this gate exists for: Tailwind generates no CSS for a class
     * that does not exist, does not warn, and does not fail the build. Seven
     * such classes across sixteen components once made every card and drawer in
     * the app draw a near-black outline for weeks with no error anywhere.
     */
    const relative = 'src/client/UndefinedTokenFixture.jsx';
    fixture.write(
      relative,
      'export const Fixture = () => <div className="text-border-nope bg-surface-nope" />;\n'
    );
    try {
      const { status, output } = fixture.run('scripts/check-tokens.js');
      assert.equal(status, 1);
      assert.match(output, /text-border-nope/);
      assert.match(output, /no such utility/);
    } finally {
      rmSync(path.join(fixture.dir, relative));
    }
  });

  test('a var() reference to a token nothing defines fails the gate', () => {
    // The same hazard at runtime rather than at build: an undefined custom
    // property handed to Recharts paints nothing.
    const relative = 'src/client/UndefinedVarFixture.jsx';
    fixture.write(relative, 'export const Fixture = () => <svg stroke="var(--color-nope-nope)" />;\n');
    try {
      const { status, output } = fixture.run('scripts/check-tokens.js');
      assert.equal(status, 1);
      assert.match(output, /var\(--color-nope-nope\)/);
      assert.match(output, /not defined in any stylesheet/);
    } finally {
      rmSync(path.join(fixture.dir, relative));
    }
  });
});

describe('check:vercel — the committed config against the HTML being served', () => {
  let fixture;

  before(() => {
    fixture = tree('vercel');
    fixture.copy('scripts/vercel-config.js');
    fixture.copy('src/server/lib/security.js');
    fixture.copy('vercel.json');
    // Read-only inputs, and 50 MB of them. Symlinked rather than copied: only
    // the SCRIPT's location decides the root, and these are never written.
    fixture.link('public');
    fixture.link('landing');
  });

  test('the unbroken fixture passes', () => {
    const { status, output } = fixture.run('scripts/vercel-config.js', ['--check']);
    assert.equal(status, 0, output);
    assert.match(output, /vercel\.json matches the HTML being served/);
  });

  test('corrupting one CSP hash fails the gate', () => {
    /*
     * The check that matters most and is hardest to eyeball. On Vercel the CDN
     * serves the HTML and this file is the only CSP it gets, so a stale hash
     * blocks an inline script silently — the page renders, nothing errors, and
     * the front door is dead. That has happened here.
     */
    const { status, output } = withMutation(
      fixture,
      'vercel.json',
      (json) => {
        const hash = json.match(/sha256-[A-Za-z0-9+/=]{20,}/);
        assert.ok(hash, 'the committed vercel.json should carry inline-script hashes');
        return json.replace(hash[0], `${hash[0].slice(0, 10)}AAAAAAAAAA${hash[0].slice(20)}`);
      },
      () => fixture.run('scripts/vercel-config.js', ['--check'])
    );

    assert.equal(status, 1);
    assert.match(output, /vercel\.json is stale/);
  });

  test('dropping a rewrite fails the gate', () => {
    const { status } = withMutation(
      fixture,
      'vercel.json',
      (json) => {
        const config = JSON.parse(json);
        config.rewrites = config.rewrites.slice(1);
        return `${JSON.stringify(config, null, 2)}\n`;
      },
      () => fixture.run('scripts/vercel-config.js', ['--check'])
    );

    assert.equal(status, 1);
  });
});

/*
 * check:charts — the palette ceiling.
 *
 * This gate is the one the brief asks for by name: "a new gate that fails when
 * any chart_group exceeds SERIES_COLORS.length". It had no mutation test, which
 * on a gate is the same as having no gate — `check-routes` shipped for months
 * unable to see a double-quoted route, and `check-contrast` unable to see a
 * seventh hue, both while passing.
 *
 * It queries the database at import, so it cannot simply be imported here. The
 * decision itself is a pure exported function with no dependencies, so it is
 * lifted out of the SHIPPED SOURCE and evaluated — the logic under test is the
 * logic that runs, not a copy of it that can drift.
 */
describe('check:charts — a chart may not hold more series than there are hues', () => {
  const source = readFileSync(
    new URL('../../scripts/check-chart-groups.js', import.meta.url),
    'utf8'
  );

  const classifyGroups = (() => {
    const start = source.indexOf('export function classifyGroups');
    assert.ok(start !== -1, 'classifyGroups is gone — the gate has been rewritten');
    const body = source.slice(start).replace('export function', 'function');
    const end = body.indexOf('\n}\n');
    assert.ok(end !== -1, 'could not bound classifyGroups');
    // eslint-disable-next-line no-new-func
    return new Function(`${body.slice(0, end + 2)}\nreturn classifyGroups;`)();
  })();

  test('the ceiling is derived from the palette, never written down twice', () => {
    assert.match(
      source,
      /import \{[^}]*SERIES_COLORS[^}]*\} from '\.\.\/src\/client\/lib\/format\.js'/,
      'the gate must read the palette rather than restate its size'
    );
    assert.match(
      source,
      /const MAX_SERIES = SERIES_COLORS\.length/,
      'a literal ceiling drifts away from the palette the moment a hue is added ' +
        'or removed, and then the gate is guarding a number nobody uses'
    );
    assert.doesNotMatch(source, /const MAX_SERIES = \d/);
  });

  test('a group over the ceiling with no declared form is caught', () => {
    const { over, exempt } = classifyGroups(
      [{ chart_group: 'ai-adoption-panel', members: 16, form: null }],
      6
    );
    assert.equal(over.length, 1, 'sixteen series against six hues must be reported');
    assert.equal(exempt.length, 0);
  });

  test('a group at the ceiling is not caught — the boundary is > and not >=', () => {
    const { over } = classifyGroups([{ chart_group: 'six', members: 6, form: null }], 6);
    assert.equal(over.length, 0, 'six series in six hues is exactly drawable');
  });

  test('a declared non-colour form is exempt, because colour stops encoding', () => {
    const { over, exempt } = classifyGroups(
      [{ chart_group: 'ai-adoption-panel', members: 44, form: 'ranked-bars' }],
      6
    );
    assert.equal(over.length, 0, 'ranked bars use one hue, so the ceiling does not apply');
    assert.equal(exempt.length, 1, 'and it is still reported, as an exemption rather than silence');
  });

  test('an absent form means a line chart, not an exemption', () => {
    // The dangerous default is the other way round: treating "no ruling" as
    // "someone must have decided" is how a blanked page ships unnoticed.
    const { over } = classifyGroups([{ chart_group: 'g', members: 8 }], 6);
    assert.equal(over.length, 1);
  });
});
