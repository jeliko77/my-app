/**
 * 입력 글자 수 제한 (PRD 5번 must 1).
 * 화면과 서버가 같은 값을 쓰도록 한 곳에 둔다.
 */
export const MIN_INPUT_LENGTH = 10; // 이보다 짧으면 AI를 호출하지 않는다
export const MAX_INPUT_LENGTH = 5000; // 이보다 길면 AI를 호출하지 않는다
export const MAX_TODOS = 10; // 한 번에 보여주는 할 일 최대 개수. 묶음 보기 요청도 이 개수까지만 받는다

/**
 * 사람이 보는 글자 수를 센다. 화면과 서버가 같은 방식으로 센다.
 * - 맥에서 복사한 한글(자모가 풀린 형태)을 합친 형태(NFC)로 바꾼 뒤 센다 → "한" 한 글자가 3자로 세지지 않는다
 * - 이모지처럼 컴퓨터 안에서 여러 칸을 쓰는 글자(👨‍👩‍👧 같은 합친 이모지 포함)도 1자로 센다
 */
export function countChars(value: string): number {
  const text = value.normalize("NFC").trim();
  // Intl.Segmenter: 사람 눈에 보이는 글자 단위로 나눠 준다. 없는 오래된 환경에서는 Array.from으로 대신 센다
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let count = 0;
    for (const piece of new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text)) {
      void piece;
      count++;
    }
    return count;
  }
  return Array.from(text).length;
}

/** 숫자를 "5,000"처럼 한국식으로 쓴다. 컴퓨터 언어 설정과 상관없이 늘 같게 보이게 한다 */
export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}
