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
 *   3) 지난 공개 시각 수보다 정답이 적어야 한다
 *
 * ⚠️ 3번을 "정답 0건"으로 하면 안 된다 — 하루에 여러 번 내는 퀴즈를 통째로 놓친다.
 *    캐시닥은 공개 시각이 10:00·10:30·11:00·19:00·20:30으로 5개다. 10시 정답 하나만
 *    있어도 "확보"로 치면 11시 문제를 아무도 안 찾는다. 실제로 7/28에 AI가 건진 5건 중
 *    3건이 바로 이 캐시닥 11시 문제였다. 그래서 "지난 시각 수 vs 가진 정답 수"로 센다.
 *
 * ⚠️ 반드시 collect.mjs 감시 루프가 끝난 뒤에 실행할 것. 감시 도중에 돌리면 아직
 *    안 지난 공개 시각이 후보에서 빠져 그 회차 발행이 한 시간 밀린다.
 *
 * 출력 마지막 줄은 기계가 읽기 쉬운 한 줄이다:
 *   AI_TARGETS=slug,slug   또는   AI_TARGETS=  (비어 있으면 AI 단계 통째로 건너뛰면 된다)
 *   AI_LIGHT=slug,slug     공개 시각을 모르는 퀴즈 — 여유 있을 때만 가볍게 1회
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

const pad2 = (n) => String(n).padStart(2, '0');
const now = kstNow();
// 테스트용: NOW_HHMM=11:30 으로 특정 시각을 가정해 돌릴 수 있다.
const nowMin = process.env.NOW_HHMM
  ? Number(process.env.NOW_HHMM.split(':')[0]) * 60 + Number(process.env.NOW_HHMM.split(':')[1])
  : now.getUTCHours() * 60 + now.getUTCMinutes();
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
const light = [];
const skipped = { 오늘발행아님: [], 아직공개전: [], 이미확보: [] };

for (const q of QUIZZES) {
  const have = (answers[q.slug] || []).length;

  if (!runsToday(q)) { skipped.오늘발행아님.push(q.slug); continue; }

  const times = q.releaseTimes || [];

  // 공개 시각을 모르는 퀴즈(cashwalk/kakaopay/auction)는 셈이 불가능하다.
  // 아직 하나도 없으면 정식 후보, 이미 있으면 가벼운 확인 대상으로만 둔다.
  if (!times.length) {
    (have > 0 ? light : targets).push(q.slug);
    continue;
  }

  const passedMins = times
    .map((t) => { const [H, M] = t.split(':').map(Number); return H * 60 + M; })
    .filter((m) => m <= nowMin);

  if (!passedMins.length) { skipped.아직공개전.push(q.slug); continue; }

  // ⚠️ "정답 개수 >= 지난 시각 개수"로 재면 안 된다. 캐시닥은 한 회차에 문제를 여러 개
  //    내므로 10시 회차만으로도 정답이 13개가 되어 11시 회차가 통째로 가려진다.
  //    그래서 개수가 아니라 "마지막으로 지난 회차 이후에 들어온 정답이 있는가"로 판정한다.
  const lastSlot = Math.max(...passedMins);
  const covered = (answers[q.slug] || []).some((it) => {
    const p = String(it.publishedAt || '');
    const m = /T(\d{2}):(\d{2})/.exec(p);
    if (!m) return false;
    return Number(m[1]) * 60 + Number(m[2]) >= lastSlot - 2; // 소스가 2분 일찍 올리는 경우 허용
  });

  // 다만 소스가 회차보다 훨씬 일찍 올려두는 퀴즈가 있다(케이뱅크는 12:30 문제를 새벽에
  // 이미 올려둔다 — 7/28 소스 대조로 확인). 그런 경우 위 시각 비교만 쓰면 영원히
  // 후보로 남아 매시간 헛검색한다. 그래서 "지난 회차 수만큼은 갖고 있다"도 확보로 친다.
  const enough = have >= passedMins.length;

  const hhmm = `${pad2(Math.floor(lastSlot / 60))}:${pad2(lastSlot % 60)}`;
  if (covered || enough) { skipped.이미확보.push(`${q.slug}(${hhmm}분 확보)`); continue; }

  targets.push(q.slug);
}

console.log(`[gaps] ${today} ${pad2(Math.floor(nowMin/60))}:${pad2(nowMin%60)} KST`);
console.log(`  이미 확보(지난 시각만큼 다 가짐) : ${skipped.이미확보.length}개 ${skipped.이미확보.join(', ')}`);
console.log(`  아직 공개 전(검색 무의미)        : ${skipped.아직공개전.length}개 ${skipped.아직공개전.join(', ')}`);
console.log(`  오늘 발행 대상 아님              : ${skipped.오늘발행아님.length}개 ${skipped.오늘발행아님.join(', ')}`);
console.log(`  → AI가 꼭 볼 것                 : ${targets.length}개`);
console.log(`  → 가볍게만 볼 것(시각 미상)      : ${light.length}개`);
console.log(`AI_TARGETS=${targets.join(',')}`);
console.log(`AI_LIGHT=${light.join(',')}`);
