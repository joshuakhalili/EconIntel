import { query } from '../db/pool.js';

/** No generation or provider calls on the reading path. */
export async function researchForQuestion(questionId, read = query) {
  const { rows } = await read(
    `SELECT c.*, r.actor_type, r.reviewer, r.reviewed_at::text, r.notes AS review_notes,
            CASE WHEN r.id IS NULL THEN 'draft'
                 WHEN r.fingerprint <> c.fingerprint THEN 'stale'
                 WHEN r.actor_type = 'human' THEN 'human_reviewed'
                 ELSE 'agent_checked' END AS review_status
       FROM research_claim_snapshots c
       LEFT JOIN LATERAL (
         SELECT * FROM research_review_events
          WHERE claim_id = c.id ORDER BY reviewed_at DESC, id DESC LIMIT 1
       ) r ON true
      WHERE c.question_id = $1 ORDER BY c.id`, [questionId]
  );
  return rows;
}
