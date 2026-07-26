#!/usr/bin/env node
/**
 * 수집 파이프라인 중단 감지.
 *
 * 왜 필요한가: 7/24~7/25 사이 약 36시간 동안 수집이 조용히 멈췄는데
 * 아무도 몰랐다. 로그를 사람이 들여다보기 전까지 알 방법이 없었다.
 * 이 스크립트는 문제를 발견하면 exit 1 로 죽고, 그러면 GitHub Actions가
 * 빨간 X와 함께 저장소 소유자에게 메일을 보낸다. 그게 알림 채널이다.
 *
 * 핵심 원칙: "소스가 아직 안 냈다"와 "우리 파이프라인이 고장났다"를 반드시 구분한다.
 * 공개 시각이 지났는데 우리한테 없다 → 그것만으로는 장애가 아니다.
 * 공개 시각이 지났고, 퀴즈벨에는 정답이 떠 있는데, 우리한테 없다 → 이게 진짜 장애다.
 */

import fs from 'node:fs';
import path from 'node:path';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const kstNow = () => new Date(Date.now() + KST_OFFSET);
const kstToday = () => kstNow().toISOString().slice(0, 10);

const ROOT = path.resolve(import.meta.dirname, '..');
const QUIZZES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/quizzes.json'), 'utf8')).quizzes;

/** 공개 시각이 이만큼 지나도 없으면 "지연"으로 본다. 소스 자체가 늦는 경우가 있어 넉넉히 잡음. */
const GRACE_MINUTES = 90;
/** 퀴즈벨에 떠 있는데 우리한테 없는 퀴즈가 이 수 이상이면 파이프라인 장애로 판정. */
const FAIL_THRESHOLD = 3;

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

/** 오늘 이 퀴즈가 나오는 날인가? (주 1회·평일만 같은 주기 설정 반영) */
function runsToday(q, dow) {
  const cad = q.cadence;
  if (!cad) return true;
  if (cad.type === 'weekdays') return dow >= 1 && dow <= 5;
  if (cad.type === 'weekly') {
    const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return (cad.days || []).some((d) => map[d] === dow);
  }
  return true; // irregular 은 판정 불가 — 지연 대상에서 제외하지 않되 장애 판정엔 안 씀
}

/** 퀴즈벨에 오늘자 정답이 실제로 떠 있는지만 확인한다(내용은 안 봄). */
async function quizbellsHasAnswer(sourceSlug, today) {
  try {
    const res = await fetch(`https://quizbells.com/quiz/${sourceSlug}/today/answer`, {
      headers: { 'user-agent': 'Mozilla/5.0 (quizday-healthcheck)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const html = await res.text();

    // 제목의 날짜가 오늘이 아니면 캐시된 옛날 페이지다.
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const dm = title.match(/(\d{4})년 (\d{2})월 (\d{2})일/);
    if (!dm || `${dm[1]}-${dm[2]}-${dm[3]}` !== today) return false;

    const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
    if (!table) return false;

    const rows = [
      ...table.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g),
    ];
    return rows.some(([, , aCell]) => {
      const text = decodeEntities(aCell.replace(/<[^>]*>/g, ' ')).trim();
      return text.length > 0 && text.length <= 40;
    });
  } catch {
    return false; // 네트워크 실패는 "장애 아님"으로 처리. 오탐보다 미탐이 낫다.
  }
}

async function main() {
  const now = kstNow();
  const today = kstToday();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dow = now.getUTCDay();
  const file = path.join(ROOT, 'data/answers', `${today}.json`);

  const problems = [];
  const notes = [];

  // 1) 오늘자 파일 자체가 없다 — 초기화조차 안 돌았다는 뜻.
  if (!fs.existsSync(file)) {
    console.error(`치명: 오늘자 정답 파일이 없음 (${today}.json)`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const answers = data.answers || {};

  // 2) 공개 시각이 지났는데 우리한테 없는 퀴즈 추리기
  const overdue = [];
  for (const q of QUIZZES) {
    if (!runsToday(q, dow)) continue;
    if ((answers[q.slug] || []).length > 0) continue;

    const times = (q.releaseTimes || []).map((t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    });
    if (times.length === 0) continue; // 공개 시각 미상 — 판정 불가

    const earliest = Math.min(...times);
    const lateBy = nowMin - earliest - GRACE_MINUTES;
    if (lateBy > 0) overdue.push({ q, lateBy });
  }

  if (overdue.length === 0) {
    console.log(`정상 — 지연된 퀴즈 없음 (${today} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} KST)`);
    return;
  }

  // 3) 지연분만 소스에 실제로 떠 있는지 확인 → 여기서 "미발행"과 "우리 장애"가 갈린다
  const checked = await Promise.all(
    overdue.map(async ({ q, lateBy }) => ({
      q,
      lateBy,
      onSource: q.sourceSlug ? await quizbellsHasAnswer(q.sourceSlug, today) : null,
    })),
  );

  const missed = checked.filter((c) => c.onSource === true);
  const notPublished = checked.filter((c) => c.onSource === false);
  const unknown = checked.filter((c) => c.onSource === null);

  console.log(`검사 시각: ${today} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} KST`);
  console.log(`지연 ${overdue.length}건 중 —`);
  console.log(`  소스에 있는데 우리가 놓침: ${missed.length}건`);
  console.log(`  소스도 아직 미발행(정상): ${notPublished.length}건`);
  console.log(`  2차 소스 없어 판정 불가: ${unknown.length}건`);

  for (const c of missed) {
    console.log(`  [놓침] ${c.q.slug} (${c.q.name}) — 공개 후 ${Math.round(c.lateBy + GRACE_MINUTES)}분 경과`);
  }
  for (const c of notPublished) {
    console.log(`  [미발행] ${c.q.slug} — 소스도 아직 없음`);
  }
  for (const c of unknown) {
    console.log(`  [판정불가] ${c.q.slug} — sourceSlug 없음`);
  }

  if (missed.length >= FAIL_THRESHOLD) {
    console.error(
      `\n장애: 퀴즈벨에 공개된 정답 ${missed.length}건을 수집하지 못했습니다 (임계 ${FAIL_THRESHOLD}건). ` +
        `수집 워크플로가 멈췄거나 파서가 깨졌을 가능성이 높습니다.`,
    );
    process.exit(1);
  }

  console.log('\n임계 미만 — 장애로 판정하지 않음');
}

main().catch((e) => {
  console.error('헬스체크 자체가 실패:', e);
  process.exit(1);
});
