import { json, err, getUser } from './_lib.js';

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const matchId = parseInt(body.match_id, 10);
  const home = (body.home || '').trim();
  const away = (body.away || '').trim();
  if (!Number.isInteger(matchId)) return err('Brak match_id');
  if (!home || !away) return err('Podaj obie drużyny');

  const match = await env.DB.prepare('SELECT id FROM matches WHERE id = ?').bind(matchId).first();
  if (!match) return err('Nie ma takiego meczu', 404);

  await env.DB.prepare('UPDATE matches SET home = ?, away = ? WHERE id = ?')
    .bind(home, away, matchId).run();

  return json({ ok: true });
}
