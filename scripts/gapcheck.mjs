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

console.log(`[gapcheck] ${today} — 외부 ${ext.length}건(다비야 ${dv.length}·팁is팁 ${tp.length}·블로그 ${bl.length}·퀴즈벨 ${qb.length}) vs 우리 ${Object.values(mine.answers).reduce((n, a) => n + a.length, 0)}건`);
if (!missing.length) {
  console.log('✅ 누락 없음 — 날짜 붙은 소스에 있는 정답은 전부 우리 사이트에 있음');
  process.exit(0);
}
console.log(`🔴 [누락] ${missing.length}건 — 소스에는 있는데 우리에 없음 (수집 규칙이 막았거나 아직 안 돈 것)`);
for (const f of missing) {
  console.log(`  · [${f.slug}] "${String(f.question).slice(0, 50)}" = ${f.answer ?? (f.choices || []).join('/')}  (${f.source})`);
}
process.exit(1);
