# Generated map backgrounds

Four opaque portrait PNGs generated with the built-in image_gen tool. Exact prompts are recorded in manifest.json.

- classic-background-v1.png: lotus pond, reeds, koi and river stones.
- twinfold-background-v1.png: walnut shelves, books, ladder, parchment and window light.
- cascade-background-v1.png: sandstone strata, copper veins, fossils and desert plants.
- rhythm-background-v1.png: brass gears, copper pipes, gauges and turquoise conduits.

These are decorative backgrounds with no collision geometry. The central play lane is kept quiet by a board-colored veil. Ambient backgrounds use aspect-preserving cover; the world board uses vertically mirrored tiles with opaque backing and one-pixel overlap to avoid seams. Cached board raster density is capped at 2.

The map selector, setup, shuffle, launch transition, race and results use the same selected-map image. The welcome scene retains the shared studio artwork. Image readiness rebuilds the board background and invalidates cinematic caches using map id and background revision. Failed/pending image loads retain the procedural fallback.
