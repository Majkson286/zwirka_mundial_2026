import { json, err, getUser, hashPassword, getSalt } from './_lib.js';

// GET: lista użytkowników (tylko admin) — do panelu administratora
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);

  const rows = await env.DB.prepare(
    'SELECT id, username, display_name, is_admin FROM users ORDER BY display_name ASC'
  ).all();
  return json({ users: rows.results });
}

// POST: reset hasła wybranego użytkownika (tylko admin)
export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.is_admin) return err('Brak uprawnień', 403);

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const targetId = parseInt(body.user_id, 10);
  const newPassword = body.new_password || '';

  if (!Number.isInteger(targetId)) return err('Brak user_id');
  if (newPassword.length < 4) return err('Nowe hasło musi mieć min. 4 znaki');

  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return err('Nie ma takiego użytkownika', 404);

  const hash = await hashPassword(newPassword, getSalt(env));
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(hash, targetId).run();
  // wyloguj wszystkie sesje tego użytkownika (stary token przestaje działać)
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetId).run();

  return json({ ok: true });
}
