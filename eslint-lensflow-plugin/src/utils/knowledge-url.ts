export const COMMIT = "14bfcdade611502a5c6a032f6e2cabd731ad599b";
const BASE = `https://raw.githubusercontent.com/jpablo/vibe-types/${COMMIT}/plugin/skills/typescript/`;

export function knowledgeUrl(path: string, section: string): string {
  return section ? `${BASE}${path} (see: "${section}")` : `${BASE}${path}`;
}
