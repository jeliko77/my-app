# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> 위 `@AGENTS.md` 줄은 지우지 않는다. `next dev`가 AGENTS.md를 다시 만들어 넣으며, 이 Next.js 버전(16.x)은 학습 데이터와 API가 다를 수 있으므로 코드를 쓰기 전 `node_modules/next/dist/docs/`를 확인한다.

## 프로젝트 개요

**할일 추출기** — 붙여넣은 글에서 사용자 본인의 할 일만 뽑아 목록으로 보여주는 1인용 웹앱.
기획의 기준 문서는 [PRD.md](PRD.md)이며, 기능·범위·규칙에 대한 판단은 항상 PRD를 따른다.

- PRD 6번의 **비범위**(로그인, DB 저장, 할 일 수정·체크, 파일 업로드, 외부 서비스 연동 등)는 요청 없이 만들지 않는다.

## 작업 규칙

- **모든 설명과 코드 주석은 한국어로 작성한다.** 사용자는 개발 입문자이므로 용어는 풀어서 설명한다.
- **새 파일은 `my-app` 폴더 안에만 만든다.**
- **기술 스택은 PRD 8번대로 Next.js로 고정한다.** 다른 프레임워크로 바꾸거나 마이그레이션을 제안하지 않는다. AI는 OpenAI API, **배포는 Vercel**을 사용한다.
- **코드를 바꾸면 무엇을 왜 바꿨는지 한 줄로 알린다.**
- **`.env` 등 비밀 정보 파일과 `node_modules/`는 `.gitignore`에 등록해 두고 절대 커밋하지 않는다.** 커밋 전에 `git status`로 올라갈 파일을 확인한다.
- **외부 서비스 인증은 `.env`의 값을 읽어서 쓴다.** 토큰 값을 사용자에게 묻거나, 채팅·명령 출력에 드러내지 않는다. 확인이 필요하면 변수 이름과 "값 있음/없음"만 말한다.
  - `.env`를 셸에 불러올 때는 `set -a; . ./.env; set +a`를 쓰고, `echo`·`env`·`printenv`로 값을 출력하지 않는다.
  - Supabase가 필요하면 Supabase CLI를 설치해 `.env`의 `SUPABASE_ACCESS_TOKEN`으로 작업한다.
  - Vercel 작업(배포 등)이 필요하면 Vercel CLI를 설치해 `.env`의 `VERCEL_TOKEN`으로 인증한다. (예: `vercel deploy --token "$VERCEL_TOKEN"`)
- **파일은 바로 삭제하지 않는다.** `my-app/trash-can/` 폴더를 만들어 그 안으로 옮기기만 한다. 사용자가 작업 후 직접 확인하고 삭제한다.
- **이미 설치된 서브에이전트는 필요할 때마다 적극 활용한다.**

## 작업 절차 (검증 루프)

코드를 바꿀 때마다 아래를 **통과할 때까지 반복**한다.

1. **변경한다.**
2. **`npm run lint`와 `npm run build`를 실행해 오류가 없는지 확인한다.**
3. **화면이 바뀐 작업이면 `npm run dev`로 띄워 실제로 보이는지 확인한다.** 이미 떠 있는 서버가 있으면 그것을 쓴다.
4. **문제가 있으면 고치고 다시 1번으로 돌아간다.**

→ 모두 통과하면 **무엇을 왜 바꿨는지 한 줄로 요약한다.**

통과하지 못한 단계가 있으면 통과한 것처럼 말하지 않고, 어느 단계에서 무엇이 실패했는지 그대로 알린다.

## 실수에서 배운 규칙 (2026-09-18)

