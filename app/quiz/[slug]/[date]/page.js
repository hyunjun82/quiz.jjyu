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
  const dates = getAnswerDates();
  const isToday = params.date === dates[0];
  const dateLabel = formatKoreanDate(params.date);
  const data = getAnswersByDate(params.date);
  const n = data?.answers?.[quiz.slug]?.length ?? 0;
  const noun = quiz.eventType ? '참여 링크' : '정답';

  // 검색량 상위 패턴이 "날짜+퀴즈명+정답/오늘의퀴즈" 조합인 게 실측 확인됨(Naver 서치어드바이저).
  // 단, "오늘의"는 실제 오늘 날짜 페이지에만 붙인다 — 지난 날짜에 붙이면 부정확한 정보가 된다.
  const title = isToday
    ? n > 0
      ? `${quiz.searchKeyword} ${dateLabel} 오늘의 ${noun} — ${n}건 공개`
      : `${quiz.searchKeyword} ${dateLabel} 오늘의 ${noun}`
    : n > 0
    ? `${quiz.searchKeyword} ${dateLabel} — ${noun} ${n}건 다시보기`
    : `${quiz.searchKeyword} ${dateLabel}`;

  const description =
    n > 0
      ? `${dateLabel} ${quiz.name} ${noun} ${n}건. ${
          isToday ? '공개 즉시 실시간 업데이트되며, ' : ''
        }탭 한 번으로 복사하고 ${quiz.reward} 받아가세요.`
      : `${dateLabel} ${quiz.name} ${noun} 모음. ${quiz.howTo}에서 참여할 수 있습니다.`;

  return {
    title,
    description,
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
