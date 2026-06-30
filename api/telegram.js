const TELEGRAM_API = 'https://api.telegram.org/bot';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({
      ok: false,
      error: 'Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel environment variables.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String(body.name || 'Anonymous').trim().slice(0, 60) || 'Anonymous';
    const question = String(body.question || '').trim().slice(0, 280);
    const questionId = String(body.id || '').trim().slice(0, 80);
    const createdAt = String(body.createdAt || new Date().toISOString()).trim().slice(0, 80);

    if (!question) {
      return res.status(400).json({ ok: false, error: 'Question is required' });
    }

    const text = [
      `<b>From:</b> ${escapeHtml(name)}`,
      `<b>Question:</b> ${escapeHtml(question)}`,
      questionId ? `<b>ID:</b> <code>${escapeHtml(questionId)}</code>` : '',
      `<b>Time:</b> ${escapeHtml(createdAt)}`,
    ].filter(Boolean).join('\n');

    const telegramResponse = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await telegramResponse.json().catch(() => null);

    if (!telegramResponse.ok || !data?.ok) {
      return res.status(502).json({
        ok: false,
        error: data?.description || `Telegram API error ${telegramResponse.status}`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Telegram notification failed:', error);
    return res.status(500).json({ ok: false, error: 'Failed to send Telegram notification' });
  }
};
