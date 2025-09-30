/**
 * LLM Validator for Philippine Location Parser
 * Uses GPT-4o-mini for validation and disambiguation
 * Enhanced with context awareness for social media mentions
 */

const OpenAI = require('openai');
const { getContextAnalysis } = require('./context-detector');

class LLMValidator {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided. LLM validation will be skipped.');
      this.enabled = false;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.enabled = true;
    this.cache = new Map();
  }

  /**
   * Validate extracted location with LLM
   */
  async validateLocation(text, extractedLocation) {
    if (!this.enabled) {
      return {
        hasLocation: !!extractedLocation,
        confidence: extractedLocation ? 50 : 50,
        location: extractedLocation,
        reasoning: 'LLM validation disabled',
        method: 'rule_based_only'
      };
    }

    // Get context analysis to detect potential false positives
    const contextAnalysis = getContextAnalysis(text);

    // Check cache first
    const cacheKey = `${text}_${JSON.stringify(extractedLocation)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = this.buildValidationPrompt(text, extractedLocation, contextAnalysis);
      const response = await this.callGPT4oMini(prompt);

      // Cache the result
      this.cache.set(cacheKey, response);

      return response;
    } catch (error) {
      console.error('LLM validation error:', error);

      // Fallback to rule-based result
      return {
        hasLocation: !!extractedLocation,
        confidence: extractedLocation ? 40 : 60,
        location: extractedLocation,
        reasoning: 'LLM validation failed, using rule-based result',
        method: 'fallback'
      };
    }
  }

  /**
   * Build validation prompt
   */
  buildValidationPrompt(text, extractedLocation, contextAnalysis) {
    // Build context warnings
    let contextWarnings = '';
    if (contextAnalysis && contextAnalysis.summary.hasSocialMediaContext) {
      contextWarnings += '\n⚠️ SOCIAL MEDIA CONTEXT DETECTED:';
      if (contextAnalysis.mentions.hasMentions) {
        contextWarnings += `\n- Found @mentions: ${contextAnalysis.mentions.mentions.join(', ')}`;
      }
      if (contextAnalysis.hashtags.hasHashtags) {
        contextWarnings += `\n- Found hashtags: ${contextAnalysis.hashtags.hashtags.join(', ')}`;
      }
    }

    if (contextAnalysis && contextAnalysis.summary.hasPublicFigures) {
      contextWarnings += '\n⚠️ PUBLIC FIGURES DETECTED:';
      if (contextAnalysis.political.hasPoliticalFigures) {
        contextWarnings += `\n- Political figures: ${contextAnalysis.political.figures.join(', ')}`;
      }
      if (contextAnalysis.celebrities.hasCelebrities) {
        contextWarnings += `\n- Celebrities: ${contextAnalysis.celebrities.celebrities.join(', ')}`;
      }
    }

    return `You are a location extraction validator for Philippine social media comments about internet issues.

Task: Determine if the text contains the USER'S ACTUAL LOCATION (not just any location mentioned).

CRITICAL RULES FOR SOCIAL MEDIA:
1. @mentions (like @bongbongmarcos, @MayorVico) are USERNAMES, NOT locations
2. #hashtags (like #AlterBacolod) are TAGS, NOT locations
3. Political figures (Bongbong Marcos, Sara Duterte) are PEOPLE, NOT locations
4. Celebrity names are PEOPLE, NOT locations
5. Only identify ACTUAL user locations, not mentioned people/places

Important Context Rules:
1. "Marcos" in "@bongbongmarcos" = President, NOT Marcos municipality
2. "Bacolod" in "#AlterBacolod" = hashtag trend, NOT Bacolod City
3. "Davao" with "Sara Duterte" = person reference, NOT Davao City
4. "wala" or "walang" means "no/without" in Filipino, NOT a location
${contextWarnings}

Text: "${text}"
Rule-based extraction: ${extractedLocation ? JSON.stringify(extractedLocation) : 'None'}

Analyze considering the context above and return JSON:
{
  "hasLocation": true/false,
  "confidence": 0-100,
  "location": {
    "region": "string or null",
    "province": "string or null",
    "city": "string or null",
    "barangay": "string or null"
  } or null,
  "reasoning": "brief explanation"
}

Examples:
- "@bongbongmarcos please help" → hasLocation: false (username mention)
- "@MayorVico here in Pasig no internet" → hasLocation: true, city: "Pasig" (location after mention)
- "#AlterBacolod trending" → hasLocation: false (hashtag, not location)
- "Bongbong Marcos announced" → hasLocation: false (political figure)
- "I'm from Marcos, Ilocos Norte" → hasLocation: true (legitimate municipality)
- "taga Quezon City ako" → hasLocation: true, city: "Quezon City"`;
  }

  /**
   * Call GPT-4o-mini API
   */
  async callGPT4oMini(prompt) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.1,  // Low temperature for consistency
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      ...result,
      method: 'llm_validated'
    };
  }

  /**
   * Batch validate multiple texts
   */
  async batchValidate(items, batchSize = 5) {
    const results = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item =>
        this.validateLocation(item.text, item.location)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Review cases where no location was found
   */
  async reviewNoLocation(text) {
    if (!this.enabled) return null;

    const prompt = `Review this text to check if it contains a user location that might have been missed.

Text: "${text}"

Look for:
1. Subtle location mentions
2. Filipino/English mixed patterns
3. Abbreviated locations (BGC, QC, etc.)
4. Contextual clues

Return JSON:
{
  "hasLocation": true/false,
  "confidence": 0-100,
  "location": {location object} or null,
  "reasoning": "explanation"
}

Be conservative - only identify clear user locations.`;

    try {
      return await this.callGPT4oMini(prompt);
    } catch (error) {
      console.error('LLM review error:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      enabled: this.enabled
    };
  }
}

module.exports = LLMValidator;