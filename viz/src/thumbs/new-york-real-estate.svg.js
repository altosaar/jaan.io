// charts/new-york-real-estate.js — the map's opening view, centre [-74, 40.7]
// at zoom 12.5, cropped to the mark's aspect.
//
// This is the only page with no chart to shrink: it is 850,000 tax lots in a
// PMTiles archive rendered by a GPU. So the mark is built from those same
// parcels — scripts/make-thumb-data.mjs reads them straight out of the archive
// the map serves and rasterises 150,000 of them by lot area — rather than from
// a borough outline or any other stand-in.
//
// A raster because at this size every lot is far smaller than a pixel: what the
// map looks like from far enough away is the FOOTPRINT of the parcels, solid
// where the city is built and empty over water, parks, rail yards and runways.
// That is what a coverage grid draws.
import { emitRaw, loadBase64, maskedRaster, WIDTH, HEIGHT } from "./mark.js";

emitRaw(
  maskedRaster({
    id: "viz-mask-parcels",
    png: loadBase64("nyc-parcels.png"),
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
  }),
);
