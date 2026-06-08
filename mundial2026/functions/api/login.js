import { json, err, hashPassword, getSalt, randomToken } from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';
  if (!username || !password) return err('Podaj login i hasło');

  const user = await env.DB.prepare(
    'SELECT id, username, display_name, password_hash, is_admin FROM users WHERE username = ?'
  ).bind(username).first();
  if (!user) return err('Błędny login lub hasło', 401);

  const hash = await hashPassword(password, getSalt(env));
  if (hash !== user.password_hash) return err('Błędny login lub hasło', 401);

  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
    .bind(token, user.id).run();

  return json({
    token,
    user: {
      id: user.id, username: user.username,
      display_name: user.display_name, is_admin: user.is_admin
    }
  });
}
