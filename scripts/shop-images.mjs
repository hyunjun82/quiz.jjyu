/**
 * 상품 이미지를 받아서 public/shop/ 에 320px webp 로 저장한다. 빌드 직전에 자동으로 돈다.
 *
 * 왜 필요한가 — 토스 원본 이미지가 장당 400KB~1.7MB 다(2026-08-20 실측:
 * 생수 405KB · 설렁탕 1.35MB · 볶음밥 1.53MB · 김치 1.70MB). 그대로 걸면 모바일에서
 * 5MB짜리 배너가 된다. 320px webp 로 줄이면 장당 6~17KB 로 끝난다.
 *
 * 왜 원본 주소를 그대로 안 쓰나 — 주소가 https://shopping.toss.im/live/temp/... 다.
 * 'temp' 다. 언제 지워질지 모르는 주소를 상용 페이지에 박아두면 어느 날 조용히 깨진다.
 *
 * 실패해도 빌드를 멈추지 않는다. 이미지가 없으면 lib/data.js 가 그 항목의 image 를
 * 지우고, 카드는 사진 없이 렌더된다(components/ShopPicks.js 가 이미 그렇게 되어 있다).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FILE = path.join(process.cwd(), 'data', 'shop.json');
const DIR = path.join(process.cwd(), 'public', 'shop');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const pick = (html, prop) => {
  const re = new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i');
  return (html.match(re) || html.match(re2) || [])[1] || '';
};

if (!fs.existsSync(FILE)) {
  console.log('data/shop.json 없음 — 건너뜀');
  process.exit(0);
}

// sharp 가 없는 환경에서도 빌드는 살아야 한다
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('sharp 없음 — 상품 이미지 생성을 건너뜁니다');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
fs.mkdirSync(DIR, { recursive: true });
let n = 0;

for (const it of data.items ?? []) {
  if (!it.link) continue;
  // 파일 이름은 링크에서 만든 짧은 해시 — 상품이 바뀌면 파일도 자연히 바뀐다
  const key = crypto.createHash('sha1').update(it.link).digest('hex').slice(0, 10);
  const dest = path.join(DIR, `${key}.webp`);
  if (fs.existsSync(dest)) { n++; continue; }
  try {
    const page = await fetch(it.link, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const src = pick(await page.text(), 'og:image').trim();
    if (!src) throw new Error('og:image 없음');
    const img = await fetch(src, { headers: { 'User-Agent': UA } });
    if (!img.ok) throw new Error(`이미지 ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    const out = await sharp(buf).resize(320, 320, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
    fs.writeFileSync(dest, out);
    console.log(`OK   ${key}.webp  ${(buf.length / 1024) | 0}KB → ${(out.length / 1024) | 0}KB`);
    n++;
  } catch (e) {
    console.error(`SKIP ${it.link} — ${e.message}`);
  }
}
console.log(`상품 이미지 ${n}장 준비됨 → public/shop/`);
