import { notFound } from 'next/navigation';
import { getQuizzes, getQuizBySlug } from '../../../../lib/data';
import { monthData, pastMonthsWithData } from '../../../../lib/monthly';
import MonthlyView from '../../../../components/MonthlyView';

/**
 * 월간 정답 모음 — 고정 주소 페이지 (/quiz/{slug}/monthly/)
 *
 * 왜 고정 주소인가: 날짜 주소(/2026-08-04/)는 매일 새로 태어나 검색 신뢰를
 * 0에서 시작하고 하루 만에 낡는다. 이 주소는 영원히 같고 내용만 매달
 * 갈아끼우므로, 링크와 크롤링 신호가 한 곳에 계속 쌓인다. 경쟁사 두 곳
 * (quizbells /monthly, epostphone 월별 카테고리)이 이 구조로 네이버 날짜
 * 검색까지 먹는 것을 실측 확인함(2026-08-04).
 *
 * 2026-10-28: 달이 바뀌면 지난달 모음이 사라지던 문제 — 지난달은
 *   /quiz/{slug}/monthly/2026-09/ 보관 페이지로 남긴다(같은 폴더의 [ym]/page.js).
 *
 * 내용 원칙: 글 없음. 이미 수집된 정답을 날짜별로 묶어 보여주기만 한다.
 * 정답 값은 data-nosnippet — 검색결과 미리보기에 정답이 새면 클릭할 이유가
 * 사라진다(제로클릭). 색인·순위에는 영향 없음.
 */

export function generateStaticParams() {
  return getQuizzes().map((q) => ({ slug: q.slug }));
}

function monthTitle(quiz, ym, total, withYear) {
  const [y, m] = (ym || '').split('-').map(Number);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  // searchKeyword가 이미 '…정답'으로 끝나면 그대로 붙일 때 "정답 8월 정답"이 된다.
  const kwBase = quiz.searchKeyword.endsWith(noun)
    ? quiz.searchKeyword.slice(0, -noun.length).trim()
    : quiz.searchKeyword;
  const when = m ? `${withYear ? `${y}년 ` : ''}${m}월` : '이번 달';
  return `${kwBase} ${when} ${noun} 모음 — 날짜별 전체 ${total}건`;
}

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const { ym, days, total } = monthData(params.slug);
  const [y, m] = (ym || '').split('-').map(Number);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  const label = ym ? `${y}년 ${m}월` : '이번 달';
  return {
    title: monthTitle(quiz, ym, total, false),
    // 정답 값은 설명에 넣지 않는다(제로클릭 방지 정책과 동일).
    description: `${label} ${quiz.name} ${noun} ${total}건을 날짜별로 한 페이지에 정리했습니다. 업데이트 ${days.length}일치, 정답 공개 즉시 자동 반영. ${quiz.reward} 바로 받아가세요.`,
    alternates: { canonical: `/quiz/${quiz.slug}/monthly/` },
  };
}

export default function MonthlyPage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) notFound();
  const { ym, days, total } = monthData(params.slug);
  return (
    <MonthlyView
      quiz={quiz}
      ym={ym}
      days={days}
      total={total}
      isCurrent
      pastLinks={pastMonthsWithData(params.slug)}
    />
  );
}
