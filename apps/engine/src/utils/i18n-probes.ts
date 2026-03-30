/**
 * i18n-probes.ts — Multilingual probe path + keyword infrastructure
 *
 * Instead of hardcoding English-only probe paths and link keywords in each module,
 * this utility provides language-aware expansion so M16 (PR/Media), M17 (Careers),
 * M18 (Investor Relations), and M19 (Support) automatically adapt to the site's
 * primary language.
 *
 * Architecture:
 *   1. detectPageLanguage()  — extracts BCP-47 primary language from <html lang="">
 *   2. KEYWORD_MAPS          — per-domain, per-language keyword/probe-path dictionaries
 *   3. expandProbePaths()    — returns deduplicated union of base English + detected language paths
 *   4. expandLinkKeywords()  — returns combined regex for link text matching in multiple languages
 *
 * Supported languages: en, es, fr, de, pt, it, nl, ja, ko, zh
 * Falls back gracefully to English-only when language is unsupported.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Semantic domain that maps to a passive module. */
export type ProbeDomain = 'press' | 'careers' | 'ir' | 'support';

/** Per-language keyword set for a domain. */
interface LanguageKeywords {
  /** URL path segments to probe (e.g., '/noticias', '/prensa') */
  paths: string[];
  /** Link text keywords to match (lowercased) */
  linkTexts: string[];
}

// ─── Language detection ─────────────────────────────────────────────────────

/**
 * Extract the primary BCP-47 language code from HTML.
 * Returns the 2-letter ISO 639-1 code (e.g., 'es', 'fr', 'de') or 'en' as fallback.
 *
 * Sources checked (in priority order):
 *   1. <html lang="..."> attribute
 *   2. <meta http-equiv="content-language" content="...">
 *   3. First <meta property="og:locale" content="...">
 */
