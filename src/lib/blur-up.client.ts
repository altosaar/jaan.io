// Blur-up cleanup, shared by every component that paints an LQIP placeholder
// (see src/lib/lqip.ts for how the placeholder itself is generated).
//
// Once a photo has painted, drop its LQIP background so the placeholder bytes
// are freed. Progressive enhancement: opaque cover photos already occlude the
// blur, so the effect works with JS disabled — this just tidies up after.
//
// This lives in its own module rather than inside carousel.client.ts because
// the carousel is no longer the only thing that blurs up (PortraitBlink.astro
// does too). Importing it from several components is safe: the bundler emits it
// once per page, so the DOM sweep below runs a single time.

export function initBlurUp(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>("img[data-blur-up]").forEach((img) => {
    // Drops the whole inline style the blur-up needed — the LQIP background and
    // the `color:transparent` that hid the alt text while it loaded. Also runs on
    // `error`: a photo that never arrives should show its alt text, and leaving
    // the colour transparent would paint that text invisibly.
    const clear = () => {
      img.removeAttribute("style");
    };
    if (img.complete && img.naturalWidth > 0) clear();
    else {
      img.addEventListener("load", clear, { once: true });
      img.addEventListener("error", clear, { once: true });
    }
  });
}

initBlurUp();
