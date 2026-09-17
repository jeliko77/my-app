import { NextResponse } from "next/server";
import OpenAI from "openai";
import { MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/limits";
import { findSource } from "@/lib/source";
import type { ExtractError, ExtractSuccess } from "@/lib/types";

/**
 * PRD 5번 must 1의 규칙을 숫자로 옮긴 값들.
 * 규칙을 바꾸려면 PRD.md와 이 상수를 함께 고친다.
 */
const MAX_TODOS = 10; // 한 번에 뽑는 최대 개수
const MAX_ITEM_LENGTH = 40; // 항목 한 개의 최대 글자 수

const MODEL = "gpt-4o-mini";

// Design Ref: DESIGN.md §2 ❹ — 할 일 판단 규칙은 AI 지시문이 지킨다 (숫자 규칙은 코드가 지킨다)
const SYSTEM_PROMPT = `너는 사용자가 붙여넣은 글에서 "할 일"만 뽑아내는 도구다.

[뽑는 것]
- 글쓴이 본인이 앞으로 해야 할 일
- 주어가 없어 누가 할 일인지 알 수 없는 할 일도 글쓴이 본인이 할 일로 보고 뽑는다 (예: "보고서 금요일까지 제출할 것")
- 마감이나 구체성이 없는 막연한 생각·다짐도 포함한다 (예: "운동하기", "빵집 가보기")

[뽑지 않는 것]
- 다른 사람이 하기로 한 일
- 글쓴이가 이미 끝낸 일 (과거형으로 적힌 것)
- 단순한 감상, 상태 서술, 인사말
- 원문에 없는 내용. 추측하거나 보충해서 만들어내지 말 것

[형식]
- 각 항목은 ${MAX_ITEM_LENGTH}자 이내의 한 문장으로, "~하기" 형태로 끝낸다
- 원문에 있는 날짜·시간·마감 표현(예: "다음 주 화요일까지", "퇴근 전에", "모레부터")은 빼지 말고 할 일 문장에 그대로 남긴다
- 무엇을 하는지 알 수 있는 핵심 동작(예: "은행 가서 통장 만들기")은 줄이더라도 빼지 않는다
- 원문에 등장한 순서를 그대로 유지한다. 중요도로 재정렬하지 않는다
- 같은 내용이 두 번 나오면 하나로 합친다
- 개수를 줄이지 말고, 해당하는 할 일을 빠짐없이 모두 뽑는다
- 설명, 요약, 인사말을 덧붙이지 않는다

[출력]
{"todos": ["...", "..."]} 형태의 JSON만 출력한다.
할 일이 하나도 없으면 {"todos": []}를 출력한다.`;

/**
 * AI 답이 약속한 모양({"todos": [문자열, ...]})인지 검사한다.
 * 모양이 틀리면 null을 돌려준다. 빈 목록으로 바꾸면 "할 일이 없습니다"로 잘못 보이기 때문이다.
 */
// Design Ref: DESIGN.md §2 ❺ — 답 모양 검사, 틀리면 502
function parseTodos(raw: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("todos" in parsed)) return null;
  const { todos } = parsed as { todos: unknown };
  if (!Array.isArray(todos) || !todos.every((t) => typeof t === "string")) return null;
  return todos;
}

/** 같은 내용을 한 번만 남긴다. 앞뒤 공백과 대소문자 차이는 무시한다. */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

export async function POST(request: Request): Promise<NextResponse<ExtractSuccess | ExtractError>> {
  let text: string;
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }

  // 규칙: 10자 미만이면 AI를 호출하지 않는다 (요금이 새지 않도록 서버에서도 막는다)
  if (text.trim().length < MIN_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `글이 너무 짧습니다. ${MIN_INPUT_LENGTH}자 이상 입력해 주세요.` },
      { status: 400 },
    );
  }

  // 규칙: 5,000자를 넘으면 AI를 호출하지 않는다 (요금과 응답 시간이 커지는 것을 막는다)
  if (text.trim().length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `글이 너무 깁니다. ${MAX_INPUT_LENGTH.toLocaleString()}자 이하로 나눠 넣어 주세요.` },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요." },
      { status: 500 },
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let raw: string;
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    console.error("[extract] OpenAI 호출 실패:", error);
    return NextResponse.json({ error: "AI 호출에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  const parsed = parseTodos(raw);
  if (parsed === null) {
    console.error("[extract] AI 응답 모양이 틀림:", raw);
    return NextResponse.json({ error: "AI 응답을 읽지 못했습니다. 다시 시도해 주세요." }, { status: 502 });
  }

  // Design Ref: DESIGN.md §2 ❻❼ — 중복 제거와 10개 제한은 AI에 맡기지 않고 코드에서 지킨다.
  // AI에게서 전부 받은 뒤 자르므로, 더 있었는지(truncated)를 알 수 있다.
  const unique = dedupe(parsed);
  const truncated = unique.length > MAX_TODOS;

  // Design Ref: DESIGN.md §2 ❻ — 근거 원문은 AI가 아니라 앱이 입력한 글에서 찾아 붙인다
  const todos = unique.slice(0, MAX_TODOS).map((todo) => ({ text: todo, source: findSource(todo, text) }));

  return NextResponse.json({ todos, truncated });
}
