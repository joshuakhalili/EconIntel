-- Publication flows are neither a stock of applicable law nor compliance costs.
UPDATE lens_tickers SET label = 'AI-related rule publications',
  why = 'Monthly Federal Register documents classified as Rules and matching the AI-related search. Publication does not establish current applicability, effective dates, enforcement or compliance costs. The current month is incomplete.'
WHERE lens_id = 'regulation' AND indicator_id = 'derived.ai_binding_rules';

UPDATE lens_tickers SET label = 'Proposed-rule publications',
  why = 'Monthly matching Federal Register documents classified as Proposed Rules. These are publications, not a count of proposals that will become law; no conversion rate or implementation lag is identified.'
WHERE lens_id = 'regulation' AND indicator_id = 'derived.ai_proposed_rules';

UPDATE lens_tickers SET label = 'Presidential publications',
  why = 'Monthly matching Federal Register Presidential Documents. Document types and legal effects differ; publication counts do not establish durability, implementation or economic effects.'
WHERE lens_id = 'regulation' AND indicator_id = 'derived.ai_presidential_documents';

UPDATE lens_tickers SET label = 'All AI-related publications',
  why = 'Monthly matching Federal Register documents across all document types, including notices. This measures publication activity, not the stock of AI laws, enforcement or compliance costs; the other three displayed categories are not exhaustive.'
WHERE lens_id = 'regulation' AND indicator_id = 'derived.ai_regulation_volume';
