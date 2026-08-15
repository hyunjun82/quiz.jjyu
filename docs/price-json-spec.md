# 금·환율 데이터 규격 (price.json)

머니위키(jjyu.co.kr) 금 페이지가 읽을 데이터의 모양입니다.
**jjyu.co.kr 저장소에는 이 파일과 관련된 어떤 코드도 넣지 않습니다.** 페이지가 브라우저에서 아래 주소를 `fetch` 하기만 하면 됩니다.

```
https://quiz.jjyu.co.kr/price.json
```

- CORS 허용됨 (`Access-Control-Allow-Origin: *`)
- 캐시 5분 (`max-age=300`)
- 갱신 주기: 1시간
- 크기: 약 22KB (대부분이 추이 그래프용 과거 데이터)

---

## 1. 최상위 구조

```json
{
  "updatedAt": "2026-08-15T17:04:34.257+09:00",
  "sources": ["retail:jongrogx", "krx:data.go.kr", "fx:yahoo", "intl.gold:yahoo", "intl.silver:yahoo"],
  "retail": { ... },
  "krx":    { ... },
  "fx":     { ... },
  "intl":   { "gold": {...}, "silver": {...} }
}
```

**모든 최상위 키는 없을 수 있습니다.** 소스 한 곳이 죽어도 나머지는 살아 있게 설계했기 때문입니다.
반드시 `data.retail?.items` 처럼 옵셔널 체이닝으로 접근하고, 없으면 그 칸을 통째로 숨기세요.
**절대 `0원`이나 `-`를 표시하지 마세요.** 시세 사이트에서 0원 노출이 가장 치명적입니다.

`sources` 배열에는 실패한 소스가 `retail:FAIL(사유)` 형태로 남습니다. 화면에 쓰지 말고 디버깅용으로만 보세요.

---

## 2. `retail` — 금은방 소매가 ★ 화면 주인공

**사람들이 "금 한 돈 얼마"로 검색해서 보고 싶어 하는 숫자가 이겁니다.** 가장 크게, 가장 위에 놓으세요.

```json
"retail": {
  "source": "종로금거래소",
  "sourceUrl": "https://www.jongrogx.com/",
  "quoteDate": "2026-08-15",
  "unit": "원/돈",
  "note": "내가 살 때 가격은 원문에 부가세 별도로 표기되어 있습니다.",
  "items": [
    {
      "key": "gold24", "name": "순금 24K",
      "userSell": { "price": 731000, "change": 4000, "dir": "up" },
      "userBuy":  { "price": 795000, "change": 7000, "dir": "up" }
    },
    { "key": "gold18",   "name": "18K", "userSell": {...}, "userBuy": null },
    { "key": "gold14",   "name": "14K", "userSell": {...}, "userBuy": null },
    { "key": "platinum", "name": "백금", "userSell": {...}, "userBuy": {...} },
    { "key": "silver",   "name": "은",   "userSell": {...}, "userBuy": {...} }
  ]
}
```

| 필드 | 뜻 |
|---|---|
| `userSell` | **내가 팔 때** — 사용자가 금을 팔고 받는 돈 |
| `userBuy` | **내가 살 때** — 사용자가 금을 사며 내는 돈 (부가세 별도) |
| `price` | 한 돈(3.75g) 기준 원화 |
| `change` | 전일 대비. 하락이면 **음수**로 들어옵니다 |
| `dir` | `"up"` / `"down"` / `"none"` |
| `quoteDate` | 업체가 고시한 날짜. 화면에 "8월 15일 기준"으로 반드시 표기 |

⚠️ **`userSell` / `userBuy` 는 사용자 관점입니다.** 업체 관점(매입/매도)과 반대라 헷갈리기 쉽습니다. 화면 문구도 반드시 "내가 팔 때 / 내가 살 때"로 쓰세요. 사람들이 이걸 제일 헷갈려 하고, 정확히 써주는 페이지가 신뢰를 얻습니다.

⚠️ **`userBuy` 가 `null` 일 수 있습니다** (18K·14K는 업체가 매도를 안 함). 그 칸은 "—" 대신 아예 숨기거나 "취급 안 함"으로 쓰세요.

⚠️ **부가세 별도 문구는 반드시 노출하세요.** `note` 를 그대로 작은 글씨로 깔면 됩니다. 이걸 빼면 실제 결제 금액과 달라 항의가 들어옵니다.

### 금 계산기는 이 값으로 만듭니다

```
사용자가 팔 때 받는 돈 = userSell.price × 돈 수
사용자가 살 때 내는 돈 = userBuy.price  × 돈 수   (+ 부가세 별도)
```

