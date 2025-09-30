/**
 * False Positive Filter for Philippine Location Parser
 * Prevents common Filipino/English words from being matched as locations
 */

// Filipino function words that should NEVER be locations
const FILIPINO_FUNCTION_WORDS = new Set([
  // Common function words
  'parang', 'iba', 'ba', 'pa', 'na', 'naman', 'din', 'daw', 'raw',
  'sana', 'kaya', 'nang', 'nga', 'pala', 'lang', 'lamang',
  'kahit', 'kung', 'kasi', 'pero', 'at', 'o', 'ni', 'ng', 'sa',
  'rin', 'dito', 'rito', 'doon', 'roon', 'dyan', 'ryan',
  'saan', 'bakit', 'paano', 'sino', 'ano', 'alin', 'aling',
  'eh', 'ha', 'oo', 'opo', 'hindi', 'huwag', 'ayaw',

  // Pronouns
  'ako', 'ikaw', 'siya', 'kami', 'kayo', 'sila', 'tayo',
  'ko', 'mo', 'niya', 'namin', 'natin', 'ninyo', 'nila',
  'akin', 'iyo', 'kaniya', 'amin', 'atin', 'inyo', 'kanila',
  'kanya', 'sarili', 'nito', 'nyan', 'niyan', 'noon', 'ngayon',

  // Common words
  'wala', 'meron', 'may', 'mayroon', 'walang', 'lahat',
  'bawat', 'kada', 'ilan', 'marami', 'konti', 'kaunti',
  'isa', 'dalawa', 'tatlo', 'apat', 'lima', 'anim', 'pito', 'walo', 'siyam', 'sampu',
  'sobra', 'kulang', 'tama', 'mali', 'totoo', 'tunay', 'talaga',

  // Time/frequency
  'araw', 'gabi', 'umaga', 'hapon', 'tanghali', 'madaling araw',
  'kahapon', 'bukas', 'ngayon', 'kanina', 'mamaya', 'maya',
  'minsan', 'lagi', 'palagi', 'madalas', 'bihira',
  'oras', 'minuto', 'segundo', 'linggo', 'buwan', 'taon',
  'sandali', 'saglit', 'ngayong araw', 'kagabi', 'kaninang umaga',

  // Adjectives that might match locations
  'bago', 'luma', 'malaki', 'maliit', 'mabilis', 'mabagal',
  'mahaba', 'maikli', 'matanda', 'bata', 'maganda', 'pangit',
  'mahal', 'mura', 'mainit', 'malamig', 'mataas', 'mababa',
  'malayo', 'malapit', 'magaan', 'mabigat', 'masaya', 'malungkot',

  // Verbs that might substring match
  'gawa', 'sabi', 'kain', 'inom', 'tulog', 'gising', 'lakad',
  'takbo', 'laro', 'trabaho', 'aral', 'basa', 'sulat', 'bili',
  'bayad', 'sakay', 'baba', 'pasok', 'labas', 'dating', 'alis',
  'uwi', 'balik', 'punta', 'tuloy', 'tigil', 'simula', 'tapos',

  // Question words and conjunctions
  'dahil', 'sapagkat', 'subalit', 'datapwat', 'samantala',
  'gayunman', 'gayunpaman', 'bagamat', 'ngunit', 'upang', 'nang',
  'kapag', 'pag', 'kung', 'sakali', 'baka', 'siguro', 'marahil',

  // Common exclamations and interjections
  'naku', 'hay', 'hala', 'aba', 'sus', 'diyos ko', 'grabe', 'sayang',
  'sige', 'tara', 'halika', 'sandali', 'teka', 'hintay', 'tignan'
]);

// Tagalog verb affixes that create false matches
const TAGALOG_VERB_PATTERNS = [
  /^(nag|mag|um|in|na|ma|i|ipa|pag|pang|ka)/i,  // Prefixes
  /^(nag|mag)(ka|pa|si)/i,                       // Combined prefixes
  /(in|an|han)$/i,                               // Suffixes
  /(um|in).*?(in|an)$/i                          // Circumfixes
];

