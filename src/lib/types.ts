/**
 * /api/extract 응답 모양 (DESIGN.md §2 "주고받는 데이터 모양").
 * 화면(page.tsx)과 서버(route.ts)가 같은 정의를 쓰도록 한 곳에 둔다.
 */

/** 할 일 한 개 */
export type Todo = {
  /** 할 일 문장. 화면 목록과 복사에 쓴다 */
  text: string;
  /** 근거가 된 원문 문장. 화면에만 보여주고 복사하지 않는다. 원문에서 찾지 못하면 빈 문자열 */
  source: string;
};

/** 성공 응답 */
export type ExtractSuccess = {
  /** 할 일 목록 (최대 10개) */
  todos: Todo[];
  /** 할 일이 10개를 넘어 잘렸으면 true */
  truncated: boolean;
};

/** 오류 응답. error는 사용자에게 그대로 보여줄 안내 문구다. */
export type ExtractError = {
  error: string;
};

export type ExtractResponse = ExtractSuccess | ExtractError;
