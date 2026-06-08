import { json, getUser } from './_lib.js';

// Zwraca wszystkie mecze z bazy + typ bieżącego usera (jeśli zalogowany).
// "locked" = true gdy do startu meczu zostało < 1h LUB mecz się zaczął/zakończył.
const LOCK_MINUTES = 60;

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);

  const matches = await env.DB.prepare(
    `SELECT id, stage, group_name, home, away, kickoff, venue,
            home_score, away_score, finished
     FROM matches ORDER BY kickoff ASC`
  ).all();

  let preds = {};
  if (user) {
    const rows = await env.DB.prepare(
      'SELECT match_id, pred_home, pred_away, points FROM predictions WHERE user_id = ?'
    ).bind(user.id).all();
    for (const r of rows.results) {
      preds[r.match_id] = { home: r.pred_home, away: r.pred_away, points: r.points };
    }
  }

  const now = Date.now();
  const out = matches.results.map(m => {
    const ko = new Date(m.kickoff).getTime();
    const locked = m.finished === 1 || now >= ko - LOCK_MINUTES * 60000;
    return {
      id: m.id, stage: m.stage, group: m.group_name,
      home: m.home, away: m.away, kickoff: m.kickoff, venue: m.venue,
      home_score: m.home_score, away_score: m.away_score,
      finished: m.finished === 1,
      locked,
      prediction: preds[m.id] || null
    };
  });

  return json({ matches: out, lock_minutes: LOCK_MINUTES });
}
