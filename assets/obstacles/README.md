# Generated obstacle materials

Four map-specific transparent PNG materials generated with the built-in image_gen tool.
Exact generation prompts, the clockwork follow-up edit prompt, dimensions and alpha-content source rectangles are recorded in manifest.json.

- classic-surface-v1.png: bamboo, jade water carving and aged brass.
- twinfold-surface-v1.png: walnut, green leather and brass fittings.
- cascade-surface-v1.png: layered sandstone and copper.
- rhythm-surface-v2.png: solid antique brass, bronze and turquoise enamel.

The renderer clips each material to the existing capsule or pin circle at its actual physical pose. Alpha margins are excluded using manifest source rectangles. No physics dimensions, map versions or replay signatures change. Images load once per map and fall back to the existing drawing while pending or unavailable.

The first clockwork variant was too dark against the board; it is archived at docs/obstacle-art/rhythm-first-pass.png. The final v2 keeps the same silhouette with a broad brass face.
