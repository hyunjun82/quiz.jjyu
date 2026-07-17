import { notFound } from 'next/navigation';
import {
  getQuizzes,
  getQuizBySlug,
  getAnswerDates,
  getAnswersByDate,
  formatKoreanDate,
} from '../../../../lib/data';
import QuizDetail from '../../../../components/QuizDetail';

/** 모든 (퀴즈 × 날짜) 조합의 아카이브 페이지 생성 */
export function generateStaticParams() {
  const quizzes = getQuizzes();
  const dates = getAnswerDates();
  return quizzes.flatMap((q) => dates.map((d) => ({ slug: q.slug, date: d })));
}

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const dateLabel = formatKoreanDate(params.date);
  return {
    title: `${quiz.searchKeyword} ${dateLabel}`,
    description: `${dateLabel} ${quiz.name} 정답 모음. ${quiz.howTo}에서 참여할 수 있습니다.`,
    alternates: { canonical: `/quiz/${quiz.slug}/${params.date}/` },
  };
}

export default function QuizDatePage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) notFound();

  const dates = getAnswerDates();
  if (!dates.includes(params.date)) notFound();

  const data = getAnswersByDate(params.date);
  const isToday = params.date === dates[0];

  return (
    <QuizDetail quiz={quiz} date={params.date} dates={dates} data={data} isToday={isToday} />
  );
}
