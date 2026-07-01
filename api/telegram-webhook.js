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
  return fields.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
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

function fromFirestoreDoc(doc) {
  const f = doc.fields || {};
  return {
    id: f.id?.stringValue || (doc.name ? doc.name.split('/').pop() : ''),
    name: f.name?.stringValue || 'Anonymous',
    question: f.question?.stringValue || '',
    answer: f.answer?.stringValue || '',
    answered: !!f.answered?.booleanValue,
    dismissed: !!f.dismissed?.booleanValue,
    createdAt: f.createdAt?.stringValue || '',
    answeredAt: f.answeredAt?.stringValue || '',
  };
}

function questionState(q) {
  if (q.dismissed) return 'DISMISSED';
  if (q.answered || String(q.answer || '').trim()) return 'ANSWERED';
  return 'UNANSWERED';
}

async function listAllQuestions() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${FIRESTORE_COLLECTION}?pageSize=200`;
  const data = await firestore('GET', url);
  return (data.documents || []).map(fromFirestoreDoc).filter((q) => q.question);
}

async function listQuestionsForRefresh() {
  const items = await listAllQuestions();
  return items
    .filter((q) => questionState(q) === 'UNANSWERED' || questionState(q) === 'DISMISSED')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function listAnsweredQuestions() {
  const items = await listAllQuestions();
  return items
    .filter((q) => questionState(q) === 'ANSWERED')
    .sort((a, b) => new Date(b.answeredAt || b.createdAt || 0) - new Date(a.answeredAt || a.createdAt || 0));
}

function sessionArray(ids = []) {
  return {
    arrayValue: {
      values: ids.map((id) => ({ stringValue: String(id) })),
    },
  };
}

async function patchSession(chatId, fields, fieldMask) {
  const allFields = {
    chatId: { stringValue: String(chatId) },
    updatedAt: { stringValue: new Date().toISOString() },
    ...fields,
  };
  const defaultMask = ['chatId', 'updatedAt', ...Object.keys(fields)];
  const queryMask = mask(fieldMask || defaultMask);
  return firestore('PATCH', `${docPath(EDIT_SESSION_COLLECTION, String(chatId))}?${queryMask}`, { fields: allFields });
}

async function getSession(chatId) {
  try {
    const doc = await firestore('GET', docPath(EDIT_SESSION_COLLECTION, String(chatId)));
    const f = doc.fields || {};
    return {
      pendingQuestionId:
        f.pendingQuestionId?.stringValue ||
        f.questionId?.stringValue ||
        '',
      pendingMode: f.pendingMode?.stringValue || (f.questionId?.stringValue ? 'edit-answer' : ''),
      lastAnsweredIds: (f.lastAnsweredIds?.arrayValue?.values || []).map((v) => v.stringValue).filter(Boolean),
    };
  } catch (e) {
    return { pendingQuestionId: '', pendingMode: '', lastAnsweredIds: [] };
  }
}

async function saveAnsweredListSession(chatId, ids) {
  return patchSession(chatId, { lastAnsweredIds: sessionArray(ids) }, ['chatId', 'updatedAt', 'lastAnsweredIds']);
}

async function startAnswerEditSession(chatId, questionId) {
  return patchSession(chatId, {
    pendingQuestionId: { stringValue: String(questionId) },
    pendingMode: { stringValue: 'edit-answer' },
  }, ['chatId', 'updatedAt', 'pendingQuestionId', 'pendingMode']);
}

async function clearPendingEditSession(chatId) {
  return patchSession(chatId, {
    pendingQuestionId: { nullValue: null },
    pendingMode: { stringValue: '' },
  }, ['chatId', 'updatedAt', 'pendingQuestionId', 'pendingMode']);
}

function extractQuestionId(replyText = '') {
  const text = String(replyText || '');
  const match = text.match(/\bID:\s*([A-Za-z0-9_-]{8,120})/i);
  return match ? match[1] : '';
}

function preview(text = '', max = 72) {
  const compact = String(text).replace(/\s+/g, ' ').trim();
  if (!compact) return '—';
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function normalizedCommand(token = '') {
  return String(token).toLowerCase().split('@')[0];
}

function parseEditNumber(text = '') {
  const match = String(text).trim().match(/^\/edit(?:@\w+)?\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
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

async function sendChunkedLines(chatId, replyToMessageId, title, lines) {
  if (!lines.length) {
    await sendTelegram(chatId, title, replyToMessageId);
    return 1;
  }

  let chunk = `${title}\n\n`;
  let sent = 0;
  for (const line of lines) {
    if ((chunk + line + '\n\n').length > 3600) {
      await sendTelegram(chatId, chunk.trim(), replyToMessageId);
      sent += 1;
      chunk = '';
    }
    chunk += line + '\n\n';
  }
  if (chunk.trim()) {
    await sendTelegram(chatId, chunk.trim(), replyToMessageId);
    sent += 1;
  }
  return sent;
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

    const session = await getSession(chatId);
    if (session.pendingMode === 'edit-answer' && session.pendingQuestionId && !text.startsWith('/')) {
      await answerQuestion(session.pendingQuestionId, text);
      await clearPendingEditSession(chatId);
      await sendTelegram(
        chatId,
        `Edited answer for <code>${escapeHtml(session.pendingQuestionId)}</code>. Refresh the website question box to see it.`,
        message.message_id,
      );
      return res.status(200).json({ ok: true, editedAnswer: session.pendingQuestionId });
    }

    const firstToken = text.split(/\s+/)[0] || '';
    const command = normalizedCommand(firstToken);
    const originalText = message.reply_to_message?.text || message.reply_to_message?.caption || '';
    const repliedQuestionId = extractQuestionId(originalText);

    if (command === '/refresh') {
      const items = await listQuestionsForRefresh();
      if (!items.length) {
        await sendTelegram(chatId, 'No unanswered or dismissed questions right now.', message.message_id);
        return res.status(200).json({ ok: true, refreshCount: 0 });
      }
      const lines = items.map((q, i) => {
        const tag = questionState(q);
        return `${i + 1}. <b>[${tag}]</b> ${escapeHtml(q.name)}\nQ: ${escapeHtml(q.question)}\nID: <code>${escapeHtml(q.id)}</code>`;
      });
      const sent = await sendChunkedLines(chatId, message.message_id, '<b>Current unanswered/dismissed questions</b>', lines);
      return res.status(200).json({ ok: true, refreshCount: items.length, messages: sent });
    }

    if (command === '/listall') {
      const items = await listAnsweredQuestions();
      if (!items.length) {
        await sendTelegram(chatId, 'No answered questions yet.', message.message_id);
        return res.status(200).json({ ok: true, answeredCount: 0 });
      }

      await saveAnsweredListSession(chatId, items.map((q) => q.id));
      const lines = items.map((q, i) => (
        `${i + 1}. <b>${escapeHtml(q.name)}</b>\n` +
        `Q: ${escapeHtml(preview(q.question, 90))}\n` +
        `A: ${escapeHtml(preview(q.answer, 90))}\n` +
        `ID: <code>${escapeHtml(q.id)}</code>`
      ));
      const sent = await sendChunkedLines(
        chatId,
        message.message_id,
        '<b>Answered questions</b>',
        lines,
      );
      return res.status(200).json({ ok: true, answeredCount: items.length, messages: sent });
    }

    if (command === '/edit') {
      const listIndex = parseEditNumber(text);
      if (Number.isInteger(listIndex)) {
        if (!session.lastAnsweredIds.length) {
          await sendTelegram(chatId, 'Use <code>/listall</code> first, then send something like <code>/edit 2</code>.', message.message_id);
          return res.status(200).json({ ok: true, ignored: 'missing answered list session' });
        }
        if (listIndex < 1 || listIndex > session.lastAnsweredIds.length) {
          await sendTelegram(chatId, `That list number is out of range. Send <code>/listall</code> again, then use <code>/edit 1</code> to <code>/edit ${session.lastAnsweredIds.length}</code>.`, message.message_id);
          return res.status(200).json({ ok: true, ignored: 'invalid edit list index' });
        }
        const questionId = session.lastAnsweredIds[listIndex - 1];
        await startAnswerEditSession(chatId, questionId);
        await sendTelegram(chatId, `Send the edited answer text now for question ${listIndex} (<code>${escapeHtml(questionId)}</code>).`, message.message_id);
        return res.status(200).json({ ok: true, editMode: questionId, source: 'list', index: listIndex });
      }

      if (repliedQuestionId) {
        await startAnswerEditSession(chatId, repliedQuestionId);
        await sendTelegram(chatId, `Send the edited answer text now for <code>${escapeHtml(repliedQuestionId)}</code>.`, message.message_id);
        return res.status(200).json({ ok: true, editMode: repliedQuestionId, source: 'reply' });
      }

      await sendTelegram(
        chatId,
        'To edit an answer, either reply to a question message with <code>/edit</code>, or use <code>/listall</code> and then <code>/edit 2</code>.',
        message.message_id,
      );
      return res.status(200).json({ ok: true, ignored: 'edit usage shown' });
    }

    if (text.startsWith('/')) {
      if (!repliedQuestionId) {
        await sendTelegram(
          chatId,
          'Reply to a question message that contains an ID line, then use <code>/delete</code> or <code>/dismiss</code>. For answer edits, use <code>/listall</code> and then <code>/edit 2</code>, or reply with <code>/edit</code>.',
          message.message_id,
        );
        return res.status(200).json({ ok: true, ignored: 'command missing question id' });
      }

      if (command === '/delete') {
        await deleteQuestion(repliedQuestionId);
        await sendTelegram(chatId, `Deleted question <code>${escapeHtml(repliedQuestionId)}</code>. Tap Load questions in the website admin popup to refresh the list.`, message.message_id);
        return res.status(200).json({ ok: true, deleted: repliedQuestionId });
      }

      if (command === '/dismiss') {
        await dismissQuestion(repliedQuestionId);
        await sendTelegram(chatId, `Dismissed question <code>${escapeHtml(repliedQuestionId)}</code>.`, message.message_id);
        return res.status(200).json({ ok: true, dismissed: repliedQuestionId });
      }

      return res.status(200).json({ ok: true, ignored: 'unknown command' });
    }

    if (!repliedQuestionId) {
      await sendTelegram(chatId, 'Could not find the question ID. Reply to the bot question message that contains an ID line.', message.message_id);
      return res.status(200).json({ ok: true, ignored: 'missing question id' });
    }

    await answerQuestion(repliedQuestionId, text);
    await sendTelegram(chatId, `Saved answer for <code>${escapeHtml(repliedQuestionId)}</code>. Refresh the website question box to see it.`, message.message_id);
    return res.status(200).json({ ok: true, answered: repliedQuestionId });
  } catch (error) {
    console.error('Telegram webhook failed:', error);
    return res.status(200).json({ ok: false, error: error.message || 'Webhook failed' });
  }
};
