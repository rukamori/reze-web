import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { cn } from "../utils/cn";
import {
  ADMIN_EMAIL, AMA_COLLECTION, AMA_KEYS, FIREBASE, FORMSPREE_ENDPOINT, SEED_QUESTIONS,
} from "../lib/data";
import { ArrowRight, Check, ChevronUp, RefreshCw, X } from "lucide-react";
import { MonoTag, SectionHead, StatusDot } from "./ui";
import { Reveal } from "./Reveal";
import { BurstLines, GiantType, Halftone } from "./AnimeFx";

/* ══════════════════════════════════════════════════════════════════════
   ASK / AMA — ported 1:1 from the previous build:
   Firestore REST · anonymous public auth · /api/ama-vote with direct
   PATCH fallback · /api/telegram notify · Formspree email fallback ·
   10/day rate limit · owner login with answer / edit / dismiss / delete.
   localStorage keys unchanged, so existing sessions + votes carry over.
   ══════════════════════════════════════════════════════════════════════ */

type AmaQ = {
  id: string; name: string; question: string; answer: string;
  answered: boolean; dismissed: boolean; votes: number;
  createdAt: string; answeredAt: string;
};
type Owner = { email: string; idToken: string; refreshToken: string; expiresAt: number };
type Pending = AmaQ & { telegramNotified?: boolean; emailNotified?: boolean };

