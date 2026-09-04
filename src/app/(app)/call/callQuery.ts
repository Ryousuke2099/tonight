// 両想い通話フローの各画面間で選択内容を引き継ぐためのクエリ文字列ヘルパー。
export function buildCallQuery(
  params: Record<string, string | null | undefined>
): string {
  const usp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      usp.set(key, value);
    }
  }

  const query = usp.toString();
  return query ? `?${query}` : "";
}
