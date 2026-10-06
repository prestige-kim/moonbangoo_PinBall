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

## 현재 에셋으로 구현한 범위와 남는 한계 (2026-10-06)

기존 PNG를 그대로 사용합니다. 새 이미지·영상·3D 모델을 추가하지 않았습니다. 런타임 Canvas 합성으로 사진 주변의 종이·고정 그림자를 부드러운 영역 마스크로 줄이고, 정면/측면의 유리 관축을 맞춰 표면을 축 방향으로 순차 전환합니다. 바퀴는 별도 PNG를 회전하며 조립하고, 구슬·유리·바퀴에 위쪽 왼쪽의 따뜻한 보조 조명과 공통 바닥/접촉 그림자를 사용합니다. 압력 발광, 섬광, 감쇠 반동, 짧은 속도 잔상, 연기·충격파와 부드러운 카메라 이동을 실시간으로 합성합니다.

| 항목 | 현재 가능 범위 | 추가 자산이 필요한 범위 |
| --- | --- | --- |
| 대포 변형 | 관축·크기·회전의 연속 이동, 넓은 사진 디졸브 대신 좁은 축 방향 표면 전환 | 동일한 대포를 촬영/렌더한 중간 각도와 정확한 투명 실루엣. 현재 두 사진은 금속 문양·끝단 형상이 달라 중간에 형상 변화와 종이색 가장자리가 남습니다. |
| 조명·유리 | 화면의 동일한 방향에서 보조 하이라이트/접촉 그림자 합성 | 사진에 고정된 반사를 제거하거나 실제 시점에 따라 반사·굴절을 계산하려면 깊이·노멀·재질 정보 또는 3D 메시가 필요합니다. 현재 유리는 물리 기반 굴절이 아닙니다. |
| 바퀴·조립 | 독립 바퀴의 회전, 축에 안착, 받침과 바닥 그림자 | 축·받침·반대쪽 바퀴까지 분리된 자산 또는 리깅된 3D 모델. 바퀴 PNG의 기존 금속 반사는 완전히 다시 조명할 수 없습니다. |
| 카메라·발사 | 한 장면 안에서 놀이판을 향해 이동, 압력/발사/반동과 구슬 이동 연결 | 자유로운 3D 회전·후면 노출·정확한 시차에는 유리/금속/바퀴가 분리된 PBR 모델과 카메라/바퀴/반동 리그가 필요합니다. 연기는 2D 입자이며 볼륨 시뮬레이션이 아닙니다. |

사진 기반 2.5D에서 가능한 개선입니다. 실제 3D 촬영이나 완전한 금속/유리 재질 변형으로 보장하지 않습니다. 500구슬은 모두 시뮬레이션·합성하지만 작은 화면에서 개별 구슬을 계속 식별하기는 어렵습니다. 그림자와 속도 잔상은 인원·품질에 따라 표본을 제한하고 실제 참가자와 출발 위치는 생략하지 않습니다.


## 중간 관점 이미지 추가 (2026-10-07)

- [cannon-bridge.png](./cannon-bridge.png): 정면 유리관과 바퀴 없는 측면 대포를 참조해 imagegen 편집으로 생성한 1678×937 중간 관점입니다. 둥근 후면과 열린 포구를 드러내면서 기존 정면 금속 문양을 이어 줍니다. 내부 핀볼·바퀴·문구는 없습니다. 기존 자산은 보존했습니다.
- 관축 기준은 (0.32, 0.504) → (0.68, 0.504), 두께 0.30입니다. 원본 정면/측면과 같은 움직이는 관축에 등록합니다. 정면 → 중간 → 측면의 두 단계 보간을 사용합니다. 바퀴는 기존 독립 PNG와 조립 좌표를 유지합니다.
- 생성 지침: 기존 정면의 1678×937 아이보리 스튜디오 배경·좌상단 조명·금색 필리그리·빈 투명 유리 유지. 측면으로 향하는 중간 카메라 관점에서 왼쪽은 둥근 후미로, 오른쪽은 타원 포구로 전환. 핀볼·바퀴·받침·텍스트·UI 추가 금지.
- 추가 사진으로 형태 변화의 간격을 줄였지만 완전한 3D 관점 회전은 아닙니다. 생성 사진마다 문양과 반사 차이가 있어 일부 디졸브 느낌은 남을 수 있습니다. 실제 굴절·시차·금속 반사의 연속성에는 동일 3D 모델의 여러 각도 렌더 또는 리깅된 모델이 필요합니다.
