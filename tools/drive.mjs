// Drives dollhouse.html over the DevTools protocol, for checks and batches of review shots.
//   node tools/drive.mjs eval "dollhouse.loopCheck()" [query]
//   node tools/drive.mjs shots outDir "t,x,y,w,h;t,x,y,w,h" [query]     (x,y,w,h optional)
//   node tools/drive.mjs perf [seconds] [query]
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let nextPort = 9300 + (process.pid % 400);   // one per open(): two pages on one port would share a browser

export async function open(query = '') {
  const port = nextPort++;
  const profile = mkdtempSync(join(tmpdir(), 'dh-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1920,1080', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await new Promise(r => setTimeout(r, 150));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const waiting = new Map(), logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const url = 'file:///' + resolve('dollhouse.html').replace(/\\/g, '/') + '?' + query;
  await send('Page.navigate', { url });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 100));
    try { if (await evaluate('!!window.dollhouse')) break; } catch { /* navigating */ }
  }
  const shot = async path => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.result.data, 'base64'));
  };
  const close = () => { ws.close(); proc.kill(); };
  return { evaluate, shot, close, logs, send };
}

const [cmd, a, b, c] = process.argv.slice(2);
if (['eval', 'shots', 'perf'].includes(cmd)) {
  const q = cmd === 'eval' ? b : cmd === 'shots' ? c : b;
  const page = await open(q || '');
  try {
    if (cmd === 'eval') console.log(JSON.stringify(await page.evaluate(a), null, 0));
    else if (cmd === 'shots') {
      mkdirSync(a, { recursive: true });
      for (const spec of b.split(';')) {
        const [t, x, y, w, h] = spec.split(',').map(Number);
        await page.evaluate(`dollhouse.CFG.zoom=${x === undefined ? '[]' : `[${x},${y},${w},${h}]`};dollhouse.renderAt(${t});1`);
        const name = `t${String(t).replace('.', '_')}${x === undefined ? '' : `_${x}_${y}`}.png`;
        await page.shot(join(a, name));
        console.log(name);
      }
    } else if (cmd === 'perf') {
      const secs = +(a || 5);
      console.log(JSON.stringify(await page.evaluate(`(async()=>{const s=performance.now();let n=0,tot=0,max=0;
        dollhouse.renderAt(0);
        while(performance.now()-s<${secs * 1000}){const t=(performance.now()-s)/1000*7;const a=performance.now();dollhouse.renderAt(t);const m=performance.now()-a;tot+=m;max=Math.max(max,m);n++;await new Promise(r=>setTimeout(r));}
        return {frames:n,avgMs:+(tot/n).toFixed(2),maxMs:+max.toFixed(2),bakeMs:+dollhouse.stats.bake.toFixed(0),heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1e6).toFixed(1):null};})()`)));
    }
    if (page.logs.length) console.log(page.logs.slice(0, 25).join('\n'));
  } finally { page.close(); }
}
