"use client";

import { useState } from "react";
import { MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/limits";
import type { ExtractResponse, Todo } from "@/lib/types";

export default function Home() {
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null); // 방금 개별 복사한 할 일 번호

  const length = text.trim().length;
  const tooShort = length < MIN_INPUT_LENGTH;
  const tooLong = length > MAX_INPUT_LENGTH;

  async function handleExtract() {
    setLoading(true);
    setError("");
    setTodos(null);
    setTruncated(false);
    setCopied(false);
    setCopiedIndex(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: ExtractResponse = await response.json();

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

  async function handleCopy() {
    if (!todos?.length) return;
    // 규칙: 번호나 기호 없이 줄바꿈으로만 구분된 평문을 복사한다. 근거 원문은 복사하지 않는다
    await navigator.clipboard.writeText(todos.map((todo) => todo.text).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Design Ref: DESIGN.md §1 ⑥ — 항목별 복사. 할 일 문장 하나만 복사하고 근거 원문은 복사하지 않는다
  async function handleCopyOne(index: number) {
    if (!todos?.[index]) return;
    await navigator.clipboard.writeText(todos[index].text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
  }

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
          입력한 글은 저장되지 않아요.
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
        <p className={`mt-3 text-right text-[13px] ${tooLong ? "text-red-400" : "text-ink-muted"}`}>
          {tooShort && text.length > 0 && `${MIN_INPUT_LENGTH}자 이상 입력해 주세요 · `}
          {tooLong && `글이 너무 깁니다. 나눠 넣어 주세요 · `}
          {length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}자
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
      {error && <p className="rounded-2xl bg-red-500/10 px-5 py-4 text-[15px] text-red-300">{error}</p>}

      {/* ⑤~⑧ 결과 카드 */}
      {todos !== null && (
        <section className="mt-3 rounded-3xl bg-card p-6">
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
                  className="rounded-full bg-white/90 px-4 py-2 text-[14px] font-medium text-[#212529] transition-colors hover:bg-white"
                >
                  {copied ? "복사됨" : "전체 복사"}
                </button>
              </div>

              <ol className="mt-4 flex flex-col">
                {todos.map((todo, i) => (
                  <li key={i} className="flex items-start gap-3 border-t border-line py-4 first:border-t-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-hover text-[13px] font-semibold text-brand">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[16px] leading-relaxed text-ink-soft">{todo.text}</p>
                      {/* Design Ref: DESIGN.md §1 ⑥ — 근거 원문을 회색으로. AI가 빠뜨린 날짜·시간도 여기서 보인다 */}
                      {todo.source && (
                        <p className="mt-1 text-[13px] leading-relaxed break-words text-ink-muted">
                          &ldquo;{todo.source}&rdquo;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopyOne(i)}
                      aria-label={`${i + 1}번 할 일 복사`}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        copiedIndex === i ? "bg-brand text-white" : "bg-card-hover text-ink-muted hover:text-ink"
                      }`}
                    >
                      {copiedIndex === i ? "복사됨" : "복사"}
                    </button>
                  </li>
                ))}
              </ol>

              {/* Design Ref: DESIGN.md §1 ⑦ — 잘린 사실을 알리지 않으면 "빠뜨림"이 다시 생긴다 (PRD 5번) */}
              {truncated && (
                <p className="mt-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-[14px] text-amber-300">
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
