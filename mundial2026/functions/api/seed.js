import { json, err } from './_lib.js';

// Ładuje mecze z /schedule.json do tabeli matches.
// Nie nadpisuje wyników już wpisanych (INSERT OR IGNORE po id).
// Wymaga ?key=<SETUP_KEY> zgodnego z env.SETUP_KEY, żeby nikt postronny nie odpalił.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const expected = env.SETUP_KEY || 'setup';
  if (key !== expected) return err('Zły klucz setup', 403);

  // Pobierz schedule.json z tego samego deploymentu
  const res = await env.ASSETS.fetch(new URL('/schedule.json', request.url));
  if (!res.ok) return err('Nie znaleziono schedule.json', 500);
  const schedule = await res.json();

  const stmts = schedule.map(m =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO matches (id, stage, group_name, home, away, kickoff, venue)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(m.id, m.stage, m.group || null, m.home, m.away, m.kickoff, m.venue || null)
  );
  await env.DB.batch(stmts);

  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM matches').first();
  return json({ ok: true, matches_in_db: count.c, loaded: schedule.length });
}
