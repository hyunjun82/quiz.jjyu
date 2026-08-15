'use client';

import { useState } from 'react';

function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <button className="af-choice-chip" onClick={copy}>
      {/* data-nosnippet — 검색결과 미리보기에서만 가린다. 색인/순위에는 그대로 반영됨. */}
      <span data-nosnippet>{value}</span>
      <span className="af-choice-copied">{copied ? '✓ 복사됨' : '탭해서 복사'}</span>
    </button>
  );
}

/**
 * 정답 표시 + 원터치 복사.
 * choices가 있으면(=랜덤 출제형: 문제마다 힌트가 달라 정답 후보가 여러 개) 후보 목록을 보여준다.
 * choices가 없으면(=고정형: 매일 하나의 확정 정답) 단일 정답을 보여준다.
 *
 * ⚠️ 정답 '값' 자체는 반드시 data-nosnippet 안에 넣는다.
 *
 * 근거 — Google Search Central "Robots meta tags / data-nosnippet":
 *   "the data-nosnippet HTML attribute on span, div, and section elements"
 * (span·div·section 세 가지 태그에서만 동작한다. 다른 태그는 무시된다.)
 * 그리고 "Control your snippets in Google Search"에 따르면 구글은 스니펫을
 * 주로 '페이지 본문'에서 가져온다. 설명(description)만 손봐서는 못 막는다.
 * 본문에 이 표시를 해야 실제로 검색결과에서 정답이 가려진다.
 *
 * 색인 자체는 막지 않으므로 순위에는 손해가 없다 — 미리보기에만 안 나온다.
 */
/**
 * 공유 버튼 — 정답 복사와 반드시 '분리'한다.
 *
 * 분리하는 이유: '탭해서 복사'는 앱 입력창에 붙여넣는 용도라 정답 글자만 들어가야 한다.
 * 여기에 주소를 섞으면 앱에 붙여넣을 때 깨진다.
 *
 * 공유 문구에 정답을 안 넣는 이유: 받은 사람이 정답까지 다 보면 링크를 누를 이유가 없다.
 * 제목+주소만 보내면 받은 사람이 우리 페이지로 들어온다 = 새 방문자 1명 + 페이지뷰 1장
 * + 전면광고 기회 1회. 지금은 정답 글자만 복사돼 나가서 이 유입이 통째로 새고 있다.
 *
 * 카카오 SDK를 안 쓰는 이유: 개발자 앱 등록·JS키 발급·도메인 등록이 필요한 계정 작업이고
 * 스크립트가 하나 더 붙어 느려진다. navigator.share를 쓰면 모바일에서 OS 공유창이 떠서
 * 그 안에 카톡이 있다 — 등록 없이 같은 결과. 미지원 환경(주로 PC)은 주소 복사로 떨어진다.
 */
function ShareButton({ text }) {
  const [copied, setCopied] = useState(false);
  const share = async (e) => {
    e.stopPropagation(); // 정답 박스 전체가 '복사' 클릭 영역이라 반드시 막는다
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title =
      text || (typeof document !== 'undefined' ? document.title.split('|')[0].trim() : '');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: title, url });
        return; // 공유창을 띄웠으면 문구를 바꾸지 않는다(취소했을 수도 있으므로)
      }
      await navigator.clipboard.writeText(`${title}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 공유창을 닫았거나 클립보드가 막힌 환경 — 조용히 무시 */
    }
  };
  return (
    <button className="af-share" onClick={share} type="button">
      {copied ? '✓ 주소가 복사됐어요' : '🔗 정답 공유하기'}
    </button>
  );
}

export default function AnswerBox({ answer, choices, label = '오늘의 정답', shareText }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (choices && choices.length > 0) {
    return (
      <>
        <div className="answer-final answer-choices">
          <p className="af-label">오늘의 정답 후보 ({choices.length}개)</p>
          <p className="af-choice-hint">
            이 퀴즈는 문제가 랜덤으로 여러 번 바뀌는 방식이에요. 내 화면에 뜬 초성 힌트와 글자 수가 맞는 정답을 아래에서 찾아 복사하세요.
          </p>
          <div className="af-choice-list">
            {choices.map((c, i) => (
              <CopyChip key={i} value={c} />
            ))}
          </div>
        </div>
        <ShareButton text={shareText} />
      </>
    );
  }

  return (
    <>
      <div className="answer-final" onClick={copy}>
        <p className="af-label">{label}</p>
        <p className="af-value">
          <span data-nosnippet>{answer}</span>
        </p>
        <button className="af-copy" onClick={copy}>
          {copied ? '복사되었습니다 ✓' : '탭해서 복사'}
        </button>
      </div>
      <ShareButton text={shareText} />
    </>
  );
}