const base = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;
const docUrl = (id: string) => `${base()}/${AMA_COLLECTION}/${encodeURIComponent(id)}`;
const colUrl = () => `${base()}/${AMA_COLLECTION}`;
const queryUrl = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents:runQuery`;

async function jfetch(url: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, opts);
  const txt = await res.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}
const nowISO = () => new Date().toISOString();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "q_" + Date.now() + "_" + Math.random().toString(16).slice(2));
function timeAgo(iso: string | number) {
  const t = typeof iso === "number" ? iso : new Date(iso || Date.now()).getTime();
  const d = Math.max(0, Date.now() - t);
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), day = Math.floor(h / 24);
  return day ? day + "d ago" : h ? h + "h ago" : m ? m + "m ago" : "now";
}
function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }
function lsDel(key: string) { try { localStorage.removeItem(key); } catch { /* */ } }

function toFields(q: AmaQ) {
  return { fields: {
    id: { stringValue: q.id },
    name: { stringValue: q.name },
    question: { stringValue: q.question },
    answer: { stringValue: q.answer || "" },
    answered: { booleanValue: !!q.answered },
    dismissed: { booleanValue: !!q.dismissed },
    votes: { integerValue: String(Number(q.votes || 0)) },
    createdAt: { stringValue: q.createdAt || nowISO() },
    answeredAt: q.answeredAt ? { stringValue: q.answeredAt } : { nullValue: null },
  } };
}
function fromDoc(doc: any): AmaQ {
  const f = doc.fields || {};
  return {
    id: (f.id && f.id.stringValue) || (doc.name ? doc.name.split("/").pop() : ""),
    name: f.name?.stringValue || "Anonymous",
    question: f.question?.stringValue || "",
    answer: f.answer?.stringValue || "",
    answered: !!f.answered?.booleanValue,
    dismissed: !!f.dismissed?.booleanValue,
    votes: Number(f.votes?.integerValue || f.votes?.doubleValue || 0),
    createdAt: f.createdAt?.stringValue || "",
    answeredAt: f.answeredAt?.stringValue || "",
  };
}

/* ---------- auth ---------- */
const ownerAuth = (): Owner | null => lsGet<Owner | null>(AMA_KEYS.ownerAuth, null);
const setOwnerAuth = (a: Owner | null) => (a ? lsSet(AMA_KEYS.ownerAuth, a) : lsDel(AMA_KEYS.ownerAuth));

async function publicToken(): Promise<string> {
  const stored = lsGet<{ idToken: string; refreshToken: string; expiresAt: number } | null>(AMA_KEYS.publicAuth, null);
  if (stored?.idToken && stored.expiresAt && Date.now() < stored.expiresAt - 60000) return stored.idToken;
  const data = await jfetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FIREBASE.apiKey, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const next = { idToken: data.idToken, refreshToken: data.refreshToken, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 };
  lsSet(AMA_KEYS.publicAuth, next);
  return next.idToken;
}
async function refreshTokenIfNeeded(): Promise<string> {
  const a = ownerAuth();
  if (!a?.refreshToken) throw new Error("Login again.");
  if (a.expiresAt && Date.now() < a.expiresAt - 60000) return a.idToken;
  const data = await jfetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: a.refreshToken }).toString(),
  });
  setOwnerAuth({ ...a, idToken: data.id_token, refreshToken: data.refresh_token || a.refreshToken, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 });
  return data.id_token;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const a = ownerAuth();
    if (a?.idToken && a.email === ADMIN_EMAIL) headers.Authorization = "Bearer " + (await refreshTokenIfNeeded());
    else headers.Authorization = "Bearer " + (await publicToken());
  } catch { /* anonymous */ }
  return headers;
}

/* ---------- notify + queue ---------- */
async function writeQuestion(q: AmaQ) {
  await jfetch(docUrl(q.id), { method: "PATCH", headers: await authHeaders(), body: JSON.stringify(toFields(q)) });
}
function notifyTelegram(q: AmaQ) {
  return fetch("/api/telegram", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: q.name, question: q.question, id: q.id, createdAt: q.createdAt }),
  }).then((res) => { if (!res.ok) throw new Error("Telegram HTTP " + res.status); return res; });
}
function notifyFormspree(q: AmaQ) {
  return fetch(FORMSPREE_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      _subject: "New AMA question from " + q.name, email: ADMIN_EMAIL, name: q.name, question: q.question,
      message: `New question on your website\n\nFrom: ${q.name}\nQuestion: ${q.question}`,
    }),
  }).then((res) => { if (!res.ok) throw new Error("Formspree HTTP " + res.status); return res; });
}
let flushInProgress = false;
async function flushQueue(): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;
  try {
    let queue = lsGet<Pending[]>(AMA_KEYS.queue, []);
    if (!queue.length) return;
    const seen = new Set<string>();
    queue = queue.filter((item) => { if (!item?.id || seen.has(item.id)) return false; seen.add(item.id); return true; });
    const remaining: Pending[] = [];
    for (const item of queue) {
      const next = { ...item };
      let keepQueued = false;
      if (!next.telegramNotified) {
        next.telegramNotified = true;
        lsSet(AMA_KEYS.queue, queue.map((x) => (x.id === next.id ? next : x)));
        try { await notifyTelegram(next); } catch { next.telegramNotified = false; keepQueued = true; }
      }
      if (!next.emailNotified) {
        try { await notifyFormspree(next); next.emailNotified = true; } catch { /* retry later */ }
      }
      try { await writeQuestion(next); } catch { keepQueued = true; }
      if (keepQueued) remaining.push(next);
    }
    lsSet(AMA_KEYS.queue, remaining);
  } finally {
    flushInProgress = false;
  }
}

async function syncVote(id: string, delta: number, optimistic: number): Promise<number> {
  try {
    const res = await fetch("/api/ama-vote", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id, delta }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || typeof data?.votes === "undefined") throw new Error(data?.error || "Vote API HTTP " + res.status);
    return Number(data.votes || 0);
  } catch {
    await jfetch(docUrl(id) + "?updateMask.fieldPaths=votes", {
      method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ fields: { votes: { integerValue: String(optimistic) } } }),
    });
    return optimistic;
  }
}

/* ---------- sorting + pagination ---------- */
type Sort = "top" | "recent" | "oldest";
const SORTS: { key: Sort; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "recent", label: "Recent" },
  { key: "oldest", label: "Oldest" },
];
const stamp = (q: AmaQ) => new Date(q.answeredAt || q.createdAt || 0).getTime();
function sortItems(items: AmaQ[], sort: Sort) {
  const arr = [...items];
  if (sort === "oldest") arr.sort((a, b) => stamp(a) - stamp(b));
  else if (sort === "recent") arr.sort((a, b) => stamp(b) - stamp(a));
  else arr.sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0) || stamp(b) - stamp(a));
  return arr;
}
const todayKey = () => "ama_count_" + new Date().toISOString().slice(0, 10);
const getUsed = () => { try { return Number(localStorage.getItem(todayKey()) || "0"); } catch { return 0; } }

/* ================= Owner console ================= */

function OwnerConsole({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [auth, setAuth] = useState<Owner | null>(() => ownerAuth());
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<AmaQ[] | null>(null);
  const [filter, setFilter] = useState<"unanswered" | "dismissed" | "answered">("unanswered");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "dismiss" | "delete" } | null>(null);
  const isOwner = !!(auth?.idToken && auth.email === ADMIN_EMAIL);

  const state = (q: AmaQ) => (q.answered || (q.answer || "").trim() ? "answered" : q.dismissed ? "dismissed" : "unanswered");
  const counts = useMemo(() => {
    const c = { answered: 0, dismissed: 0, unanswered: 0 };
    (items || []).forEach((q) => { c[state(q) as keyof typeof c]++; });
    return c;
  }, [items]);
  const visible = useMemo(() => (items || []).filter((q) => state(q) === filter), [items, filter]);

  const load = useCallback(async () => {
    setStatus("Loading questions…"); setErr(false);
    try {
      const token = await refreshTokenIfNeeded();
      const data = await jfetch(colUrl() + "?pageSize=200", { headers: { Authorization: "Bearer " + token } });
      const list: AmaQ[] = (data.documents || []).map(fromDoc).filter((q: AmaQ) => q.question);
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(list);
      setStatus(list.length ? `${list.length} question${list.length === 1 ? "" : "s"} loaded.` : "No questions in Firestore yet.");
      onChanged();
    } catch (e) {
      setStatus((e as Error).message || "Could not load questions.");
      setErr(true);
    }
  }, [onChanged]);

  async function login(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || !pass) { setStatus("Enter email and password."); setErr(true); return; }
    setBusy(true);
    try {
      const data = await jfetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE.apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass, returnSecureToken: true }),
      });
      if (data.email !== ADMIN_EMAIL) throw new Error("Wrong account.");
      const next = { email: data.email, idToken: data.idToken, refreshToken: data.refreshToken, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 };
      setOwnerAuth(next); setAuth(next); setStatus(""); setErr(false);
    } catch (e2) {
      setStatus((e2 as Error).message || "Login failed."); setErr(true);
    } finally { setBusy(false); }
  }

  async function saveAnswer(q: AmaQ, answer: string) {
    const trimmed = answer.trim();
    if (!trimmed) { setStatus("Write an answer first."); setErr(true); return; }
    setBusy(true);
    try {
      const token = await refreshTokenIfNeeded();
      const savedAt = nowISO();
      await jfetch(docUrl(q.id) + "?updateMask.fieldPaths=answer&updateMask.fieldPaths=answered&updateMask.fieldPaths=answeredAt&updateMask.fieldPaths=dismissed", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ fields: { answer: { stringValue: trimmed.slice(0, 1000) }, answered: { booleanValue: true }, answeredAt: { stringValue: savedAt }, dismissed: { booleanValue: false } } }),
      });
      setItems((prev) => (prev ? prev.map((x) => (x.id === q.id ? { ...x, answer: trimmed.slice(0, 1000), answered: true, dismissed: false, answeredAt: savedAt } : x)) : prev));
      setEditing(null); setDrafts((d) => ({ ...d, [q.id]: "" }));
      setStatus("Answer saved."); setErr(false);
      onChanged();
    } catch (e2) { setStatus((e2 as Error).message || "Could not save answer."); setErr(true); }
    finally { setBusy(false); }
  }
  async function dismiss(q: AmaQ) {
    setBusy(true);
    try {
      const token = await refreshTokenIfNeeded();
      await jfetch(docUrl(q.id) + "?updateMask.fieldPaths=dismissed&updateMask.fieldPaths=answered", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ fields: { dismissed: { booleanValue: true }, answered: { booleanValue: false } } }),
      });
      setItems((prev) => (prev ? prev.map((x) => (x.id === q.id ? { ...x, dismissed: true, answered: false } : x)) : prev));
      setStatus("Question dismissed."); setErr(false);
    } catch (e2) { setStatus((e2 as Error).message || "Could not dismiss."); setErr(true); }
    finally { setBusy(false); setConfirm(null); }
  }
  async function remove(q: AmaQ) {
    setBusy(true);
    try {
      const token = await refreshTokenIfNeeded();
      await jfetch(docUrl(q.id), { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      setItems((prev) => (prev || []).filter((x) => x.id !== q.id));
      setStatus("Question deleted."); setErr(false);
      onChanged();
    } catch (e2) { setStatus((e2 as Error).message || "Could not delete question."); setErr(true); }
    finally { setBusy(false); setConfirm(null); }
  }

  useEffect(() => { if (isOwner) void load(); }, [isOwner, load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#14130f8c] p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="AMA owner console">
      <div className="m-settle flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[var(--radius-lg)] border border-ink bg-composer shadow-[var(--shadow-ink)] sm:rounded-[var(--radius-lg)]">
        <div className="flex items-center justify-between border-b border-rule px-5 py-2 sm:px-7">
          <div className="flex items-center gap-2.5">
            <StatusDot tone="vermilion" label={<><span className="text-vermilion-ink">$</span> ama, owner console</>} />
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
              <button onClick={() => { setOwnerAuth(null); setAuth(null); setItems(null); }} className="min-h-11 rounded-full px-3 font-mono text-xs text-ink-soft transition-colors duration-[var(--dur-2)] hover:text-vermilion-ink">
                Log out
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close owner console" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-2)] hover:bg-[#14130f0d] hover:text-ink">
              <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
          {!isOwner ? (
            <form onSubmit={login} className="mx-auto flex max-w-sm flex-col gap-4 py-6">
              <div>
                <label htmlFor="owner-email" className="mb-1.5 block text-sm font-medium text-ink">Owner email</label>
                <input id="owner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"
                  className="min-h-11 w-full rounded-[var(--radius-sm)] border border-rule-strong bg-paper px-4 py-2.5 font-mono text-[16px] text-ink placeholder:text-graphite focus:border-ink" />
              </div>
              <div>
                <label htmlFor="owner-pass" className="mb-1.5 block text-sm font-medium text-ink">Password</label>
                <input id="owner-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password"
                  className="min-h-11 w-full rounded-[var(--radius-sm)] border border-rule-strong bg-paper px-4 py-2.5 font-mono text-[16px] text-ink focus:border-ink" />
              </div>
              <button type="submit" disabled={busy}
                className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-medium text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft disabled:opacity-50">
                {busy ? "…" : "Log in"}
              </button>
              {status && <MonoTag className={cn("text-center", err ? "text-vermilion-ink" : "text-ink-soft")}>{status}</MonoTag>}
              <MonoTag className="text-center text-graphite">Reze only · answer, edit, dismiss, delete</MonoTag>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(["unanswered", "dismissed", "answered"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
                    className={cn(
                      "min-h-11 rounded-full border px-3.5 font-mono text-xs capitalize transition-colors duration-[var(--dur-2)]",
                      filter === k ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
                    )}>
                    {k} <span className="tabular opacity-70">{counts[k]}</span>
                  </button>
                ))}
                <button type="button" onClick={() => void load()} aria-label="Refresh"
                  className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink-soft transition-colors duration-[var(--dur-2)] hover:border-ink hover:text-ink">
                  <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              {status && <MonoTag className={cn("mt-3 block", err ? "text-vermilion-ink" : "text-ink-soft")}>{status}</MonoTag>}

              <ul className="mt-4 space-y-4">
                {items === null && <li className="py-8 text-center"><MonoTag className="text-graphite">Loading the queue…</MonoTag></li>}
                {items !== null && visible.length === 0 && (
                  <li className="py-8 text-center"><MonoTag className="text-graphite">Nothing in “{filter}”</MonoTag></li>
                )}
                {visible.map((q) => (
                  <li key={q.id} className="rounded-[var(--radius-md)] border border-rule bg-card p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <MonoTag className="text-ink-soft">from: {q.name}</MonoTag>
                      <MonoTag className="ml-auto text-graphite tabular">{q.votes} votes · {timeAgo(q.createdAt)}</MonoTag>
                    </div>
                    <p className="mt-2 break-words text-md text-ink">{q.question}</p>
                    {q.answer && (
                      <p className="mt-1.5 break-words text-md text-ink-soft">
                        <span className="mr-1.5 font-mono text-xs text-moss-ink">A</span>{q.answer}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
                      {filter !== "answered" && editing !== q.id && (
                        <button onClick={() => { setEditing(q.id); setDrafts((d) => ({ ...d, [q.id]: q.answer || "" })); }}
                          className="min-h-11 rounded-full bg-ink px-3.5 font-mono text-xs text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft">
                          {q.answer ? "Edit answer" : "Answer"}
                        </button>
                      )}
                      {confirm?.id === q.id ? (
                        <>
                          <MonoTag className="text-vermilion-ink">{confirm.kind === "delete" ? "Delete for real?" : "Dismiss?"}</MonoTag>
                          <button onClick={() => (confirm.kind === "delete" ? remove(q) : dismiss(q))} disabled={busy}
                            className="min-h-11 rounded-full bg-vermilion px-3.5 font-mono text-xs text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep">
                            Yes
                          </button>
                          <button onClick={() => setConfirm(null)} className="min-h-11 rounded-full border border-rule-strong px-3.5 font-mono text-xs text-ink-soft hover:border-ink hover:text-ink">
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          {filter !== "dismissed" && (
                            <button onClick={() => setConfirm({ id: q.id, kind: "dismiss" })}
                              className="min-h-11 rounded-full border border-rule-strong px-3.5 font-mono text-xs text-ink-soft transition-colors duration-[var(--dur-2)] hover:border-ink hover:text-ink">
                              Dismiss
                            </button>
                          )}
                          <button onClick={() => setConfirm({ id: q.id, kind: "delete" })}
                            className="min-h-11 rounded-full border border-vermilion-ink px-3.5 font-mono text-xs text-vermilion-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-wash">
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {editing === q.id && (
                      <div className="m-swap mt-3">
                        <label htmlFor={`answer-${q.id}`} className="mb-1.5 block text-sm font-medium text-ink">Your answer</label>
                        <textarea
                          id={`answer-${q.id}`}
                          value={drafts[q.id] ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                          rows={3} maxLength={1000} placeholder="Write the reply…"
                          className="w-full resize-none rounded-[var(--radius-sm)] border border-rule-strong bg-paper px-3 py-2.5 text-[16px] text-ink placeholder:text-graphite focus:border-ink"
                        />
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => saveAnswer(q, drafts[q.id] ?? "")} disabled={busy}
                            className="min-h-11 rounded-full bg-ink px-3.5 font-mono text-xs text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft disabled:opacity-50">
                            Save answer
                          </button>
                          <button onClick={() => setEditing(null)} className="min-h-11 rounded-full border border-rule-strong px-3.5 font-mono text-xs text-ink-soft hover:border-ink hover:text-ink">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Public section ================= */

export function Ask() {
  const [items, setItems] = useState<AmaQ[]>([]);
  const [pending, setPending] = useState<AmaQ[]>(() => lsGet<Pending[]>(AMA_KEYS.queue, []).map((q) => ({ ...q, answered: false, dismissed: false })));
  const [voted, setVoted] = useState<string[]>(() => lsGet<string[]>(AMA_KEYS.voted, []));
  const [sort, setSort] = useState<Sort>(() => lsGet<Sort>(AMA_KEYS.sort, "top"));
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [page, setPage] = useState(1);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const PAGE = 4;

  const reload = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const data = await jfetch(queryUrl(), {
        method: "POST", headers,
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: AMA_COLLECTION }], orderBy: { field: { fieldPath: "createdAt" }, direction: "DESCENDING" }, limit: 100 } }),
      });
      const list = (Array.isArray(data) ? data : []).filter((d: any) => d.document).map((d: any) => fromDoc(d.document));
      setItems(list.filter((q: AmaQ) => q.question && q.answered && !q.dismissed));
    } catch {
      setItems(SEED_QUESTIONS.map((s) => ({
        id: s.id, name: s.author, question: s.text, answer: "", answered: true, dismissed: false,
        votes: s.votes, createdAt: new Date(s.ts).toISOString(), answeredAt: new Date(s.ts).toISOString(),
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); void flushQueue(); }, [reload]);
  useEffect(() => { lsSet(AMA_KEYS.sort, sort); setPage(1); }, [sort]);
  useEffect(() => { lsSet(AMA_KEYS.voted, voted); }, [voted]);

  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);
  const shown = sorted.slice(0, page * PAGE);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    if (getUsed() >= 10) { setStatus({ kind: "err", msg: "Daily limit reached (10). Come back tomorrow." }); return; }
    const doc: Pending = {
      id: uuid(), name: name.trim() || "anon", question: q, answer: "", answered: false, dismissed: false,
      votes: 0, createdAt: nowISO(), answeredAt: "",
    };
    localStorage.setItem(todayKey(), String(getUsed() + 1));
    const queue = [...lsGet<Pending[]>(AMA_KEYS.queue, []), doc];
    lsSet(AMA_KEYS.queue, queue);
    setPending((p) => [doc, ...p]);
    setText("");
    setStatus({ kind: "ok", msg: "Transmitted — queued for the wire." });
    setTimeout(() => setStatus(null), 2200);
    void flushQueue().then(reload);
  };

  const vote = async (id: string, current: number) => {
    if (voted.includes(id)) return;
    setVoted((v) => [...v, id]);
    setItems((prev) => prev.map((q) => (q.id === id ? { ...q, votes: current + 1 } : q)));
    try { await syncVote(id, 1, current + 1); } catch { /* optimistic */ }
  };

  return (
    <section id="ask" aria-labelledby="ask-title" className="relative overflow-clip border-t border-rule">
      <GiantType text="ROOT" reverse className="bottom-0" />
      <BurstLines className="bottom-10" />
      <div className="page relative py-24 lg:py-32">
        <Halftone className="top-16 right-0 left-0 h-44" />
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          {/* Composer */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <SectionHead
                num="06"
                label="Ask"
                title={<span id="ask-title">Ask me <em className="ital">anything</em>.</span>}
                lede="Root, ROMs, anime, whatever. Questions land in Firestore and ping my Telegram; answers show up here once I've replied. Ten per visitor per day."
              />
              <button
                onClick={() => setOwnerOpen(true)}
                className="min-h-11 shrink-0 rounded-full border border-rule-strong px-4 font-mono text-xs text-ink-soft transition-colors duration-[var(--dur-2)] hover:border-ink hover:text-ink"
              >
                Owner
              </button>
            </div>

            <Reveal delay={80}>
              <form onSubmit={submit} className="mt-10 rounded-[var(--radius-lg)] border border-ink bg-composer shadow-[var(--shadow-ink)]">
                <div className="flex items-center gap-2.5 border-b border-rule px-5 py-3">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-vermilion" />
                  <span className="kicker text-ink-soft">New question</span>
                </div>
                <div className="flex flex-col gap-5 px-5 py-5">
                  <div>
                    <label htmlFor="ama-text" className="mb-2 block text-sm font-medium text-ink">Your question</label>
                    <textarea
                      id="ama-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} required maxLength={280}
                      placeholder="Magisk or KernelSU for a fresh install?"
                      className="w-full resize-none rounded-[var(--radius-sm)] border border-rule-strong bg-paper p-4 text-[16px] text-ink placeholder:text-graphite transition-colors duration-[var(--dur-2)] focus:border-ink"
                    />
                  </div>
                  <div>
                    <label htmlFor="ama-name" className="mb-2 block text-sm font-medium text-ink">
                      Name <span className="font-normal text-graphite">(optional)</span>
                    </label>
                    <input
                      id="ama-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                      placeholder="anon"
                      className="min-h-11 w-full rounded-[var(--radius-sm)] border border-rule-strong bg-paper px-4 font-mono text-[16px] text-ink placeholder:text-graphite focus:border-ink"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule px-5 py-3">
                  <MonoTag className="text-graphite tabular">{280 - text.length} characters left</MonoTag>
                  <button type="submit"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-vermilion px-6 text-[15px] font-medium text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep">
                    {status?.kind === "ok" ? (<><Check aria-hidden className="h-4 w-4" strokeWidth={2} />Sent</>) : (<>Send question<ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} /></>)}
                  </button>
                </div>
                <div aria-live="polite" className="px-5 empty:hidden">
                  {status && <p className={cn("pb-4 font-mono text-xs", status.kind === "err" ? "text-vermilion-ink" : "text-moss-ink")}>{status.msg}</p>}
                </div>
              </form>
            </Reveal>
          </div>

          {/* The wire */}
          <Reveal delay={120}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-4">
              <h3 className="font-display text-title font-normal text-ink">
                Answered <span className="font-mono text-xs text-graphite tabular">{String(sorted.length + pending.length).padStart(2, "0")}</span>
              </h3>
              <div className="flex gap-1.5" role="group" aria-label="Sort questions">
                {SORTS.map((s) => (
                  <button key={s.key} onClick={() => setSort(s.key)} aria-pressed={sort === s.key}
                    className={cn(
                      "min-h-11 rounded-full border px-3.5 font-mono text-xs transition-colors duration-[var(--dur-2)]",
                      sort === s.key ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
                    )}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <ul>
              {loading && <li className="py-8 text-center"><MonoTag className="text-graphite">Loading questions…</MonoTag></li>}

              {pending.map((q) => (
                <li key={q.id} className="flex gap-5 border-b border-rule py-6">
                  <span className="flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border border-dashed border-rule-strong text-graphite">
                    <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span className="font-mono text-xs tabular">{q.votes}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-lg text-ink">{q.question}</p>
                    <StatusDot className="mt-2" tone="vermilion" label={<>Queued, awaiting a reply · {q.name}</>} />
                  </div>
                </li>
              ))}

              {!loading && shown.map((q) => {
                const isVoted = voted.includes(q.id);
                return (
                  <li key={q.id} className="flex gap-5 border-b border-rule py-6">
                    <button
                      onClick={() => vote(q.id, q.votes)}
                      aria-label={`Upvote: ${q.question}`} aria-pressed={isVoted}
                      className={cn(
                        "flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border transition-colors duration-[var(--dur-2)]",
                        isVoted ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
                      )}>
                      <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      <span className="font-mono text-xs tabular">{q.votes}</span>
                    </button>
                    <div className="min-w-0">
                      <p className="break-words text-lg text-ink">
                        <span aria-hidden className="mr-2 font-mono text-xs text-graphite">Q</span>{q.question}
                      </p>
                      {q.answer && (
                        <p className="mt-2 break-words text-md text-ink-soft">
                          <span aria-hidden className="mr-2 font-mono text-xs text-moss-ink">A</span>{q.answer}
                        </p>
                      )}
                      <MonoTag className="mt-2 block text-graphite">{timeAgo(q.answeredAt || q.createdAt)} · {q.name}</MonoTag>
                    </div>
                  </li>
                );
              })}

              {sorted.length > shown.length && (
                <li className="pt-6">
                  <button onClick={() => setPage((p) => p + 1)}
                    className="min-h-11 rounded-full border border-rule-strong px-5 text-sm text-ink-soft transition-colors duration-[var(--dur-2)] hover:border-ink hover:text-ink">
                    Load more ({sorted.length - shown.length} older)
                  </button>
                </li>
              )}
            </ul>
          </Reveal>
        </div>
      </div>

      {ownerOpen && <OwnerConsole onClose={() => setOwnerOpen(false)} onChanged={reload} />}
    </section>
  );
}
