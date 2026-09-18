import OpenAI from "openai";

/** 할 일 뽑기와 묶음 나누기에 함께 쓰는 AI 모델 */
export const MODEL = "gpt-4o-mini";

/** AI 답을 기다리는 최대 시간. 보통 1~4초면 오므로, 이보다 늦으면 멈추고 오류로 알린다 */
const TIMEOUT_MS = 12_000;

/** 일시적인 네트워크 오류일 때 다시 시도하는 횟수. 최악의 경우에도 약 24초 안에 끝난다 (PLAN 성공 기준 30초) */
const MAX_RETRIES = 1;

/** OpenAI에 요청을 보내는 도우미를 만든다. 서버에 OPENAI_API_KEY가 없으면 null */
export function createOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES }) : null;
}

/** 서버에 OPENAI_API_KEY가 없을 때 사용자에게 보여줄 문구. 어떤 설정이 빠졌는지는 드러내지 않는다 */
export const SERVER_CONFIG_ERROR = "서버 설정에 문제가 있어 지금은 쓸 수 없습니다. 잠시 후 다시 시도해 주세요.";

/**
 * OpenAI 오류를 서버 기록(로그)용 한 줄로 줄인다.
 * 오류 종류·상태 코드·요청 번호만 남기고, 오류 본문(키 일부가 들어갈 수 있음)은 남기지 않는다.
 */
export function describeOpenAIError(error: unknown): string {
  const e = (error ?? {}) as { name?: string; status?: number; requestID?: string | null };
  return `${e.name ?? "Error"} status=${e.status ?? "-"} request=${e.requestID ?? "-"}`;
}
