const COMMIT = "7891def9e1b66bebd95a393b42f3401eba697cd5";
const BASE = `https://raw.githubusercontent.com/jpablo/vibe-types/${COMMIT}/plugin/skills/typescript/`;

export function knowledgeUrl(path: string): string {
  return `${BASE}${path}`;
}
