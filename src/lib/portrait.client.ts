// Interactive state for PortraitBlink.astro. One flag, class-based, so the
// styling stays in the component's own stylesheet.
//
//   html.portrait-blinking — the blink runs, for exactly as long as the visitor
//                            is scrolling
//
// The portrait blinks WHILE a scroll gesture is happening and stops the moment
// it ends. Attaching the class is what starts the animation, and keyframe 0% is
// the closed frame (see PortraitBlink.astro), so the first instant of a gesture
// is the blink itself; letting go detaches the animation and the portrait falls
// back to open eyes. Nothing moves on its own, ever.
//
// This replaces a one-way "wake on first scroll, then blink forever" model, and
// with it the portrait/gallery attention model that dimmed the portrait when the
// carousel was touched — the carousel now lives on /images/ and the portrait on
// /, so those two could no longer be on screen together and none of that code
// could fire. `carousel:interact` / `carousel:release` are still dispatched by
// carousel.client.ts; nothing listens for them now.

const BLINKING = "portrait-blinking";

/**
 * How long after the last wheel/scroll event to call the gesture over.
 *
 * A wheel has no release event the way a touch does, and trackpad momentum
 * arrives as a burst with gaps inside it — so an idle window is the closest
 * honest equivalent. Long enough not to flicker mid-flick, short enough that
 * stopping reads as immediate.
 */
const IDLE_MS = 180;

const root = document.documentElement;

let idle: ReturnType<typeof setTimeout> | undefined;
// Whether a finger is currently down. A touch-scroll fires `scroll` too, and
// without this the idle window below could expire and stop the blink while the
// visitor is still mid-gesture, holding the screen still for a moment.
let touching = false;

function start() {
  clearTimeout(idle);
  // A no-op if the class is already set, which is what keeps a long scroll from
  // restarting the animation on every event and freezing it on frame 0.
  root.classList.add(BLINKING);
}

function stopNow() {
  clearTimeout(idle);
  root.classList.remove(BLINKING);
}

function stopWhenIdle() {
  if (touching) return;
  clearTimeout(idle);
  idle = setTimeout(() => root.classList.remove(BLINKING), IDLE_MS);
}

// ── Wheel and scroll: no release event, so fall back to the idle window ──────
// `scroll` covers the pages that actually scroll (and keyboard scrolling, which
// fires it); `wheel` covers the home page, which is locked to one screen and so
// never fires `scroll` at all — the gesture still happens, nothing moves.
for (const type of ["wheel", "scroll"] as const) {
  window.addEventListener(
    type,
    () => {
      start();
      stopWhenIdle();
    },
    { passive: true },
  );
}

// ── Touch: there IS a real release, so use it ────────────────────────────────
// Keyed to `touchmove`, not `touchstart`: a tap on a link is not a scroll. And
// like `wheel`, this fires on the locked home page even though nothing moves,
// which is the whole reason mobile works here at all.
window.addEventListener("touchstart", () => (touching = true), { passive: true });
window.addEventListener("touchmove", start, { passive: true });
for (const type of ["touchend", "touchcancel"] as const) {
  window.addEventListener(
    type,
    () => {
      touching = false;
      stopNow();
    },
    { passive: true },
  );
}
