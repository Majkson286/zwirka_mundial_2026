import { json, err, getUser } from './_lib.js';

const LOCK_MINUTES = 0; // mecz blokuje się o starcie (spójne z predict.js/matches.js)

// Zwraca typy wszystkich graczy dla danego meczu — ale TYLKO jeśli mecz jest już zablokowany.
// Dzięki temu nikt nie podejrzy cudzych typów przed zamknięciem (ochrona po stronie serwera).
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return err('Niezalogowany', 401);

  const url = new URL(request.url);
  const matchId = parseInt(url.searchParams.get('match_id'), 10);
  if (!Number.isInteger(matchId)) return err('Brak match_id');

  const match = await env.DB.prepare(
    'SELECT kickoff, finished FROM matches WHERE id = ?'
  ).bind(matchId).first();
  if (!match) return err('Nie ma takiego meczu', 404);

  const ko = new Date(match.kickoff).getTime();
  const locked = match.finished === 1 || Date.now() >= ko - LOCK_MINUTES * 60000;
  if (!locked) {
    // mecz wciąż otwarty — nie ujawniamy typów
    return json({ locked: false, predictions: [] });
  }

  const rows = await env.DB.prepare(
    `SELECT u.display_name AS name, p.pred_home, p.pred_away, p.points
     FROM predictions p JOIN users u ON u.id = p.user_id
     WHERE p.match_id = ?
     ORDER BY u.display_name COLLATE NOCASE ASC`
  ).bind(matchId).all();

  const predictions = rows.results.map(r => ({
    name: r.name,
    home: r.pred_home,
    away: r.pred_away,
    points: r.points
  }));

  return json({ locked: true, finished: match.finished === 1, predictions });
}
