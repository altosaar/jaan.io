// Helpers that stand in for the parts of a Framework *page* that an exported
// module does not get.
//
// On a Framework page, a `js` block re-runs whenever a value it references
// changes — that is what `Generators.input(yearInput)` buys you, and it is the
// only Framework feature these visualizations relied on that does not come
// along with an exported module. `reactive()` below is the replacement: an
// explicit "when any of these inputs fires, render again" loop.

/**
 * Wire a set of Observable Inputs to a render function.
 *
 * Returns a container holding the controls and, beneath them, whatever
 * `render` most recently produced. `render` is called once immediately and
 * again on every `input` event from any control; it may be async.
 *
 * Renders are sequenced, not just awaited. Dragging the year slider fires an
 * event per step and each one starts a DuckDB query; those queries do not
 * necessarily finish in the order they were issued, so a slow early one can
 * land after a fast later one and leave the chart showing the wrong year. The
 * `seq` counter drops any result that is no longer the newest request.
 *
 * @param {Array<{control: Element, label?: () => string}>} controls
 * @param {() => Node | Promise<Node>} render
 */
export function reactive(controls, render) {
  const root = document.createElement("div");
  root.className = "viz";

  const bar = document.createElement("div");
  bar.className = "viz-controls";
  for (const { control, label } of controls) {
    const group = document.createElement("div");
    group.className = "viz-control";
    if (label) {
      const readout = document.createElement("span");
      readout.className = "viz-readout";
      group.append(readout);
      control.addEventListener("input", () => (readout.textContent = label()));
      readout.textContent = label();
    }
    group.append(control);
    bar.append(group);
  }

  const slot = document.createElement("div");
  slot.className = "viz-figure";
  // Reserve height so the page does not jump when the first render lands.
  slot.style.minHeight = "420px";
  root.append(bar, slot);

  let seq = 0;
  async function update() {
    const mine = ++seq;
    const node = await render();
    if (mine !== seq) return; // a newer render has already been requested
    slot.replaceChildren(node);
  }
  for (const { control } of controls) control.addEventListener("input", update);
  update();

  return root;
}

/**
 * Read a DuckDB result as plain JS rows.
 *
 * `db.query` hands back an Apache Arrow table. The pages this was ported from
 * each reimplemented this by hand — walking `result.batches[0].data.children[0]
 * .valueOffsets` and decoding UTF-8 out of a Uint8Array — which only ever read
 * the FIRST record batch, so any result DuckDB split across batches was
 * silently truncated. `toArray()` is the supported way to do it and has no
 * such limit.
 */
export const rows = (table) => table.toArray();

/** The distinct values of one column, in the order the query returned them. */
export const column = (table, name) => rows(table).map((d) => d[name]);

/**
 * The page's chart colours, in order of use: --series-1, --series-2, … as the
 * palette on screen defines them (src/styles/tokens.css for the site's own,
 * src/styles/series.css per palette). Hand it to a scale as the range:
 *
 *   Plot.plot({ color: { domain, range: seriesColors() }, … })
 *   vg.colorRange(seriesColors())
 *
 * Read off <html> at call time, so the answer is whichever palette is applied
 * right now. Every one is a legal mark on that palette's background and every
 * pair stays distinct under simulated colour-vision deficiencies — the first
 * six more so, which is why a chart should take them from the front.
 *
 * Plot and Mosaic bake the colours into the SVG they draw, so a chart that
 * should follow the palette switcher has to draw again: see onPaletteChange.
 */
export function seriesColors() {
  const style = getComputedStyle(document.documentElement);
  const out = [];
  for (let i = 1; ; i++) {
    const value = style.getPropertyValue(`--series-${i}`).trim();
    if (!value) return out;
    out.push(value);
  }
}

/**
 * Call `fn(seriesColors())` whenever the palette switcher changes the page's
 * palette (src/lib/palette.client.ts sets `data-palette` on <html>, and that is
 * the whole mechanism). Returns a function that stops listening.
 *
 * No settle delay, unlike MermaidRuntime.astro: the tokens THAT component reads
 * are registered with @property and crossfade, so mid-transition it would read
 * a colour between two palettes. The --series-* tokens are deliberately left
 * unregistered, so they have their new values as soon as the attribute does.
 */
export function onPaletteChange(fn) {
  const observer = new MutationObserver(() => fn(seriesColors()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-palette"],
  });
  return () => observer.disconnect();
}
