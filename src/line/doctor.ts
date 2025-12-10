import { Router, Request, Response } from "express";
import { listSessions, getSession, archiveSession } from "../core/stateStore";
import { buildDoctorSummary } from "../core/summary";

function basicAuth(req: Request, res: Response, next: Function) {
  const u = process.env.DOCTOR_USERNAME || "doctor";
  const p = process.env.DOCTOR_PASSWORD || "changeme";
  const hdr = req.headers.authorization || "";
  if (!hdr.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"Doctor Dashboard\"");
    return res.status(401).send("Auth required");
  }
  const raw = Buffer.from(hdr.slice(6), "base64").toString();
  const [user, pass] = raw.split(":");
  if (user === u && pass === p) return next();
  return res.status(401).send("Invalid credentials");
}

export const doctorRouter = Router();
doctorRouter.use(basicAuth);

// 醫師介面：/doctor
doctorRouter.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AI 預診 - 醫師端 Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    :root { --bg-soft:#f3f4f6; --border-soft:#e5e7eb; --accent:#2563eb; }
    body { padding: 1rem; background: var(--bg-soft); }
    main { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: .25rem; }
    .subtitle { font-size: .9rem; color: #6b7280; margin-bottom: 1rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 1rem; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
    }
    .card {
      background: #fff;
      border-radius: .8rem;
      border: 1px solid var(--border-soft);
      padding: .75rem .9rem;
      box-shadow: 0 10px 25px rgba(15,23,42,0.05);
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .card h2 {
      font-size: 1rem;
      margin-bottom: .2rem;
    }
    .card small {
      color: #6b7280;
      font-size: .75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: .15rem .55rem;
      font-size: .7rem;
      background: #e5e7eb;
      color: #374151;
      margin-left: .4rem;
    }
    .list {
      margin-top: .5rem;
      border-radius: .6rem;
      border: 1px solid var(--border-soft);
      overflow: hidden;
      max-height: calc(100vh - 210px);
      background: #f9fafb;
    }
    .list table {
      margin: 0;
      font-size: .8rem;
    }
    .list thead {
      background: #f3f4f6;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .list tbody tr {
      cursor: pointer;
    }
    .list tbody tr:hover {
      background: #e5f0ff;
    }
    .list tbody tr.active {
      background: #dbeafe;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0 .45rem;
      font-size: .7rem;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .pill.state-END {
      background: #dcfce7;
      border-color: #bbf7d0;
      color: #166534;
    }
    .pill.state-RAPPORT,
    .pill.state-CC {
      background: #fee2e2;
      border-color: #fecaca;
      color: #b91c1c;
    }
    .pill.state-HPI_ONSET,
    .pill.state-HPI_TRIGGER_RELIEF,
    .pill.state-HPI_QUALITY_SITE,
    .pill.state-HPI_SEVERITY,
    .pill.state-HPI_ASSOC,
    .pill.state-ROS,
    .pill.state-PMH,
    .pill.state-MEDS_ALLERGY,
    .pill.state-FH_SH {
      background: #fef9c3;
      border-color: #fef08a;
      color: #92400e;
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: .5rem;
      margin-top: .25rem;
      margin-bottom: .35rem;
      flex-wrap: wrap;
    }
    .detail-main {
      flex: 1;
      border-radius: .6rem;
      border: 1px solid var(--border-soft);
      background: #f9fafb;
      padding: .6rem .7rem;
      font-size: .8rem;
      line-height: 1.5;
      overflow-y: auto;
      max-height: calc(100vh - 230px);
      white-space: pre-wrap;
    }
    .detail-main pre {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: .8rem;
    }
    .status-bar {
      font-size: .75rem;
      color: #6b7280;
      margin-top: .25rem;
    }
    .status-bar span + span {
      margin-left: .75rem;
    }
    .status-ok { color: #16a34a; }
    .status-error { color: #dc2626; }
    .btn-ghost {
      background: transparent;
      border-radius: 999px;
      border: 1px solid var(--border-soft);
      font-size: .75rem;
      padding: .25rem .7rem;
      cursor: pointer;
    }
    .btn-ghost:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .btn-danger {
      background: #ef4444;
      border-radius: 999px;
      border: none;
      color: #fff;
      font-size: .75rem;
      padding: .25rem .8rem;
      cursor: pointer;
    }
    .btn-danger[disabled] {
      opacity: .5;
      cursor: default;
    }
  </style>
</head>
<body>
<main>
  <header>
    <h1>🩺 AI 預診 - 醫師端 Dashboard</h1>
    <div class="subtitle">
      左側為目前未封存的病例，右側為 AI 整理的重點摘要。
      <span class="badge">每 10 秒自動更新</span>
    </div>
  </header>

  <section class="layout">
    <!-- 左側：病例列表 -->
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
        <div>
          <h2>病例列表</h2>
          <small>顯示目前仍在記錄中的會話（未 Archive）</small>
        </div>
        <button class="btn-ghost" type="button" onclick="reloadNow()">手動重新整理</button>
      </div>
      <div class="list">
        <table role="grid">
          <thead>
            <tr>
              <th style="width:40%;">患者 ID</th>
              <th style="width:20%;">狀態</th>
              <th style="width:40%;">最後更新</th>
            </tr>
          </thead>
          <tbody id="rows">
            <tr><td colspan="3">載入中…</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 右側：單一病例摘要 -->
    <section class="card">
      <div class="detail-header">
        <div>
          <h2>AI 問診摘要（給醫師）</h2>
          <small id="detail-meta">尚未選擇病例</small>
        </div>
        <div>
          <button id="archive-btn" class="btn-danger" type="button" disabled onclick="archiveSelected()">封存此病例</button>
        </div>
      </div>
      <div class="detail-main" id="detail-pane">
        尚未選擇病例。請在左側列表點選一位病人。
      </div>
      <div class="status-bar" id="status-bar">
        <span>狀態：尚未載入</span>
      </div>
    </section>
  </section>
</main>

<script>
  let sessions = [];
  let selectedUserId = null;
  let pollingTimer = null;

  function setStatus(text, isError) {
    const el = document.getElementById('status-bar');
    el.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = '狀態：' + text;
    span.className = isError ? 'status-error' : 'status-ok';
    el.appendChild(span);
  }

  function renderList() {
    const tbody = document.getElementById('rows');
    if (!sessions.length) {
      tbody.innerHTML = '<tr><td colspan="3">目前沒有進行中的病例</td></tr>';
      document.getElementById('detail-pane').textContent = '目前沒有病例可顯示。';
      document.getElementById('detail-meta').textContent = '尚未選擇病例';
      document.getElementById('archive-btn').disabled = true;
      return;
    }
    const rows = sessions.map(item => {
      const cls = item.userId === selectedUserId ? 'active' : '';
      const statePill = '<span class="pill state-' + (item.state || 'UNKNOWN') + '">' + (item.state || 'UNKNOWN') + '</span>';
      const updated = item.updatedAt || '';
      return '<tr class="' + cls + '" data-user-id="' + item.userId + '">'
           + '<td><strong>' + item.userId + '</strong></td>'
           + '<td>' + statePill + '</td>'
           + '<td>' + updated + '</td>'
           + '</tr>';
    }).join('');
    tbody.innerHTML = rows;

    Array.from(tbody.querySelectorAll('tr[data-user-id]')).forEach(tr => {
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-user-id');
        selectUser(id);
      });
    });
  }

  function renderDetail() {
    const pane = document.getElementById('detail-pane');
    const meta = document.getElementById('detail-meta');
    const btn = document.getElementById('archive-btn');

    if (!selectedUserId) {
      pane.textContent = '尚未選擇病例。請在左側列表點選一位病人。';
      meta.textContent = '尚未選擇病例';
      btn.disabled = true;
      return;
    }
    const item = sessions.find(s => s.userId === selectedUserId);
    if (!item) {
      pane.textContent = '找不到對應的病例資料。可能已被封存或過期。';
      meta.textContent = '尚未選擇病例';
      btn.disabled = true;
      return;
    }

    const infoLine = '患者 ID：' + item.userId + '｜狀態：' + (item.state || 'UNKNOWN') + (item.updatedAt ? '｜最後更新：' + item.updatedAt : '');
    meta.textContent = infoLine;

    const pre = document.createElement('pre');
    pre.textContent = item.summary || '(尚無摘要內容)';
    pane.innerHTML = '';
    pane.appendChild(pre);

    btn.disabled = false;
  }

  function selectUser(userId) {
    selectedUserId = userId;
    renderList();
    renderDetail();
  }

  async function loadSessions() {
    try {
      const resp = await fetch('/doctor/api/summaries');
      if (!resp.ok) {
        if (resp.status === 401) {
          document.getElementById('rows').innerHTML = '<tr><td colspan="3">驗證失敗，請重新整理並輸入帳號密碼。</td></tr>';
          setStatus('驗證失敗（HTTP 401）', true);
          return;
        }
        throw new Error('HTTP ' + resp.status);
      }
      const data = await resp.json();
      sessions = Array.isArray(data) ? data : [];
      if (sessions.length && !selectedUserId) {
        selectedUserId = sessions[0].userId;
      }
      if (selectedUserId && !sessions.find(s => s.userId === selectedUserId) && sessions.length) {
        selectedUserId = sessions[0].userId;
      }
      renderList();
      renderDetail();
      setStatus('已載入 ' + sessions.length + ' 筆病例', false);
    } catch (e) {
      console.error(e);
      document.getElementById('rows').innerHTML = '<tr><td colspan="3">無法載入病例列表。</td></tr>';
      setStatus('載入失敗，請稍後重試', true);
    }
  }

  async function archiveSelected() {
    if (!selectedUserId) return;
    if (!confirm('確定要封存這位患者的紀錄嗎？')) return;
    try {
      const resp = await fetch('/doctor/api/archive/' + encodeURIComponent(selectedUserId), { method: 'POST' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      setStatus('封存成功，重新載入中…', false);
      selectedUserId = null;
      await loadSessions();
    } catch (e) {
      console.error(e);
      alert('封存失敗，請稍後重試');
      setStatus('封存失敗', true);
    }
  }

  function reloadNow() {
    loadSessions();
  }

  // init
  loadSessions();
  pollingTimer = setInterval(loadSessions, 10000);
</script>
</body>
</html>`);
});

// 給醫師端的 summaries API
doctorRouter.get("/api/summaries", async (_req: Request, res: Response) => {
  const ids = await listSessions();
  const items: any[] = [];
  for (const userId of ids) {
    const s = await getSession(userId);
    if (!s || Object.keys(s).length === 0) continue;
    const summary = buildDoctorSummary(userId, s);
    items.push({
      userId,
      state: s.state || "RAPPORT",
      updatedAt: new Date().toLocaleString(),
      summary,
    });
  }
  res.json(items);
});

// 封存病例
doctorRouter.post("/api/archive/:userId", async (req: Request, res: Response) => {
  await archiveSession(req.params.userId);
  res.json({ ok: true });
});
