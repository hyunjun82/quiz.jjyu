#!/usr/bin/env node
/**
 * "지금 AI가 실제로 손댈 가치가 있는 퀴즈만" 골라서 출력한다.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────
 * 예약 세션은 하루 12번 깨어나는데, 그때마다 23개 퀴즈를 전부 AI 웹검색으로
 * 훑으면 검색 호출이 하루 200회를 넘는다. 그런데 7/28 실측 결과 그 하루치
 * 성과는 정답 5건이었고, 나머지 52건은 전부 무료 파싱 수집기가 잡았다.
 * 즉 AI 검색의 90% 이상이 "이미 있는 걸 다시 확인하는" 헛수고다.
 *
 * 이 스크립트가 헛수고를 빼고 진짜 후보만 남긴다. 남는 조건은 전부 필요조건이다:
 *   1) 오늘 발행되는 퀴즈여야 한다        (cadence — 목요일 전용 퀴즈를 월요일에 찾지 않는다)
 *   2) 공개 시각이 이미 지났어야 한다      (아직 안 나온 걸 검색하는 건 100% 허탕)
 *   3) 오늘 정답이 0건이어야 한다          (있으면 수집기가 이미 이겼다)
 *
 * 출력 마지막 줄은 기계가 읽기 쉬운 한 줄이다:
 *   AI_TARGETS=slug,slug   또는   AI_TARGETS=  (비어 있으면 AI 단계 통째로 건너뛰면 된다)
 */

import fs from 'fs';
import path from 'path';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const kstNow = () => new Date(Date.now() + KST_OFFSET);
const kstToday = () => kstNow().toISOString().slice(0, 10);

const root = process.cwd();
const QUIZZES = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'quizzes.json'), 'utf-8'),
).quizzes;

const today = kstToday();
const file = path.join(root, 'data', 'answers', `${today}.json`);
const answers = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf-8')).answers || {}
  : {};

const now = kstNow();
const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
const dow = now.getUTCDay();

const DOW_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
function runsToday(q) {
  const cad = q.cadence;
  if (!cad) return true;
  if (cad.type === 'weekdays') return dow >= 1 && dow <= 5;
  if (cad.type === 'weekly') return (cad.days || []).some((d) => DOW_MAP[d] === dow);
  return true; // irregular 은 언제 나올지 몰라 후보로 둔다
}

const targets = [];
const skipped = { 오늘발행아님: [], 아직공개전: [], 이미확보: [] };

for (const q of QUIZZES) {
  const have = (answers[q.slug] || []).length;
  if (have > 0) { skipped.이미확보.push(q.slug); continue; }
  if (!runsToday(q)) { skipped.오늘발행아님.push(q.slug); continue; }

  const times = q.releaseTimes || [];
  if (times.length) {
    const passed = times.some((t) => {
      const [H, M] = t.split(':').map(Number);
      return H * 60 + M <= nowMin;
    });
    if (!passed) { skipped.아직공개전.push(q.slug); continue; }
  }
  // releaseTimes가 아예 없는 퀴즈(cashwalk/kakaopay/auction)는 언제 뜰지 모르니 후보로 남긴다.
  targets.push(q.slug);
}

const pad = (n) => String(n).padStart(2, '0');
console.log(`[gaps] ${today} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} KST`);
console.log(`  이미 확보(수집기가 잡음)  : ${skipped.이미확보.length}개`);
console.log(`  아직 공개 전(검색 무의미) : ${skipped.아직공개전.length}개 ${skipped.아직공개전.join(', ')}`);
console.log(`  오늘 발행 대상 아님       : ${skipped.오늘발행아님.length}개 ${skipped.오늘발행아님.join(', ')}`);
console.log(`  → AI가 볼 것             : ${targets.length}개`);
console.log(`AI_TARGETS=${targets.join(',')}`);
