import { json, err, hashPassword, getSalt, randomToken } from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  const username = (body.username || '').trim().toLowerCase();
  const displayName = (body.display_name || body.username || '').trim();
  const password = body.password || '';

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return err('Login: 3-20 znaków, małe litery/cyfry/podkreślnik');
  }
  if (password.length < 4) return err('Hasło musi mieć min. 4 znaki');
  if (!displayName) return err('Podaj nazwę wyświetlaną');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username).first();
  if (existing) return err('Taki login już istnieje', 409);

  const hash = await hashPassword(password, getSalt(env));
  const res = await env.DB.prepare(
    'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)'
  ).bind(username, displayName, hash).run();

  const userId = res.meta.last_row_id;
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
    .bind(token, userId).run();

  return json({
    token,
    user: { id: userId, username, display_name: displayName, is_admin: 0 }
  });
}
