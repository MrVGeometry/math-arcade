/**
 * Spireclash key bindings: the list of rebindable actions, their defaults,
 * friendly key names, and the click-to-rebind editor shown on the menu.
 * Bindings are stored as KeyboardEvent.code values, so they follow the
 * physical key whatever the keyboard layout.
 */
(function () {
  'use strict';
  const G = window.G;

  const ACTIONS = [
    { id: 'forward', label: 'Move forward', def: 'KeyW', group: 'Movement' },
    { id: 'back', label: 'Move back', def: 'KeyS', group: 'Movement' },
    { id: 'left', label: 'Strafe left', def: 'KeyA', group: 'Movement' },
    { id: 'right', label: 'Strafe right', def: 'KeyD', group: 'Movement' },
    { id: 'jump', label: 'Jump', def: 'Space', group: 'Movement' },
    { id: 'bow', label: 'Water Bolt', def: 'Digit1', group: 'Combat' },
    { id: 'staff', label: 'Fire Blast', def: 'Digit2', group: 'Combat' },
    { id: 'draught', label: 'Drink a draught', def: 'Digit3', group: 'Combat' },
    { id: 'reload', label: 'Reload', def: 'KeyR', group: 'Combat' },
    { id: 'wall', label: 'Wall', def: 'KeyQ', group: 'Building' },
    { id: 'ramp', label: 'Stair', def: 'KeyE', group: 'Building' },
    { id: 'floor', label: 'Floor', def: 'KeyF', group: 'Building' },
    { id: 'roof', label: 'Spire', def: 'KeyC', group: 'Building' },
    { id: 'box', label: 'Box in', def: 'KeyB', group: 'Building' },
    { id: 'wand', label: 'Phase wand', def: 'KeyG', group: 'Building' },
  ];
  // Escape always pauses, so it can never be bound to an action.
  const RESERVED = new Set(['Escape']);

  const binds = {};
  let onChange = () => {};

  function reset() {
    for (const a of ACTIONS) binds[a.id] = a.def;
  }

  // Merge saved bindings, dropping unknown actions and duplicate keys.
  function load(saved) {
    reset();
    if (!saved || typeof saved !== 'object') return;
    for (const a of ACTIONS) {
      const code = saved[a.id];
      if (typeof code === 'string' && !RESERVED.has(code)) binds[a.id] = code;
    }
    // If two actions somehow share a key, only the first keeps it.
    const seen = new Set();
    for (const a of ACTIONS) {
      if (binds[a.id] && seen.has(binds[a.id])) binds[a.id] = '';
      seen.add(binds[a.id]);
    }
  }

  function actionFor(code) {
    for (const a of ACTIONS) if (binds[a.id] === code) return a.id;
    return null;
  }

  // Bind code to id. A key already in use swaps over to the old binding.
  function set(id, code) {
    const prev = binds[id];
    const other = actionFor(code);
    binds[id] = code;
    if (other && other !== id) binds[other] = prev;
    return other && other !== id ? other : null;
  }

  const NAMED = {
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    CapsLock: 'Caps Lock',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt',
    AltRight: 'Right Alt',
    MetaLeft: 'Left Cmd',
    MetaRight: 'Right Cmd',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  };

  function label(code) {
    if (!code) return 'None';
    if (NAMED[code]) return NAMED[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
    return code;
  }

  function short(code) {
    const l = label(code);
    return l.length > 5 ? l.replace(/^(Left|Right) /, '').slice(0, 5) : l;
  }

  /* Editor ------------------------------------------------------------------ */

  let listening = null;

  function buildEditor(host, note) {
    host.textContent = '';
    let group = '';
    for (const a of ACTIONS) {
      if (a.group !== group) {
        group = a.group;
        const h = document.createElement('div');
        h.className = 'bind-group';
        h.textContent = group;
        host.appendChild(h);
      }
      const row = document.createElement('div');
      row.className = 'bind-row';
      const name = document.createElement('span');
      name.textContent = a.label;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bind-key';
      btn.dataset.action = a.id;
      btn.textContent = label(binds[a.id]);
      btn.addEventListener('click', () => startListening(btn, note));
      row.append(name, btn);
      host.appendChild(row);
    }
  }

  function refreshEditor(host) {
    host.querySelectorAll('.bind-key').forEach((b) => {
      b.classList.remove('listening');
      b.textContent = label(binds[b.dataset.action]);
    });
  }

  function stopListening() {
    if (!listening) return;
    listening.btn.classList.remove('listening');
    listening.btn.textContent = label(binds[listening.btn.dataset.action]);
    listening = null;
  }

  function startListening(btn, note) {
    stopListening();
    listening = { btn, note };
    btn.classList.add('listening');
    btn.textContent = 'Press a key';
    note.textContent = 'Press the new key, or Esc to cancel.';
  }

  // Runs in the capture phase so a key being bound never reaches the game.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!listening) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const { btn, note } = listening;
      if (e.code === 'Escape') {
        stopListening();
        note.textContent = '';
        return;
      }
      const id = btn.dataset.action;
      const swapped = set(id, e.code);
      listening = null;
      const host = btn.closest('.binds');
      if (host) refreshEditor(host);
      note.textContent = swapped
        ? `${label(e.code)} was on ${ACTIONS.find((a) => a.id === swapped).label}, so the two swapped.`
        : '';
      onChange();
    },
    true
  );
  window.addEventListener('mousedown', (e) => {
    if (listening && !e.target.classList.contains('bind-key')) {
      listening.note.textContent = '';
      stopListening();
    }
  });

  G.keybinds = {
    ACTIONS,
    binds,
    load,
    reset,
    set,
    get: (id) => binds[id],
    actionFor,
    label,
    short,
    buildEditor,
    refreshEditor,
    isListening: () => !!listening,
    onChange(fn) {
      onChange = fn;
    },
  };
  reset();
})();
