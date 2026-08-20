'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 토스쇼핑 쉐어링크 — 정답을 다 본 사람에게 "번 돈으로 뭘 살 수 있나"를 보여준다.
 *
 * ── 왜 이 자리, 왜 이 문구인가 ───────────────────────────
 * 여기 오는 사람은 퀴즈로 하루 1,740원쯤 모으는 사람이다. 쇼핑 배너를 그냥 얹으면
 * 광고로 보고 넘긴다. 그래서 '번 돈'과 '쓸 돈'을 같은 단위로 잇는다 —
 * "8,700원 = 적립금 5일치". 쿠팡 배너는 이 문장을 못 쓴다.
 * 방문자가 오늘 얼마 벌었는지 모르니까. 우리만 안다.
 *
 * ── 왜 하나를 크게 걸지 않고 그리드인가 ──────────────────
 * 한 사람에게 필요한 게 물일지 반찬일지 설렁탕일지 모른다. 하나만 크게 걸면
 * 그게 안 맞는 사람은 그냥 나간다. 카테고리가 안 겹치게 6개를 깔면 누구든 하나는 걸린다.
 *
 * ── 수수료 구조 (공식 문서) ──────────────────────────────
 * "다른 사람이 링크를 클릭한 뒤 24시간 안에 토스쇼핑에서 결제하면, 결제 금액의 10%"
 * 즉 이 상품을 안 사고 다른 걸 사도 집계된다. 그래서 전략은 '이걸 팔자'가 아니라
 * '아무거나 하나만 눌리게 하자'다. 그럼 답은 그리드다.
 *
 * ── 왜 토스 UI 인가 ──────────────────────────────────────
 * 방문자 상당수가 "토스 행운퀴즈 정답"을 검색해 들어온 토스 앱 유저다.
 * 토스쇼핑 목록과 같은 카드 모양이면 낯설지 않고, 누르면 어디로 가는지도 예상이 된다.
 *
 * ── 애드센스 정책 (광고 게재위치 정책 확인) ───────────────
 *   · "사용자의 의도적인 상호작용에 의해 실행되는 창이 아닌 다른 창에 Google 광고 게재" 금지
 *     → 이 팝업 안에는 애드센스 광고를 절대 넣지 않는다. 토스 상품만 넣는다.
 *   · "팝업이 4개 이상인 사이트" 금지 → 세션당 1회, 1개만.
 *   · "팝언더" 금지 → 새 창을 열지 않는다.
 *   · "콘텐츠가 광고와 유사하게 보이도록 하는 레이아웃" 금지
 *     → 제휴 영역임을 문구로 명시해 애드센스 광고와 헷갈리지 않게 한다.
 *
 * ── 공정거래위원회 ───────────────────────────────────────
 * 추천·보증 심사지침에 따라 경제적 이해관계를 표시해야 한다.
 * 고정 섹션과 팝업 '양쪽 모두'에 넣는다. 하나만 넣으면 팝업만 본 사람은 못 본다.
 */

const DISCLOSURE =
  '이 콘텐츠는 토스쇼핑 쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를 지급받습니다.';

/** 8,700원짜리를 "적립금 5일치"로 바꾼다. 이 사이트에서만 통하는 단위다. */
function daysOf(price, daily) {
  if (!daily || daily <= 0) return null;
  const d = Math.round(price / daily);
  return d >= 1 ? d : null;
}

