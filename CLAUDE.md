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

요청 흐름은 한 줄이다: **`src/app/page.tsx`(화면) → `src/app/api/extract/route.ts`(서버) → OpenAI → 서버 후처리 → 화면**

- 화면에서 OpenAI를 직접 부르지 않는다. `OPENAI_API_KEY`를 브라우저에 노출하지 않기 위해 반드시 `/api/extract`를 거친다. 키에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- `src/lib/limits.ts`의 글자 수 제한(10자 이상, 5,000자 이하)은 **화면과 서버가 같은 상수를 import**한다. 화면은 버튼을 잠그고, 서버는 우회 호출을 막는다. 제한을 바꿀 때는 이 파일만 고친다.
- `route.ts`는 `gpt-4o-mini`를 JSON 모드(`{"todos": [...]}`), `temperature: 0`으로 호출한다.

### PRD 규칙이 지켜지는 위치

PRD 5번 규칙은 두 곳으로 나뉘어 있다. 규칙을 추가·수정할 때 어느 쪽인지 먼저 정한다.

| 지키는 곳 | 규칙 |
|---|---|
| **코드** (`route.ts`, `page.tsx`, `limits.ts`) | 글자 수 제한, 중복 합치기, 최대 10개 자르기, 0개일 때 "할 일이 없습니다", 번호 없는 평문 복사 |
| **AI 지시문** (`route.ts`의 `SYSTEM_PROMPT`) | 본인 할 일만, 끝난 일 제외, 막연한 생각 포함, 40자 이내 `~하기`, 원문 순서 유지 |

반드시 지켜야 하는 수치 규칙은 AI에 맡기지 않고 코드에서 강제한다.

### 규칙을 바꿀 때 함께 고칠 파일

규칙 하나가 세 파일에 걸쳐 있으므로 어긋나지 않게 같이 수정한다.

1. `PRD.md` 5번 — 규칙 문장
2. `route.ts`의 `SYSTEM_PROMPT` 또는 상수 / `limits.ts`
3. `TEST-CASES.md` — 정답표와 채점표 합계

## 진행 상황 관리

- 작업 단위와 완료 여부는 [PRD.md](PRD.md) **9. 개발 단위**의 체크박스로 관리한다. 단위를 끝내면 `[ ]`를 `[x]`로 바꾼다. `[x]`는 "코드 작성 완료"이며 테스트 통과를 뜻하지 않는다.
- 10개 초과 안내(개발 단위 11번)를 만들 때는 `SYSTEM_PROMPT`의 "최대 10개" 지시를 빼야 한다. 지금은 AI가 처음부터 10개만 돌려주므로 코드가 잘렸는지 알 수 없다.

## 환경 주의사항

- `.env`에는 `OPENAI_API_KEY`, `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`이 들어 있다.
- Windows 환경이며, `python`/`python3`는 Microsoft Store 더미라 **실행해도 아무 일 없이 조용히 끝난다.** 스크립트가 필요하면 `node`를 쓴다.
- `.bkit/`은 bkit 플러그인이 만드는 실행 상태 폴더다. 직접 수정하지 않는다.
