#!/usr/bin/env node
/**
 * 월간 정답 모음 자동 점검 — 배포 직후 매번 실행 (2026-10-28 추가)
 *
 * 왜: "○○ 퀴즈 10월 정답 모음" 페이지는 검색 유입 경로인데, 네이버 알림(IndexNow)에서
 *   한 번도 빠져 있었고 아무도 몰랐다. 사람이 매일 보지 않아도 빠지면 바로 드러나게 한다.
 *
 * 퀴즈마다 실제 사이트(https://quiz.jjyu.co.kr)를 열어 확인한다:
 *   1) /quiz/{slug}/monthly/ 가 200 으로 열린다
 *   2) 제목이 데이터 기준 '이번 달'(예: 10월) 모음이다 — 달이 바뀌면 자동으로 11월이어야 한다
 *   3) 제목의 '전체 N건'이 저장소 데이터의 그 달 정답 수와 같다 (오늘 정답까지 반영됐는지)
 *   4) 오늘 정답이 있는 퀴즈는 오늘 날짜 링크가 페이지 안에 있다
 *   5) 사이트맵에 이번 달 모음 주소가 있다
 *   6) 매달 1~3일: 지난달 보관 페이지(/monthly/YYYY-MM/)가 열린다
 * 하나라도 틀리면 exit 1 → 배포 워크플로가 빨간불(실패 메일)로 알린다.
 */
import fs from 'fs';

const SITE = 'https://quiz.jjyu.co.kr';
const quizzes = JSON.parse(fs.readFileSync('data/quizzes.json', 'utf8')).quizzes;
const dates = fs
  .readdirSync('data/answers')
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.slice(0, 10))
  .sort();
const latest = dates[dates.length - 1];
const ym = latest.slice(0, 7);
const month = Number(ym.slice(5, 7));
const load = (d) => JSON.parse(fs.readFileSync(`data/answers/${d}.json`, 'utf8')).answers || {};
const monthDates = dates.filter((d) => d.startsWith(ym));
const latestData = load(latest);

const bust = () => `?chk=${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url + bust(), { signal: AbortSignal.timeout(20000) });
      return { status: r.status, text: await r.text() };
    } catch (e) {
      if (i === 2) return { status: 0, text: String(e) };
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const problems = [];
const sitemap = (await get(`${SITE}/sitemap.xml`)).text;

let ok = 0;
for (const q of quizzes) {
  let total = 0;
  for (const d of monthDates) total += (load(d)[q.slug] || []).length;
  const url = `${SITE}/quiz/${q.slug}/monthly/`;
  const { status, text } = await get(url);
  if (status !== 200) {
    problems.push(`${q.slug}: 이번 달 모음 페이지 응답 ${status}`);
    continue;
  }
  const title = (text.match(/<title>([^<]*)/) || [])[1] || '';
  if (!title.includes(`${month}월`)) problems.push(`${q.slug}: 제목이 ${month}월 모음이 아님 — "${title}"`);
  const n = Number((title.match(/전체 (\d+)건/) || [])[1]);
  // 배포 중에 새 정답이 커밋됐을 수 있으므로 사이트가 데이터보다 적을 때만 문제로 본다.
  if (!(n >= total)) problems.push(`${q.slug}: 모음 건수 사이트 ${n} < 데이터 ${total} — "${title}"`);
  if ((latestData[q.slug] || []).length > 0 && !text.includes(`/quiz/${q.slug}/${latest}/`))
    problems.push(`${q.slug}: 오늘(${latest}) 정답이 모음 페이지에 없음`);
  if (!sitemap.includes(`${SITE}/quiz/${q.slug}/monthly/<`)) problems.push(`${q.slug}: 사이트맵에 이번 달 모음 없음`);
  ok += 1;
}

// 달이 막 바뀐 직후엔 지난달 보관 페이지가 생겼는지도 본다.
if (Number(latest.slice(8, 10)) <= 3) {
  const prev = dates.filter((d) => d < `${ym}-01`).pop();
  if (prev) {
    const pym = prev.slice(0, 7);
    for (const q of quizzes) {
      const had = dates.filter((d) => d.startsWith(pym)).some((d) => (load(d)[q.slug] || []).length > 0);
      if (!had) continue;
      const { status } = await get(`${SITE}/quiz/${q.slug}/monthly/${pym}/`);
      if (status !== 200) problems.push(`${q.slug}: 지난달(${pym}) 보관 모음 응답 ${status}`);
    }
  }
}

console.log(`[월간 모음 점검] 기준 ${latest} · ${month}월 모음 ${ok}/${quizzes.length}개 확인 · 문제 ${problems.length}건`);
for (const p of problems) console.log(`::error::${p}`);
process.exit(problems.length ? 1 : 0);
