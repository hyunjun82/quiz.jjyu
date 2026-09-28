#!/usr/bin/env node
/**
 * 누락 자동 대조 — "날짜가 붙은 소스"를 기준선으로 우리 오늘 파일과 항목 단위로 맞춰본다.
 *
 * 왜 만들었나 (2026-09-14):
 *   감시(quiz-xcheck)의 기준선인 토막스는 차단됐고 앱테크는 어제 값을 보여준다. 그래서 감시가
 *   "누락"이라고 한 것과 진짜 누락이 달랐다. 이 스크립트는 수집기가 실제로 쓰는 소스 중
 *   항목마다 날짜가 붙는 것(다비야·팁is팁·블로그)과, 오늘 자 표를 주는 퀴즈벨(어제 행 제거 후)을
 *   기준으로 대조한다. 여기서 [누락]이 나오면 "소스에는 있는데 우리 규칙이 막았다"는 뜻이라
 *   규칙 버그를 그날 바로 잡을 수 있다(9/14 카뱅 12시·기후행동·모니모가 이 유형이었다).
 *
 * 사용: node scripts/gapcheck.mjs        종료코드 0 = 누락 없음 / 1 = 누락 있음
 */
import {
  collectFromDaviya,
  collectFromTipistip,
  collectFromBlog,
  collectFromQuizbells,
  loadExisting,
  itemKey,
  kstToday,
} from './collect.mjs';
import { execFileSync } from 'child_process';

const today = kstToday();
let mine = loadExisting(today);

const safe = (p, name) => p.catch((e) => { console.log(`  (${name} 실패: ${e.message})`); return []; });
const [dv, tp, bl, qb] = await Promise.all([
  safe(collectFromDaviya(), '다비야'),
  safe(collectFromTipistip(null), '팁is팁'),
  safe(collectFromBlog(), '블로그'),
  safe(collectFromQuizbells(), '퀴즈벨'),
]);
const ext = [...dv, ...tp, ...bl, ...qb];

const norm = (s) => String(s || '').replace(/[^가-힣0-9A-Za-z]/g, '').toLowerCase();
const has = (slug, f) => {
  const key = itemKey(f);
  if (!key) return true; // 정답 없는 항목은 대조 불가
  return (mine.answers[slug] || []).some((m) => {
    const k = itemKey(m);
    if (k === key) return true;
    // 표기 차이(번호·괄호) 흡수: 한쪽이 다른 쪽 앞부분이고 3자 이상
    const s = Math.min(k.length, key.length);
    if (s >= 3 && (k.startsWith(key) || key.startsWith(k)) && Math.abs(k.length - key.length) <= 6) return true;
    // 지문이 같으면 정답 표기가 달라도 같은 문제로 본다 (OX 표기 등)
    const nq = norm(f.question), mq = norm(m.question);
    return !!nq && nq.length >= 12 && nq === mq;
  });
};

