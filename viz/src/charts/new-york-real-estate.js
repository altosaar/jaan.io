// 850k New York City properties — MapPLUTO, rendered from a PMTiles archive.
//
// Ported from jaan.li/new-york-real-estate. The tileset is 101 MB, far past
// Cloudflare Pages' 25 MiB per-file ceiling, so it is served from R2. That is
// the right home for it regardless: PMTiles is a range-request format, and the
// map pulls only the tiles for the current viewport.
import maplibregl from "npm:maplibre-gl@4.0.2";
import { Protocol } from "npm:pmtiles@3.0.3";
import { remote } from "./config.js";

const TILES = remote("new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles");
const LAYER = "dataMapPLUTO24v1_wgs84";

// Lower Manhattan and the western Brooklyn/Jersey City waterfront.
const CENTER = [-74, 40.7];
const ZOOM = 12.5;

// Teach MapLibre the pmtiles:// scheme. Registered once per page load — a
// second addProtocol for the same scheme throws, and this module is a
// singleton per document, so the guard is all that is needed.
let protocol;
function registerPMTiles() {
  if (protocol) return;
  protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

export function PropertyMap({ height = 720 } = {}) {
  registerPMTiles();

  const div = document.createElement("div");
  div.className = "viz viz--map";
  div.style.height = `${height}px`;

  const map = new maplibregl.Map({
    container: div,
    zoom: ZOOM,
    center: CENTER,
    // Protomaps' dark basemap, to match the original. The key is Jaan's and is
    // already public in the jaanli/jaan.li repo this was ported from.
    //
    // It is ORIGIN-LOCKED, and that list is held in the Protomaps dashboard —
    // nothing in this repo. For an origin that is not on it the API answers
    // 200 with no `access-control-allow-origin`, so the browser blocks the
    // response and MapLibre reports only `TypeError: Failed to fetch`. The
    // style never loads, `map.on("load")` below never fires, and NEITHER layer
    // is ever added: the reader gets an empty box rather than a broken map.
    //
    // That is exactly what jaan.io served after the port, because the list had
    // been written for jaan.li and localhost. https://jaan.io, the two pages.dev
    // origins and http://localhost:4321 are all on it now. Add any new origin
    // there BEFORE pointing it at this page; the same lock covers the tile
    // endpoint the style refers to, not just the style JSON.
    style: "https://api.protomaps.com/styles/v2/black.json?key=7c0c24912bd59a0f",
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // MapLibre measures its container once, at construction. This node is still
  // DETACHED at that point — VizEmbed hands the module's return value to the
  // page loader, which appends it a tick later (see src/layouts/Viz.astro) — and
  // a detached div has no layout, so the canvas is sized at MapLibre's 400x300
  // fallback and stays there. The symptom is a small map drawn into the top-left
  // corner of the reserved 720px box, with the zoom control stranded at the far
  // right edge of the empty remainder.
  //
  // `trackResize` (on by default) does not cover this: it listens for *window*
  // resizes, and no window resize happens when a node is appended.
  //
  // A ResizeObserver does. It fires as soon as the node lands in the document
  // and has a size, and again on every later reflow of the column — so the same
  // line also makes the map responsive, which it previously was not below the
  // breakpoint where the figure changes width.
  new ResizeObserver(() => map.resize()).observe(div);

  map.on("load", () => {
    map.addSource(LAYER, { type: "vector", url: `pmtiles://${TILES}` });

    map.addLayer({
      id: LAYER,
      source: LAYER,
      "source-layer": LAYER,
      type: "fill",
      paint: {
        "fill-color": ["case", ["boolean", ["feature-state", "hover"], false], "red", "steelblue"],
        "fill-opacity": 0.7,
      },
    });

    map.addLayer({
      id: `${LAYER}_stroke`,
      source: LAYER,
      "source-layer": LAYER,
      type: "line",
      paint: { "line-color": "cyan", "line-width": 0.2 },
    });

    // Hovering a lot shows every MapPLUTO column it carries — which is the
    // point of the map, so the popup is a dump of the feature's properties
    // rather than a curated few.
    let hoveredId = null;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    const setHover = (id, hover) =>
      id != null && map.setFeatureState({ source: LAYER, sourceLayer: LAYER, id }, { hover });

    map.on("mousemove", LAYER, (e) => {
      if (!e.features.length) return;
      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;
      // textContent per row, not an HTML string: these are values out of a
      // city data file, and building markup by concatenation would let any
      // stray angle bracket in them render as markup.
      const table = document.createElement("table");
      table.className = "viz-popup";
      for (const [key, value] of Object.entries(props)) {
        const tr = table.insertRow();
        tr.insertCell().textContent = key;
        tr.insertCell().textContent = value;
      }
      popup.setLngLat(e.lngLat).setDOMContent(table).addTo(map);

      setHover(hoveredId, false);
      hoveredId = e.features[0].id;
      setHover(hoveredId, true);
    });

    map.on("mouseleave", LAYER, () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
      setHover(hoveredId, false);
      hoveredId = null;
    });
  });

  return div;
}
