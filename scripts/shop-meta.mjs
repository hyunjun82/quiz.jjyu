/**
 * data/shop.json 의 각 항목에서 link 만 보고 name·image·note 를 자동으로 채운다.
 *
 * 왜 필요한가 — 사장님이 토스앱에서 [링크 발급]만 눌러 붙여넣으면 끝나게 하려고.
 * 상품명·이미지·평점을 손으로 옮겨 적으면 오타가 나고, 상품이 바뀌면 전부 다시 해야 한다.
 * 쉐어링크를 따라가면 토스가 공유용으로 지정해둔 og 태그가 있으므로 그걸 그대로 쓴다.
 *
 * 사용법:  node scripts/shop-meta.mjs
 *          (link 만 있는 항목도, 이미 채워진 항목도 전부 최신값으로 갱신한다)
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'shop.json');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const pick = (html, prop) => {
  const re = new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i');
  return (html.match(re) || html.match(re2) || [])[1] || '';
};

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
let changed = 0;

for (const it of data.items) {
  if (!it.link) continue;
  try {
    const res = await fetch(it.link, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const html = await res.text();

    // "스파클 생수, 무라벨, 500ml, 80개 | 토스쇼핑" → 뒤 꼬리표를 뗀다
    const title = pick(html, 'og:title').replace(/\s*\|\s*토스쇼핑\s*$/, '').trim();
    const image = pick(html, 'og:image').trim();
    // "…, 국산생수 1위. 리뷰 34,249개 · 평점 4.9점" → 상품명 반복을 빼고 뒤쪽 설명만 남긴다
    const desc = pick(html, 'og:description').trim();
    const note = desc.startsWith(title) ? desc.slice(title.length).replace(/^[,\s]+/, '') : desc;

    if (title && title !== it.name) { it.name = title; changed++; }
    if (image && image !== it.image) { it.image = image; changed++; }
    if (note && note !== it.note) { it.note = note; changed++; }

    console.log(`OK  ${it.name}`);
  } catch (e) {
    console.error(`FAIL ${it.link} — ${e.message}`);
  }
}

if (changed) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n${changed}개 필드 갱신 → data/shop.json 저장`);
} else {
  console.log('\n변경 없음');
}
