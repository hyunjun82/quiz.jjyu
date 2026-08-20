/**
 * data/shop-images.json (base64) → public/shop/*.webp 로 풀어놓는다.
 *
 * 빌드 직전에 자동으로 돈다(package.json 의 prebuild). 의존성이 하나도 없다 —
 * 배포 환경에 sharp 가 없어도, 네트워크가 막혀 있어도 무조건 성공한다.
 *
 * 왜 이런 구조인가 — 이 저장소에는 바이너리를 직접 커밋할 수 없다. 그렇다고
 * 토스 CDN 주소(https://shopping.toss.im/live/temp/...)를 상용 페이지에 박아두면
 * 'temp' 라 언제 조용히 깨질지 모르고, 원본이 400KB라 모바일에서 무겁다.
 * 그래서 이미지를 320px webp(8KB 안팎)로 줄여 텍스트로 보관하고 빌드 때 되살린다.
 *
 * 이미지를 새로 넣거나 바꿀 때는 scripts/shop-meta.mjs 를 돌리면 이 JSON 이 갱신된다.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'data', 'shop-images.json');
const DIR = path.join(process.cwd(), 'public', 'shop');

if (!fs.existsSync(SRC)) {
  console.log('shop-images.json 없음 — 건너뜀');
  process.exit(0);
}

const store = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
fs.mkdirSync(DIR, { recursive: true });

let n = 0;
for (const [name, b64] of Object.entries(store)) {
  if (!/^[\w.-]+\.(webp|png|jpg|jpeg)$/.test(name)) continue; // 경로 탈출 방지
  fs.writeFileSync(path.join(DIR, name), Buffer.from(b64, 'base64'));
  n++;
}
console.log(`상품 이미지 ${n}장 → public/shop/`);
