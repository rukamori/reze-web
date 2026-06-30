const crypto = require('crypto');

const TELEGRAM_API = 'https://api.telegram.org/bot';
const DEFAULT_PROJECT_ID = 'therealreze-2a3bf';
const FIRESTORE_COLLECTION = 'amaQuestions';
const EDIT_SESSION_COLLECTION = 'telegramEditSessions';

function jsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY must contain client_email and private_key');
  }
  return parsed;
}

function projectId() {
  const sa = serviceAccount();
  return process.env.FIREBASE_PROJECT_ID || sa.project_id || DEFAULT_PROJECT_ID;
}

function docPath(collection, id) {
  return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
}

async function googleAccessToken() {
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Google token error ${response.status}`);
  }
  return data.access_token;
}

async function firestore(method, url, body) {
  const token = await googleAccessToken();
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Firestore ${method} error ${response.status}`);
  return data;
}

function mask(fields) {
  return fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
}

async function answerQuestion(questionId, answer) {
  return firestore('PATCH', `${docPath(FIRESTORE_COLLECTION, questionId)}?${mask(['answer', 'answered', 'answeredAt', 'dismissed'])}`, {
    fields: {
      answer: { stringValue: answer.slice(0, 1000) },
      answered: { booleanValue: true },
      answeredAt: { stringValue: new Date().toISOString() },
      dismissed: { booleanValue: false },
    },
  });
}

async function dismissQuestion(questionId) {
  return firestore('PATCH', `${docPath(FIRESTORE_COLLECTION, questionId)}?${mask(['dismissed', 'answered'])}`, {
    fields: {
      dismissed: { booleanValue: true },
      answered: { booleanValue: false },
    },
  });
}

async function deleteQuestion(questionId) {
  return firestore('DELETE', docPath(FIRESTORE_COLLECTION, questionId));
}

async function editQuestionText(questionId, text) {
  return firestore('PATCH', `${docPath(FIRESTORE_COLLECTION, questionId)}?${mask(['question'])}`, {
    fields: { question: { stringValue: text.slice(0, 280) } },
  });
}

async function saveEditSession(chatId, questionId) {
  return firestore('PATCH', docPath(EDIT_SESSION_COLLECTION, String(chatId)), {
    fields: {
      chatId: { stringValue: String(chatId) },
      questionId: { stringValue: String(questionId) },
      createdAt: { stringValue: new Date().toISOString() },
    },
  });
}

async function getEditSession(chatId) {
  try { return await firestore('GET', docPath(EDIT_SESSION_COLLECTION, String(chatId))); }
  catch (e) { return null; }
}

async function clearEditSession(chatId) {
  try { await firestore('DELETE', docPath(EDIT_SESSION_COLLECTION, String(chatId))); } catch (e) {}
}

function extractQuestionId(replyText = '') {
  const text = String(replyText || '');
  const match = text.match(/\bID:\s*([A-Za-z0-9_-]{8,80})/i);
  return match ? match[1] : '';
}

async function sendTelegram(chatId, text, replyToMessageId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;
  await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_to_message_id: replyToMessageId,
      allow_sending_without_reply: true,
    }),
  }).catch(() => null);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram webhook endpoint is live.' });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).json({ ok: false, error: 'Invalid Telegram webhook secret' });
  }

  try {
    const update = jsonBody(req);
    const message = update.message || update.edited_message;
    if (!message) return res.status(200).json({ ok: true, ignored: 'no message' });

    const chatId = message.chat?.id;
    const allowedChatId = String(process.env.TELEGRAM_CHAT_ID || '');
    if (allowedChatId && String(chatId) !== allowedChatId) {
      return res.status(200).json({ ok: true, ignored: 'wrong chat' });
    }

    const text = String(message.text || message.caption || '').trim();
    if (!text) return res.status(200).json({ ok: true, ignored: 'empty' });

    // If /edit was started, the next normal message becomes the edited question text.
    const pending = await getEditSession(chatId);
    const pendingQuestionId = pending?.fields?.questionId?.stringValue;
    if (pendingQuestionId && !text.startsWith('/')) {
      await editQuestionText(pendingQuestionId, text);
      await clearEditSession(chatId);
      await sendTelegram(chatId, `Edited question <code>${escapeHtml(pendingQuestionId)}</code>. Refresh the website question box.`, message.message_id);
      return res.status(200).json({ ok: true, edited: pendingQuestionId });
    }

    const originalText = message.reply_to_message?.text || message.reply_to_message?.caption || '';
    const questionId = extractQuestionId(originalText);
    const command = text.split(/\s+/)[0].toLowerCase();

    if (text.startsWith('/')) {
      if (!questionId) {
        await sendTelegram(chatId, 'Reply to a question message that contains an ID line, then use /delete, /dismiss, or /edit.', message.message_id);
        return res.status(200).json({ ok: true, ignored: 'command missing question id' });
      }

      if (command === '/delete') {
        await deleteQuestion(questionId);
        await sendTelegram(chatId, `Deleted question <code>${escapeHtml(questionId)}</code>.`, message.message_id);
        return res.status(200).json({ ok: true, deleted: questionId });
      }

      if (command === '/dismiss') {
        await dismissQuestion(questionId);
        await sendTelegram(chatId, `Dismissed question <code>${escapeHtml(questionId)}</code>.`, message.message_id);
        return res.status(200).json({ ok: true, dismissed: questionId });
      }

      if (command === '/edit') {
        await saveEditSession(chatId, questionId);
        await sendTelegram(chatId, `Send the edited question text now for <code>${escapeHtml(questionId)}</code>.`, message.message_id);
        return res.status(200).json({ ok: true, editMode: questionId });
      }

      return res.status(200).json({ ok: true, ignored: 'unknown command' });
    }

    if (!questionId) {
      await sendTelegram(chatId, 'Could not find the question ID. Reply to the bot message that contains an ID line.', message.message_id);
      return res.status(200).json({ ok: true, ignored: 'missing question id' });
    }

    await answerQuestion(questionId, text);
    await sendTelegram(chatId, `Saved answer for <code>${escapeHtml(questionId)}</code>. Refresh the website question box to see it.`, message.message_id);
    return res.status(200).json({ ok: true, answered: questionId });
  } catch (error) {
    console.error('Telegram webhook failed:', error);
    return res.status(200).json({ ok: false, error: error.message || 'Webhook failed' });
  }
};
