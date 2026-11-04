/**
 * Spireclash touch controls, laid out like a mobile battle-royale HUD:
 * a floating move stick on the left, drag anywhere else to look, a big fire
 * button you can also drag to aim, a second fire button above the stick,
 * jump, steady aim, reload and a build/combat toggle on the right, and a
 * tappable hotbar that swaps between weapons and build pieces.
 *
 * Uses pointer events, so it also works with a mouse when forced on (handy
 * for testing). The game reads the shared state each frame.
 */
(function () {
  'use strict';
  const G = window.G;
  const $ = (id) => document.getElementById(id);
  const STICK_R = 56;
  const STICK_DEAD = 0.12;

  const T = {
    enabled: false,
    moveX: 0,
    moveY: 0,
    fire: false,
    ads: false,
    jump: false,
  };
  const roles = new Map();
  let api = null;
  let root = null;
  let knob = null;
  let stick = null;
  let fireHolds = 0;

  function isCoarse() {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (e) {
      return false;
    }
  }

  // Mode is 'auto', 'touch' or 'mouse'. Auto follows the primary pointer.
  function setMode(mode) {
    T.enabled = mode === 'touch' || (mode !== 'mouse' && isCoarse());
    document.body.classList.toggle('touch', T.enabled);
    if (!T.enabled) releaseAll();
  }

  function releaseAll() {
    roles.clear();
    fireHolds = 0;
    T.moveX = 0;
    T.moveY = 0;
    T.fire = false;
    T.jump = false;
    resetStick();
    if (root) root.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
  }

  /* Move stick: it appears wherever the left thumb lands --------------------- */

  function resetStick() {
    if (!stick) return;
    stick.classList.remove('live');
    stick.style.left = '';
    stick.style.top = '';
    knob.style.transform = '';
  }

  function stickStart(r, x, y) {
    r.ox = x;
    r.oy = y;
    stick.classList.add('live');
    stick.style.left = `${x}px`;
    stick.style.top = `${y}px`;
    stickMove(r, x, y);
  }

  function stickMove(r, x, y) {
    let dx = (x - r.ox) / STICK_R;
    let dy = (y - r.oy) / STICK_R;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    knob.style.transform = `translate(${dx * STICK_R}px, ${dy * STICK_R}px)`;
    const live = Math.min(1, m) > STICK_DEAD;
    T.moveX = live ? dx : 0;
    T.moveY = live ? dy : 0;
  }

  /* Pointer routing ------------------------------------------------------- */

  function onPadDown(e) {
    e.preventDefault();
    const leftZone = e.clientX < window.innerWidth * 0.42;
    const hasStick = [...roles.values()].some((r) => r.kind === 'stick');
    const r = { kind: leftZone && !hasStick ? 'stick' : 'look', x: e.clientX, y: e.clientY };
    roles.set(e.pointerId, r);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (r.kind === 'stick') stickStart(r, e.clientX, e.clientY);
  }

  function onMove(e) {
    const r = roles.get(e.pointerId);
    if (!r) return;
    e.preventDefault();
    if (r.kind === 'stick') {
      stickMove(r, e.clientX, e.clientY);
      return;
    }
    // Look, or a fire button being dragged to aim while shooting.
    if (r.kind === 'look' || r.kind === 'fire') {
      api.look(e.clientX - r.x, e.clientY - r.y);
      r.x = e.clientX;
      r.y = e.clientY;
    }
  }

  function onUp(e) {
    const r = roles.get(e.pointerId);
    if (!r) return;
    roles.delete(e.pointerId);
    if (r.kind === 'stick') {
      T.moveX = 0;
      T.moveY = 0;
      resetStick();
    } else if (r.kind === 'fire') {
      fireHolds = Math.max(0, fireHolds - 1);
      T.fire = fireHolds > 0;
    } else if (r.kind === 'jump') {
      T.jump = false;
    }
    if (r.el) r.el.classList.remove('pressed');
  }

  function onButtonDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.classList.add('pressed');
    const hold = el.dataset.hold;
    const r = { kind: hold || 'tap', el, x: e.clientX, y: e.clientY };
    roles.set(e.pointerId, r);
    if (hold === 'fire') {
      fireHolds += 1;
      T.fire = true;
    } else if (hold === 'jump') {
      T.jump = true;
    } else if (el.dataset.tap === 'ads') {
      T.ads = !T.ads;
    } else if (el.dataset.tap) {
      api.action(el.dataset.tap);
    }
  }

  function wire(el) {
    el.addEventListener('pointerdown', onButtonDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function init(callbacks) {
    api = callbacks;
    root = $('touch-ui');
    stick = $('t-stick');
    knob = $('t-knob');
    const pad = $('t-pad');
    pad.addEventListener('pointerdown', onPadDown);
    pad.addEventListener('pointermove', onMove);
    pad.addEventListener('pointerup', onUp);
    pad.addEventListener('pointercancel', onUp);
    root.querySelectorAll('[data-hold], [data-tap]').forEach(wire);
    // The hotbar slots double as touch buttons.
    const slots = {
      'slot-w0': 'bow',
      'slot-w1': 'staff',
      'slot-pot': 'draught',
      'slot-wall': 'wall',
      'slot-ramp': 'ramp',
      'slot-floor': 'floor',
      'slot-roof': 'roof',
      'slot-box': 'box',
    };
    for (const [id, action] of Object.entries(slots)) {
      const el = $(id);
      el.dataset.tap = action;
      wire(el);
    }
    window.addEventListener('blur', releaseAll);
  }

  // Reflect the game's mode on the buttons each frame.
  function sync(s) {
    if (!T.enabled || !root) return;
    const building = s.mode === 'build';
    if (building || !s.canAds) T.ads = false;
    root.classList.toggle('building', building);
    document.getElementById('hotbar').classList.toggle('building', building);
    $('t-ads').classList.toggle('on', T.ads);
    root.classList.toggle('hidden', !!s.hidden);
    if (s.hidden) releaseAll();
  }

  function enterFullscreen() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        const p = el.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    } catch (e) {
      // Fullscreen is a nicety; iPhones and some browsers refuse it.
    }
  }

  G.touch = Object.assign(T, { init, setMode, sync, releaseAll, enterFullscreen, isCoarse });
})();
