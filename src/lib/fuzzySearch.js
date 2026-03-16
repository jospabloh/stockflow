/**
 * Motor de Búsqueda Difusa (Fuzzy Search) — StockFlow Help Center
 * Sin dependencias externas ni IA. Implementa:
 *  1. Limpieza de stop words en español
 *  2. Coincidencia exacta y parcial en title y keywords
 *  3. Distancia de Levenshtein para errores tipográficos
 *  4. Ordenamiento por relevancia
 */

// ─── Stop Words en Español ───────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "de", "del", "al", "a", "en", "y", "o", "u", "que",
  "es", "se", "no", "te", "lo", "le", "me", "si", "mi",
  "su", "sus", "con", "por", "para", "como", "más", "pero",
  "hay", "son", "ser", "estar", "tiene", "tener", "esto",
  "esta", "este", "eso", "esa", "ese", "cómo", "qué", "cuándo",
  "dónde", "puedo", "puede", "hacer", "hacer", "ver", "ir"
]);

// ─── Distancia de Levenshtein ────────────────────────────────────────────────
function levenshtein(s, t) {
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s[i - 1] === t[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ─── Limpieza de Texto ───────────────────────────────────────────────────────
function cleanText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ")   // quita puntuación
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .join(" ");
}

function tokenize(text) {
  return cleanText(text).split(/\s+/).filter(Boolean);
}

// ─── Puntuación de un Artículo ───────────────────────────────────────────────
function scoreArticle(queryTokens, article) {
  let score = 0;
  const titleTokens = tokenize(article.title);
  const keywordTokens = article.keywords.flatMap(k => tokenize(k));
  const allTokens = [...titleTokens, ...keywordTokens];

  for (const qWord of queryTokens) {
    // Coincidencia exacta en título → puntuación alta
    if (titleTokens.includes(qWord)) {
      score += 50;
      continue;
    }

    // Coincidencia exacta en keywords
    if (keywordTokens.includes(qWord)) {
      score += 30;
      continue;
    }

    // Coincidencia parcial (contiene la palabra)
    let partialMatch = false;
    for (const token of allTokens) {
      if (token.includes(qWord) || qWord.includes(token)) {
        score += 15;
        partialMatch = true;
        break;
      }
    }
    if (partialMatch) continue;

    // Búsqueda difusa con Levenshtein (maneja errores tipográficos)
    let bestDist = Infinity;
    for (const token of allTokens) {
      if (Math.abs(token.length - qWord.length) > 3) continue; // optimización
      const dist = levenshtein(qWord, token);
      if (dist < bestDist) bestDist = dist;
    }

    if (bestDist === 0) score += 40;
    else if (bestDist === 1) score += 20;
    else if (bestDist === 2) score += 8;
    else if (bestDist === 3 && qWord.length > 5) score += 3;
  }

  return score;
}

// ─── Función Principal de Búsqueda ──────────────────────────────────────────
/**
 * Busca artículos relevantes usando fuzzy search.
 * @param {string} query - Texto del usuario
 * @param {Array} articles - Lista de artículos del help data
 * @param {number} topN - Número máximo de resultados (default: 3)
 * @returns {Array} Artículos ordenados por relevancia
 */
export function fuzzySearch(query, articles, topN = 3) {
  if (!query || query.trim().length < 2) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = articles
    .map(article => ({
      article,
      score: scoreArticle(queryTokens, article),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map(s => s.article);
}

/**
 * Ejemplo de uso:
 *   const results = fuzzySearch("cotizacion ventas", articles);
 *   // Retorna los 3 artículos más relevantes sobre cotizaciones/ventas
 *
 *   const results = fuzzySearch("como creo un prodcuto", articles);
 *   // "prodcuto" → Levenshtein detecta "producto" (dist=1) y devuelve artículo correcto
 */