// Common English words that match Philippine locations
const ENGLISH_FALSE_POSITIVES = new Set([
  // Common words that match cities/municipalities
  'real', 'goal', 'goals', 'usual', 'usually', 'face', 'facebook',
  'book', 'books', 'load', 'loading', 'loaded', 'upload',
  'download', 'reload', 'alone', 'loan', 'loans',
  'can', 'cant', 'cannot', 'ban', 'bans', 'banned',
  'pan', 'pans', 'tan', 'tans', 'man', 'men',
  'new', 'news', 'newer', 'newest', 'renew',

  // Tech/service terms
  'lag', 'lagging', 'lags', 'ping', 'pings', 'pinged',
  'plan', 'plans', 'planning', 'planned',
  'pass', 'passed', 'passing', 'password',
  'data', 'database', 'update', 'updates',
  'service', 'services', 'servicing',

  // Common verbs that might substring match
  'announce', 'announced', 'announcement', 'announcing',
  'register', 'registered', 'registration', 'registering',
  'apply', 'applied', 'application', 'applying',
  'pay', 'paid', 'payment', 'paying',
  'say', 'said', 'saying', 'says',

  // Status/state words
  'down', 'up', 'online', 'offline', 'active', 'inactive',
  'good', 'bad', 'better', 'best', 'worse', 'worst',
  'same', 'different', 'similar', 'exact',

  // Time-related
  'day', 'days', 'daily', 'today', 'yesterday', 'tomorrow',
  'week', 'weeks', 'weekly', 'month', 'months', 'monthly',
  'year', 'years', 'yearly', 'annual', 'annually'
]);

// Words that need context to determine if they're locations
const CONTEXT_DEPENDENT_WORDS = new Set([
  'aurora', 'victoria', 'angeles', 'carmen', 'esperanza',
  'florida', 'jordan', 'leon', 'mercedes', 'salvador',
  'santiago', 'trinidad', 'valencia'
]);

// Patterns that indicate NON-location context
const NON_LOCATION_PATTERNS = [
  // Verb patterns
  /\b(nag|mag|um)\s*\w+/i,           // Tagalog verb markers
  /\b\w+ing\b/i,                      // English progressive
  /\b\w+ed\b/i,                       // English past tense

  // Tech/service patterns
  /@\w+/,                             // Mentions
  /#\w+/,                             // Hashtags
  /\.(com|net|org|ph)/i,             // Domains
  /https?:\/\//i,                     // URLs

  // Number/date patterns without location context
  /\b\d{1,2}(am|pm)\b/i,             // Time
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d+/i,  // Dates
  /\bseptember\s+\d+/i,               // Full month names with dates

  // Service complaints
  /\b(down|offline|slow|lag|delay|issue|problem|error)/i,
  /\b(walang|no|without)\s+(internet|connection|service|signal)/i
];

// Patterns that indicate VALID location context
const LOCATION_CONTEXT_PATTERNS = [
  // Strong indicators
  /\b(taga|galing|from|sa|nasa|dito|rito|nandito|narito)\s+/i,
  /\b(here\s+in|located\s+at|located\s+in|based\s+in)\s+/i,
  /\b(address|location|lugar|area|place)\s*[:=]\s*/i,
  /\b([a-z]+)\s+area\b/i,  // "Makati area", "QC area"
  /\b(here|dito|rito)\b/i,  // Presence indicators
  /\b(?:around|near)\s+[a-z]/i,
  /\b(?:living|staying|working)\s+in\s+[a-z]/i,

  // Geographic indicators
  /\b(city|municipality|province|region|barangay|brgy)\s+/i,
  /\b(city|municipality|province|region|barangay|brgy)$/i,
  /,\s*philippines$/i,

  // Directional context
  /\b(north|south|east|west|northern|southern|eastern|western)\s+/i,
  /\b(upper|lower|central|downtown|suburban)\s+/i
];

/**
 * Check if a word is likely a false positive
 */
