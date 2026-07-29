#!/usr/bin/env node
/**
 * 발행된 정답을 소스 원본과 대조한다 — "사람이 화면 보고 발견하는 구조"를 없애기 위한 것.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 7/29에 토스 정답이 "플립, 폴드, 울트라"인데 우리 사이트에는 "플립" 하나만 떠 있었다.
 * 소스에는 처음부터 제대로 있었고, 우리 중복 판정 규칙이 완전한 정답을 버린 것이다.
 * 문제는 버그 자체보다 **발견 경로**였다. 사용자가 다른 사이트와 눈으로 비교해서 알려줬다.
 * 그 사이 하루치 트래픽은 이미 지나갔다.
 *
 * 필터를 하나 더 추가하는 걸로는 이런 걸 못 막는다. 다음 버그는 다른 모양으로 온다.
 * 그래서 "규칙을 늘리는" 대신 "결과를 대조하는" 장치를 둔다. 우리가 발행한 것과
 * 소스가 지금 말하는 것을 매 실행마다 맞춰보고, 어긋나면 그 자리에서 드러낸다.
 *
 * ── 무엇을 잡는가 ──────────────────────────────────────────────────
 *   누락  : 소스에 있는데 우리에겐 없다        → 수집 실패. 가장 치명적(트래픽 손실).
 *   부분  : 정답이 소스 것의 일부만 담고 있다   → 7/29 토스 유형.
 *   불일치: 우리 정답이 소스 어디에도 없다      → 오발행/쓰레기 의심.
 *
 * ⚠️ "불일치"는 곧바로 오류가 아니다. AI 검색이나 다른 소스로 넣은 정답이 퀴즈벨엔
 *    아직 없을 수 있다. 그래서 삭제하지 않고 보고만 한다 — 판단은 사람이나 다음 회차가 한다.
 *
 * 종료 코드: 누락·부분이 하나라도 있으면 1. (자동화에서 "손봐야 함" 신호로 쓴다.)
 */

import fs from 'fs';
import path from 'path';
import { parseQuizbells, isSaneQuestion, garbageReason } from './collect.mjs';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const kstNow = () => new Date(Date.now() + KST_OFFSET);
const kstToday = () => kstNow().toISOString().slice(0, 10);

const root = process.cwd();
const QUIZZES = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'quizzes.json'), 'utf-8'),
).quizzes;

const today = process.env.VERIFY_DATE || kstToday();
const file = path.join(root, 'data', 'answers', `${today}.json`);
const published = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf-8')).answers || {}
  : {};

const norm = (s) => String(s || '').replace(/[\s,.·/()]/g, '').toLowerCase();

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-verify/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const missing = [];   // 소스에 있는데 우리에겐 없음
const partial = [];   // 우리 정답이 소스 정답의 일부만 담음
const unknown = [];   // 우리에게만 있고 소스엔 없음 (참고용)
const unreachable = [];

for (const q of QUIZZES) {
  if (!q.sourceSlug) continue;

  let rows;
  try {
    const html = await fetchText(`https://quizbells.com/quiz/${q.sourceSlug}/today/answer`);
    rows = parseQuizbells(html, q.slug, today).filter((r) => isSaneQuestion(r.question));
  } catch (e) {
    unreachable.push(`${q.slug}(${e.message})`);
    continue;
  }
  if (!rows.length) continue; // 소스가 아직 오늘 걸 안 올렸다 — 우리 잘못 아님

  const mine = (published[q.slug] || []).filter((it) => !garbageReason(it));

  for (const r of rows) {
    const src = norm(r.answer);
    if (!src) continue;
    const exact = mine.find((it) => norm(it.answer) === src);
    if (exact) continue;
    // 우리 정답이 소스 정답의 앞부분만 담고 있는가 (7/29 토스 유형)
    const part = mine.find((it) => {
      const m = norm(it.answer);
      return m && m.length < src.length && src.startsWith(m);
    });
    if (part) {
      partial.push({ slug: q.slug, ours: part.answer, source: r.answer, question: r.question, ref: part });
      continue;
    }
    // ⚠️ 반대 방향도 봐야 한다. 우리가 다른 소스에서 "O (그렇다)"로 받아둔 걸 퀴즈벨이
    //    "O"로만 적으면, 이 검사를 빼먹으면 "누락"으로 잘못 잡고 중복 행을 만든다.
    if (mine.some((it) => norm(it.answer) && norm(it.answer).startsWith(src))) continue;
    missing.push({ slug: q.slug, source: r.answer, question: r.question });
  }

  for (const it of mine) {
    const m = norm(it.answer);
    if (!m) continue;
    if (!rows.some((r) => norm(r.answer).startsWith(m) || m.startsWith(norm(r.answer)))) {
      unknown.push({ slug: q.slug, ours: it.answer, question: it.question });
    }
  }
}

const line = (x) => `    - [${x.slug}] ${x.question ? `"${x.question}" ` : ''}`;

console.log(`[verify] ${today} — 퀴즈벨 원본 대조`);
console.log(`  누락(소스엔 있고 우리에겐 없음) : ${missing.length}건`);
for (const x of missing) console.log(`${line(x)}소스 정답 "${x.source}"`);
console.log(`  부분(정답이 일부만 발행됨)      : ${partial.length}건`);
for (const x of partial) console.log(`${line(x)}우리 "${x.ours}" ← 소스 "${x.source}"`);
console.log(`  참고: 소스에 없는 우리 정답     : ${unknown.length}건 (다른 소스/AI 수집분일 수 있음)`);
for (const x of unknown) console.log(`${line(x)}"${x.ours}"`);
if (unreachable.length) console.log(`  소스 접근 실패                  : ${unreachable.join(', ')}`);

// ── 자가 교정 ─────────────────────────────────────────────────────
// "부분"만 고친다. 우리 정답이 소스 정답의 앞부분이라는 건, 소스 것이 우리 것을 통째로
// 품고 있다는 뜻이라 갈아끼워서 나빠질 수 없다. 행이 늘지도 않는다.
// "누락"은 자동으로 안 넣는다 — 다른 소스에서 표현만 다르게 받아둔 걸 중복으로 만들
// 위험이 있다. 어차피 다음 수집 한 바퀴에 정상 경로로 들어온다.
let fixed = 0;
if (process.env.VERIFY_FIX === '1' && partial.length) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  for (const x of partial) {
    const arr = raw.answers[x.slug] || [];
    const hit = arr.find((it) => norm(it.answer) === norm(x.ours));
    if (!hit) continue;
    console.log(`  [교정] [${x.slug}] "${hit.answer}" → "${x.source}"`);
    hit.answer = x.source;
    if (x.question && String(x.question).length > String(hit.question || '').length) {
      hit.question = x.question;
    }
    fixed += 1;
  }
  if (fixed) {
    raw.updatedAt = kstNow().toISOString().replace('Z', '+09:00');
    fs.writeFileSync(file, JSON.stringify(raw, null, 2));
  }
}

const problems = missing.length + partial.length - fixed;
console.log(`VERIFY_FIXED=${fixed}`);
console.log(`VERIFY_PROBLEMS=${problems}`);
process.exit(problems > 0 ? 1 : 0);
