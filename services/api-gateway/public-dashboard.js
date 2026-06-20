"use strict";

/**
 * Public (no-auth) HTML dashboard — served at /api/v1/public/dashboard.
 * Fetches /api/v1/public/status every 10s and renders pipeline + agent tables.
 */

const PUBLIC_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CogniMesh Platform Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f1419;color:#e7ecf3;padding:1.5rem}
h1{color:#6ee7b7;margin-bottom:.5rem;font-size:1.4rem}
.subtitle{color:#8b9cb3;font-size:.85rem;margin-bottom:1.5rem}
.kpi-row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
.kpi{background:#151b24;border:1px solid #243044;border-radius:8px;padding:.75rem 1rem;min-width:140px;flex:1}
.kpi-label{font-size:.72rem;color:#64748b;text-transform:uppercase}
.kpi-value{font-size:1.5rem;font-weight:700;color:#e7ecf3}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1.5rem}
th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid #243044}
th{color:#94a3b8;font-size:.72rem;text-transform:uppercase}
.status-SUCCEEDED,.status-PREPARED{color:#6ee7b7}
.status-RUNNING,.status-PREPARING{color:#93c5fd}
.status-FAILED{color:#fca5a5}
.refresh{font-size:.72rem;color:#64748b;margin-top:1rem}
</style>
</head>
<body>
<h1>CogniMesh Platform Dashboard</h1>
<p class="subtitle">Live view of deployed pipelines and agents</p>
<div class="kpi-row">
  <div class="kpi"><span class="kpi-label">Pipelines</span><span class="kpi-value" id="kpi-pipelines">—</span></div>
  <div class="kpi"><span class="kpi-label">Agents</span><span class="kpi-value" id="kpi-agents">—</span></div>
  <div class="kpi"><span class="kpi-label">Region</span><span class="kpi-value" id="kpi-region">—</span></div>
</div>
<h2 style="margin-bottom:.5rem;font-size:1rem">Pipelines (Step Functions)</h2>
<table><thead><tr><th>Name</th><th>Created</th><th>Last Run</th></tr></thead><tbody id="pipelines-body"></tbody></table>
<h2 style="margin-bottom:.5rem;font-size:1rem">Agents (Bedrock)</h2>
<table><thead><tr><th>Name</th><th>ID</th><th>Status</th></tr></thead><tbody id="agents-body"></tbody></table>
<p class="refresh" id="refresh-ts">Loading...</p>
<script>
async function load(){
  try{
    const r=await fetch("/api/v1/public/status");
    const d=await r.json();
    document.getElementById("kpi-pipelines").textContent=d.pipelines?.length||0;
    document.getElementById("kpi-agents").textContent=d.agents?.length||0;
    document.getElementById("kpi-region").textContent=d.region||"—";
    const pb=document.getElementById("pipelines-body");
    pb.innerHTML=(d.pipelines||[]).map(p=>"<tr><td>"+p.name+"</td><td>"+(p.created?new Date(p.created).toLocaleDateString():"—")+"</td><td class=\\"status-"+(p.lastRun||"")+"\\">"+( p.lastRun||"—")+"</td></tr>").join("");
    const ab=document.getElementById("agents-body");
    ab.innerHTML=(d.agents||[]).map(a=>"<tr><td>"+a.name+"</td><td>"+a.id+"</td><td class=\\"status-"+(a.status||"")+"\\">"+( a.status||"—")+"</td></tr>").join("");
    document.getElementById("refresh-ts").textContent="Last refresh: "+new Date().toLocaleTimeString();
  }catch(e){
    document.getElementById("refresh-ts").textContent="Error: "+e.message;
  }
}
load();
setInterval(load,10000);
</script>
</body>
</html>`;

module.exports = { PUBLIC_DASHBOARD_HTML };
