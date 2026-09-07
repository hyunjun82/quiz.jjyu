#!/usr/bin/env node
/**
 * 발행된 정답 항목을 "기억을 남기고" 삭제한다.
 *
 * ── 왜 이 스크립트를 거쳐야 하는가 ──────────────────────────────────
 * JSON을 손으로 고쳐 지우면 다음 수집이 소스에서 같은 항목을 다시 읽어 되살린다.
 * 지우는 쪽과 넣는 쪽이 서로를 모르기 때문이다. 2026-09-07 하루에 같은 삭제 커밋이
 * 다섯 번(00:32 / 01:03 / 02:26 / 03:26 / 04:01) 찍혔고, 04:56에 또 되살아났다.
 * 사용자 눈에는 정답이 있었다 없었다 하니 "정답이 틀리다"로 보인다.
 *
 * 이 스크립트는 항목을 지우면서 data/answers/<날짜>.deleted.json 에 키를 남긴다.
 * 수집기는 그 키를 그날 하루 재삽입하지 않는다. 날짜가 바뀌면 자동으로 풀린다.
 *
 * ── 사용법 ─────────────────────────────────────────────────────────
 *   node scripts/drop.mjs <slug> <번호>            # 1부터 시작하는 항목 번호
 *   node scripts/drop.mjs <slug> --match "지문일부"  # 지문에 포함된 문구로 지정
 *   node scripts/drop.mjs <slug> <번호> --reason "감사: 중복"
 *   node scripts/drop.mjs --list <slug>            # 번호 확인용 (지우지 않음)
 *   node scripts/drop.mjs ... --date 2026-09-07    # 기본은 오늘(KST)
 *
 * 종료 코드: 0 = 지움 / 1 = 대상 못 찾음 · 인자 오류
 */

import fs from 'fs';
import {
  kstToday,
  loadExisting,
  fileFor,
  recordTombstone,
} from './collect.mjs';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const has = (name) => argv.includes(name);

const date = flag('--date') || kstToday();
const reason = flag('--reason') || '수동 삭제';
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const prev = argv[i - 1];
  return !(prev === '--reason' || prev === '--date' || prev === '--match' || prev === '--list');
});

const listSlug = flag('--list');
const slug = listSlug || positional[0];

if (!slug) {
  console.error('사용법: node scripts/drop.mjs <slug> <번호|--match "문구"> [--reason "..."] [--date YYYY-MM-DD]');
  process.exit(1);
}

const data = loadExisting(date);
const arr = data.answers[slug];
if (!Array.isArray(arr)) {
  console.error(`알 수 없는 slug: ${slug}`);
  process.exit(1);
}

const show = () => {
  console.log(`[${date}] ${slug} — ${arr.length}건`);
  arr.forEach((it, i) => {
    console.log(`  ${i + 1}. "${it.question}"  =>  "${it.answer ?? (it.choices || []).join(' / ')}"`);
  });
};

if (listSlug) {
  show();
  process.exit(0);
}

const match = flag('--match');
let idx = -1;
if (match) {
  idx = arr.findIndex((it) => String(it.question || '').includes(match));
  if (idx < 0) {
    console.error(`"${match}" 를 지문에 포함하는 항목이 없습니다.`);
    show();
    process.exit(1);
  }
} else {
  const n = Number(positional[1]);
  if (!Number.isInteger(n) || n < 1 || n > arr.length) {
    console.error(`번호가 범위를 벗어났습니다 (1~${arr.length}).`);
    show();
    process.exit(1);
  }
  idx = n - 1;
}

const [removed] = arr.splice(idx, 1);
data.updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .replace('Z', '+09:00');
fs.writeFileSync(fileFor(date), `${JSON.stringify(data, null, 2)}\n`);
const key = recordTombstone(date, slug, removed, reason);

console.log(`삭제 [${slug}] "${removed.question}" => "${removed.answer ?? ''}"`);
console.log(`  사유       : ${reason}`);
console.log(`  삭제 기억  : ${key}`);
console.log(`  남은 건수  : ${arr.length}`);
console.log('');
console.log('커밋 대상 2개 — 반드시 함께 커밋하세요:');
console.log(`  data/answers/${date}.json`);
console.log(`  data/answers/${date}.deleted.json`);
