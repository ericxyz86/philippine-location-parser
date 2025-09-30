/**
 * Context Detector for Philippine Location Parser
 * Detects social media mentions, political figures, and other context that might cause false positives
 */

// Known Philippine political figures and celebrities that might be mistaken for locations
const POLITICAL_FIGURES = [
  // National figures
  'bongbong marcos', 'ferdinand marcos jr', 'bbm', 'pbbm',
  'sara duterte', 'inday sara', 'rodrigo duterte', 'digong',
  'leni robredo', 'vp leni',
  'manny pacquiao', 'pacman',
  'isko moreno', 'yorme',
  'vico sotto', 'mayor vico',
  'bong go', 'senator bong',
  'grace poe', 'senator grace',
  'nancy binay', 'senator nancy',
  'risa hontiveros', 'senator risa',
  'ping lacson', 'senator ping',
  'tito sotto', 'vicente sotto',
  'juan ponce enrile', 'jpe',
  'imee marcos', 'senator imee',
  'jinggoy estrada', 'senator jinggoy',
  'bong revilla', 'senator bong',
  'francis tolentino', 'senator tolentino',
  'ronald dela rosa', 'bato dela rosa', 'senator bato',
  'christopher lawrence go', 'bong go',
  'alan peter cayetano', 'senator cayetano',
  'pia cayetano', 'senator pia',

  // Local figures
  'joy belmonte', 'mayor joy',
  'marcy teodoro', 'mayor marcy',
  'rex gatchalian', 'mayor rex',
  'abby binay', 'mayor abby',
  'francis zamora', 'mayor francis',
  'benjamin magalong', 'mayor benjamin',
  'michael rama', 'mayor mike',
  'jerry trenas', 'mayor jerry',
  'oscar moreno', 'mayor oscar',

  // Historical figures
  'ferdinand marcos', 'marcos sr',
  'corazon aquino', 'cory aquino',
  'fidel ramos', 'fvr',
  'joseph estrada', 'erap',
  'gloria macapagal arroyo', 'gma',
  'benigno aquino', 'noynoy', 'pnoy'
];

// Celebrity names that might contain location-like words
const CELEBRITIES = [
  'daniel padilla', 'kathryn bernardo', 'vice ganda',
  'sarah geronimo', 'anne curtis', 'dingdong dantes',
  'marian rivera', 'angel locsin', 'bea alonzo',
  'john lloyd cruz', 'piolo pascual', 'coco martin',
  'julia barretto', 'joshua garcia', 'nadine lustre',
  'james reid', 'liza soberano', 'enrique gil',
  'maine mendoza', 'alden richards', 'kim chiu',
  'xian lim', 'maja salvador', 'paulo avelino'
];

// Common alter/fan account prefixes that shouldn't be locations
const ALTER_PREFIXES = [
  'alter', 'alt', 'anon', 'secret', 'hidden',
  'priv', 'private', 'personal', 'backup'
];

/**
 * Detect if text contains @mentions
 */
function detectMentions(text) {
  const mentionPattern = /@[a-zA-Z0-9_]+/g;
  const mentions = text.match(mentionPattern) || [];

  return {
    hasMentions: mentions.length > 0,
    mentions: mentions,
    count: mentions.length
  };
}

/**
 * Detect if text contains hashtags
 */
function detectHashtags(text) {
  const hashtagPattern = /#[a-zA-Z0-9_]+/g;
  const hashtags = text.match(hashtagPattern) || [];

  // Check for location-like hashtags
  const locationHashtags = hashtags.filter(tag => {
    const normalized = tag.toLowerCase().replace('#', '');
    return normalized.includes('alter') ||
           normalized.includes('bacolod') ||
           normalized.includes('manila') ||
           normalized.includes('cebu') ||
           normalized.includes('davao');
  });

  return {
    hasHashtags: hashtags.length > 0,
    hashtags: hashtags,
    locationHashtags: locationHashtags,
    count: hashtags.length
  };
}

/**
 * Check if text contains known political figures
 */