그램 입력을 받으려면 `1돈 = 3.75g` 으로 나누세요.

---

## 3. `krx` — 한국거래소 도매 종가 ★ 추이 그래프용

```json
"krx": {
  "source": "한국거래소 KRX 금시장 (공공데이터포털)",
  "item": "금 99.99_1kg",
  "unit": "원/그램",
  "note": "하루 1회 갱신되는 전 영업일 종가입니다. 실시간 시세가 아닙니다.",
  "latest":  { "date": "2026-08-13", "krwPerGram": 200570, "krwPerDon": 752138, "change": 100, "changePct": 0.05 },
  "history": [ { "date": "2026-02-19", "krwPerGram": ..., "krwPerDon": ..., "change": ..., "changePct": ... }, ... ]
}
```

- `history` 는 **과거 → 최신 순** 정렬, 최근 6개월 영업일치(현재 120건)
- 그래프 y축은 `krwPerDon` 을 쓰는 게 자연스럽습니다(사람들이 "돈" 단위로 생각하므로)
- ⚠️ **`latest` 를 "오늘 금값" 자리에 절대 쓰지 마세요.** 하루 1회 갱신에 전 영업일 기준이라, 오늘이 8/15인데 최신이 8/13일 수 있습니다. 주말·연휴면 더 벌어집니다.
- 표기할 때는 반드시 `latest.date` 를 같이 적으세요 → "8월 13일 종가 기준"

---

## 4. `fx` — 원/달러 환율

```json
"fx": { "usdkrw": 1412, "change": -6.13, "changePct": -0.43, "dir": "down", "source": "Yahoo Finance" }
```

---

## 5. `intl` — 국제 시세 (참고 칸)

```json
"intl": {
  "gold":   { "name": "금", "usdPerOz": 4437.3, "changePct": 0.38, "dir": "up",
              "krwPerGram": 201439, "krwPerDon": 755398, "source": "Yahoo Finance (COMEX 선물)" },
  "silver": { "name": "은", "usdPerOz": 65.11, ... }
}
```

- `usdPerOz` 가 원본, `krwPerGram`/`krwPerDon` 은 환율로 환산한 **참고값**입니다
- 소매가와 다른 게 정상입니다(세공비·마진·부가세 차이). 화면에 "국제 시세 환산 참고값"이라고 밝혀야 문의가 안 옵니다

---

## 6. 색상 규칙 (한국 관례)

**`dir` 을 그대로 색에 매핑하세요. 초록은 쓰지 마세요.**

| `dir` | 색 | 기호 |
|---|---|---|
| `"up"` | 빨강 | ▲ |
| `"down"` | 파랑 | ▼ |
| `"none"` | 회색 | — |

---

## 7. 붙여 쓸 수 있는 코드

```jsx
'use client';
import { useEffect, useState } from 'react';

const PRICE_URL = 'https://quiz.jjyu.co.kr/price.json';

export function usePrice() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(PRICE_URL, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => alive && setData(j))
        .catch((e) => alive && setError(e));
    load();
    // 페이지를 열어둔 채로도 갱신되게 10분마다 다시 읽는다.
    const t = setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return { data, error };
}

/** 등락 표시 — 상승 빨강▲ / 하락 파랑▼ (한국 관례) */
export function Delta({ change, dir }) {
  if (dir === 'none' || !change) return <span style={{ color: '#888' }}>—</span>;
  const up = dir === 'up';
  return (
    <span style={{ color: up ? '#e11d48' : '#2563eb' }}>
      {up ? '▲' : '▼'} {Math.abs(change).toLocaleString()}
    </span>
  );
}
```

---

## 8. 페이지 3개에 무엇을 쓰나

| 페이지 | 주로 쓰는 데이터 |
|---|---|
| **금시세 메인** | `retail.items` 전체 표 + `krx.history` 그래프 + `intl.gold` 참고 칸 |
| **금 계산기** | `retail.items` 의 `userSell.price` / `userBuy.price` |
| **금 살 때·팔 때** | `retail.items[0]` (순금) 두 값의 차이를 설명 + `krx.latest` 도매가와 비교 |

세 번째 페이지가 특히 승산이 있습니다. **"살 때와 팔 때 가격이 왜 6만원이나 차이 나는가"** 는 검색량이 있는데 제대로 답하는 페이지가 드뭅니다. 지금 데이터로 실제 숫자를 넣어 설명할 수 있습니다 — 도매(KRX) 752,138원, 살 때 795,000원, 팔 때 731,000원. 이 세 숫자를 한 화면에 놓는 것만으로 설명이 됩니다.