export function detectPageLanguage(html: string): string {
  // 1. <html lang="xx"> or <html lang="xx-YY">
  const htmlLangMatch = html.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i);
  if (htmlLangMatch?.[1]) {
    return normalizeLangCode(htmlLangMatch[1]);
  }

  // 2. <meta http-equiv="content-language" content="xx">
  const contentLangMatch = html.match(
    /<meta[^>]*http-equiv\s*=\s*["']content-language["'][^>]*content\s*=\s*["']([^"']+)["']/i,
  );
  if (contentLangMatch?.[1]) {
    return normalizeLangCode(contentLangMatch[1]);
  }

  // 3. og:locale (e.g., "es_ES", "fr_FR")
  const ogLocaleMatch = html.match(
    /<meta[^>]*(?:property|name)\s*=\s*["']og:locale["'][^>]*content\s*=\s*["']([^"']+)["']/i,
  );
  if (ogLocaleMatch?.[1]) {
    return normalizeLangCode(ogLocaleMatch[1]);
  }

  return 'en';
}

/**
 * Normalize a BCP-47 / locale string to a 2-letter language code.
 * "en-US" → "en", "es_ES" → "es", "pt-BR" → "pt", "zh-Hans" → "zh"
 */
function normalizeLangCode(raw: string): string {
  const code = raw.trim().split(/[-_]/)[0]?.toLowerCase() ?? 'en';
  // Validate it's a real 2-3 letter code
  return /^[a-z]{2,3}$/.test(code) ? code : 'en';
}

// ─── Keyword maps ───────────────────────────────────────────────────────────

/**
 * Multilingual keyword maps organized by domain → language → paths + link texts.
 *
 * English (en) is always the base and is included via the module's own constant arrays.
 * This map provides ADDITIONAL language variants that get unioned with the English base.
 */
const KEYWORD_MAPS: Record<ProbeDomain, Record<string, LanguageKeywords>> = {
  press: {
    es: {
      paths: ['/noticias', '/prensa', '/comunicados', '/sala-de-prensa', '/notas-de-prensa', '/medios'],
      linkTexts: ['prensa', 'noticias', 'sala de prensa', 'comunicados', 'notas de prensa', 'medios'],
    },
    fr: {
      paths: ['/actualites', '/presse', '/communiques', '/salle-de-presse', '/espace-presse'],
      linkTexts: ['presse', 'actualités', 'communiqués', 'salle de presse', 'espace presse'],
    },
    de: {
      paths: ['/presse', '/pressemitteilungen', '/neuigkeiten', '/nachrichten', '/pressemeldungen'],
      linkTexts: ['presse', 'pressemitteilungen', 'neuigkeiten', 'nachrichten', 'pressemeldungen'],
    },
    pt: {
      paths: ['/noticias', '/imprensa', '/comunicados', '/sala-de-imprensa'],
      linkTexts: ['imprensa', 'notícias', 'comunicados', 'sala de imprensa'],
    },
    it: {
      paths: ['/notizie', '/stampa', '/comunicati', '/sala-stampa', '/ufficio-stampa'],
      linkTexts: ['stampa', 'notizie', 'comunicati stampa', 'sala stampa'],
    },
    nl: {
      paths: ['/nieuws', '/pers', '/persberichten'],
      linkTexts: ['pers', 'nieuws', 'persberichten'],
    },
    ja: {
      paths: ['/news', '/press', '/pressrelease'],
      linkTexts: ['ニュース', 'プレスリリース', 'お知らせ', '報道'],
    },
    ko: {
      paths: ['/news', '/press'],
      linkTexts: ['뉴스', '보도자료', '공지사항'],
    },
    zh: {
      paths: ['/news', '/press'],
      linkTexts: ['新闻', '新聞', '媒体', '媒體', '新闻发布'],
    },
  },

  careers: {
    es: {
      paths: ['/empleo', '/empleos', '/trabaja-con-nosotros', '/carreras', '/equipo', '/unete', '/vacantes', '/oportunidades'],
      linkTexts: ['empleo', 'empleos', 'trabaja con nosotros', 'carreras', 'únete', 'vacantes', 'oportunidades', 'equipo'],
    },
    fr: {
      paths: ['/emplois', '/carrieres', '/recrutement', '/rejoignez-nous', '/offres-emploi', '/postes'],
      linkTexts: ['emplois', 'carrières', 'recrutement', 'rejoignez-nous', 'offres d\'emploi', 'postes'],
    },
    de: {
      paths: ['/karriere', '/stellen', '/jobs', '/stellenangebote', '/arbeiten-bei-uns'],
      linkTexts: ['karriere', 'stellen', 'stellenangebote', 'arbeiten bei uns', 'offene stellen'],
    },
    pt: {
      paths: ['/carreiras', '/vagas', '/trabalhe-conosco', '/empregos', '/oportunidades'],
      linkTexts: ['carreiras', 'vagas', 'trabalhe conosco', 'empregos', 'oportunidades'],
    },
    it: {
      paths: ['/carriere', '/lavora-con-noi', '/posizioni-aperte', '/opportunita'],
      linkTexts: ['carriere', 'lavora con noi', 'posizioni aperte', 'opportunità'],
    },
    nl: {
      paths: ['/vacatures', '/carriere', '/werken-bij-ons'],
      linkTexts: ['vacatures', 'carrière', 'werken bij ons'],
    },
    ja: {
      paths: ['/recruit', '/careers'],
      linkTexts: ['採用', '求人', 'キャリア', '採用情報'],
    },
    ko: {
      paths: ['/recruit', '/careers'],
      linkTexts: ['채용', '인재채용', '채용정보'],
    },
    zh: {
      paths: ['/careers', '/jobs'],
      linkTexts: ['招聘', '加入我们', '职业', '職業', '人才招募'],
    },
  },

  ir: {
    es: {
      paths: ['/inversionistas', '/relacion-con-inversionistas', '/relaciones-con-inversionistas', '/accionistas'],
      linkTexts: ['inversionistas', 'relación con inversionistas', 'accionistas'],
    },
    fr: {
      paths: ['/investisseurs', '/relations-investisseurs', '/actionnaires'],
      linkTexts: ['investisseurs', 'relations investisseurs', 'actionnaires'],
    },
    de: {
      paths: ['/investoren', '/investor-relations', '/aktionaere'],
      linkTexts: ['investoren', 'investor relations', 'aktionäre'],
    },
    pt: {
      paths: ['/investidores', '/relacoes-com-investidores', '/acionistas', '/ri'],
      linkTexts: ['investidores', 'relações com investidores', 'acionistas'],
    },
    it: {
      paths: ['/investitori', '/relazioni-investitori', '/azionisti'],
      linkTexts: ['investitori', 'relazioni investitori', 'azionisti'],
    },
    nl: {
      paths: ['/investeerders', '/beleggers', '/aandeelhouders'],
      linkTexts: ['investeerders', 'beleggers', 'aandeelhouders'],
    },
    ja: {
      paths: ['/ir', '/investor'],
      linkTexts: ['IR情報', '投資家情報', '株主・投資家'],
    },
    ko: {
      paths: ['/ir', '/investor'],
      linkTexts: ['IR', '투자자', '주주'],
    },
    zh: {
      paths: ['/ir', '/investor'],
      linkTexts: ['投资者关系', '投資者關係', '股东'],
    },
  },

  support: {
    es: {
      paths: ['/soporte', '/ayuda', '/contacto', '/preguntas-frecuentes', '/comunidad', '/centro-de-ayuda'],
      linkTexts: ['soporte', 'ayuda', 'contacto', 'preguntas frecuentes', 'comunidad', 'centro de ayuda'],
    },
    fr: {
      paths: ['/assistance', '/aide', '/contact', '/faq', '/communaute', '/centre-aide'],
      linkTexts: ['assistance', 'aide', 'contact', 'faq', 'communauté', 'centre d\'aide'],
    },
    de: {
      paths: ['/support', '/hilfe', '/kontakt', '/haeufige-fragen', '/community', '/hilfecenter'],
      linkTexts: ['support', 'hilfe', 'kontakt', 'häufige fragen', 'community', 'hilfecenter'],
    },
    pt: {
      paths: ['/suporte', '/ajuda', '/contato', '/perguntas-frequentes', '/comunidade', '/central-de-ajuda'],
      linkTexts: ['suporte', 'ajuda', 'contato', 'perguntas frequentes', 'comunidade', 'central de ajuda'],
    },
    it: {
      paths: ['/supporto', '/aiuto', '/contatti', '/domande-frequenti', '/comunita'],
      linkTexts: ['supporto', 'aiuto', 'contatti', 'domande frequenti', 'comunità'],
    },
    nl: {
      paths: ['/ondersteuning', '/hulp', '/contact', '/veelgestelde-vragen', '/community'],
      linkTexts: ['ondersteuning', 'hulp', 'contact', 'veelgestelde vragen', 'community'],
    },
    ja: {
      paths: ['/support', '/help'],
      linkTexts: ['サポート', 'ヘルプ', 'お問い合わせ', 'よくある質問'],
    },
    ko: {
      paths: ['/support', '/help'],
      linkTexts: ['지원', '도움말', '문의', '자주 묻는 질문'],
    },
    zh: {
      paths: ['/support', '/help'],
      linkTexts: ['支持', '帮助', '幫助', '联系我们', '常见问题'],
    },
  },
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Expand a base set of English probe paths with language-specific variants.
 *
 * Returns a deduplicated array: base paths first, then additional paths for the
 * detected language. If the language is English or unsupported, returns the base
 * paths unchanged.
 *
 * @param basePaths - The module's default English probe paths
 * @param lang - 2-letter language code from detectPageLanguage()
 * @param domain - The probe domain ('press', 'careers', 'ir', 'support')
 */
export function expandProbePaths(
  basePaths: readonly string[],
  lang: string,
  domain: ProbeDomain,
): string[] {
  const langMap = KEYWORD_MAPS[domain][lang];
  if (!langMap || lang === 'en') {
    return [...basePaths];
  }

  const seen = new Set(basePaths);
  const expanded = [...basePaths];
  for (const path of langMap.paths) {
    if (!seen.has(path)) {
      seen.add(path);
      expanded.push(path);
    }
  }
  return expanded;
}

/**
 * Build a combined regex that matches link text in English + the detected language.
 *
 * The returned RegExp is case-insensitive and matches if the link text contains
 * any of the keywords (English base + detected language variants).
 *
 * @param baseKeywords - English keywords from the module (e.g., ['press', 'newsroom'])
 * @param lang - 2-letter language code
 * @param domain - The probe domain
 */
export function buildMultilingualLinkRegex(
  baseKeywords: readonly string[],
  lang: string,
  domain: ProbeDomain,
): RegExp {
  const keywords = [...baseKeywords];
  const langMap = KEYWORD_MAPS[domain][lang];
  if (langMap && lang !== 'en') {
    keywords.push(...langMap.linkTexts);
  }

  // Escape regex special characters in keywords, then join with |
  const escaped = keywords.map(kw =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`(?:${escaped.join('|')})`, 'i');
}

/**
 * Get all link-text keywords for a domain in both English and the detected language.
 * Returns lowercased strings for direct comparison.
 */
export function getMultilingualKeywords(
  baseKeywords: readonly string[],
  lang: string,
  domain: ProbeDomain,
): string[] {
  const keywords = baseKeywords.map(k => k.toLowerCase());
  const langMap = KEYWORD_MAPS[domain][lang];
  if (langMap && lang !== 'en') {
    for (const kw of langMap.linkTexts) {
      if (!keywords.includes(kw.toLowerCase())) {
        keywords.push(kw.toLowerCase());
      }
    }
  }
  return keywords;
}
