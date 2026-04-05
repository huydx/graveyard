import type { KeyboardEvent } from "react";

/**
 * True when Enter should run app shortcuts (submit / blur).
 * False while Japanese IME (or similar) is composing — Enter は変換確定に使われるため。
 */
export function isEnterWithoutIme(e: KeyboardEvent): boolean {
  if (e.key !== "Enter") return false;
  if (e.nativeEvent.isComposing) return false;
  // IME がキーを処理しているときにブラウザが返すことがある
  if (e.keyCode === 229) return false;
  return true;
}
