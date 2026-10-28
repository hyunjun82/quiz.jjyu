import { notFound } from 'next/navigation';
import { getQuizzes, getQuizBySlug } from '../../../../../lib/data';
import { monthData, pastMonthsWithData } from '../../../../../lib/monthly';
import MonthlyView from '../../../../../components/MonthlyView';

/**
 * 지난달 정답 모음 보관 페이지 — /quiz/{slug}/monthly/2026-09/
 *
 * 2026-10-28 추가: 고정 주소(/monthly/)는 달이 바뀌면 내용이 새 달로 바뀌어
 *   "하나원큐 퀴즈 9월 정답 모음" 같은 지난달 모음이 사이트에서 사라졌다.
 *   지난달(이번 달 제외)마다 이 주소로 영구 보관한다. 정답이 1건 이상인 달만 만든다.
 */

export function generateStaticParams() {
  return getQuizzes().flatMap((q) => pastMonthsWithData(q.slug).map((p) => ({ slug: q.slug, ym: p.ym })));
}

export const dynamicParams = false;

function title(quiz, ym, total) {
  const [y, m] = ym.split('-').map(Number);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  const kwBase = quiz.searchKeyword.endsWith(noun)
    ? quiz.searchKeyword.slice(0, -noun.length).trim()
    : quiz.searchKeyword;
  return `${kwBase} ${y}년 ${m}월 ${noun} 모음 — 날짜별 전체 ${total}건`;
}

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const { ym, days, total } = monthData(params.slug, params.ym);
  const [y, m] = ym.split('-').map(Number);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  return {
    title: title(quiz, ym, total),
    description: `${y}년 ${m}월 ${quiz.name} ${noun} ${total}건을 날짜별로 한 페이지에 정리했습니다. ${days.length}일치 전체 기록.`,
    alternates: { canonical: `/quiz/${quiz.slug}/monthly/${ym}/` },
  };
}

export default function PastMonthPage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz || !/^\d{4}-\d{2}$/.test(params.ym)) notFound();
  const { ym, days, total } = monthData(params.slug, params.ym);
  if (total === 0) notFound();
  return (
    <MonthlyView
      quiz={quiz}
      ym={ym}
      days={days}
      total={total}
      isCurrent={false}
      pastLinks={pastMonthsWithData(params.slug)}
    />
  );
}
