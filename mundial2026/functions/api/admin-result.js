import { json, err, getUser, computePoints } from './_lib.js';

// Admin wpisuje wynik meczu. Automatycznie przelicza punkty wszystkich typów na ten mecz.
export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const matchId = parseInt(body.match_id, 10);
  const hs = parseInt(body.home_score, 10);
  const as = parseInt(body.away_score, 10);

  if (!Number.isInteger(matchId)) return err('Brak match_id');
  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
    return err('Wynik musi być liczbą >= 0');
  }

  const match = await env.DB.prepare('SELECT id FROM matches WHERE id = ?').bind(matchId).first();
  if (!match) return err('Nie ma takiego meczu', 404);

  // Zapis wyniku i oznaczenie jako zakończony
  await env.DB.prepare(
    'UPDATE matches SET home_score = ?, away_score = ?, finished = 1 WHERE id = ?'
  ).bind(hs, as, matchId).run();

  // Przeliczenie punktów wszystkich typów na ten mecz
  const preds = await env.DB.prepare(
    'SELECT id, pred_home, pred_away FROM predictions WHERE match_id = ?'
  ).bind(matchId).all();

  const stmts = preds.results.map(p => {
    const pts = computePoints(p.pred_home, p.pred_away, hs, as);
    return env.DB.prepare('UPDATE predictions SET points = ? WHERE id = ?').bind(pts, p.id);
  });
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, updated_predictions: preds.results.length });
}

// Cofnięcie wyniku (gdyby admin się pomylił)
export async function onRequestDelete({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);
  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const matchId = parseInt(body.match_id, 10);
  if (!Number.isInteger(matchId)) return err('Brak match_id');

  await env.DB.prepare(
    'UPDATE matches SET home_score = NULL, away_score = NULL, finished = 0 WHERE id = ?'
  ).bind(matchId).run();
  await env.DB.prepare('UPDATE predictions SET points = NULL WHERE match_id = ?')
    .bind(matchId).run();

  return json({ ok: true });
}
