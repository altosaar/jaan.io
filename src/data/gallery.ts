// The photo gallery — every image and its alt text, in one file.
//
// ADDING OR REMOVING A PHOTO
//   1. Put it in (or take it out of) ~/Pictures/_jaan.io-picpicks
//   2. npm run photos          — resizes, de-rotates, prunes what is gone
//   3. Add its line below       — the build tells you the exact filename
//
// There is no per-photo Markdown file and no content collection. Sixteen files
// whose entire contents were an image path, an alt string and a sort order were
// sixteen places to look for one table, and the sort order was fiction: the
// strip is shuffled on every build (see the end of this file). This is that
// table.
//
// WHY THE DIRECTORY IS THE SOURCE OF TRUTH
// The list of photos is not written down here — it is whatever is in
// src/assets/gallery, discovered at build time. That is the whole point: a
// photo cannot be in the folder and missing from the gallery, because nothing
// has to remember to list it. What CANNOT be discovered is what a photograph
// shows, so that is the one thing authored by hand, and the checks below make
// the two agree or stop the build.
import type { ImageMetadata } from "astro";
import { SITE } from "../site.config";

/**
 * What each photograph shows, keyed by its filename in src/assets/gallery.
 *
 * These describe the frame — who is in it, where, what the light is doing —
 * and never name anyone. The people here are private individuals photographed
 * on the street and at events, not public figures, and a name in alt text is a
 * name published on the open web attached to a face. The filenames are opaque
 * for the same reason: `portrait-04.jpg` is a URL and a first name would be
 * too. (One source file was called `nicole.jpg`; it never reached the repo
 * under that name.)
 *
 * They are also what the tooltip shows on hover — see Carousel.astro.
 */
const ALT: Record<string, string> = {
  "portrait-02.jpg":
    "A woman with long grey-blonde hair smiles broadly on a city street at dusk, out-of-focus traffic lights blooming red and green behind her.",
  "portrait-03.jpg":
    "A woman with windblown platinum hair on a rooftop, the Manhattan skyline soft and blue behind her.",
  "portrait-04.jpg":
    "A close portrait of a young woman with long fair hair and a gold hoop earring, looking just past the camera with a level, unsmiling expression, summer foliage blurred to green behind her.",
  "portrait-05.jpg":
    "A woman with a natural afro stands on the Williamsburg Bridge walkway, its red railings receding behind her.",
  "portrait-06.jpg":
    "A woman with dark hair and a nose ring smiles gently in a park, greenery and a brick building blurred behind her.",
  "portrait-07.jpg":
    "A woman's face framed by a dense tangle of green branches, one eye catching the light as she smiles through the foliage.",
  "portrait-08.jpg":
    "A man in a patterned headwrap, sunglasses and feathered wings presses his palms together in greeting behind a yellow scooter strung with sunflowers and LED lights on a wet night street.",
  "portrait-12.jpg":
    "An older woman in a quilted cap and denim jacket turns toward the camera with a warm, crinkled smile.",
  "portrait-13.jpg":
    'An older man in a checked shirt and a YOLO snapback with a "Knowledge is Power" pin looks directly at the camera, a city street soft behind him.',
  "portrait-14.jpg":
    "An older woman with a shock of white hair and a green top gives a small, closed-mouth smile on a residential street.",
  "portrait-15.jpg":
    "Two women lean cheek to cheek at an outdoor evening event, formally dressed, other guests blurred behind them.",
  "portrait-16.jpg":
    "A man in a navy jacket smiles off to one side, a lake and dark trees soft in the background.",
  "portrait-17.jpg":
    "Shot from below, a woman leans down toward the camera on a flight of pale stone steps, her long dark hair blown sideways across her face, in an orange cropped top against a clear blue sky.",
  "portrait-18.jpg":
    "A young man in a blue polo shirt with a gold hoop earring tilts his head and smiles slightly, a painted sky of clouds and rooftop scaffolding behind him.",
  "portrait-19.jpg":
    "A man in round gold glasses laughs with his eyes shut and a hand on his head, a streak of green paint on one cheek and an event wristband on his wrist, a park and a domed building behind him.",
};

/**
 * Every photo in the folder, as Astro image metadata.
 *
 * `eager` because these are needed to render, not on demand, and the glob is a
 * literal because Vite has to statically analyse it — a variable path here
 * compiles to nothing and the gallery silently empties.
 */
const files = import.meta.glob<{ default: ImageMetadata }>("../assets/gallery/*.jpg", {
  eager: true,
});

const found = new Map(
  Object.entries(files).map(([path, mod]) => [path.split("/").pop()!, mod.default]),
);

// Both directions, because both failures are silent otherwise: a photo with no
// description would ship as an unlabelled image, and a description with no
// photo means a rename went half-done and some picture is now being described
// by the wrong words. Thrown at build time, naming the files, so `npm run
// build` says exactly what to do.
const undescribed = [...found.keys()].filter((name) => !ALT[name]).sort();
if (undescribed.length > 0) {
  throw new Error(
    `[gallery] No alt text for: ${undescribed.join(", ")}\n` +
      `Add a line for each to the ALT table in src/data/gallery.ts, describing ` +
      `what the photograph shows.`,
  );
}

const orphaned = Object.keys(ALT)
  .filter((name) => !found.has(name))
  .sort();
if (orphaned.length > 0) {
  throw new Error(
    `[gallery] Alt text for missing photos: ${orphaned.join(", ")}\n` +
      `Either the file was removed (delete these lines) or npm run photos has ` +
      `not been run since it was added.`,
  );
}

export interface GalleryPhoto {
  /** Named `img` to match CarouselItem, so the array can be passed straight in. */
  img: ImageMetadata;
  alt: string;
}

const photos: GalleryPhoto[] = [...found.entries()].map(([name, img]) => ({
  img,
  alt: ALT[name]!,
}));

/**
 * A different order every build.
 *
 * These are sixteen portraits with no argument running between them — no
 * chronology, no series, no first among them — so any fixed order is one the
 * viewer will read meaning into that is not there. Shuffling makes the absence
 * of an order visible, and gives the photo that would otherwise always be
 * sixteenth its turn at the front.
 *
 * Fisher-Yates rather than `sort(() => Math.random() - 0.5)`, which is not a
 * shuffle: it feeds an inconsistent comparator to an algorithm entitled to
 * assume a consistent one, and leaves items measurably near where they started.
 *
 * Module scope, so it runs ONCE per build and every page in that build agrees
 * on the order — a shuffle per render would disagree between the markup and
 * anything derived from it.
 */
function shuffled(list: GalleryPhoto[]): GalleryPhoto[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const gallery: GalleryPhoto[] = SITE.features.randomizeGallery ? shuffled(photos) : photos;