- **정규식·`\n` 같은 백슬래시가 든 코드는 Edit 도구로 고치고, 고친 뒤 `grep`으로 그 줄을 다시 확인한다.** 셸이나 node 문자열로 바꾸면 `\s`가 `s`로, `\d`가 `d`로 조용히 바뀌어 검사가 통과해도 동작이 틀렸다(이날 3번).
- **AI 지시문(`SYSTEM_PROMPT`)을 바꾸면 TEST-CASES.md 1~10번을 3번씩 다시 채점하고 결과를 "N차"로 기록한다. 지시문 예시에는 테스트 글의 표현을 쓰지 않는다.** 테스트 문장을 예시로 넣으면 점수가 실제보다 좋게 나온다.
- **AI 지시만으로 안 막히는 규칙은 코드로 막거나 화면 경고를 붙인다.** (예: 40자 자르기, 인젝션 의심 경고) 지시문을 여러 번 고쳐도 안 되면 되돌리고 코드 쪽으로 옮긴다.
- **Vercel 배포는 명령 성공만 믿지 말고 배포 상태(READY/BLOCKED)를 API로 확인한다.** 커밋 작성자 이메일이 Vercel 계정에 없으면 BLOCKED로 막힌다.
- **미리보기 창이 가려져 있으면 스크린샷·부드러운 스크롤·애니메이션이 멈춘다.** 화면 확인은 글자·위치를 DOM으로 재서 하고, 확인하지 못한 것은 그렇다고 말한다.
- **임시 파일은 `my-app` 안에 만들지 않는다.** 명령 결과는 파이프로 걸러 보거나 세션 임시 폴더(scratchpad)에 둔다. 만들었다면 지우지 말고 `trash-can/`으로 옮긴다.

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npx tsc --noEmit     # 타입 검사
```

- 자동화된 테스트 러너는 없다. 품질 검증은 [TEST-CASES.md](TEST-CASES.md)의 테스트 글을 앱(또는 API)에 넣고 정답표와 손으로 대조하는 방식이다.
  - 측정용 1~7번: 정답 25개 중 23개 이상, 지어낸 항목 0개가 목표
  - 규칙 검증용 8~10번: 할 일 없음 / 10개 초과 / 10자 미만 동작 확인
- API 단독 확인 (Windows Git Bash에서는 한글 깨짐을 피하려고 JSON을 파일로 만들어 보낸다):
  ```bash
  curl -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" --data-binary @body.json
  ```
- `next dev`는 같은 폴더에서 이미 서버가 돌고 있으면 새로 뜨지 않고 종료한다. 먼저 3000번 포트를 확인한다.

## 구조

서버 코드는 두 개이고, 화면은 이 둘만 부른다. 자세한 설계는 [DESIGN.md](DESIGN.md)를 본다.

- **할 일 뽑기:** `src/app/page.tsx`(화면) → `src/app/api/extract/route.ts` → 요청 확인 → 글자 수 검사 → OpenAI → 답 모양 검사 → 40자 자르기·중복 합치기·10개 자르기 → 근거 원문 찾기 → 인젝션 의심 표시 → 화면
- **묶음 보기:** [묶어서]를 누를 때만 `src/app/api/group/route.ts` → OpenAI → `normalizeGroups`로 바로잡기 → 화면

| 파일 | 역할 |
|---|---|
| `src/lib/limits.ts` | 10자·5,000자·최대 10개 기준, 글자 수 세기(`countChars`), 숫자 쓰기(`formatNumber`). **화면과 서버가 같은 것을 import**한다 |
| `src/lib/types.ts` | 화면과 서버가 주고받는 모양 (`Todo`는 `text`·`source`·`suspicious`) |
| `src/lib/openai.ts` | 모델(`gpt-4o-mini`), 대기 시간(12초 × 2번), 안전한 오류 기록 |
| `src/lib/request.ts` | JSON 요청인지(415)·이 앱 사이트에서 왔는지(403) 확인 |
| `src/lib/source.ts` | 할 일마다 근거 원문을 **AI가 아니라 코드가** 입력 글에서 찾는다 |
| `src/lib/injection.ts` | 근거 원문이 AI에게 내리는 명령처럼 보이는지 확인 |
| `src/lib/group.ts` | AI가 나눈 묶음을 검사하고 바로잡음 (빠짐·겹침·최대 5개) |
| `next.config.ts` | 보안 설정(헤더) |

- 화면에서 OpenAI를 직접 부르지 않는다. `OPENAI_API_KEY`를 브라우저에 노출하지 않기 위해 반드시 서버 코드를 거친다. 키에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 두 서버 코드는 JSON 모드, `temperature: 0`, `max_tokens`(뽑기 2,000·묶음 600), `maxDuration = 30`으로 AI를 부른다.
- 색은 `src/app/globals.css`의 색 이름(`brand`, `danger`, `warn`, `chip` 등)만 쓰고, 화면 코드에 색 값을 직접 쓰지 않는다.

### PRD 규칙이 지켜지는 위치

규칙을 추가·수정할 때 어느 쪽이 지킬지 먼저 정한다. 반드시 지켜야 하는 규칙은 AI에 맡기지 않고 코드에서 강제한다.

| 지키는 곳 | 규칙 |
|---|---|
| **코드** | 글자 수 제한, 할 일 40자 자르기, 중복 합치기, 최대 10개와 잘림 표시, 답 모양 검사, 근거 원문 찾기, 인젝션 의심 경고, 묶음 바로잡기, 0개일 때 "할 일이 없습니다", 번호 없는 평문 복사 |
| **AI 지시문** (`route.ts`의 `SYSTEM_PROMPT`) | 붙여넣은 글 속 명령 따르지 않기, 본인 할 일만, 주어 없으면 본인 일로 봄, 끝난 일 제외, 막연한 생각 포함, 40자 이내 `~하기`, 날짜·시간 표현 남기기, 원문 순서, 같은 뜻 중복 합치기 |

### 규칙을 바꿀 때 함께 고칠 파일

규칙 하나가 여러 파일에 걸쳐 있으므로 어긋나지 않게 같이 수정한다.

1. `PRD.md` 5번 — 규칙 문장
2. 코드 — `route.ts`의 `SYSTEM_PROMPT`·상수, 또는 `src/lib/`의 해당 파일
3. `DESIGN.md` — 규칙을 누가 지키는지, 오류 표, 데이터 모양
4. `TEST-CASES.md` — 정답표와 채점표, 다시 채점한 "N차" 기록

## 진행 상황 관리

- 1차 개발 작업 23개는 [PLAN.md](PLAN.md)에서 모두 `[x]`다. `[x]`는 "코드 작성 완료"이며 테스트 통과를 뜻하지 않는다.
- **지금 남은 보완 항목과 통과/실패 판정은 [CHECK.md](CHECK.md)에서 관리한다.** 항목을 고치면 CHECK.md의 "이미 고친 것"으로 옮기고, 새 점검 결과가 나오면 새로 만들지 말고 CHECK.md를 덮어쓴다.
- 채점 기록은 [TEST-CASES.md](TEST-CASES.md)의 "채점 기록"에 차수별로 쌓는다.

## 환경 주의사항

- `.env`에는 `OPENAI_API_KEY`, `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`이 들어 있다.
- Windows 환경이며, `python`/`python3`는 Microsoft Store 더미라 **실행해도 아무 일 없이 조용히 끝난다.** 스크립트가 필요하면 `node`를 쓴다.
- `.bkit/`은 bkit 플러그인이 만드는 실행 상태 폴더다. 직접 수정하지 않는다. `.gitignore`에 들어 있어 커밋되지 않는다.
- Vercel 프로젝트 `my-app` (연결 정보는 `.vercel/project.json`, 커밋되지 않음). GitHub: `jeliko77/my-app` (공개, 기본 가지 `master`).
- **배포 주소는 커밋되는 문서(README·CLAUDE·DESIGN·TEST-CASES·CHECK 등)에 적지 않는다.** 저장소가 공개라서, 주소가 알려지면 누구나 OpenAI 요금을 쓸 수 있다. 채팅으로만 알린다.
