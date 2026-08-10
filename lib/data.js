import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ANSWERS_DIR = path.join(DATA_DIR, 'answers');

export function getQuizzes() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'quizzes.json'), 'utf-8');
  return JSON.parse(raw).quizzes;
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
