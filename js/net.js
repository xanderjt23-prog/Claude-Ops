// ============================================================================
// Peer-to-peer networking over WebRTC (PeerJS public broker). The host's peer
// id is derived from a short game code; clients connect to it directly.
// ============================================================================
const Net = (() => {
  const PREFIX = 'frontline-ops-3d-v1-';
  let peer = null, conns = {}, hostConn = null, role = null, code = null, myId = null;
  const h = { message: () => {}, join: () => {}, leave: () => {}, error: () => {}, closed: () => {} };

  function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  function available() { return typeof Peer !== 'undefined'; }

  function wire(conn, isHostSide) {
    conn.on('data', d => { let msg = d; if (typeof d === 'string') { try { msg = JSON.parse(d); } catch (e) { return; } } h.message(isHostSide ? conn.peer : 'H', msg); });
    conn.on('close', () => {
      if (isHostSide) { delete conns[conn.peer]; h.leave(conn.peer); }
      else { hostConn = null; h.closed('The host closed the game or the connection was lost.'); }
    });
    conn.on('error', e => console.warn('conn error', e));
  }

  function host(onReady, tries) {
    if (!available()) return h.error('Networking library failed to load (are you offline?).');
    close();
    role = 'host'; code = genCode();
    peer = new Peer(PREFIX + code, { debug: 1 });
    peer.on('open', id => { myId = 'H'; onReady(code); });
    peer.on('connection', conn => {
      conn.on('open', () => { conns[conn.peer] = conn; wire(conn, true); h.join(conn.peer); });
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && (tries || 0) < 4) return host(onReady, (tries || 0) + 1);
      h.error('Network error: ' + (e.type || e.message || e));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }
  function join(c, onOpen) {
    if (!available()) return h.error('Networking library failed to load (are you offline?).');
    close();
    role = 'client'; code = c.trim().toUpperCase();
    peer = new Peer({ debug: 1 });
    let opened = false;
    peer.on('open', id => {
      myId = id;
      hostConn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      hostConn.on('open', () => { opened = true; wire(hostConn, false); onOpen(myId); });
      setTimeout(() => { if (!opened) h.error('Could not reach a game with code ' + code + '. Check the code and that the host is still in the lobby.'); }, 12000);
    });
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') h.error('No game found with code ' + code + '.');
      else h.error('Network error: ' + (e.type || e.message || e));
    });
  }
  function send(msg) { if (hostConn && hostConn.open) hostConn.send(msg); }
  function sendTo(id, msg) { const c = conns[id]; if (c && c.open) c.send(msg); }
  function broadcast(msg) { for (const id in conns) if (conns[id].open) conns[id].send(msg); }
  function kick(id) { const c = conns[id]; if (c) { try { c.send({ t: 'kicked' }); setTimeout(() => c.close(), 200); } catch (e) {} delete conns[id]; } }
  function close() {
    try { for (const id in conns) conns[id].close(); } catch (e) {}
    try { if (hostConn) hostConn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conns = {}; hostConn = null; role = null; code = null; myId = null;
  }
  return {
    host, join, send, sendTo, broadcast, kick, close, available,
    on(ev, fn) { h[ev] = fn; },
    get role() { return role; }, get code() { return code; }, get myId() { return myId; },
    peers: () => Object.keys(conns),
  };
})();
