
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

doctorRouter.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Doctor Dashboard</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
<style>body{padding:1rem}pre{white-space:pre-wrap}.badge{background:#eef;color:#225;padding:.2rem .5rem;border-radius:.4rem;font-size:.8rem}</style>
</head>
<body>
<h2>🩺 Doctor Dashboard</h2>
<p class="badge">Tip: 每 10 秒自動更新一次</p>
<table role="grid"><thead><tr><th>患者</th><th>狀態</th><th>摘要</th><th>操作</th></tr></thead>
<tbody id="rows"><tr><td colspan="4">Loading...</td></tr></tbody></table>
<script>
async function load(){
  const resp = await fetch('/doctor/api/summaries');
  if(!resp.ok){document.getElementById('rows').innerHTML='<tr><td colspan=4>Auth failed</td></tr>';return;}
  const data = await resp.json();
  const rows = data.map(item => \`<tr>
    <td><strong>\${item.userId}</strong><br/><small>\${item.updatedAt}</small></td>
    <td>\${item.state}</td>
    <td><pre>\${item.summary}</pre></td>
    <td><button onclick="archive('\${item.userId}')">Archive</button></td>
  </tr>\`).join('');
  document.getElementById('rows').innerHTML = rows || '<tr><td colspan=4>目前沒有進行中的病例</td></tr>';
}
async function archive(id){
  if(!confirm('確定封存這位患者紀錄？')) return;
  const r = await fetch('/doctor/api/archive/'+encodeURIComponent(id), {method:'POST'});
  if(r.ok) load();
}
load(); setInterval(load, 10000);
</script>
</body></html>`);
});

doctorRouter.get("/api/summaries", async (_req, res) => {
  const ids = await listSessions();
  const items:any[] = [];
  for (const userId of ids) {
    const s = await getSession(userId);
    if (!s || Object.keys(s).length === 0) continue;
    const summary = buildDoctorSummary(userId, s);
    items.push({ userId, state: s.state || "RAPPORT", updatedAt: new Date().toLocaleString(), summary });
  }
  res.json(items);
});

doctorRouter.post("/api/archive/:userId", async (req, res) => {
  await archiveSession(req.params.userId);
  res.json({ ok: true });
});
