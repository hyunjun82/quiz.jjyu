import { notFound } from 'next/navigation';
import {
  getQuizzes,
  getQuizBySlug,
  getAnswerDates,
  getAnswersByDate,
  formatKoreanDate,
} from '../../../lib/data';
import QuizDetail from '../../../components/QuizDetail';

export function generateStaticParams() {
  return getQuizzes().map((q) => ({ slug: q.slug }));
}

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const dates = getAnswerDates();
  const dateLabel = dates[0] ? formatKoreanDate(dates[0]) : '오늘';
  const data = dates[0] ? getAnswersByDate(dates[0]) : null;
  const n = data?.answers?.[quiz.slug]?.length ?? 0;
  const noun = quiz.eventType ? '참여 링크' : '정답';

  /* ── 2026-08-23 "오늘" 실험 ────────────────────────────────────────
     왜 넣나 — 네이버 연관검색어가 "토스 행운퀴즈 정답 오늘" 이다.
     그런데 기존 구조는 정답이 채워지는 순간(n>0) 제목에서 "오늘"이 빠졌다.
     새벽(0건)에는 "오늘의 정답 실시간"이 붙어 있다가, 정작 사람이 몰리는
     시간대가 되면 그 단어가 사라지는 구조였다. 정확히 거꾸로였다.

     왜 하나원큐만 빼나 — 대조군이다. hana-onq 는 노출 2,855 / CTR 13.4% 로
     31개 중 유일하게 잘 나오는 페이지다. 전부 바꿔버리면 일주일 뒤 CTR이
     올라도 "이 문구 덕분인지, 그냥 그 주가 좋았던 건지" 구분이 안 된다.
     하나만 그대로 두면 그게 갈린다. (30개 = 전체 노출의 95.7%)

     되돌리기 — CTR_TEST 를 false 로 바꾸면 전부 원래 문구로 돌아간다.
     판정 — 2026-08-30 네이버 서치어드바이저 '검색 웹문서' 에서
            바꾼 30개 CTR 변화 vs 하나원큐 CTR 변화 대조. */
  const CTR_TEST = quiz.slug !== 'hana-onq';
  const t = CTR_TEST ? ' 오늘' : ''; // 날짜 뒤에 붙인다. "8월 23일 오늘"이 자연스럽고 "오늘 8월 23일"은 어색하다.

  // 정답/참여링크 건수를 넣은 동적 디스크립션 — 발행 때마다 재빌드되므로 항상 최신 (언론사 기사는 불가능한 방식)
  const description =
    n > 0
      ? `✅ ${dateLabel}${t} ${quiz.name} ${noun} ${n}건 공개 중 — 공개 즉시 실시간 업데이트. 탭 한 번으로 복사하고 ${quiz.reward} 받아가세요.`
      : `${dateLabel}${t} ${quiz.name} ${noun}을 공개 즉시 실시간 업데이트합니다. ${quiz.howTo} — ${noun}이 뜨면 이 페이지에 가장 먼저 올라옵니다.`;
  return {
    title:
      n > 0
        ? `${quiz.searchKeyword} — ${dateLabel}${t} ${noun} ${n}건 공개`
        : `${quiz.searchKeyword} — ${dateLabel} ${CTR_TEST ? '오늘' : '오늘의'} ${noun} 실시간`,
    description,
    alternates: { canonical: `/quiz/${quiz.slug}/` },
  };
}

export default function QuizPage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) notFound();

  const dates = getAnswerDates();
  const today = dates[0];
  const data = today ? getAnswersByDate(today) : null;

  return <QuizDetail quiz={quiz} date={today} dates={dates} data={data} isToday />;
}
