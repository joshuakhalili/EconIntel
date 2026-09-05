/**
 * The User-Agent this project's adapters send, in ONE place.
 *
 * WHY A MODULE FOR ONE STRING
 *
 * There were five copies. Four were corrected in a single pass and the fifth —
 * epoch.js, which sent `Diffusion/1.0 (research dashboard)` and named no
 * contact at all — was missed, which is what a copied constant does. A
 * User-Agent exists so that an operator whose service is being hit can find out
 * who is hitting them; one that says only "research dashboard" is a name
 * without a doorbell.
 *
 * THE URL MUST RESOLVE TODAY.
 *
 * `github.com/joshuakhalili/Diffusion` is a 404 — the repository is still named
 * EconIntel and renaming it is an owner action — so this names the repository
 * that exists rather than the one that is planned. Checked again on 2026-09-04:
 * `/EconIntel` 200, `/Diffusion` 404. GitHub keeps the old path redirecting
 * after a rename, so this line keeps working when the rename happens and does
 * not have to be part of it.
 *
 * NO EMAIL ADDRESS. A personal address in a shipped file is published to
 * everyone who reads the repository and lands in every provider log it touches.
 * The repository's issues page is a contact route that can be closed again. The
 * one place an address is genuinely required is the SEC, whose adapter reads it
 * from the `SEC_USER_AGENT` secret — and OpenAlex's polite pool, which reads
 * the same secret rather than carrying its own literal.
 */
export const USER_AGENT = 'Diffusion/1.0 (+https://github.com/joshuakhalili/EconIntel)';
