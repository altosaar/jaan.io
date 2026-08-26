// PALETTE TEST — the half of the palette switcher that has to run in <head>.
//
// The switcher itself is src/lib/palette.client.ts, loaded as a module by
// src/components/PaletteToggle.astro. A module script is deferred: it runs after
// the document has parsed, which is fine for a click handler and useless for
// RESTORING a choice — the page would paint in the site's own black, then jump
// to the visitor's palette a moment later. Every page they read, forever.
//
// So the restore is a few dozen bytes of inline script in <head>, run before the
// parser reaches <body>, exactly like FAVICON_PICKER above it in Base.astro and
// for exactly the same reason.
//
// It is deliberately incurious about the value it finds. Validating the name
// against the list would mean shipping the list twice — palette.client.ts reads
// it out of the stylesheet at runtime precisely so it exists in one place — and
// an unrecognised name matches no rule and renders the default palette, which is
// the same outcome the validation would have produced.
//
// It carries the used-flag across for the same timing reason as the palette: on
// the home page that flag decides whether the marks are rendered at all, and
// deciding it from a deferred script would flash a control onto a page built to
// be one uninterrupted screen — or flash one off it.

/** localStorage key holding the chosen palette's slug. Absent = the site's own. */
export const PALETTE_KEY = "jaan-palette";

/**
 * localStorage key set the first time any of the three marks is pressed, and
 * never cleared.
 *
 * It exists because the home page asks a different question than the rest of the
 * site. Everywhere else the marks are simply there; on the home page they appear
 * only for someone who has already found them elsewhere — that page is one
 * composed screen with a single idea on it, and a first-time visitor should meet
 * it in the site's own colours rather than with a colour toy in the corner.
 *
 * WHY IT IS NOT PALETTE_KEY. That one is removed when a palette is cleared, so
 * keying the home page on it would mean the off mark deletes the whole control
 * from under the visitor's finger: press it once on the home page and there is
 * nothing left to press. This is a record of engagement, not of state — once you
 * have used the thing it is yours, including the right to turn it off and pick
 * again.
 */
export const PALETTE_USED_KEY = "jaan-palette-used";

/**
 * Reapply the stored palette, as source for an `is:inline` <script> in <head>.
 *
 * try/catch because localStorage is not merely empty but THROWS on access in a
 * few configurations — Safari with cookies blocked, an iframe with third-party
 * storage partitioned off. An exception here would abort the whole inline
 * script; the site's own palette is the right answer in that case anyway.
 */
export const PALETTE_RESTORE =
  `(function(){try{var d=document.documentElement,` +
  `p=localStorage.getItem(${JSON.stringify(PALETTE_KEY)});` +
  `if(p)d.setAttribute("data-palette",p);` +
  `if(localStorage.getItem(${JSON.stringify(PALETTE_USED_KEY)}))` +
  `d.setAttribute("data-palette-used","")}catch(e){}})()`;
