const ADMIN_EMAIL_DEFAULT = 'asaxxhiii@gmail.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
function clean(s, max) { return String(s || '').trim().slice(0, max); }
async function readQuestion(env, key) {
  const value = await env.AMA_KV.get(key, 'json');
  return value || null;
}

export async function onRequestGet({ env }) {
  if (!env.AMA_KV) return json({ questions: [] });
  const listed = await env.AMA_KV.list({ prefix: 'q:', limit: 1000 });
  const questions = [];
  for (const k of listed.keys) {
    const q = await readQuestion(env, k.name);
    if (q && q.answer) questions.push(q);
  }
  questions.sort((a, b) => new Date(b.answeredAt || b.createdAt) - new Date(a.answeredAt || a.createdAt));
  return json({ questions: questions.slice(0, 30) });
}

async function notify(env, q) {
  const to = env.ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  if (!env.RESEND_API_KEY) return;
  const from = env.EMAIL_FROM || 'Portfolio AMA <onboarding@resend.dev>';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `New AMA question from ${q.name}`,
      text: `New question on your website\n\nFrom: ${q.name}\nQuestion: ${q.question}\n\nOpen your website and click the owner/admin icon in the Ask Me Anything box to answer it.`
    })
  }).catch(() => {});
}

export async function onRequestPost({ request, env }) {
  if (!env.AMA_KV) return json({ error: 'AMA_KV is not configured.' }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const name = clean(body.name, 60);
  const question = clean(body.question, 280);
  if (!name || !question) return json({ error: 'Name and question are required.' }, 400);
  const id = crypto.randomUUID();
  const q = { id, name, question, answer: '', createdAt: new Date().toISOString(), answeredAt: '' };
  await env.AMA_KV.put(`q:${id}`, JSON.stringify(q));
  await notify(env, q);
  return json({ ok: true, id });
}
