"use client";

import { useEffect, useRef, useState } from "react";
import { countChars, formatNumber, MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/limits";
import type { ExtractResponse, GroupResponse, Todo, TodoGroup } from "@/lib/types";

/** 할 일이 이보다 적으면 묶어 볼 의미가 없어 [묶어서] 버튼을 보여주지 않는다 */
const MIN_TODOS_TO_GROUP = 3;

type View = "order" | "group";

/**
 * 서버 응답을 읽는다. 우리 서버가 보낸 JSON이 아니면(시간 초과 안내 페이지 등)
 * "연결하지 못했다"로 오해하지 않도록, 서버가 답은 했다는 안내 문구로 바꾼다.
 */
async function readResponse<T>(response: Response): Promise<T | { error: string }> {
  try {
    return (await response.json()) as T;
  } catch {
    return {
      error:
        response.status === 504
          ? "서버가 제때 응답하지 않았습니다. 잠시 후 다시 시도해 주세요."
          : `서버에서 문제가 생겼습니다(오류 코드 ${response.status}). 잠시 후 다시 시도해 주세요.`,
    };
  }
}

export default function Home() {
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null); // 방금 개별 복사한 할 일 번호
  const [copyFailed, setCopyFailed] = useState(false);

  // 묶음 보기
  const [view, setView] = useState<View>("order");
  const [groups, setGroups] = useState<TodoGroup[] | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [groupError, setGroupError] = useState("");
  const extractionId = useRef(0); // 새로 뽑으면 늘어난다. 늦게 도착한 옛 묶음 결과를 버리는 데 쓴다
  const copyFailTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // 복사 실패 안내를 지우는 타이머

  // 결과(또는 오류)가 나오면 그 위치로 화면을 옮긴다.
  // 결과 카드는 입력칸 아래 화면 밖에 생겨서, 특히 휴대폰에서는 결과가 나왔는지 알기 어렵기 때문이다
  const resultRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const scrollAfterExtract = useRef(false); // [할 일 뽑기]로 새 결과를 받았을 때만 옮긴다 (묶음 보기 전환 등에는 옮기지 않음)

  useEffect(() => {
    if (loading || !scrollAfterExtract.current) return;
    const target = errorRef.current ?? resultRef.current;
    if (!target) return;
    scrollAfterExtract.current = false;
    // 움직임을 줄이도록 설정한 사람에게는 부드러운 이동 대신 바로 이동한다
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [loading, todos, error]);

  const length = countChars(text);
  const tooShort = length < MIN_INPUT_LENGTH;
  const tooLong = length > MAX_INPUT_LENGTH;

  async function handleExtract() {
    extractionId.current += 1;
    scrollAfterExtract.current = true;
    setLoading(true);
    setError("");
    setTodos(null);
    setTruncated(false);
    setCopied(false);
    setCopiedIndex(null);
    setCopyFailed(false); // 앞 결과의 복사 실패 안내가 새 결과 위에 남지 않게 한다
    setView("order");
    setGroups(null);
    setGrouping(false);
    setGroupError("");

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await readResponse<ExtractResponse>(response);

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "알 수 없는 오류가 발생했습니다.");
        return;
      }
      setTodos(data.todos);
      setTruncated(data.truncated);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // Design Ref: DESIGN.md §1 묶음 보기 — [묶어서]를 처음 누를 때만 AI에게 묶음을 부탁하고, 결과는 다시 쓴다
  async function handleShowGroups() {
    setView("group");
    if (!todos || groups || grouping) return;

    const requestId = extractionId.current;
    setGrouping(true);
    setGroupError("");
    try {
      const response = await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos: todos.map((todo) => todo.text) }),
      });
      const data = await readResponse<GroupResponse>(response);
      if (requestId !== extractionId.current) return; // 그 사이 새로 뽑았으면 버린다

      if (!response.ok || "error" in data) {
        setGroupError("error" in data ? data.error : "묶음을 만들지 못했습니다.");
        setView("order");
        return;
      }
      setGroups(data.groups);
    } catch {
      if (requestId !== extractionId.current) return;
      setGroupError("서버에 연결하지 못했습니다.");
      setView("order");
    } finally {
      if (requestId === extractionId.current) setGrouping(false);
    }
  }

  /** 클립보드에 넣는다. 브라우저가 막으면 false (권한 거부, 창이 선택되지 않음 등) */
  async function writeClipboard(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFailed(false);
      return true;
    } catch {
      setCopyFailed(true);
      // 앞선 타이머를 지우고 새로 3초를 센다. 연달아 실패해도 두 번째 안내가 일찍 사라지지 않는다
      if (copyFailTimer.current) clearTimeout(copyFailTimer.current);
      copyFailTimer.current = setTimeout(() => setCopyFailed(false), 3000);
      return false;
    }
  }

  async function handleCopy() {
    if (!todos?.length) return;
    // 규칙: 번호나 기호 없이 줄바꿈으로만 구분된 평문을 복사한다. 근거 원문은 복사하지 않는다
    if (!(await writeClipboard(todos.map((todo) => todo.text).join("\n")))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Design Ref: DESIGN.md §1 ⑥ — 항목별 복사. 할 일 문장 하나만 복사하고 근거 원문은 복사하지 않는다
  async function handleCopyOne(index: number) {
    if (!todos?.[index]) return;
    if (!(await writeClipboard(todos[index].text))) return;
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
  }

  /** 할 일 한 줄. 순서대로 보기와 묶음 보기에서 함께 쓴다. 번호는 항상 원래 순서 번호다 */
  function renderTodo(todo: Todo, i: number) {
    return (
      <li key={i} className="flex items-start gap-3 border-t border-line py-4 first:border-t-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-hover text-[13px] font-semibold text-brand">
          {i + 1}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[16px] leading-relaxed text-ink-soft">{todo.text}</p>
          {/* Design Ref: DESIGN.md §1 ⑥ — 근거 원문을 회색으로. AI가 빠뜨린 날짜·시간도 여기서 보인다 */}
          {todo.suspicious && (
            <p className="mt-1 text-[13px] leading-relaxed text-danger-ink">
              ⚠ AI에게 내리는 명령처럼 보이는 문장에서 나왔습니다. 글쓴이가 정말 할 일인지 확인해 주세요.
            </p>
          )}
          {todo.source ? (
            <p className="mt-1 text-[13px] leading-relaxed break-words text-ink-muted">&ldquo;{todo.source}&rdquo;</p>
          ) : (
            // 원문에서 근거를 못 찾은 할 일은 AI가 지어냈거나, 붙여넣은 글 속 지시에 속았을 수 있다
            <p className="mt-1 text-[13px] leading-relaxed text-warn-ink">원문에서 찾지 못했습니다. 직접 확인해 주세요.</p>
          )}
        </div>
        <button
          onClick={() => handleCopyOne(i)}
          aria-label={`${i + 1}번 할 일 복사`}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
            copiedIndex === i ? "bg-chip/90 text-chip-ink" : "bg-card-hover text-ink-muted hover:text-ink"
          }`}
        >
          {copiedIndex === i ? "복사됨" : "복사"}
        </button>
      </li>
    );
  }

  /** 보기 방식 버튼 모양. 고른 쪽만 밝게 */
  const viewButtonClass = (value: View) =>
    `flex-1 rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
      view === value ? "bg-card-hover text-ink" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-5 pt-20 pb-16">
      {/* ① 머리말: 앱 이름 + 크고 굵은 가운데 제목 */}
      <header className="mb-6 text-center">
        <p className="text-[15px] font-semibold text-brand">할일 추출기</p>
        <h1 className="mt-3 text-[40px] leading-[1.3] font-bold tracking-tight text-ink">
          글 속 할 일만
          <br />
          쏙 골라드려요
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          회의 메모, 대화, 이메일을 그대로 붙여넣으세요.
          <br />
          이 앱은 글을 저장하지 않지만,
          <br />
          할 일을 뽑기 위해 OpenAI로 보내집니다.
        </p>
      </header>

      {/* ②③ 입력 카드 */}
      <section className="rounded-3xl bg-card p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="여기에 글을 붙여넣으세요"
          rows={9}
          className="w-full resize-y bg-transparent text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-muted"
        />
        <p className={`mt-3 text-right text-[13px] ${tooLong ? "text-danger-strong" : "text-ink-muted"}`}>
          {tooShort && text.length > 0 && `${MIN_INPUT_LENGTH}자 이상 입력해 주세요 · `}
          {tooLong && `글이 너무 깁니다. 나눠 넣어 주세요 · `}
          {formatNumber(length)} / {formatNumber(MAX_INPUT_LENGTH)}자
        </p>
      </section>

      {/* ③ 알약 모양 파란 버튼 */}
      <button
        onClick={handleExtract}
        disabled={tooShort || tooLong || loading}
        className="h-14 w-full rounded-full bg-brand text-[17px] font-semibold text-white transition-colors active:bg-brand-press disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "뽑는 중..." : "할 일 뽑기"}
      </button>

      {/* ④ 오류 상자 */}
      {error && (
        <p ref={errorRef} className="scroll-mt-6 rounded-2xl bg-danger/10 px-5 py-4 text-[15px] text-danger-ink">
          {error}
        </p>
      )}

      {/* ⑤~⑧ 결과 카드 */}
      {todos !== null && (
        <section ref={resultRef} className="mt-3 scroll-mt-6 rounded-3xl bg-card p-6">
          {todos.length === 0 ? (
            <p className="py-6 text-center text-[16px] text-ink-muted">할 일이 없습니다.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[22px] font-bold text-ink">
                  할 일 <span className="text-brand">{todos.length}</span>개
                </h2>
                <button
                  onClick={handleCopy}
                  className="rounded-full bg-chip/90 px-4 py-2 text-[14px] font-medium text-chip-ink transition-colors hover:bg-chip"
                >
                  {copied ? "복사됨" : "전체 복사"}
                </button>
              </div>

              {/* 보기 방식: 기본은 원래 순서 (PRD 5번). 묶음 보기는 눌렀을 때만 */}
              {todos.length >= MIN_TODOS_TO_GROUP && (
                <div className="mt-4 flex rounded-full bg-page p-1">
                  <button onClick={() => setView("order")} aria-pressed={view === "order"} className={viewButtonClass("order")}>
                    순서대로
                  </button>
                  <button onClick={() => handleShowGroups()} aria-pressed={view === "group"} className={viewButtonClass("group")}>
                    묶어서
                  </button>
                </div>
              )}

              {copyFailed && (
                <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger-ink">
                  복사하지 못했습니다. 할 일 문장을 직접 선택해 복사해 주세요.
                </p>
              )}

              {groupError && (
                <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger-ink">{groupError}</p>
              )}

              {view === "order" && <ol className="mt-4 flex flex-col">{todos.map(renderTodo)}</ol>}

              {view === "group" && grouping && (
                <p className="py-8 text-center text-[15px] text-ink-muted">비슷한 할 일끼리 묶는 중...</p>
              )}

              {view === "group" && groups && (
                <div className="mt-4 flex flex-col gap-3">
                  {groups.map((group) => (
                    <section key={group.name} className="rounded-2xl bg-page/60 px-4 pt-3 pb-1">
                      <h3 className="text-[16px] font-semibold text-ink">
                        {group.emoji && <span className="mr-1.5">{group.emoji}</span>}
                        {group.name}
                        <span className="ml-1.5 text-[14px] font-normal text-ink-muted">{group.indexes.length}개</span>
                      </h3>
                      <ol className="mt-1 flex flex-col">{group.indexes.map((i) => renderTodo(todos[i], i))}</ol>
                    </section>
                  ))}
                </div>
              )}

              {/* Design Ref: DESIGN.md §1 ⑦ — 잘린 사실을 알리지 않으면 "빠뜨림"이 다시 생긴다 (PRD 5번) */}
              {truncated && (
                <p className="mt-2 rounded-2xl bg-warn/10 px-4 py-3 text-[14px] text-warn-ink">
                  10개까지만 표시했습니다. 글을 나눠 넣어주세요.
                </p>
              )}
              <p className="mt-4 text-center text-[13px] text-ink-muted">
                원문과 대조해 빠진 것이 없는지 확인해 주세요.
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
