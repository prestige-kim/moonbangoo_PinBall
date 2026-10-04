# 유리 대포 연출 이미지

사용자가 제공한 두 장의 이미지를 `imagegen` 내장 도구의 편집 모드로 가공했습니다. 로고·문구·고정된 구슬을 제거한 배경 위에 실제 참가자 구슬을 Canvas로 실시간 합성합니다. 미리 녹화한 영상이 아니라 사진 기반 2.5D 연출입니다.

- 정면 배경: [cannon-front.png](./cannon-front.png)
- 발사 각도 배경: [cannon-angle.png](./cannon-angle.png)
- 원본 크기: 각각 1678 × 937

## 정면 배경 최종 프롬프트

Edit target: the supplied first image of the horizontal ornate glass cannon. Production asset for an animated website, image-edit / object-removal. Keep the exact 16:9 composition, camera angle, ivory paper background, realistic warm studio illumination, golden filigree cuffs, barrel location and dimensions, clear glass reflections, and ground shadow. Remove ALL marbles from inside the glass barrel; the barrel must be completely empty and transparent, with the ivory background visible through it. Remove all logos, Korean lettering, decorative text and the start button above and below the cannon, replacing those areas seamlessly with the same ivory paper background. Do not add anything else. No balls, no letters, no button, no UI, no confetti. Preserve exceptionally high-quality photographic gold material and glass. Match the reference geometry precisely: long cannon horizontally from approximately x14% to83%, y34% to77%. Output a single full-frame clean empty-cannon plate.

## 발사 배경 최종 프롬프트

Edit target: the supplied second image of a glass and gold cannon aimed up-right on a wheel. Production empty plate for a cinematic website animation, image-edit / object-removal. Preserve exact 16:9 camera composition, ornate golden cannon and wheel in lower-left, cannon angled up toward the upper-right, photorealistic gold scrollwork, transparent glass barrel, warm ivory background and realistic soft studio shadows. Remove ALL marbles: both those inside the glass and flying outside. Remove ALL sparkle trails/confetti/particles. Remove the entire target board on the right including lettering and rings, replacing it with a seamless warm ivory studio background/ground. No balls, no target, no writing, no interface. Keep empty transparent glass and the cannon muzzle opening, exact object placement and perspective as source. High-quality realistic materials, full-frame clean empty-cannon plate.


## 독립 바퀴 조립 자산 (2026-10-04)

`imagegen` 내장 편집 모드로 기존 발사 사진을 두 부분으로 분리했습니다. 몸체는 같은 관축 좌표를 유지한 배경 사진이며, 바퀴는 살 사이까지 투명한 PNG입니다. Canvas에서 바퀴가 회전하며 올라와 축에 안착하고, 몸체만 반동하도록 합성합니다.

- 바퀴 없는 몸체: [cannon-barrel.png](./cannon-barrel.png), 1678 × 937
- 투명 바퀴: [cannon-wheel.png](./cannon-wheel.png), 1254 × 1254
- 참조: 기존 [cannon-angle.png](./cannon-angle.png)

### 몸체 편집 최종 프롬프트

Edit the supplied image for a cinematic game. Remove ONLY the large foreground gold spoked wheel and its little axle/cradle (roughly x16%-33%,y63%-89%). Reconstruct the ornate glass cannon barrel realistically behind the removed wheel. Keep the entire cannon barrel in EXACT same location, angle and size: rear gold cap at x9%-20% y60%-82%; transparent cylindrical chamber x16%-35% y45%-70%; ornate muzzle cuff x29%-41% y39%-65%. The cannon is suspended at this unchanged angle as if supported out of view. Do not move, rotate, resize or redesign the barrel. Keep original full 1678x937 16:9 canvas composition, ivory studio background, studio light, material texture and soft shadow. Empty glass chamber with no balls. No wheels, no stand or platform, no new objects, no lettering, no UI. This wheel-less cannon plate will be composited with a separately animated wheel. Precise object removal with aggressive preservation of all remaining pixels and geometry.

### 바퀴 분리 최종 프롬프트

Create a production game sprite extracted from the supplied cannon reference: ONLY the ornate gold spoked wheel in the foreground, no cannon or glass barrel or background. Match its aged golden-brass outer rim, elegant looped/petal-shaped thin spokes, central round axle hub, real metallic reflections, shallow bevels and nearly face-on perspective exactly. Wheel seen as in original image, slight perspective oval, all spokes and outer rim intact. Make a square transparent-background PNG. Isolated wheel centered, filling 85% of image width and height, no shadow extending beyond wheel, all empty spaces between spokes truly transparent, no ivory matte, no text, no extra objects. Preserve photorealism and softly lit warm gold. Intended for independent wheel rotation and attachment beneath the cannon.