function detectPoliticalFigures(text) {
  const lowerText = text.toLowerCase();
  const detectedFigures = [];

  for (const figure of POLITICAL_FIGURES) {
    if (lowerText.includes(figure)) {
      detectedFigures.push(figure);
    }
  }

  return {
    hasPoliticalFigures: detectedFigures.length > 0,
    figures: detectedFigures,
    count: detectedFigures.length
  };
}

/**
 * Check if text contains celebrity names
 */
function detectCelebrities(text) {
  const lowerText = text.toLowerCase();
  const detectedCelebs = [];

  for (const celeb of CELEBRITIES) {
    if (lowerText.includes(celeb)) {
      detectedCelebs.push(celeb);
    }
  }

  return {
    hasCelebrities: detectedCelebs.length > 0,
    celebrities: detectedCelebs,
    count: detectedCelebs.length
  };
}

/**
 * Check if mentions might be incorrectly parsed as locations
 */
function analyzeLocationRisk(text) {
  const mentions = detectMentions(text);
  const hashtags = detectHashtags(text);
  const political = detectPoliticalFigures(text);
  const celebs = detectCelebrities(text);

  const risks = [];

  // Check for risky mentions
  if (mentions.hasMentions) {
    for (const mention of mentions.mentions) {
      const handle = mention.toLowerCase().replace('@', '');

      // Check for location-like handles
      if (handle.includes('marcos') ||
          handle.includes('duterte') ||
          handle.includes('bacolod') ||
          handle.includes('manila') ||
          handle.includes('cebu') ||
          handle.includes('davao') ||
          handle.includes('makati') ||
          handle.includes('quezon')) {
        risks.push({
          type: 'mention',
          value: mention,
          risk: 'high',
          reason: 'Handle contains location-like word'
        });
      }
    }
  }

  // Check for risky hashtags
  if (hashtags.locationHashtags.length > 0) {
    for (const tag of hashtags.locationHashtags) {
      risks.push({
        type: 'hashtag',
        value: tag,
        risk: 'medium',
        reason: 'Hashtag contains location word'
      });
    }
  }

  // Check for political figure names that might match locations
  if (political.hasPoliticalFigures) {
    for (const figure of political.figures) {
      if (figure.includes('marcos') || figure.includes('duterte')) {
        risks.push({
          type: 'political',
          value: figure,
          risk: 'high',
          reason: 'Political figure name matches location'
        });
      }
    }
  }

  return {
    hasRisks: risks.length > 0,
    risks: risks,
    riskLevel: risks.some(r => r.risk === 'high') ? 'high' :
               risks.some(r => r.risk === 'medium') ? 'medium' : 'low'
  };
}

/**
 * Pre-process text to remove potential false positive triggers
 */
function preprocessText(text) {
  let processed = text;

  // Remove @mentions but keep the surrounding context
  processed = processed.replace(/@[a-zA-Z0-9_]+/g, '[MENTION]');

  // Remove hashtags but keep the surrounding context
  processed = processed.replace(/#[a-zA-Z0-9_]+/g, '[HASHTAG]');

  return {
    original: text,
    processed: processed,
    hasModifications: text !== processed
  };
}

/**
 * Get context analysis for LLM validation
 */
function getContextAnalysis(text) {
  const mentions = detectMentions(text);
  const hashtags = detectHashtags(text);
  const political = detectPoliticalFigures(text);
  const celebs = detectCelebrities(text);
  const risks = analyzeLocationRisk(text);

  return {
    mentions,
    hashtags,
    political,
    celebrities: celebs,
    risks,
    summary: {
      hasSocialMediaContext: mentions.hasMentions || hashtags.hasHashtags,
      hasPublicFigures: political.hasPoliticalFigures || celebs.hasCelebrities,
      falsePositiveRisk: risks.riskLevel,
      shouldBeCareful: risks.riskLevel === 'high' ||
                       (mentions.hasMentions && political.hasPoliticalFigures)
    }
  };
}

module.exports = {
  detectMentions,
  detectHashtags,
  detectPoliticalFigures,
  detectCelebrities,
  analyzeLocationRisk,
  preprocessText,
  getContextAnalysis,
  POLITICAL_FIGURES,
  CELEBRITIES,
  ALTER_PREFIXES
};