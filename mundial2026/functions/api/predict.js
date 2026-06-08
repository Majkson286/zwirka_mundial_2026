import { json, err, getUser } from './_lib.js';

const LOCK_MINUTES = 0;

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return err('Niezalogowany', 401);

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const matchId = parseInt(body.match_id, 10);
  const ph = parseInt(body.pred_home, 10);
  const pa = parseInt(body.pred_away, 10);

  if (!Number.isInteger(matchId)) return err('Brak match_id');
  if (!Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || pa < 0 || ph > 99 || pa > 99) {
    return err('Wynik musi być liczbą 0-99');
  }

  const match = await env.DB.prepare('SELECT kickoff, finished FROM matches WHERE id = ?')
    .bind(matchId).first();
  if (!match) return err('Nie ma takiego meczu', 404);

  const ko = new Date(match.kickoff).getTime();
  if (match.finished === 1 || Date.now() >= ko - LOCK_MINUTES * 60000) {
    return err('Obstawianie zamknięte (mniej niż godzina do meczu)', 403);
  }

  await env.DB.prepare(
    `INSERT INTO predictions (user_id, match_id, pred_home, pred_away)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, match_id)
     DO UPDATE SET pred_home = excluded.pred_home,
                   pred_away = excluded.pred_away,
                   updated_at = datetime('now')`
  ).bind(user.id, matchId, ph, pa).run();

  return json({ ok: true, prediction: { home: ph, away: pa } });
}
