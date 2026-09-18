import { NextResponse } from "next/server";
import type { ExtractError } from "@/lib/types";

/**
 * 서버 코드에 들어온 요청이 "이 앱 화면에서 보낸 정상 요청"인지 먼저 확인한다.
 *
 * Design Ref: DESIGN.md §2 요청 확인 — 다른 사이트가 방문자의 브라우저를 시켜 몰래 요청을 보내는 것(CSRF와 비슷한 오용)을 막는다.
 * - JSON 요청만 받는다. 다른 사이트의 일반 양식(form)은 JSON 요청을 보낼 수 없다
 * - 브라우저가 알려 주는 "보낸 사이트"(Origin)가 있으면, 이 앱 주소와 같을 때만 받는다
 *   Origin이 없는 요청(브라우저가 아닌 프로그램)은 막지 않는다. 그런 요청은 요금 제한(Vercel·OpenAI 설정)으로 막는다
 *
 * @returns 막아야 하면 오류 응답, 통과면 null
 */
export function rejectForeignRequest(request: Request): NextResponse<ExtractError> | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "요청 형식이 잘못되었습니다." }, { status: 415 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    // Vercel은 원래 주소를 x-forwarded-host에 담아 준다
    const appHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    if (!originHost || originHost !== appHost) {
      return NextResponse.json({ error: "다른 사이트에서 보낸 요청은 받지 않습니다." }, { status: 403 });
    }
  }

  return null;
}
