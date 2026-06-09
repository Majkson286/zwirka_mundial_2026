import { json, err, getUser } from './_lib.js';

const GROUP_PTS = 3;
const CHAMPION_PTS = 15;

// Admin wpisuje rzeczywisty wynik specjalny (zwycięzca grupy lub mistrz)
// i automatycznie przelicza punkty wszystkich typów dla tego klucza.
export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const kind = body.kind === 'champion' ? 'champion' : 'group';
  const betKey = (body.bet_key || '').trim();
  const team = (body.team || '').trim();
  if (!betKey || !team) return err('Podaj klucz i drużynę');

  // zapis wyniku
  await env.DB.prepare(
    `INSERT INTO special_results (kind, bet_key, team) VALUES (?, ?, ?)
     ON CONFLICT(kind, bet_key) DO UPDATE SET team = excluded.team`
  ).bind(kind, betKey, team).run();

  // przelicz punkty wszystkich typów dla tego klucza
  const pts = kind === 'champion' ? CHAMPION_PTS : GROUP_PTS;
  const preds = await env.DB.prepare(
    'SELECT id, team FROM special_predictions WHERE kind = ? AND bet_key = ?'
  ).bind(kind, betKey).all();

  const stmts = preds.results.map(p =>
    env.DB.prepare('UPDATE special_predictions SET points = ? WHERE id = ?')
      .bind(p.team === team ? pts : 0, p.id)
  );
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, updated: preds.results.length });
}

// Cofnięcie wyniku specjalnego
export async function onRequestDelete({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);
  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const kind = body.kind === 'champion' ? 'champion' : 'group';
  const betKey = (body.bet_key || '').trim();
  if (!betKey) return err('Podaj klucz');

  await env.DB.prepare('DELETE FROM special_results WHERE kind = ? AND bet_key = ?')
    .bind(kind, betKey).run();
  await env.DB.prepare('UPDATE special_predictions SET points = NULL WHERE kind = ? AND bet_key = ?')
    .bind(kind, betKey).run();

  return json({ ok: true });
}