const findMissing = () => {
  const out = [];
  const seen = new Set();
  for (const f of ext) {
    const tag = `${f.slug}|${itemKey(f)}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    if (!has(f.slug, f)) out.push(f);
  }
  return out;
};
let missing = findMissing();

// 9/14 14:00 실측: 감시가 "누락"이라고 알린 홍삼 32900 은 14:01 에 들어왔다. 수집기는 30초마다 도니
// 소스에 막 뜬 항목은 1~2분 뒤면 들어온다. 누락이 보이면 2분 기다렸다 원격 최신으로 다시 대조한다 —
// 그래도 없는 것만 진짜 누락이다.
if (missing.length) {
  console.log(`  (누락 후보 ${missing.length}건 — 2분 뒤 재확인)`);
  await new Promise((r) => setTimeout(r, 120000));
  try {
    execFileSync('git', ['fetch', '-q', 'origin', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['checkout', '-q', 'origin/main', '--', `data/answers/${today}.json`], { stdio: 'pipe' });
  } catch { /* 원격 갱신 실패 시 현재 파일로 판정 */ }
  mine = loadExisting(today);
  missing = findMissing();
}

// ── 오답 의심(불일치) — 2026-09-28 추가 ─────────────────────────────────────
// 지금까지 이 스크립트는 '빠진 것'만 봤고 '틀린 것'은 못 봤다. 9/26~9/28 오답(케이뱅크 빅컷,
// 닥터 O, 기후행동 곤충)은 모두 날짜 없는 소스(퀴즈벨·앱테크)에서 왔고, 그날 날짜 붙은 소스는
// 다른 답을 주고 있었다. 그래서: 날짜 붙은 소스가 이 퀴즈에 답을 주고 있는데, 우리 행 중
// 날짜 없는 소스에서 온 답이 그 어디에도 없고, 우리 행 수가 날짜 붙은 답 수보다 많으면 보고한다.
// 자동으로 지우지는 않는다 — 날짜 붙은 소스가 두 번째 회차를 아직 안 올렸을 수도 있기 때문이다.
const oxOf = (a) => {
  const t = String(a || '').trim();
  if (/^(O|○)(\s|\(|$)|^\(?(그렇다|맞아요|맞다)\)?(\s|\(|$)/i.test(t)) return 'o';
  if (/^(X|×)(\s|\(|$)|^\(?(아니다|아니요|아니에요|틀리다)\)?(\s|\(|$)/i.test(t)) return 'x';
  return null;
};
const coreAns = (a) => oxOf(a) || String(a || '').replace(/^\s*(\d{1,2}\s*[.)번]|[①-⑩])\s*/, '').replace(/\([^)]*\)/g, '').replace(/[^가-힣0-9A-Za-z]/g, '').toLowerCase();
const sameAns = (x, y) => x === y || (Math.min(x.length, y.length) >= 2 && (x.startsWith(y) || y.startsWith(x)));
// 신한(쏠퀴즈·팡팡·야구·출석)·KB스타(한국사·스타퀴즈)는 한 카드에 서로 다른 퀴즈가 여럿이라 정답끼리 비교가 안 된다
// (9/29 오탐: 신한 야구 '5회'·KB 한국사 '④ 신간회…' 모두 팁is팁과 일치하는 정답이었다).
const SKIP_MISMATCH = new Set(['cashwalk', 'cashdoc', 'monimo', 'yes24', 'shinhan-sol', 'kb-star']);
const findMismatch = () => {
  const dated = [...dv, ...tp, ...bl];
  const out = [];
  for (const [slug, rows] of Object.entries(mine.answers)) {
    if (SKIP_MISMATCH.has(slug) || !rows.length) continue;
    const dAns = [...new Set(dated.filter((f) => f.slug === slug).map((f) => coreAns(f.answer ?? (f.choices || []).join(','))).filter(Boolean))];
    if (!dAns.length || rows.length <= dAns.length) continue;
    for (const r of rows) {
      if (!['quizbells', 'apptech'].includes(r.source)) continue;
      const c = coreAns(r.answer);
      if (c && !dAns.some((d) => sameAns(c, d))) out.push({ slug, r, dAns });
    }
  }
  return out;
};
const mismatch = findMismatch();

console.log(`[gapcheck] ${today} — 외부 ${ext.length}건(다비야 ${dv.length}·팁is팁 ${tp.length}·블로그 ${bl.length}·퀴즈벨 ${qb.length}) vs 우리 ${Object.values(mine.answers).reduce((n, a) => n + a.length, 0)}건`);
if (mismatch.length) {
  console.log(`🟠 [불일치] ${mismatch.length}건 — 날짜 없는 소스(퀴즈벨·앱테크)에서 온 우리 답이 날짜 붙은 소스 답과 다름 (오답 의심)`);
  for (const { slug, r, dAns } of mismatch) {
    console.log(`  · [${slug}] 우리 "${r.answer}" (${r.source}, "${String(r.question).slice(0, 30)}") ↔ 날짜 붙은 소스: ${dAns.join(' / ')}`);
  }
}
if (!missing.length) {
  console.log('✅ 누락 없음 — 날짜 붙은 소스에 있는 정답은 전부 우리 사이트에 있음');
  process.exit(mismatch.length ? 1 : 0);
}
console.log(`🔴 [누락] ${missing.length}건 — 소스에는 있는데 우리에 없음 (수집 규칙이 막았거나 아직 안 돈 것)`);
for (const f of missing) {
  console.log(`  · [${f.slug}] "${String(f.question).slice(0, 50)}" = ${f.answer ?? (f.choices || []).join('/')}  (${f.source})`);
}
process.exit(1);
