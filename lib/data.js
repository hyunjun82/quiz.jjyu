import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ANSWERS_DIR = path.join(DATA_DIR, 'answers');

export function getQuizzes() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'quizzes.json'), 'utf-8');
  return JSON.parse(raw).quizzes;
}

/**
 * 토스쇼핑 쉐어링크 상품 + "하루 적립액" 기준값.
 *
 * daily 는 quizzes.json 의 estDaily 합계다(2026-08-20 기준 1,740원).
 * 상품 가격을 이 값으로 나눠 "적립금 N일치"로 보여주려고 쓴다 —
 * 퀴즈로 돈을 모으는 사람에게 8,700원은 '5일치'라고 해야 감이 온다.
 * 숫자를 코드에 박아두면 앱이 늘 때마다 어긋나므로 매번 계산한다.
 */
export function getShopPicks() {
  let items = [];
  let headline = '';
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'shop.json'), 'utf-8');
    const j = JSON.parse(raw);
    // 품절 상품은 화면에서 뺀다 — 눌렀는데 품절이면 다음부터 아예 안 누른다.
    items = (j.items ?? []).filter((it) => it && it.link && it.name && !it.soldOut);
    // 이미지는 빌드 직전 scripts/shop-images.mjs 가 받아 놓는다.
    // 못 받았으면(토스 쪽 실패 등) 깨진 사진 대신 사진 없는 카드로 내보낸다.
    items = items.map((it) => {
      if (!it.image) return it;
      const f = path.join(process.cwd(), 'public', it.image.replace(/^\//, ''));
      return fs.existsSync(f) ? it : { ...it, image: '' };
    });
    headline = j.headline ?? '';
  } catch {
    items = [];
  }
  const daily = getQuizzes().reduce(
    (n, q) => n + (Number(String(q.estDaily ?? 0).replace(/[^0-9.]/g, '')) || 0),
    0,
  );
  return { items, daily, headline };
}

export function getQuizBySlug(slug) {
  return getQuizzes().find((q) => q.slug === slug) || null;
}

/** 정답 파일이 있는 모든 날짜 (최신순) */
export function getAnswerDates() {
  return fs
    .readdirSync(ANSWERS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace('.json', ''))
    .sort()
    .reverse();
}

export function getAnswersByDate(date) {
  const file = path.join(ANSWERS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** 가장 최신(=오늘) 정답 */
export function getLatestAnswers() {
  const dates = getAnswerDates();
  if (dates.length === 0) return null;
  return getAnswersByDate(dates[0]);
}

/**
 * 이 퀴즈의 정답이 실제로 있는 가장 최근 날짜 (없으면 null).
 *
 * 왜 필요한가 — 2026-08-10 실측: 토스 행운퀴즈가 8/8부터 사흘 연속 소스에
 * 정답이 안 올라왔다(경쟁사 3곳도 전부 없음 = 업계 공통 상황). 그동안 우리
 * /quiz/toss-lucky/ 페이지는 "8월 10일 오늘의 정답"이라는 제목을 달고 검색에
 * 노출되는데 내용은 "아직 등록되지 않았습니다" 한 줄뿐이었다.
 * 들어온 사람은 바로 나가고, 검색엔진은 이 주소를 빈 페이지로 학습한다.
 * 오늘 것이 없으면 최근 정답이라도 보여줘 헛걸음을 막는다.
 *
 * @param {string} slug   퀴즈 슬러그
 * @param {string} except 건너뛸 날짜(보통 오늘)
 */
export function getLatestNonEmptyDate(slug, except) {
  for (const d of getAnswerDates()) {
    if (d === except) continue;
    if ((getAnswersByDate(d)?.answers?.[slug] ?? []).length > 0) return d;
  }
  return null;
}

/**
 * 오늘의 정주행 그리드 데이터 — 퀴즈별 (아이콘, 오늘 정답 건수).
 * 정답 있는 퀴즈 먼저(건수 많은 순), 대기 중은 뒤로.
 */
export function getTodayQuizGridItems() {
  const dates = getAnswerDates();
  const today = dates[0];
  const data = today ? getAnswersByDate(today) : null;
  const items = getQuizzes().map((q) => ({
    slug: q.slug,
    name: q.shortName || q.name,
    icon: q.iconUrl,
    count: (data?.answers?.[q.slug] ?? []).length,
    // 2026-08-19: '아직 N개 남음'을 '안 받은 적립금 ₩'로 바꾸기 위해 추가.
    // 앱테크 사용자에게 개수는 할 일이지만 원화 금액은 자기 돈이다.
    // quizzes.json 의 estDaily(하루 예상 적립액) 실데이터를 그대로 쓴다.
    estDaily: Number(String(q.estDaily ?? 0).replace(/[^0-9.]/g, '')) || 0,
  }));
  items.sort((a, b) => (b.count > 0) - (a.count > 0) || b.count - a.count);
  return { today, items };
}

export function formatKoreanDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function formatShortDate(isoDate) {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${m}월 ${d}일`;
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
  });
}
