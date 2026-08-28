// PALETTE TEST — behaviour for the three marks stacked in the bottom-right
// corner (src/components/PaletteToggle.astro).
//
//   ▫  top     clear, back to the site's own palette
//   ▪  middle  a light palette   (the `-light` blocks in palettes.css)
//   ▪  bottom  a dark palette    (everything else)
//
// The switch is one attribute on <html>: every colour on the site is a var()
// away from the tokens those rules redefine, so nothing else has to be told.
//
// EACH MARK WEARS THE ACCENT OF THE PALETTE IT WILL APPLY, and once applied it
// STAYS on that colour — the mark is the palette you are looking at, not a
// wheel that keeps turning under your finger. A family only draws a new colour
// when it stops being the one on screen: you clear, or you cross to the other
// family. That is what makes the top mark part of the loop rather than an
// afterthought — off is how you ask for the next colour.
//
// AND WHAT IT DRAWS IS ALWAYS A DIFFERENT SHADE. Random, but neither repeating
// nor merely nominally different: dealt from a deck so every palette in a
// family comes up once before any comes up twice, and filtered so a draw is
// never a colour already on the corner — measured in Oklab, because two of
// these palettes can carry the same orange under different names. See dealer()
// and MIN_SHADE below.
//
// THE PALETTES ARE NOT LISTED HERE. They are read out of the stylesheet at
// load, which is why adding, renaming, reordering or dropping one is an edit to
// palettes.css and nothing else. A hardcoded array would be the same forty-four
// names in a second place, and the failure mode when the two disagree is a
// click that appears to do nothing.

import { PALETTE_KEY, PALETTE_USED_KEY } from "./palette";

/** Suffix that marks a palette as the light half of the pair. */
const LIGHT = "-light";
type Family = "light" | "dark";
const familyOf = (name: string): Family => (name.endsWith(LIGHT) ? "light" : "dark");

/**
 * Every palette the loaded CSS defines, with its accent.
 *
 * Walks the CSSOM rather than fetching and parsing anything. It can come back
 * EMPTY, and that is not the same as "there are no palettes": a deferred module
 * is only guaranteed to run after the document is parsed, not after every
 * stylesheet has reached document.styleSheets, and WebKit takes that liberty on
 * a page small enough to finish parsing first. See the startup block below,
 * which is what turns an empty answer into a retry instead of a verdict.
 *
 * `cssRules` THROWS on a cross-origin stylesheet with no CORS grant, hence the
 * try — this site serves its own CSS, but a browser extension's injected sheet
 * lands in the same list.
 *
 * Reading `selectorText` covers dev and prod alike: `astro dev` injects the
 * file as a <style> and the build emits a <link>, and both are ordinary sheets
 * here. The <link> is the one that can be late.
 *
 * The accents come off the same rules as the names, which is the only way to
 * know a palette's colour WITHOUT applying it: `[data-palette]` matches the root
 * element and nothing else, so there is no offscreen element to try it on and
 * measure.
 */
function readPalettes(): { names: string[]; accents: Map<string, string> } {
  const names: string[] = [];
  const accents = new Map<string, string>();

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const selector = (rule as CSSStyleRule).selectorText;
      const style = (rule as CSSStyleRule).style;
      if (!selector || !style) continue;
      const accent = style.getPropertyValue("--accent").trim();
      // Quotes optional: the CSS minifier emits `[data-palette=ponyo-2008]`, and
      // whether the browser puts them back when it serialises `selectorText` is
      // up to the browser. A slug can hold neither quotes nor `]`, so accepting
      // both spellings costs nothing.
      for (const [, name] of selector.matchAll(/\[data-palette=["']?([^"'\]]+)["']?\]/g)) {
        if (!names.includes(name)) names.push(name);
        if (accent) accents.set(name, accent);
      }
    }
  }
  return { names, accents };
}

