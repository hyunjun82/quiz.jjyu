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
  return {
    title: `${quiz.searchKeyword} — ${dateLabel} 오늘의 정답 실시간`,
    description: `${dateLabel} ${quiz.name} 정답을 공개 즉시 업데이트합니다. ${quiz.howTo}에서 참여하고 ${quiz.reward}을 받아보세요.`,
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
