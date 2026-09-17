/**
 * 할 일 문장의 근거가 된 원문 문장을 입력한 글에서 찾는다.
 *
 * Design Ref: DESIGN.md §2 ❻ — 근거 원문은 AI에게 받지 않고 앱이 직접 찾는다.
 * AI에게 원문까지 달라고 하면 할 일을 고르는 성적이 떨어졌기 때문이다 (TEST-CASES.md 3차 채점).
 * 이렇게 찾은 원문은 항상 입력한 글 안의 문장이다.
 */

/** 이 비율보다 덜 겹치면 짝을 찾지 못한 것으로 보고 원문을 비워 둔다 */
const MIN_MATCH = 0.3;

/** 이 글자 수 이하의 짧은 조각("오후 6시 전에.")은 바로 앞 문장에 붙인다. 날짜·시간이 떨어져 나가지 않게 한다 */
const FRAGMENT_LENGTH = 12;

/** 줄바꿈으로 이어지는 두 문장을 합친 후보가 이만큼 더 잘 맞을 때만 합친 쪽을 고른다 */
const JOIN_BONUS = 0.1;

type Unit = { text: string; line: number };

/** 문장 끝 표시(. ! ?)로 끝나는지 */
function endsSentence(value: string): boolean {
  return /[.!?。…]$/.test(value.trim());
}

/** 글을 문장 단위로 나눈다. 짧은 조각은 앞 문장에 붙인다 */
function splitUnits(input: string): Unit[] {
  const units: Unit[] = [];
  input.split(/\n/).forEach((rawLine, line) => {
    const parts = rawLine
      .split(/(?<=[.!?。])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      const prev = units[units.length - 1];
      const sameLine = prev && prev.line === line;
      const wrappedLine = prev && prev.line === line - 1 && !endsSentence(prev.text);
      if (prev && part.length <= FRAGMENT_LENGTH && (sameLine || wrappedLine)) {
        prev.text = `${prev.text} ${part}`;
        prev.line = line;
      } else {
        units.push({ text: part, line });
      }
    }
  });
  return units;
}

/** 공백·문장부호를 빼고 두 글자씩 끊은 묶음. 조사·어미가 달라도 겹치는 정도를 잴 수 있다 */
function bigrams(value: string): Set<string> {
  const letters = value.replace(/[\s\p{P}\p{S}]/gu, "");
  const result = new Set<string>();
  for (let i = 0; i < letters.length - 1; i++) result.add(letters.slice(i, i + 2));
  return result;
}

/** 할 일 문장의 글자 묶음 중 후보 문장에도 있는 비율 (0~1) */
function coverage(todo: Set<string>, candidate: string): number {
  if (todo.size === 0) return 0;
  const found = bigrams(candidate);
  let hit = 0;
  for (const pair of todo) if (found.has(pair)) hit++;
  return hit / todo.size;
}

/** 할 일 문장 하나에 대해 가장 잘 맞는 원문 문장을 돌려준다. 못 찾으면 빈 문자열 */
export function findSource(todoText: string, input: string): string {
  // 끝의 "하기"·"기"("가보기")는 거의 모든 할 일에 붙어 있어 짝 찾기에 도움이 안 되므로 뺀다
  const todo = bigrams(todoText.replace(/하?기$/, ""));
  const units = splitUnits(input);

  let best = { text: "", score: 0 };
  units.forEach((unit, i) => {
    const single = coverage(todo, unit.text);
    if (single > best.score) best = { text: unit.text, score: single };

    // 줄이 바뀌며 문장이 이어지는 경우("…한 페이지에" / "모아야 한다.")는 두 줄을 합친 후보도 본다
    // 두 줄 중 한 줄만으로 충분하면 합치지 않는다
    const next = units[i + 1];
    if (next && next.line === unit.line + 1 && !endsSentence(unit.text)) {
      const joined = `${unit.text} ${next.text}`;
      const score = coverage(todo, joined);
      const bestAlone = Math.max(single, coverage(todo, next.text));
      if (score > bestAlone + JOIN_BONUS && score > best.score) best = { text: joined, score };
    }
  });

  return best.score >= MIN_MATCH ? best.text : "";
}
