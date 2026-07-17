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
