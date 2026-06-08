// Wspólne funkcje pomocnicze dla API

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

export function err(message, status = 400) {
  return json({ error: message }, status);
}

// Hash hasła przez SHA-256 z solą (Web Crypto, dostępne w Workers)
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + ':' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sól globalna z env (ustawiana jako secret). Fallback dla local dev.
export function getSalt(env) {
  return env.AUTH_SALT || 'mundial2026-domyslna-sol-zmien-mnie';
}

// Pobiera zalogowanego usera z nagłówka Authorization: Bearer <token>
export async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();
  return row || null;
}

// PUNKTACJA:
//  - dokładny wynik (home i away się zgadzają) => 10 pkt
//  - tylko poprawny zwycięzca/remis (ale nie dokładny wynik) => 5 pkt
//  - nietrafione => 0 pkt
// Aby zmienić punkty, edytuj wartości EXACT_PTS i OUTCOME_PTS poniżej.
export const EXACT_PTS = 10;
export const OUTCOME_PTS = 5;

export function computePoints(predHome, predAway, realHome, realAway) {
  if (predHome === realHome && predAway === realAway) return EXACT_PTS;
  const predSign = Math.sign(predHome - predAway);
  const realSign = Math.sign(realHome - realAway);
  if (predSign === realSign) return OUTCOME_PTS;
  return 0;
}