function isFalsePositive(word, fullText = '') {
  if (!word) return true;

  const normalized = word.toLowerCase().trim();
  const fullTextLower = fullText.toLowerCase();

  // Check Filipino function words
  if (FILIPINO_FUNCTION_WORDS.has(normalized)) {
    return true;
  }

  // Check English false positives
  if (ENGLISH_FALSE_POSITIVES.has(normalized)) {
    return true;
  }

  // Check Tagalog verb patterns
  for (const pattern of TAGALOG_VERB_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // For context-dependent words, check if there's location context
  if (CONTEXT_DEPENDENT_WORDS.has(normalized)) {
    const hasLocationContext = LOCATION_CONTEXT_PATTERNS.some(pattern =>
      pattern.test(fullTextLower)
    );
    return !hasLocationContext;
  }

  // Check if the word appears in non-location context
  for (const pattern of NON_LOCATION_PATTERNS) {
    if (pattern.test(fullTextLower)) {
      // Check if this word is part of the non-location pattern
      const matches = fullTextLower.match(pattern);
      if (matches && matches[0].includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if text has valid location context
 */
function hasLocationContext(text) {
  const textLower = text.toLowerCase();

  // Check for Filipino location patterns specifically
  if (/\b(taga|dito\s+sa|nasa)\s+\w+/i.test(textLower)) {
    return true;
  }

  // Check for area pattern
  if (/\w+\s+area\b/i.test(textLower)) {
    return true;
  }

  // Check for explicit location indicators
  if (/\b(location|address)\s*[:=]/i.test(textLower)) {
    return true;
  }

  // Check other location context patterns
  return LOCATION_CONTEXT_PATTERNS.some(pattern => pattern.test(textLower));
}

/**
 * Extract word with boundaries (not substring)
 */
function extractWordWithBoundaries(text, word) {
  // Create regex that ensures word boundaries
  const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
  const match = text.match(wordRegex);

  if (match) {
    // Verify it's not part of a larger word
    const index = match.index;
    const before = index > 0 ? text[index - 1] : ' ';
    const after = index + match[0].length < text.length ?
                  text[index + match[0].length] : ' ';

    // Check for word boundaries (space, punctuation, or string boundary)
    const isWordBoundary = /[\s,.\-!?;:]/.test(before) && /[\s,.\-!?;:]/.test(after);

    if (isWordBoundary) {
      return match[0];
    }
  }

  return null;
}

/**
 * Clean and validate location candidate
 */
function validateLocationCandidate(candidate, fullText) {
  if (!candidate || candidate.length < 3) {
    return { isValid: false, reason: 'Too short' };
  }

  // Check if it's a false positive
  if (isFalsePositive(candidate, fullText)) {
    return { isValid: false, reason: 'Common word false positive' };
  }

  // Check if text has location context
  if (!hasLocationContext(fullText)) {
    // For low confidence, require explicit location context
    return { isValid: false, reason: 'No location context' };
  }

  // Ensure word boundaries
  const extracted = extractWordWithBoundaries(fullText, candidate);
  if (!extracted) {
    return { isValid: false, reason: 'Not a complete word' };
  }

  return { isValid: true, candidate: extracted };
}

/**
 * Pre-process text to remove false positive triggers
 */
function preprocessTextForParsing(text) {
  let processed = text;

  // Remove @mentions and #hashtags completely
  processed = processed.replace(/@\w+/g, '');
  processed = processed.replace(/#\w+/g, '');

  // Remove URLs
  processed = processed.replace(/https?:\/\/[^\s]+/g, '');

  // Remove common false positive phrases
  const falsePositivePhrases = [
    /\bnag\s+announce\b/gi,
    /\bnag\s+register\b/gi,
    /\bgoal\s+is\b/gi,
    /\breal\s+problem\b/gi,
    /\busual\s+time\b/gi
  ];

  falsePositivePhrases.forEach(phrase => {
    processed = processed.replace(phrase, '');
  });

  return processed;
}

module.exports = {
  isFalsePositive,
  hasLocationContext,
  extractWordWithBoundaries,
  validateLocationCandidate,
  preprocessTextForParsing,
  FILIPINO_FUNCTION_WORDS,
  TAGALOG_VERB_PATTERNS,
  ENGLISH_FALSE_POSITIVES,
  CONTEXT_DEPENDENT_WORDS,
  NON_LOCATION_PATTERNS,
  LOCATION_CONTEXT_PATTERNS
};