// Client behavior for Carousel.astro: Embla motion, blur-up cleanup, the
// single-highlight model, the "N of M" counter, and the reveal panel.
// Self-contained — it discovers every [data-carousel] section in the DOM and
// reads its configuration back off that element's data-* attributes, so it
// needs nothing passed in from Astro.

import EmblaCarousel from "embla-carousel";

// Blur-up cleanup now lives in its own module, because the carousel is not the
// only component that paints an LQIP placeholder. Importing it runs the sweep.
import "../lib/blur-up.client";

document.querySelectorAll<HTMLElement>("[data-carousel]").forEach((section) => {
  const enablePopup = section.dataset.enablePopup === "true";

  const viewport = section.querySelector<HTMLElement>(".embla__viewport");
  const slides = Array.from(section.querySelectorAll<HTMLElement>(".embla__slide"));
  const counter = section.querySelector<HTMLElement>(".carousel-counter");

  if (!viewport || slides.length === 0) return;
  const N = slides.length;

  // Where a slide has to sit, in px from the viewport's left edge, for the slide's
  // own horizontal centre to land exactly on the horizontal centre of the screen.
  // Embla calls this once per snap, so EVERY resting position of the strip —
  // arrows, arrow keys, swipe, drag — is one photo bisected by the middle of the
  // window.
  //
  // A function rather than align: "center", because the viewport is not the
  // screen. It starts at the content's left edge and bleeds off the right (see
  // .embla__viewport in Carousel.astro), and even full-bleed it is 100vw, which
  // includes a classic scrollbar; Embla's own "center" centres inside that box, so
  // the photo would sit half a gutter — or half a scrollbar — left of centre.
  // documentElement.clientWidth is the width actually shown, scrollbar excluded.
  //
  // Re-evaluated on every init and reInit, which is what makes it survive the
  // images loading (slide widths change), a window resize and a phone rotating.
  const centreOnScreen = (_viewportSize: number, slideSize: number) =>
    document.documentElement.clientWidth / 2 -
    viewport.getBoundingClientRect().left -
    slideSize / 2;

  const embla = EmblaCarousel(viewport, {
    align: centreOnScreen,
    containScroll: false,
    loop: true,
    slidesToScroll: 1,
  });

  // Re-measure after images are sized at load
  if (document.readyState === "complete") {
    embla.reInit();
  } else {
    window.addEventListener("load", () => embla.reInit(), { once: true });
  }

  // ── Drag cursor ─────────────────────────────────
  embla.on("pointerDown", () => viewport.classList.add("is-dragging"));
  embla.on("pointerUp", () => viewport.classList.remove("is-dragging"));

  // ── Highlight model ─────────────────────────────
  // Exactly one slide is highlighted at a time (or none at load). A single sticky
  // index, "last interaction wins":
  //   • desktop hover / keyboard focus → that slide (stays put after the mouse
  //     leaves, until another slide is hovered);
  //   • arrow button → the slide it lands on;
  //   • mobile swipe → the settled slide.
  // A desktop drag leaves it alone (so it never jumps to the first card). Applied
  // ONLY here via `.is-active` (no CSS :hover), which enforces the single highlight.
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  let activeIndex = -1; // -1 = nothing highlighted (the load state)
  let arrowNav = false; // true only while an arrow-button move is settling
  let swipeDir = 0; // +1 = images scrolled left (advance), -1 = scrolled right (back)

  // How long the highlight takes to cross from one photo to the next. Written to
  // --hl-dur, which is the transition-duration of `filter` and `opacity` on the
  // slide images (see .card__media img in Carousel.astro).
  //
  // TUNE THE CROSSFADE HERE — one line each, nothing else reads these:
  const HL_DURATION = {
    /** Desktop: moving the mouse from one photo to another. */
    hover: "500ms",
    /** Desktop: the prev/next arrow buttons. */
    arrow: "350ms",
    /** Touch: swiping back (right). Advancing snaps instantly instead. */
    swipeBack: "225ms",
    /** Taps, advance-swipes, and pressing the next image — no fade at all. */
    instant: "0ms",
  };
  const setHighlightDuration = (ms: string) => section.style.setProperty("--hl-dur", ms);

  function setActive(i: number) {
    activeIndex = i;
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === activeIndex));
    // Announce that the carousel has taken the highlight, so anything else on
    // the page that competes for attention can stand down. Every path that
    // highlights a slide — hover, focus, arrow buttons, swipe, tap — routes
    // through here, so this one line covers all of them.
    //
    // A generic DOM event rather than a direct call: the carousel stays a
    // self-contained component that knows nothing about its neighbours, and a
    // page with no listener is simply unaffected.
    if (i >= 0) {
      section.dispatchEvent(new CustomEvent("carousel:interact", { bubbles: true }));
    }
  }
  setActive(-1);

  // The mirror of the event above: something else on the page has claimed the
  // highlight, so drop ours and return every slide to its resting state — the
  // same all-grey strip the carousel loads with.
  //
  // This has to run through setActive rather than letting the other party strip
  // `.is-active` off the slides itself, or `activeIndex` would still point at a
  // slide that is no longer highlighted, and the next pointerdown would compare
  // against a stale position. Faded at hover speed so it reads as the highlight
  // moving away, not blinking out.
  document.addEventListener("carousel:release", () => {
    if (activeIndex < 0) return;
    setHighlightDuration(HL_DURATION.hover);
    setActive(-1);
  });

  // Mobile highlight speed: advancing — images scrolled LEFT — snaps in
  // instantly; going back — scrolled RIGHT — fades smoothly.
  function setHighlightSpeed() {
    setHighlightDuration(swipeDir > 0 ? HL_DURATION.instant : HL_DURATION.swipeBack);
  }

  // Physical swipe direction that feeds setHighlightSpeed().
  let downX = 0;
  viewport.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      downX = e.clientX;
      // Touch advance: the instant a finger lands on an image to the RIGHT of the
      // currently highlighted one (the gesture that scrolls images left), move the
      // highlight onto it immediately — don't wait for the swipe to settle. Pressing
      // the current/left image (a back-swipe) is left to settle smoothly on `select`.
      if (e.pointerType !== "touch") return;
      const slide = (e.target as HTMLElement).closest<HTMLElement>(".embla__slide");
      if (!slide) return;
      const cur = activeIndex >= 0 ? slides[activeIndex] : null;
      if (!cur || slide.getBoundingClientRect().left > cur.getBoundingClientRect().left + 1) {
        setHighlightDuration(HL_DURATION.instant);
        setActive(parseInt(slide.dataset.index ?? "-1", 10));
      }
    },
    { passive: true },
  );
  viewport.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      const dx = e.clientX - downX;
      if (Math.abs(dx) > 2) {
        swipeDir = dx < 0 ? 1 : -1;
        downX = e.clientX;
      }
    },
    { passive: true },
  );

  // Desktop hover / keyboard focus set the sticky highlight. Gated to the mouse
  // pointer and non-touch so a tap never sets a stuck highlight on touch devices.
  slides.forEach((slide, i) => {
    slide.addEventListener("pointerenter", (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setHighlightDuration(HL_DURATION.hover); // hover is always a smooth crossfade
      setActive(i);
    });
    if (!isTouch) slide.addEventListener("focusin", () => setActive(i));
  });

  // ── Counter ─────────────────────────────────────
  // Template comes from the `labels.counter` prop via a data attribute, so the
  // wording (and its language) is the caller's to set, not this file's.
  const counterLabel = section.dataset.counterLabel ?? "{n} of {total}";
  function updateCounter() {
    if (!counter) return;
    counter.textContent = counterLabel
      .replaceAll("{n}", String(embla.selectedScrollSnap() + 1))
      .replaceAll("{total}", String(N));
  }

  // Move the highlight onto the slide an arrow move landed on. Desktop: an
  // extra-smooth crossfade. Mobile: match the swipe feel (advance instant, back
  // smooth) — a long crossfade there leaves the old highlight lingering during the
  // fade, which reads as a stuck/double highlight.
  function commitArrowHighlight(idx: number) {
    if (isTouch) setHighlightSpeed();
    else setHighlightDuration(HL_DURATION.arrow);
    setActive(idx);
    arrowNav = false;
  }

  embla.on("select", () => {
    updateCounter();
    const idx = embla.selectedScrollSnap();
    if (arrowNav) {
      commitArrowHighlight(idx);
    } else if (isTouch) {
      setHighlightSpeed(); // swipe: advance instant, back smooth
      setActive(idx);
    }
    // desktop drag: leave the sticky highlight where it is
  });
  embla.on("reInit", updateCounter);
  updateCounter();

  // ── Arrow buttons ────────────────────────────────
  // Flag the move as arrow-driven (so `select` commits its highlight) and record the
  // direction: next = advance (instant), prev = back (smooth).
  //
  // One step is one photo on from the HIGHLIGHTED one, which on desktop is not
  // always the centred one — hover moves the highlight without moving the track.
  // Stepping from the track instead would answer "next" with the photo after
  // whatever happens to be centred, dragging the highlight backwards past the one
  // being looked at. This way every arrow press does the one thing: the photo after
  // the one you are on, centred.
  function step(dir: 1 | -1) {
    const from = activeIndex >= 0 ? activeIndex : embla.selectedScrollSnap();
    goTo((from + dir + N) % N, dir);
  }
  const goPrev = () => step(-1);
  const goNext = () => step(1);

  function goTo(index: number, dir?: 1 | -1) {
    arrowNav = true;
    swipeDir = dir ?? (index > embla.selectedScrollSnap() ? 1 : -1);
    // Already the centred slide — the highlight was sitting one step off-centre
    // after a hover. scrollTo would be a no-op and `select` would never fire, so
    // commit the highlight here rather than leave it on the previous photo.
    if (index === embla.selectedScrollSnap()) commitArrowHighlight(index);
    else embla.scrollTo(index); // loop mode takes the shorter way round
  }
  section.querySelector("[data-dir=prev]")?.addEventListener("click", goPrev);
  section.querySelector("[data-dir=next]")?.addEventListener("click", goNext);

  // ── Keyboard navigation ──────────────────────────
  // The viewport is overflow:hidden and not focusable, so without this the only
  // way to move the carousel from a keyboard is to Tab to the two arrow buttons.
  //
  // WHERE this listens is the `keyboard` prop (carousel.types.ts). On "section"
  // it hears only what bubbles out of the carousel, so the keys work once focus
  // is inside it — which is why clicking an arrow used to be the thing that
  // "switched them on": the click left focus on the button. On "page" it listens
  // at the document, so the keys work from a cold page load with focus still on
  // <body>. See the prop for why that is not the default.
  const onKeydown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;

    // Not while focus is inside an open panel: arrow keys have to keep scrolling
    // that text, which is the whole reason .card__panel-body carries tabindex="0".
    if (target?.closest(".card__panel")) return;

    // Someone is typing. Only reachable in "page" mode — there is no field
    // inside a carousel — but the check costs nothing and is what stops a
    // document-level listener from eating the caret keys in a form.
    if (
      target &&
      (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    ) {
      return;
    }

    // Something has taken the page over — MobileMenu marks every other
    // top-level element `inert` while it is open. Matching on the attribute
    // rather than asking the menu keeps this decoupled from it: anything that
    // inerts the carousel should also silence its keys.
    if (section.closest("[inert]")) return;

    switch (e.key) {
      case "ArrowLeft":
        goPrev();
        break;
      case "ArrowRight":
        goNext();
        break;
      case "Home":
        goTo(0);
        break;
      case "End":
        goTo(N - 1);
        break;
      default:
        return;
    }
    // Only reached when the key was handled — stop the page scrolling too.
    e.preventDefault();
  };

  if (section.dataset.keyboard === "page") {
    document.addEventListener("keydown", onKeydown);
  } else {
    section.addEventListener("keydown", onKeydown);
  }

  // ── Off-screen slides ────────────────────────────
  // The track loops and is clipped, so most slides are invisible at any moment —
  // but they stay in the tab order and the accessibility tree, and Tab walks
  // through every one of them including photos nobody can see. Hide those.
  //
  // NOT `inert`, which would be the one-attribute way to do this. `inert` also
  // makes the subtree non-hit-testable, which silently breaks the hover
  // highlight: a slide that is inert when the pointer enters it fires no
  // `pointerenter`, so it never becomes .is-active and never runs the crossfade.
  // The visible symptom is a highlight that stops following the mouse — most
  // obviously right after a scroll, when the card under a stationary cursor is
  // skipped entirely (pointerenter only fires on entry, and the cursor never
  // moved). aria-hidden + tabindex="-1" achieves the same tab-order and
  // screen-reader result and leaves pointer behaviour completely untouched.
  //
  // The slide holding focus is never hidden: `select` closes any open panel and
  // hands focus back to that slide's toggle, and hiding it in the same turn
  // would strand that focus inside an aria-hidden subtree.
  const FOCUSABLE = "a[href], button, [tabindex]";

  function setSlideHidden(slide: HTMLElement, hidden: boolean) {
    if (slide.dataset.offscreen === String(hidden)) return; // already in this state
    slide.dataset.offscreen = String(hidden);

    if (hidden) slide.setAttribute("aria-hidden", "true");
    else slide.removeAttribute("aria-hidden");

    // Take the controls out of the tab order too — aria-hidden alone would
    // leave a focusable element inside a hidden subtree, which is its own bug.
    // The authored tabindex is remembered so .card__panel-body gets its 0 back.
    for (const el of slide.querySelectorAll<HTMLElement>(FOCUSABLE)) {
      if (hidden) {
        if (el.dataset.tabindexWas === undefined)
          el.dataset.tabindexWas = el.getAttribute("tabindex") ?? "";
        el.setAttribute("tabindex", "-1");
      } else {
        const prev = el.dataset.tabindexWas;
        if (prev === undefined) continue;
        if (prev === "") el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", prev);
        delete el.dataset.tabindexWas;
      }
    }
  }

  function updateOffscreenSlides() {
    const inView = new Set(embla.slidesInView());
    // Before Embla has measured (and if it ever reports nothing), treat every
    // slide as visible. Hiding all of them would leave the carousel unreachable.
    if (inView.size === 0) {
      slides.forEach((slide) => setSlideHidden(slide, false));
      return;
    }
    slides.forEach((slide, i) => {
      const visible = inView.has(i) || slide.contains(document.activeElement);
      setSlideHidden(slide, !visible);
    });
  }
  embla.on("slidesInView", updateOffscreenSlides);
  embla.on("reInit", updateOffscreenSlides);
  // Re-evaluate when focus moves, so a slide that was hidden but has just been
  // scrolled into view (or out of it) settles into the right state.
  section.addEventListener("focusin", updateOffscreenSlides);
  updateOffscreenSlides();

  // ── Testimonial panel ────────────────────────────
  if (!enablePopup) return;

  function panelOf(slide: HTMLElement) {
    return slide.querySelector<HTMLElement>(".card__panel");
  }

  function closeAllPanels(except: HTMLElement | null) {
    slides.forEach((s) => {
      if (s === except || !isPanelShowing(s)) return;
      closePanel(s);
    });
  }

  function openPanel(slide: HTMLElement) {
    closeAllPanels(slide);
    const panel = panelOf(slide);
    if (panel) {
      // Start every reveal at the top of the quote. The panel keeps its DOM (and
      // so its scrollTop) between opens, so without this, reopening a long
      // testimonial drops you back wherever you happened to stop reading last
      // time — which reads as a rendering glitch, not as a memory aid.
      const body = panel.querySelector<HTMLElement>(".card__panel-body");
      if (body) body.scrollTop = 0;
    }
    // State that shouldn't wait for the animation.
    slide.querySelector(".card__toggle")?.setAttribute("aria-expanded", "true");
    // Highlight the source card while its panel is open
    setActive(parseInt(slide.dataset.index ?? "-1", 10));

    // Two-step open, so the rise mirrors the fall. Step one makes the panel
    // visible while it is still parked off-screen (see .is-panel-priming in
    // Carousel.astro) — that is the frame the browser spends painting the text.
    // Step two, a full frame later, starts the slide against painted content.
    // Without the gap the paint and the first transition frames collide and the
    // rise stutters; the fall never did, because the text was already painted.
    //
    // Two rAFs, not one: the first fires BEFORE the pending paint, the second
    // after it, which is what actually guarantees a painted panel.
    slide.classList.add("is-panel-priming");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Bail if it was closed again in those two frames (fast toggling).
        if (!slide.classList.contains("is-panel-priming")) return;
        slide.classList.add("is-panel-open");
        // Move focus into what just opened. The panel precedes the toggle in the
        // DOM, so without this, Tab from the toggle walks AWAY from the content
        // the user just revealed. The close button is the natural landing spot,
        // and mirrors closePanel(), which returns focus to the toggle.
        // preventScroll: the button is absolutely positioned inside a panel that
        // is mid-slide, and letting the browser scroll it into view yanks the
        // page while the animation runs.
        slide.querySelector<HTMLElement>(".card__panel-close")?.focus({ preventScroll: true });
      }),
    );
  }

  function isPanelShowing(slide: HTMLElement) {
    // "Showing" covers the two-frame priming window as well as the open state,
    // so a fast second click closes the panel instead of re-opening it.
    return (
      slide.classList.contains("is-panel-open") || slide.classList.contains("is-panel-priming")
    );
  }

  function closePanel(slide: HTMLElement) {
    // Whether focus is inside the panel we're about to close. Must be read
    // BEFORE the classes come off, while the panel is still focusable.
    const panel = panelOf(slide);
    const hadFocus = !!panel && panel.contains(document.activeElement);

    slide.classList.remove("is-panel-open", "is-panel-priming");
    slide.querySelector(".card__toggle")?.setAttribute("aria-expanded", "false");

    // Return focus to the toggle that opened this panel. Without it, the panel
    // goes visibility:hidden 0.44s later with focus still inside it, focus falls
    // to <body>, and a keyboard user is silently dumped at the top of the
    // document (WCAG 2.4.3). This lives here rather than in the close-button
    // click handler so EVERY close path is covered — Escape and the carousel
    // settling on another slide both call closePanel() too.
    // preventScroll: the carousel may be mid-transition; letting the browser
    // scroll the toggle into view yanks the page.
    if (hadFocus) {
      slide.querySelector<HTMLElement>(".card__toggle")?.focus({ preventScroll: true });
    }

    // Dropping .is-panel-priming hands visibility back to the base rule, whose
    // `transition: visibility 0s 0.44s` keeps the panel painted for the whole
    // slide-out and only then hides it — which is what takes it back out of the
    // tab order and the accessibility tree.
  }

  // Embla stopPropagation()s click in capture phase after drags,
  // so this only fires on genuine taps/clicks (< dragThreshold movement).
  section.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Whole caption box (name + quote + arrow) toggles the panel.
    const caption = target.closest<HTMLElement>(".card__caption");
    if (caption) {
      const slide = caption.closest<HTMLElement>(".embla__slide");
      if (!slide || !panelOf(slide)) return;
      isPanelShowing(slide) ? closePanel(slide) : openPanel(slide);
      return;
    }

    const close = target.closest<HTMLElement>(".card__panel-close");
    if (close) {
      // closePanel() returns focus to the toggle itself — focus is on this
      // button, which is inside the panel.
      const slide = close.closest<HTMLElement>(".embla__slide");
      if (slide) closePanel(slide);
      return;
    }

    // A plain tap on the image highlights that slide — on touch there's no hover to
    // do it. (Suppressed after a drag by Embla, so only genuine taps get here.)
    const media = target.closest<HTMLElement>(".card__media");
    if (media && !target.closest(".card__panel")) {
      const slide = media.closest<HTMLElement>(".embla__slide");
      if (slide) {
        setHighlightDuration(HL_DURATION.instant); // a direct tap highlights instantly
        setActive(parseInt(slide.dataset.index ?? "-1", 10));
      }
    }
  });

  // Close on Escape and whenever the carousel settles on another slide
  // (swipe, drag, and the prev/next arrows all fire 'select').
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") closeAllPanels(null);
  });
  embla.on("select", () => closeAllPanels(null));
});
