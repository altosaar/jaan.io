// Interactive state for PortraitBlink.astro. Three flags, all class-based so
// the styling stays in the component's stylesheet.
//
// The portrait and the photo gallery both want to be the thing you are looking
// at, so they share one attention model: whichever was engaged last is the one
// in colour. The gallery already enforces a single highlight among its own
// slides; this extends that idea one level up, to the page.
//
//   html.portrait-awake  — the blink is allowed to run (set on first scroll)
//   html.portrait-still  — the blink is retired for good (set on first gallery
//                          interaction; a visitor who is browsing photos does
//                          not need a portrait twitching for attention)
//   .portrait.is-dimmed  — desaturated, because the gallery currently holds the
//                          highlight. Cleared by pointing at the portrait.
//
// `portrait-still` is deliberately one-way while `is-dimmed` toggles: colour is
// a running indication of focus, but the blink is an opening flourish, and
// re-arming it after someone has started browsing would read as a glitch.

const AWAKE = "portrait-awake";
const STILL = "portrait-still";
const DIMMED = "is-dimmed";

const root = document.documentElement;

// ── The blink starts on the visitor's first scroll ───────────────────────────
// Paused until then so motion never begins on its own while someone is still
// reading the headline. `once` + `passive`: one listener that removes itself and
// never blocks scrolling.
if (!root.classList.contains(AWAKE)) {
  window.addEventListener("scroll", () => root.classList.add(AWAKE), {
    once: true,
    passive: true,
  });
}

// ── The gallery taking focus dims the portrait and retires the blink ─────────
// `carousel:interact` is dispatched by carousel.client.ts whenever a slide takes
// the highlight — hover, keyboard focus, the arrow buttons, a swipe or a tap.
document.addEventListener("carousel:interact", () => {
  root.classList.add(STILL);
  document.querySelectorAll(".portrait").forEach((el) => el.classList.add(DIMMED));
});

// ── Pointing at the portrait takes the highlight back ────────────────────────
// The portrait returns to colour AND the gallery stands down to the all-grey
// strip it loads with, so exactly one thing on the page is ever in colour.
// `carousel:release` is the mirror of `carousel:interact`; the carousel clears
// its own highlight through its own state, which keeps its internal index
// honest (see carousel.client.ts).
//
// Not gated to `pointerType === "mouse"` the way the carousel's own hover is: on
// a touch device there is no hover, so a tap has to be able to restore the
// portrait or it would stay grey for the rest of the visit once the gallery had
// been swiped.
document.querySelectorAll<HTMLElement>(".portrait").forEach((el) => {
  el.addEventListener("pointerenter", () => {
    el.classList.remove(DIMMED);
    document.dispatchEvent(new CustomEvent("carousel:release"));
  });
});
