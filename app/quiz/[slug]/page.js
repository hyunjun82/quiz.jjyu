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
  // 정답/참여링크 건수를 넣은 동적 디스크립션 — 발행 때마다 재빌드되므로 항상 최신 (언론사 기사는 불가능한 방식)
  const description =
    n > 0
      ? `✅ ${dateLabel} ${quiz.name} ${noun} ${n}건 공개 중 — 공개 즉시 실시간 업데이트. 탭 한 번으로 복사하고 ${quiz.reward} 받아가세요.`
      : `${dateLabel} ${quiz.name} ${noun}을 공개 즉시 실시간 업데이트합니다. ${quiz.howTo} — ${noun}이 뜨면 이 페이지에 가장 먼저 올라옵니다.`;
  return {
    title:
      n > 0
        ? `${quiz.searchKeyword} — ${dateLabel} ${noun} ${n}건 공개`
        : `${quiz.searchKeyword} — ${dateLabel} 오늘의 ${noun} 실시간`,
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