/**
 * How far apart two accents have to be to count as different shades, as a
 * distance in Oklab — roughly, how different they look rather than how
 * different their hex is.
 *
 * The corpus makes this necessary. Twenty-two dark palettes do not mean
 * twenty-two colours: `grave-of-the-fireflies-1988` is #f18913 and
 * `my-neighbors-the-yamadas-1999` is #f18915, two apart in the last channel and
 * a distance of 0.001 — the same orange by any measure a person could apply.
 * Four such pairs sit under 0.005 in each family. A deck that deals every
 * palette exactly once still deals that orange four times a pass, and every one
 * of them reads as "it did not change".
 *
 * 0.1 was chosen against the measured distribution: it rejects the 28% (dark)
 * and 33% (light) of pairs that are near neighbours, while the most crowded
 * accent in either family still has eleven partners out of twenty-one to choose
 * from — different enough to see, loose enough that the deck never runs dry.
 */
const MIN_SHADE = 0.1;

/** sRGB hex → Oklab. Björn Ottosson's matrices, the same ones scripts/gen-light-palettes.mjs derives the light palettes with. */
function oklab(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const q = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  return [
    0.2104542553 * l + 0.793617785 * q - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * q + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * q - 0.808675766 * s,
  ];
}

/** Perceptual distance between two accents. Unparseable → Infinity, so an odd value never blocks a draw. */
function shadeGap(a: string | undefined, b: string | undefined): number {
  const x = a && oklab(a);
  const y = b && oklab(b);
  if (!x || !y) return Infinity;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/**
 * A shuffled deck that also refuses to deal a colour you can already see.
 *
 * TWO GUARANTEES, AND THEY ARE DIFFERENT ONES. The deck is the first: cards are
 * dealt without replacement and the deck is only rebuilt once empty, so every
 * palette in a family comes up exactly once before any comes up again. That is
 * what keeps the run even — independent draws would repeat and skip, and out of
 * twenty-two you would sometimes get the same film twice running while another
 * went unseen for dozens of clicks.
 *
 * The filter is the second, and it is the one that makes a click always LOOK
 * like a change: the dealer walks the deck for the first card at least
 * MIN_SHADE from every colour currently on the corner — the mark being replaced
 * and its neighbour both — and passes over the rest, leaving them in the deck
 * for later rather than discarding them. So no near-identical orange follows an
 * orange, and the two marks never sit there wearing the same colour.
 *
 * WHEN THE TAIL RUNS OUT OF SHADES it tops up rather than settling. The last
 * two or three cards of a pass are whatever the filter kept passing over, which
 * is exactly the set most likely to be close to what is on screen; dealing the
 * best of a bad lot is how a click ends up changing #f18913 for #f18915. So a
 * fresh shuffle is appended and the search runs again over both — the leftovers
 * stay in the deck and are still dealt, just not necessarily before every card
 * of the next pass. Evenness is a heuristic here; a click that visibly does
 * nothing is the actual bug.
 *
 * The furthest-card fallback below it never fires with this corpus (the most
 * crowded accent in either family has eleven partners past MIN_SHADE) and is
 * kept for the shape of the thing: a family with one palette in it, or a
 * MIN_SHADE raised past what the colours can satisfy, deals the best available
 * rather than nothing at all.
 */
function dealer(list: string[], accentOf: (name: string) => string | undefined) {
  const shuffled = () => {
    const deck = list.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  let deck: string[] = [];
  return (avoid: (string | undefined)[]) => {
    if (!deck.length) deck = shuffled();
    const gap = (name: string) => Math.min(...avoid.map((c) => shadeGap(accentOf(name), c)));
    const pick = () => deck.findIndex((name) => gap(name) >= MIN_SHADE);

    let index = pick();
    if (index === -1) {
      deck = deck.concat(shuffled());
      index = pick();
    }
    if (index === -1) {
      index = deck.reduce((best, name, i) => (gap(name) > gap(deck[best]) ? i : best), 0);
    }
    return deck.splice(index, 1)[0];
  };
}

/** `my-neighbor-totoro-1988-light` → `My neighbor totoro 1988`. */
function label(name: string): string {
  const words = name.replace(LIGHT, "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const corner = document.querySelector<HTMLElement>("[data-palette-corner]");
const buttons: Record<Family, HTMLButtonElement | null> = {
  light: document.querySelector("[data-palette-light]"),
  dark: document.querySelector("[data-palette-dark]"),
};
const clear = document.querySelector<HTMLButtonElement>("[data-palette-clear]");

/**
 * Wire the marks up, if the stylesheet is there to read.
 *
 * Returns false when the scan finds nothing to offer — which means either that
 * palettes.css is genuinely gone, or that it simply has not landed yet.
 */
function start(
  corner: HTMLElement,
  clear: HTMLButtonElement,
  buttons: Record<Family, HTMLButtonElement>,
): boolean {
  const { names, accents } = readPalettes();
  const pools: Record<Family, string[]> = {
    light: names.filter((n) => familyOf(n) === "light"),
    dark: names.filter((n) => familyOf(n) === "dark"),
  };
  if (!pools.light.length || !pools.dark.length) return false;
  wire(corner, clear, buttons, pools, accents);
  return true;
}

// A family with nothing in it means palettes.css did not load, or its light half
// was dropped. Controls that cannot do anything are worse than no controls, so
// the corner removes itself rather than sitting there absorbing clicks.
//
// BUT AN EMPTY SCAN IS NOT PROOF OF THAT, and treating it as proof is what took
// the marks off the home page in Safari while leaving them on every other route.
// A deferred module runs once the document is parsed; whether the external
// stylesheet has reached document.styleSheets by then is up to the engine, and
// WebKit finishes parsing a one-screen page before the CSS is in. Chrome and
// Firefox happened to be in the other order, so the same build worked in two
// browsers out of three — and the colours, which come from the inline restore in
// <head> and the cascade, kept working in all three, which is exactly the shape
// the bug reached me in.
//
// So: ask again each frame until the answer means something. `readyState`
// reaching "complete" is that point — every stylesheet has loaded or failed by
// then — and only an empty scan at that moment is a real verdict.
if (corner && clear && buttons.light && buttons.dark) {
  const marks = buttons as Record<Family, HTMLButtonElement>;
  if (!start(corner, clear, marks)) {
    const retry = () => {
      if (start(corner, clear, marks)) return;
      if (document.readyState === "complete") corner.remove();
      else requestAnimationFrame(retry);
    };
    requestAnimationFrame(retry);
  }
}

function wire(
  corner: HTMLElement,
  clear: HTMLButtonElement,
  buttons: Record<Family, HTMLButtonElement>,
  pools: Record<Family, string[]>,
  accents: Map<string, string>,
) {
  const root = document.documentElement;
  /** Every palette the stylesheet actually defines, both families. */
  const known = [...pools.light, ...pools.dark];
  const accentOf = (name: string) => accents.get(name);
  const draw: Record<Family, (avoid: (string | undefined)[]) => string> = {
    light: dealer(pools.light, accentOf),
    dark: dealer(pools.dark, accentOf),
  };

  /** What each mark is offering. Overwritten only when that family goes cold. */
  const offer: Record<Family, string> = { light: draw.light([]), dark: "" };
  // Seeded second and against the first, so the two marks do not open the page
  // wearing the same shade either.
  offer.dark = draw.dark([accentOf(offer.light)]);

  /** The palette on screen, "" for the site's own. Never stored twice. */
  const applied = () => {
    const name = root.getAttribute("data-palette") ?? "";
    // A stored palette that no longer exists in the CSS applies nothing, so it
    // is not the palette on screen either.
    return known.includes(name) ? name : "";
  };
  const shown = (family: Family) => {
    const now = applied();
    return now && familyOf(now) === family ? now : offer[family];
  };

  function paint() {
    const now = applied();
    for (const family of ["light", "dark"] as const) {
      const name = shown(family);
      const accent = accents.get(name);
      if (accent) corner.style.setProperty(`--palette-dot-${family}`, accent);
      // The accessible name is the state: which palette this mark is holding,
      // whether it is the one on screen, and what pressing will do. Not
      // aria-live — that would announce a colour change nobody asked to hear,
      // and refocusing a button re-reads its new name.
      buttons[family].setAttribute(
        "aria-label",
        name === now
          ? `${family === "light" ? "Light" : "Dark"} palette: ${label(name)}, on. Clear it for another.`
          : `${family === "light" ? "Light" : "Dark"} palette: ${label(name)}. Click to apply.`,
      );
      buttons[family].title = label(name);
    }
    clear.setAttribute("aria-label", "Clear the colour palette, back to the site's own.");
    clear.title = "Back to the site palette";
  }

  /**
   * Point the off mark at the slot it belongs in — directly above (desktop) or
   * to the left of (mobile) the family about to be applied. The component's
   * stylesheet does the arranging; this only records which family it is.
   *
   * WHY A FRAME IS FORCED. When the off mark is hidden it is parked half a slot
   * from wherever it will rise, and "wherever" has just changed. A transition
   * interpolates from the style the browser last computed, so writing the new
   * slot and the new palette in one go would make the mark rise from its OLD
   * slot — a 42px sweep up the stack instead of a 14px step into place. Setting
   * the slot with transitions switched off, forcing the style through, and only
   * then applying the palette makes the short move the one that animates.
   *
   * Only while it is hidden. With a palette already on, the mark is visible and
   * changing families should be seen: it glides to its new slot while the light
   * square glides the other way, and the two cross.
   *
   * THE SUPPRESSION IS INLINE AND THE FLUSH IS PER ELEMENT. Both used to go
   * through the stylesheet — an attribute on the corner that zeroed the duration
   * custom properties, then one `offsetWidth` read on the corner to force the
   * style through. That asks an engine to resolve a chain (attribute → custom
   * property → the `transition` shorthand that references it → the durations of
   * three descendants) inside a single task, and to have resolved it before the
   * next mutation is seen, which is the kind of thing engines are entitled to
   * disagree about. `transition-property: none` set straight on each element is
   * the one form none of them can misread, and reading back the very property
   * that will animate is the narrowest way to prove the new value has landed.
   */
  function aim(family: Family, hidden: boolean) {
    if (!hidden) {
      corner.dataset.family = family;
      return;
    }
    const marks = [clear, buttons.light, buttons.dark];
    for (const mark of marks) mark.style.transitionProperty = "none";
    corner.dataset.family = family;
    for (const mark of marks) void getComputedStyle(mark).translate;
    for (const mark of marks) mark.style.transitionProperty = "";
  }

  function apply(name: string) {
    const before = applied();
    if (before === name) return;
    // The family losing the page draws its next colour — the ONLY moment either
    // mark changes what it is offering. Turning a palette off is therefore what
    // asks for the next one, and a mark you have not touched keeps its offer.
    // Drawn against what is on the corner right now — the colour this mark is
    // giving up and the colour its neighbour is wearing — so the replacement is
    // visibly a replacement.
    if (before) {
      const cold = familyOf(before);
      offer[cold] = draw[cold]([accentOf(shown("light")), accentOf(shown("dark"))]);
    }
    // On the way out the aim is left alone, so the mark retreats to the slot it
    // arrived in rather than jumping across the stack as it fades.
    if (name) aim(familyOf(name), !before);

    if (name) root.setAttribute("data-palette", name);
    else root.removeAttribute("data-palette");
    // Engagement is recorded on the way past, whichever mark was pressed —
    // clearing counts too. It is what puts the marks on the home page, and
    // unlike the palette itself it is never taken back; see PALETTE_USED_KEY.
    root.setAttribute("data-palette-used", "");
    try {
      localStorage.setItem(PALETTE_USED_KEY, "1");
      if (name) localStorage.setItem(PALETTE_KEY, name);
      else localStorage.removeItem(PALETTE_KEY);
    } catch {
      // Storage blocked (Safari with cookies off, a partitioned iframe): the
      // palette still applies, it just will not outlive the page.
    }
    paint();
  }

  // Opening state: whatever the inline restore in <head> put on <html>. The
  // family that owns it shows it; the other one shows the colour it drew above.
  // The aim starts out matching, so the first clear retreats the way it came.
  const restored = applied();
  if (restored) corner.dataset.family = familyOf(restored);
  paint();
  // Only NOW may the corner animate its colours (see the component's
  // stylesheet). The first paint is a correction from the CSS fallback to the
  // real accents, and a fallback fading into the right answer on every page load
  // reads as a bug rather than as a transition.
  corner.dataset.ready = "";

  for (const family of ["light", "dark"] as const) {
    buttons[family].addEventListener("click", () => apply(shown(family)));
  }

  clear.addEventListener("click", () => {
    // The clear mark is only displayed while a palette is applied, so pressing
    // it removes the element under the pointer — and, for a keyboard visitor,
    // the element holding focus. Hand focus to the mark for the family being
    // turned off rather than letting it fall back to <body>, which would drop
    // them at the top of the tab order.
    const before = applied();
    const hadFocus = document.activeElement === clear;
    apply("");
    if (before && hadFocus) buttons[familyOf(before)].focus();
  });
}
