import { json } from './_lib.js';

// Ranking publiczny — każdy zalogowany widzi punkty wszystkich.
export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            COALESCE(SUM(p.points), 0) AS total,
            COUNT(p.id) AS played,
            SUM(CASE WHEN p.points = 10 THEN 1 ELSE 0 END) AS exact_hits,
            SUM(CASE WHEN p.points = 5  THEN 1 ELSE 0 END) AS outcome_hits
     FROM users u
     LEFT JOIN predictions p
       ON p.user_id = u.id AND p.points IS NOT NULL
     GROUP BY u.id
     ORDER BY total DESC, exact_hits DESC, u.display_name ASC`
  ).all();

  const standings = rows.results.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.display_name,
    total: r.total,
    played: r.played,
    exact_hits: r.exact_hits || 0,
    outcome_hits: r.outcome_hits || 0
  }));

  return json({ standings });
}
