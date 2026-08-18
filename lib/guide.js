/**
 * 가이드 페이지용 집계.
 *
 * ── 왜 만드는가 ──────────────────────────────────────────────
 * 정답 페이지는 CPC $0.02다. "토스 정답 뭐야"로 온 사람에게 광고주가 붙일 게
 * 없기 때문이다(2026-08-18 실측: 클릭 264건 × $0.02 = $5.43). 이건 광고 배치를
 * 아무리 만져도 안 바뀐다 — 페이지 주제 자체가 단가를 정한다.
 *
 * 그래서 같은 사이트 안에 '광고주가 입찰할 이유가 있는 페이지'를 따로 만든다.
 * 은행 앱 비교·수익 계산은 금융 문맥이라 은행·카드·증권이 입찰한다.
 * 같은 계정 안에서 gov 도메인이 RPM $6.75, 퀴즈가 $0.29였던 게 그 증거다.
 *
 * ── 경쟁사가 못 하는 것 ──────────────────────────────────────
 * 경쟁사(퀴즈코리아)도 가이드 글 10편을 갖고 있다. 다만 사람이 한 번 써둔
 * 정적인 글이다. 우리는 매일 쌓는 실측 데이터가 있다.
 *   · 앱별 하루 평균 문제 수 (14일 실측)
 *   · 실제 발행 시각 분포 (공지가 아니라 우리가 관측한 값)
 *   · 출제일수 = 주말·공휴일에 쉬는지 여부
 * 이걸 쓰면 글이 아니라 '매일 숫자가 바뀌는 표'가 된다. 늦게 시작해도 이긴다.
 *
 * ⚠️ 모든 수치는 실제 파일에서 계산한다. 하드코딩된 숫자를 넣지 않는다 —
 *    한번 틀리면 매일 그 틀린 값이 노출된다.
 */
import { getQuizzes, getAnswerDates, getAnswersByDate } from './data';

/** 집계 기간(일). 너무 짧으면 요일 편향이 크고, 너무 길면 최근 변화를 못 따라간다. */
const WINDOW_DAYS = 14;

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * 퀴즈별 14일 실측 통계.
 * @returns {{days: string[], stats: Object<string, {total:number, activeDays:number, avgPerDay:number, byHour:number[]}>}}
 */
export function getQuizStats() {
  const dates = getAnswerDates().slice(0, WINDOW_DAYS);
  const stats = {};

  for (const d of dates) {
    const data = getAnswersByDate(d);
    for (const [slug, items] of Object.entries(data?.answers ?? {})) {
      if (!Array.isArray(items) || items.length === 0) continue;
      const s = (stats[slug] ??= { total: 0, activeDays: 0, byHour: new Array(24).fill(0) });
      s.total += items.length;
      s.activeDays += 1;
      for (const it of items) {
        // publishedAt 은 이미 KST 문자열이라 그대로 시(hour)를 뗀다.
        const hh = Number(String(it.publishedAt ?? '').slice(11, 13));
        if (Number.isInteger(hh) && hh >= 0 && hh < 24) s.byHour[hh] += 1;
      }
    }
  }

  for (const s of Object.values(stats)) {
    s.avgPerDay = s.activeDays ? s.total / s.activeDays : 0;
  }
  return { days: dates, stats };
}

/**
 * 가이드 표에 쓸 행 목록. 퀴즈 메타 + 실측을 합친다.
 * 14일 안에 한 번도 안 나온 퀴즈는 뺀다 — 없는 걸 표에 올리면 신뢰를 잃는다.
 */
export function getGuideRows() {
  const { days, stats } = getQuizStats();
  const rows = getQuizzes()
    .map((q) => {
      const s = stats[q.slug];
      return {
        slug: q.slug,
        name: q.name,
        shortName: q.shortName || q.name,
        app: q.app,
        icon: q.iconUrl,
        category: q.category,
        reward: q.reward,
        rewardRange: q.rewardRange,
        howTo: q.howTo,
        resetInfo: q.resetInfo,
        releaseTimes: q.releaseTimes ?? [],
        estDaily: toNum(q.estDaily),
        avgPerDay: s?.avgPerDay ?? 0,
        activeDays: s?.activeDays ?? 0,
        total: s?.total ?? 0,
        byHour: s?.byHour ?? new Array(24).fill(0),
      };
    })
    // activeDays 0 = 14일 안에 한 번도 안 나옴. 없는 걸 표에 올리면 신뢰를 잃는다.
    // estDaily 0 = 적립액을 아직 확인 못한 퀴즈(2026-08-18 naverpay). 수익 표는
    // 전부 이 값으로 계산되므로, 모르는 값을 0원으로 노출하느니 표에서 빼는 게 맞다.
    // 정답 페이지·수집에는 정상 노출된다 — 여기서 빠지는 건 가이드의 '돈 표'뿐이다.
    .filter((r) => r.activeDays > 0 && r.estDaily > 0);

  return { windowDays: days.length, from: days[days.length - 1], to: days[0], rows };
}

/**
 * 은행·금융 앱만 추린다.
 *
 * category 값에 의존하지 않고 슬러그를 직접 지정한다 — category 는 나중에
 * 분류 기준이 바뀔 수 있는데, 이 페이지의 정체성(은행 앱 비교)은 고정이라
 * 여기서 명시하는 편이 안전하다.
 */
const BANK_SLUGS = [
  'kb-star',
  'kbpay',
  'shinhan-sol',
  'hana-onq',
  'kbank',
  'nh-allone',
  'kakaobank',
  'kakaopay',
  'toss-lucky',
  'monimo',
];

export function getBankRows() {
  const { windowDays, rows } = getGuideRows();
  const picked = BANK_SLUGS.map((s) => rows.find((r) => r.slug === s)).filter(Boolean);
  picked.sort((a, b) => b.estDaily - a.estDaily || b.avgPerDay - a.avgPerDay);
  return { windowDays, rows: picked };
}

/** 하루 예상 적립액 순위 (전체). */
export function getRankingRows() {
  const { windowDays, rows } = getGuideRows();
  const sorted = [...rows].sort((a, b) => b.estDaily - a.estDaily || b.avgPerDay - a.avgPerDay);
  return {
    windowDays,
    rows: sorted,
    sumDaily: sorted.reduce((s, r) => s + r.estDaily, 0),
    sumQuestions: sorted.reduce((s, r) => s + r.avgPerDay, 0),
  };
}

/**
 * 시간대별 출제 표.
 *
 * releaseTimes(설정값)가 아니라 byHour(실제 관측값)를 기준으로 만든다.
 * 2026-08-17 실측에서 설정값이 실제와 30분씩 어긋나 있던 걸 확인했다.
 * 경쟁사는 앱 공지를 옮겨 적지만 우리는 관측값을 쓴다 — 이게 차별점이다.
 */
export function getTimetable() {
  const { windowDays, rows } = getGuideRows();
  const hours = [];
  for (let h = 0; h < 24; h += 1) {
    const list = rows
      .map((r) => ({ ...r, n: r.byHour[h] }))
      .filter((r) => r.n >= 2) // 1건은 우연일 수 있다
      .sort((a, b) => b.n - a.n);
    if (list.length) hours.push({ hour: h, list });
  }
  return { windowDays, hours, rows };
}
