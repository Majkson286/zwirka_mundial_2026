import { json, err, getUser } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return err('Niezalogowany', 401);
  return json({ user });
}