/** 토스쇼핑 목록과 같은 카드 */
function Card({ item, daily }) {
  const days = daysOf(item.price, daily);
  return (
    <a href={item.link} className="tc" target="_blank" rel="nofollow sponsored noopener">
      <span className="tc-img">
        {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" />}
        {item.tag && <em className="tc-tag">{item.tag}</em>}
      </span>
      <span className="tc-body">
        <b className="tc-name">{item.name}</b>
        <span className="tc-price">{item.price.toLocaleString()}원</span>
        {/* 단가 도장 — 토스 목록에는 없는 우리 것.
            "8,700원"은 남의 돈이고 "1병 109원"은 결정할 수 있는 숫자다.
            값은 전부 실제 나눗셈 결과다(지어낸 비교값은 절대 넣지 않는다). */}
        {item.unit && <span className="tc-unit">{item.unit}</span>}
        {item.note && <span className="tc-meta">{item.note}</span>}
        {days && <span className="tc-days">적립금 {days}일치</span>}
      </span>
    </a>
  );
}

function Grid({ items, daily }) {
  if (!items.length) return null;
  return (
    <div className="tgrid">
      {items.map((it, i) => (
        <Card key={i} item={it} daily={daily} />
      ))}
    </div>
  );
}

/** 정답 아래 고정 섹션 — 6개까지 */
export function ShopInline({ items = [], daily = 0, headline = '' }) {
  if (!items.length) return null;
  return (
    <section className="sp-wrap">
      <div className="sp-head">
        {/* 이 문장은 이 사이트만 쓸 수 있다. headline 은 data/shop.json 에서 받는다
            — 예: "설렁탕 한 그릇 값입니다" (8,900원 ÷ 5그릇 = 1,780원 ≈ 하루 적립액) */}
        <h2>
          오늘 퀴즈 다 풀면 <span className="hl">{daily.toLocaleString()}원</span>
          {headline && (
            <>
              <br />
              {headline}
            </>
          )}
        </h2>
        <p>그 돈으로 뭘 살 수 있는지 계산해봤어요</p>
      </div>
      <div className="sp-body">
        <Grid items={items.slice(0, 6)} daily={daily} />
        <p className="sp-disc">✱ {DISCLOSURE}</p>
      </div>
    </section>
  );
}

/**
 * 나갈 때 한 번 뜨는 시트.
 *
 * 정답을 이미 본 뒤라 목적을 방해하지 않는다(들어올 때 막는 오퍼월과 다른 점).
 * 모바일은 뒤로가기, PC는 마우스가 화면 위로 빠질 때 감지한다.
 * ⚠️ 뒤로가기는 '한 번만' 잡는다. 두 번째엔 그냥 나가야 한다 —
 *    안 그러면 "뒤로가기가 안 먹네" 하고 짜증이 난다.
 */
export function ShopExit({ items = [], daily = 0 }) {
  const [open, setOpen] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!items.length) return;
    try {
      if (sessionStorage.getItem('sp-exit') === '1') return;
    } catch {}

    const fire = () => {
      if (done.current) return false;
      done.current = true;
      try {
        sessionStorage.setItem('sp-exit', '1');
      } catch {}
      setOpen(true);
      return true;
    };

    // 모바일 — 뒤로가기 한 번을 붙잡는다
    history.pushState({ sp: 1 }, '');
    const onPop = () => {
      if (!fire()) return; // 이미 떴으면 붙잡지 않고 그대로 보낸다
      history.pushState({ sp: 1 }, ''); // 다음 뒤로가기는 실제로 나가게
    };

    // PC — 마우스가 주소창 쪽으로 빠질 때
    const onLeave = (e) => {
      if (e.clientY <= 0) fire();
    };

    window.addEventListener('popstate', onPop);
    document.addEventListener('mouseout', onLeave);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('mouseout', onLeave);
    };
  }, [items.length]);

  if (!open || !items.length) return null;

  return (
    <div className="sp-modal" role="dialog" aria-label="토스쇼핑 추천 상품">
      <div className="sp-dim" onClick={() => setOpen(false)} />
      <div className="sp-sheet">
        <button type="button" className="sp-close" onClick={() => setOpen(false)} aria-label="닫기">
          ✕
        </button>
        <div className="sp-head">
          <h2>
            가시기 전에 —
            <br />
            오늘 모은 <span className="hl">{daily.toLocaleString()}원</span>, 이거 살 수 있어요
          </h2>
          <p>토스쇼핑 오늘 최저가 기준</p>
        </div>
        <div className="sp-body">
          <Grid items={items.slice(0, 4)} daily={daily} />
          <p className="sp-disc">✱ {DISCLOSURE}</p>
        </div>
        <button type="button" className="sp-later" onClick={() => setOpen(false)}>
          괜찮아요, 닫기
        </button>
      </div>
    </div>
  );
}
