import { getAnswerDates, getAnswersByDate } from './data';

/** 데이터가 있는 달 목록(최신순). 예: ['2026-10','2026-09',...] */
export function getMonths() {
  return [...new Set(getAnswerDates().map((d) => d.slice(0, 7)))].sort().reverse();
}

/** 이번 달(최신 정답 날짜가 속한 달). 빌드 서버 시계(UTC) 대신 KST 데이터 날짜를 쓴다. */
export function currentMonth() {
  return getMonths()[0] || null;
}

/** 지난달들 — 이번 달을 뺀 나머지(최신순) */
export function pastMonths() {
  return getMonths().slice(1);
}

/** 한 퀴즈의 특정 달 정답을 날짜별로 묶는다. ym 없으면 이번 달. */
export function monthData(slug, ym = currentMonth()) {
  const days = [];
  let total = 0;
  if (!ym) return { ym, days, total };
  for (const d of getAnswerDates().filter((x) => x.startsWith(ym))) {
    const items = getAnswersByDate(d)?.answers?.[slug] ?? [];
    if (items.length > 0) {
      days.push({ date: d, items });
      total += items.length;
    }
  }
  return { ym, days, total };
}

/** 이 퀴즈의 지난달 모음 중 정답이 1건이라도 있는 달만 */
export function pastMonthsWithData(slug) {
  return pastMonths()
    .map((ym) => ({ ym, total: monthData(slug, ym).total }))
    .filter((x) => x.total > 0);
}
