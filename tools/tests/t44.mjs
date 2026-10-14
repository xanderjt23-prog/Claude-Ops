export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  // play a quick simulated match so the profile has numbers
  await b.eval(`(() => { const p = Profile.get(); p.stats.games = 0; Profile.save(); })()`);
  await b.eval(`UI.go('sp')`); await b.sleep(300); await b.eval(`document.querySelector('[data-mode="score"]').click()`); await b.sleep(200);
  await b.eval(`(() => { const r = document.querySelector('[data-minutes]'); r.value = 2; r.oninput(); r.onchange(); })()`);
  await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(3000);
  await b.eval(`(() => { const g = UI.game, me = g.byId[g.localId]; me.isBot = true; me.ai = new BotBrain(g, me); g.running = false; let s = 0; while (!g.ended && s++ < 30 * 130) g.update(1 / 30); })()`);
  await b.sleep(3500); await b.shot('219-end');
  await b.eval(`document.querySelector('#endscreen') && document.querySelector('#endscreen').classList.add('hidden'); UI.go('profile')`); await b.sleep(800); await b.shot('220-profile');
  // keybinds: rebind crouch to Shift; sprint should swap to C
  await b.eval(`UI.go('menu'); document.querySelector('#btn-settings').click()`); await b.sleep(400);
  await b.eval(`document.querySelector('[data-bind="crouch"]').click()`); await b.sleep(200);
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft' }); await b.sleep(300);
  console.log('crouch =', await b.eval(`Keybinds.label(Keybinds.get('crouch'))`), '| sprint =', await b.eval(`Keybinds.label(Keybinds.get('sprint'))`), '| hold =', await b.eval(`Keybinds.label(Keybinds.get('hold'))`));
  await b.shot('221-keybinds');
  await b.eval(`document.querySelector('#btn-keys-reset').click()`);
};
