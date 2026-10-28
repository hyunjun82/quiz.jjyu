#!/usr/bin/env node
/**
 * 빌드 직후 out/_redirects 생성 (2026-10-28 추가)
 *
 * 왜: 오답·이월을 지우면 그날 문제 번호가 앞으로 당겨져 마지막 번호 주소가 사라진다.
 *   예) 10/27 토스 4건 중 이월 2건을 지우자 /quiz/toss-lucky/2026-10-27/4/ (오후 정답 '선착순쿠폰')가
 *   404 가 됐는데, 네이버에서 그 주소로 들어온 사람이 404 화면을 봤다(애널리틱스 '404' 조회).
 * 처리: 그날 지운 건수만큼 사라진 번호 주소를 그날 정답 페이지(/quiz/{slug}/{date}/)로 301 이동시킨다.
 *   Cloudflare Workers 정적 자산은 out/_redirects 를 읽는다.
 */
import fs from 'fs';

const dir = 'data/answers';
const lines = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.deleted.json')).sort()) {
  const date = f.slice(0, 10);
  let del, cur;
  try {
    del = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    cur = JSON.parse(fs.readFileSync(`${dir}/${date}.json`, 'utf8')).answers || {};
  } catch {
    continue;
  }
  const count = {};
  for (const l of del.log || []) count[l.slug] = (count[l.slug] || 0) + 1;
  for (const [slug, n] of Object.entries(count)) {
    const have = (cur[slug] || []).length;
    for (let i = have + 1; i <= have + n; i++) {
      // 혹시 그 번호 페이지가 실제로 있으면(같은 날 새 정답이 다시 채워진 경우) 건드리지 않는다.
      if (fs.existsSync(`out/quiz/${slug}/${date}/${i}/index.html`)) continue;
      lines.push(`/quiz/${slug}/${date}/${i}/ /quiz/${slug}/${date}/ 301`);
    }
  }
}
fs.writeFileSync('out/_redirects', lines.join('\n') + '\n');
console.log(`[redirects] 지운 문제 번호 주소 ${lines.length}개 → 그날 정답 페이지로 이동`);
