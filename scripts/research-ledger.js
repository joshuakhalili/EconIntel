/** Read-only export/validation. Redirect JSON to a review artifact if desired. */
import { query, pool } from '../src/server/db/pool.js';
import { researchForQuestion } from '../src/server/repositories/research.js';
import { validateClaim } from '../src/server/lib/research-validation.js';

try {
  const { rows: questions } = await query('SELECT id FROM questions WHERE is_active ORDER BY id');
  const ledger = [];
  const issues = [];
  for (const question of questions) {
    const claims = await researchForQuestion(question.id);
    if (!claims.length) issues.push({ question: question.id, errors: ['no claim ledger'] });
    for (const claim of claims) {
      ledger.push(claim);
      const errors = validateClaim(claim);
      if (errors.length) issues.push({ question: question.id, claim: claim.id, errors });
    }
  }
  console.log(JSON.stringify(process.argv.includes('--check') ? { claims: ledger.length, issues } : ledger, null, 2));
  if (process.argv.includes('--check') && issues.length) process.exitCode = 1;
} finally {
  await pool.end();
}
