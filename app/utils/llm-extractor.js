/**
 * LLM-First Location Extractor for Philippine Location Parser
 * Uses GPT-4o-mini as PRIMARY extraction method (not validation)
 * Implements cascading location inference for incomplete mentions
 */

const OpenAI = require('openai');

class LLMExtractor {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided. LLM extraction will be disabled.');
      this.enabled = false;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.enabled = true;
    this.cache = new Map();
  }

  /**
   * Primary location extraction using LLM
   * This is now the MAIN extraction method, not a validator
   */
  async extractLocation(text) {
    if (!this.enabled) {
      return {
        hasLocation: false,
        confidence: 0,
        location: null,
        reasoning: 'LLM extraction disabled',
        method: 'disabled'
      };
    }

    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return { ...cached, cached: true };
    }

    // Pre-filter obvious non-locations to save LLM calls
    if (this.shouldSkipLLM(text)) {
      const result = {
        hasLocation: false,
        confidence: 100,
        location: null,
        reasoning: 'Text contains only mentions/hashtags or is too short',
        method: 'pre-filtered'
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    try {
      const prompt = this.buildExtractionPrompt(text);
      const response = await this.callGPT4oMini(prompt);

      // Cache the result
      this.cache.set(cacheKey, response);

      // Maintain cache size
      this.maintainCacheSize();

      return response;
    } catch (error) {
      console.error('LLM extraction error:', error);

      // Return no location on error
      return {
        hasLocation: false,
        confidence: 0,
        location: null,
        reasoning: 'LLM extraction failed',
        method: 'error'
      };
    }
  }

  /**
   * Check if text should skip LLM processing
   */
  shouldSkipLLM(text) {
    if (!text || text.trim().length < 10) {
      return true;
    }

    const trimmed = text.trim();

    // Skip if only contains @mentions
    if (/^(@\w+\s*)+$/.test(trimmed)) {
      return true;
    }

    // Skip if only contains hashtags
    if (/^(#\w+\s*)+$/.test(trimmed)) {
      return true;
    }

    // Skip if it's just "no signal", "walang signal", etc. without location
    const noLocationPatterns = [
      /^(no|walang|wala|nawala|mahina|slow|bagal)\s+(signal|internet|connection|net|wiffi|data|service)$/i,
      /^(down|offline|disconnected|intermittent|unstable)$/i,
      /^(fix|ayusin|please|pls|help|tululong)\s+(po|nyo|globe|pldt|smart|converge)?$/i,
      /^(amen|thanks|salamat|thank you|good morning|good evening|hello|hi)$/i,
      /^(\d+)\s*(days|weeks|months|years|hrs|hours)$/i
    ];

    return noLocationPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Build extraction prompt with cascading inference instructions
   * Optimized for token usage and speed
   */
  buildExtractionPrompt(text) {
    return `You are a Philippine location extraction system.

TASK: Extract USER'S PHYSICAL LOCATION from text.
Output JSON: { "hasLocation": boolean, "confidence": 0-100, "location": { "region": "Name/None", "province": "Name/None", "city": "Name/None", "barangay": "Name/None" }, "reasoning": "brief" }

RULES:
1. Ignore companies (Globe, PLDT), people, & #hashtags.
2. "dito sa [loc]" / "taga [loc]" / "area [loc]" = User Location.
3. INFER hierarchy: Brgy -> City -> Prov -> Region.

CONTEXT:
- NCR Cities: QC, Manila, Makati, Taguig, Pasig, Caloocan, Marikina, etc.
- Provinces: Cavite, Laguna, Rizal, Bulacan, Cebu, Davao.

INPUT: "${text}"`;
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
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Ensure proper format with "None" for missing fields
    if (result.location) {
      result.location.region = result.location.region || "None";
      result.location.province = result.location.province || "None";
      result.location.city = result.location.city || "None";
      result.location.barangay = result.location.barangay || "None";
    }

    return {
      ...result,
      method: 'llm_extracted'
    };
  }

  /**
   * Batch extract multiple texts with optimized processing
   */
  async batchExtract(texts, batchSize = 10) {
    const results = [];
    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.extractLocation(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return results;
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
      enabled: this.enabled,
      maxSize: 10000 // Increased cache size
    };
  }

  /**
   * Maintain cache size
   */
  maintainCacheSize() {
    const maxSize = 10000;
    if (this.cache.size > maxSize) {
      // Remove oldest entries (FIFO)
      const entriesToRemove = this.cache.size - maxSize;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }
}

module.exports = LLMExtractor;