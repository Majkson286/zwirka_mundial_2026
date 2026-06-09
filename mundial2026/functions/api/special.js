import { json, err, getUser } from './_lib.js';

// Zwraca typy specjalne usera + czy obstawianie jest jeszcze otwarte.
// Blokada: moment pierwszego meczu Mundialu (najwcześniejszy kickoff w bazie).
async function getLockTime(env) {
  const row = await env.DB.prepare('SELECT MIN(kickoff) AS first FROM matches').first();
  return row && row.first ? new Date(row.first).getTime() : null;
}

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return err('Niezalogowany', 401);

  const lockTime = await getLockTime(env);
  const locked = lockTime ? Date.now() >= lockTime : false;

  const rows = await env.DB.prepare(
    'SELECT kind, bet_key, team, points FROM special_predictions WHERE user_id = ?'
  ).bind(user.id).all();

  const preds = {};
  for (const r of rows.results) {
    preds[r.kind + ':' + r.bet_key] = { team: r.team, points: r.points };
  }

  // wyniki rzeczywiste (jeśli admin już wpisał) — by pokazać graczowi co trafił
  const resRows = await env.DB.prepare('SELECT kind, bet_key, team FROM special_results').all();
  const results = {};
  for (const r of resRows.results) results[r.kind + ':' + r.bet_key] = r.team;

  return json({
    predictions: preds,
    results,
    locked,
    lock_time: lockTime ? new Date(lockTime).toISOString() : null
  });
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return err('Niezalogowany', 401);

  const lockTime = await getLockTime(env);
  if (lockTime && Date.now() >= lockTime) {
    return err('Typy specjalne są już zamknięte (Mundial wystartował)', 403);
  }

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe dane'); }
  // body.bets = [{kind, bet_key, team}, ...]
  const bets = Array.isArray(body.bets) ? body.bets : [];
  if (!bets.length) return err('Brak typów do zapisania');

  const stmts = [];
  for (const b of bets) {
    const kind = b.kind === 'champion' ? 'champion' : 'group';
    const betKey = (b.bet_key || '').trim();
    const team = (b.team || '').trim();
    if (!betKey || !team) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO special_predictions (user_id, kind, bet_key, team)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, kind, bet_key)
         DO UPDATE SET team = excluded.team, updated_at = datetime('now')`
      ).bind(user.id, kind, betKey, team)
    );
  }
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, saved: stmts.length });
}
