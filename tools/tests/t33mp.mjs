import { spawn } from 'child_process'; import fs from 'fs'; import path from 'path';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function browser(name) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join((await import('os')).tmpdir(), 'frontline-ops-3d-prof-' + name)}`, '--window-size=1280,800', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' });
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const logs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(name + ` [${m.params.type}] ` + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push(name + ' [EXC] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  return { proc, logs, send,
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.exceptionDetails ? 'ERR ' + (r.result.exceptionDetails.exception?.description) : r.result.result.value; },
    async shot(n) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`tools/tests/shots/${n}.png`, Buffer.from(r.result.data, 'base64')); },
    async goto(u) { await send('Page.navigate', { url: u }); await sleep(1800); } };
}
const url = 'file:///C:/Users/ajons/Claude-Ops/index.html';
const H = await browser('host'), C = await browser('client');
const units = `JSON.stringify(UI.game ? {role:UI.game.role, map:UI.game.cfg.mapId, mode:UI.game.cfg.mode, units:UI.game.units.map(u=>[u.name,u.team,Math.round(u.x),Math.round(u.y),Math.round(u.hp),u.alive])} : 'nogame')`;
try {
  await H.goto(url); await C.goto(url);
  // host: a saved generated map and face paint
  await H.ev(`(() => { const p = Profile.get(); p.name = 'HostGuy'; p.savedMaps = [{ id: 'sm_test1', name: 'Test Harbour', theme: 'coast', size: 'medium', seed: 424242 }];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#b3201e'; g.fillRect(0, 30, 64, 8); p.face = c.toDataURL('image/png'); Profile.save(); })()`);
  await H.ev(`UI.go('mp'); document.querySelector('#mp-host').click()`);
  let code = null; for (let i = 0; i < 40 && !code; i++) { await sleep(500); code = await H.ev(`Net.code`); }
  console.log('code', code);
  await C.ev(`Profile.reset(); const p = Profile.get(); p.name = 'ClientGal'; const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillStyle = '#1e4fb3'; c.getContext('2d').fillRect(0, 0, 64, 20); p.face = c.toDataURL('image/png'); Profile.save(); UI.go('mp'); document.querySelector('#join-code').value='${code}'; document.querySelector('#mp-join').click()`);
  let ok = false; for (let i = 0; i < 40 && !ok; i++) { await sleep(500); ok = await C.ev(`!!document.querySelector('#screen-lobby.active .code')`); }
  console.log('client in lobby:', ok); await sleep(800);
  console.log('client sees saved map card:', await C.ev(`!!document.querySelector('[data-vmap="sm_test1"]')`));
  await C.ev(`document.querySelector('[data-vmap="sm_test1"]').click(); document.querySelector('[data-vmode="score"]').click(); document.querySelector('#ready').click()`); await sleep(600);
  await H.ev(`document.querySelector('[data-vmap="sm_test1"]').click(); document.querySelector('[data-vmode="score"]').click()`); await sleep(500);
  await H.ev(`(() => { const r = document.querySelector('[data-minutes]'); if (r) { r.value = 3; r.oninput(); r.onchange(); } })()`); await sleep(500);
  await H.ev(`document.querySelector('[data-mod="dhp"]').click()`); await sleep(300); await H.ev(`document.querySelector('[data-mod="lowgrav"]').click()`); await sleep(500);
  await H.ev(`document.querySelector('#fill-bots').click()`); await sleep(800);
  await H.shot('mp4-host-lobby'); await C.shot('mp4-client-lobby');
  await H.ev(`document.querySelector('#lobby-start').click()`);
  await sleep(6000);
  const st = `JSON.stringify(UI.game ? { role: UI.game.role, map: UI.game.map.id, theme: UI.game.map.genOpts && UI.game.map.genOpts.theme, w: UI.game.map.w, objHash: UI.game.map.obj.reduce((s, v, i) => (s + v * (i % 97 + 1)) % 1000003, 0), mode: UI.game.cfg.mode, limit: UI.game.timeLimit, mods: [...UI.game.mods].join('+'), maxHp: UI.game.maxHp, faces: UI.game.units.map(u => u.name + ':' + (u.face ? u.face.length : 0)).join(',') } : 'nogame')`;
  console.log('host', await H.ev(st)); console.log('client', await C.ev(st));
  await sleep(4000);
  await H.shot('mp4-host-game'); await C.shot('mp4-client-game');
} catch (e) { console.log('ERR', e); }
console.log('--- logs ---'); console.log(H.logs.concat(C.logs).join(String.fromCharCode(10)));
H.proc.kill(); C.proc.kill(); process.exit(0);
