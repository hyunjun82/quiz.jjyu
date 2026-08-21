import {
  getQuizzes,
  getLatestAnswers,
  getAnswerDates,
  formatKoreanDate,
  formatTime,
  getTodayQuizGridItems,
  getShopPicks,
} from '../../lib/data';
import AdUnit from '../../components/AdUnit';
import TodayAllAnswers from '../../components/TodayAllAnswers';
import TodayQuizGrid from '../../components/TodayQuizGrid';
import { ShopInline } from '../../components/ShopPicks';

/**
 * /today/ — 오늘 올라온 모든 앱의 퀴즈 정답을 한 페이지에 모은다.
 *
 * ── 왜 별도 페이지인가 ───────────────────────────────────
 * 정답 모음집을 각 퀴즈의 목록·상세 페이지 안에 넣으면, 그 페이지 하나로 볼일이 끝나서
 * 페이지 이동이 사라진다. 이동이 사라지면 모바일 전면광고(RPM $7.26 — 우리 형식 중
 * 최고)가 통째로 죽는다.
 * 그래서 모음집을 '한 번 더 눌러야 오는 자리'로 분리했다. 버튼을 누르는 순간 이동이
 * 발생하고(전면광고), 도착해서는 오늘 것을 전부 볼 수 있으니 체류시간도 길어진다.
 *
 * 주소를 /today/ 로 고정한 이유 — 날짜가 안 들어가야 신뢰가 한 주소에 누적된다.
 * 매일 내용만 갱신되므로 "오늘 퀴즈 정답 모음" 류 검색어를 이 한 페이지로 받는다.
 */

const SITE_URL = 'https://quiz.jjyu.co.kr';

export function generateMetadata() {
  const data = getLatestAnswers();
  const date = data?.date || getAnswerDates()[0];
  const total = Object.values(data?.answers ?? {}).reduce((n, a) => n + (a?.length ?? 0), 0);
  const label = date ? formatKoreanDate(date) : '';

  return {
    title: `오늘 퀴즈 정답 모음 ${label} — ${total}개 전부 공개 | QUIZDAY`,
    description: `${label} 올라온 앱테크 퀴즈 정답 ${total}개를 한 페이지에 모았습니다. 캐시워크 돈버는퀴즈·토스 행운퀴즈·신한 쏠퀴즈·캐시닥 용돈퀴즈까지 앱별로 정리했고, 정답은 탭 한 번으로 복사됩니다.`,
    alternates: { canonical: '/today/' },
    openGraph: {
      title: `오늘 퀴즈 정답 모음 ${label} — ${total}개`,
      description: `${label} 앱테크 퀴즈 정답 ${total}개 한 곳에.`,
      url: `${SITE_URL}/today/`,
      type: 'website',
    },
  };
}

export default function TodayAllPage() {
  const data = getLatestAnswers();
  const date = data?.date || getAnswerDates()[0];
  const dateLabel = date ? formatKoreanDate(date) : '';
  const grid = getTodayQuizGridItems();
  const shop = getShopPicks();

  const answers = data?.answers ?? {};
  const groups = getQuizzes()
    .map((q) => ({
      slug: q.slug,
      name: q.name,
      eventType: q.eventType || null,
      estDaily: Number(String(q.estDaily ?? 0).replace(/[^0-9.]/g, '')) || 0,
      items: (answers[q.slug] ?? []).map((it, i) => ({
        idx: i + 1,
        question: it.question,
        answer: it.answer ?? '',
        choices: it.choices ?? null,
        note: it.note ?? '',
        time: formatTime(it.publishedAt) || '',
      })),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="container detail">
      <div className="detail-grid">
        <aside className="rail rail-left">
        </aside>
        <div className="detail-main">
          <p className="crumb">
            <a href="/">홈</a> › 오늘 정답 모음
          </p>

          <h1>
            오늘 퀴즈 정답 모음 <span className="grad">{dateLabel}</span>
          </h1>

          <div className="meta-bar">
            <span className="upd">
              <span className="upd-dot" />
              {formatTime(data?.updatedAt) || ''} 업데이트
            </span>
            <span className="sep" />
            <span>정답 {total}건</span>
            <span className="sep" />
            <span>앱 {groups.length}개</span>
          </div>

          <div className="howto">
            <b>이 페이지</b> — 오늘 올라온 앱테크 퀴즈 정답을 앱별로 전부 모았습니다 · 수시 갱신
          </div>


          <TodayAllAnswers
            groups={groups}
            date={date}
            dateLabel={dateLabel}
            currentSlug={null}
            currentIdx={null}
          />

          <AdUnit slot="9284435988" />

          <TodayQuizGrid items={grid.items} currentSlug={null} today={grid.today} />

          {/* 여기가 사이트의 마지막 페이지다 — 오늘 것을 다 본 사람은 더 갈 데가 없다.
              이동으로 벌 수 있는 건 다 벌었으니 이 자리에서 쇼핑을 권한다. */}
          <ShopInline items={shop.items} daily={shop.daily} headline={shop.headline} />

          <div className="guide-cta-group">
            <p className="guide-cta-head">더 알아보기</p>

            <a href="/guide/ranking/" className="guide-cta">
              <span className="guide-cta-txt">
                <b>어떤 앱이 제일 남을까 — 앱테크 수익 순위</b>
                <span>27개 앱을 하루 적립액으로 줄 세웠습니다 · 14일 실측</span>
              </span>
              <span className="guide-cta-go">순위 보기 →</span>
            </a>

            <a href="/guide/timetable/" className="guide-cta">
              <span className="guide-cta-txt">
                <b>퀴즈가 몇 시에 열리는지</b>
                <span>앱 공지가 아니라 실제로 올라온 시각을 14일간 기록했습니다</span>
              </span>
              <span className="guide-cta-go">시간표 보기 →</span>
            </a>
          </div>

        </div>
        <aside className="rail">
        </aside>
      </div>
    </main>
  );
}
