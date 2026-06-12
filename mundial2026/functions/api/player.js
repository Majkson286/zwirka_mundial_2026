import { json, err, getUser } from './_lib.js';

const LOCK_MINUTES = 0;

// Profil gracza: jego typy WYŁĄCZNIE w zablokowanych meczach (otwarte ukryte,
// żeby nikt nie podglądał cudzych typów przed zamknięciem).
export async function onRequestGet({ request, env }) {
  const viewer = await getUser(request, env);
  if (!viewer) return err('Niezalogowany', 401);

  const url = new URL(request.url);
  const userId = parseInt(url.searchParams.get('user_id'), 10);
  if (!Number.isInteger(userId)) return err('Brak user_id');

  const target = await env.DB.prepare(
    'SELECT id, display_name FROM users WHERE id = ?'
  ).bind(userId).first();
  if (!target) return err('Nie ma takiego gracza', 404);

  // Wszystkie typy gracza + dane meczu
  const rows = await env.DB.prepare(
    `SELECT m.id, m.home, m.away, m.kickoff, m.stage, m.group_name,
            m.home_score, m.away_score, m.finished,
            p.pred_home, p.pred_away, p.points
     FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.user_id = ?
     ORDER BY m.kickoff ASC`
  ).bind(userId).all();

  const now = Date.now();
  const bets = [];
  for (const r of rows.results) {
    const ko = new Date(r.kickoff).getTime();
    const locked = r.finished === 1 || now >= ko - LOCK_MINUTES * 60000;
    if (!locked) continue; // pomijamy otwarte mecze
    bets.push({
      match_id: r.id,
      home: r.home, away: r.away, kickoff: r.kickoff,
      stage: r.stage, group: r.group_name,
      home_score: r.home_score, away_score: r.away_score,
      finished: r.finished === 1,
      pred_home: r.pred_home, pred_away: r.pred_away,
      points: r.points
    });
  }

  return json({ name: target.display_name, bets });
}
