import { json } from './_lib.js';

// Ranking — sumuje punkty meczowe (predictions) + specjalne (special_predictions).
// Podzapytania zamiast JOIN-ów, by uniknąć mnożenia wierszy.
export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            COALESCE(mp.match_pts, 0) AS match_pts,
            COALESCE(mp.played, 0) AS played,
            COALESCE(mp.exact_hits, 0) AS exact_hits,
            COALESCE(mp.outcome_hits, 0) AS outcome_hits,
            COALESCE(sp.special_pts, 0) AS special_pts
     FROM users u
     LEFT JOIN (
       SELECT user_id,
              SUM(points) AS match_pts,
              COUNT(id) AS played,
              SUM(CASE WHEN points = 10 THEN 1 ELSE 0 END) AS exact_hits,
              SUM(CASE WHEN points = 5  THEN 1 ELSE 0 END) AS outcome_hits
       FROM predictions WHERE points IS NOT NULL GROUP BY user_id
     ) mp ON mp.user_id = u.id
     LEFT JOIN (
       SELECT user_id, SUM(points) AS special_pts
       FROM special_predictions WHERE points IS NOT NULL GROUP BY user_id
     ) sp ON sp.user_id = u.id`
  ).all();

  const standings = rows.results
    .map(r => ({
      id: r.id,
      name: r.display_name,
      total: (r.match_pts || 0) + (r.special_pts || 0),
      match_pts: r.match_pts || 0,
      special_pts: r.special_pts || 0,
      played: r.played || 0,
      exact_hits: r.exact_hits || 0,
      outcome_hits: r.outcome_hits || 0
    }))
    .sort((a, b) =>
      b.total - a.total ||
      b.exact_hits - a.exact_hits ||
      a.name.localeCompare(b.name)
    )
    .map((r, i) => ({ rank: i + 1, ...r }));

  return json({ standings });
}
