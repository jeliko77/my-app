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

/** 원래 문장 바로 다음 줄이 이 글자 수 이하이고 날짜·시간이 들어 있으면("알겠어 오늘 저녁에 볼게") 함께 붙인다 */
const FOLLOW_LENGTH = 20;

/** 날짜·시간·마감을 나타내는 표현 */
const TIME_WORDS =
  /\d|오늘|내일|모레|글피|어제|오전|오후|아침|점심|저녁|새벽|주말|까지|부터|전에|이내|마감|다음 ?주|이번 ?주|다음 ?달|이번 ?달|[월화수목금토일]요일/;

/** 줄바꿈으로 이어지는 두 문장을 합친 후보가 이만큼 더 잘 맞을 때만 합친 쪽을 고른다 */
const JOIN_BONUS = 0.1;

/**
 * 원래 문장으로 보여줄 최대 글자 수. 마침표 없이 길게 이어진 한 줄(메신저 대화 등)은
 * 문장으로 나뉘지 않아 문단 전체가 붙기 때문에, 할 일과 가장 잘 맞는 부분만 이만큼 잘라 보여준다
 */
const MAX_SOURCE_LENGTH = 120;

/** 긴 원문에서 잘라 볼 후보 구간을 몇 글자씩 옮겨 가며 볼지 */
const WINDOW_STEP = 10;

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
      // 같은 줄의 짧은 조각은 날짜·시간일 때만 붙인다. "은행 주소 변경하기."처럼 그 자체로 할 일인 문장을 앞 문장에 붙이지 않기 위해서다
      // 줄바꿈으로 끊긴 문장의 뒷부분("모아야 한다.")은 날짜가 없어도 붙인다
      if (prev && part.length <= FRAGMENT_LENGTH && ((sameLine && TIME_WORDS.test(part)) || wrappedLine)) {
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

type Match = { text: string; score: number; first: number; last: number };

/** 할 일 문장 하나에 가장 잘 맞는 문장(또는 줄바꿈으로 이어진 두 줄)을 찾는다 */
function bestMatch(todoText: string, units: Unit[]): Match {
  // 끝의 "하기"·"기"("가보기")는 거의 모든 할 일에 붙어 있어 짝 찾기에 도움이 안 되므로 뺀다
  const todo = bigrams(todoText.replace(/하?기$/, ""));

  let best: Match = { text: "", score: 0, first: -1, last: -1 };
  units.forEach((unit, i) => {
    const single = coverage(todo, unit.text);
    if (single > best.score) best = { text: unit.text, score: single, first: i, last: i };

    // 줄이 바뀌며 문장이 이어지는 경우("…한 페이지에" / "모아야 한다.")는 두 줄을 합친 후보도 본다
    // 두 줄 중 한 줄만으로 충분하면 합치지 않는다
    const next = units[i + 1];
    if (next && next.line === unit.line + 1 && !endsSentence(unit.text)) {
      const joined = `${unit.text} ${next.text}`;
      const score = coverage(todo, joined);
      const bestAlone = Math.max(single, coverage(todo, next.text));
      if (score > bestAlone + JOIN_BONUS && score > best.score) best = { text: joined, score, first: i, last: i + 1 };
    }
  });
  return best;
}

/**
 * 원문이 MAX_SOURCE_LENGTH자보다 길면, 할 일과 가장 많이 겹치는 부분만 잘라 앞뒤에 "…"를 붙인다.
 * 글자 단위(Array.from)로 잘라 이모지가 깨지지 않게 한다.
 */
function trimLongSource(todoText: string, source: string): string {
  const letters = Array.from(source);
  if (letters.length <= MAX_SOURCE_LENGTH) return source;

  const todo = bigrams(todoText.replace(/하?기$/, ""));
  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start + MAX_SOURCE_LENGTH <= letters.length + WINDOW_STEP; start += WINDOW_STEP) {
    const from = Math.min(start, letters.length - MAX_SOURCE_LENGTH);
    const score = coverage(todo, letters.slice(from, from + MAX_SOURCE_LENGTH).join(""));
    if (score > bestScore) {
      bestScore = score;
      bestStart = from;
    }
  }
  const end = bestStart + MAX_SOURCE_LENGTH;
  const middle = letters.slice(bestStart, end).join("").trim();
  return `${bestStart > 0 ? "…" : ""}${middle}${end < letters.length ? "…" : ""}`;
}

/**
 * 할 일마다 근거 원문을 찾는다. 못 찾은 할 일은 빈 문자열.
 * 할 일 전체를 한꺼번에 보는 이유: 다른 할 일의 원문인 줄을 엉뚱한 할 일에 덧붙이지 않기 위해서다.
 */
export function findSources(todoTexts: string[], input: string): string[] {
  const units = splitUnits(input);
  const matches = todoTexts.map((todo) => bestMatch(todo, units));
  return pickSources(matches, units).map((source, i) => trimLongSource(todoTexts[i], source));
}

/** 찾은 짝마다 보여줄 원문 문장을 정한다 (짧은 대답 이어 붙이기 포함) */
function pickSources(matches: Match[], units: Unit[]): string[] {
  // 어떤 할 일의 원문으로 이미 쓰인 줄
  const taken = new Set<number>();
  for (const m of matches) {
    if (m.score < MIN_MATCH) continue;
    for (let i = m.first; i <= m.last; i++) taken.add(i);
  }

  return matches.map((m) => {
    if (m.score < MIN_MATCH) return "";

    // 부탁 바로 다음 줄의 짧은 대답에 시간이 있으면 함께 보여준다 ("…확인해달라고 하셨어요" + "알겠어 오늘 저녁에 볼게")
    const followIndex = m.last + 1;
    const follow = units[followIndex];
    if (
      follow &&
      !taken.has(followIndex) &&
      follow.line === units[m.last].line + 1 && // 빈 줄을 건너뛴 문장은 붙이지 않는다
      follow.text.length <= FOLLOW_LENGTH &&
      TIME_WORDS.test(follow.text)
    ) {
      return `${m.text} ${follow.text}`;
    }
    return m.text;
  });
}
