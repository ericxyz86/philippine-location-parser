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
   * Build extraction prompt with cascading inference instructions
   */
  buildExtractionPrompt(text) {
    return `You are an expert Philippine location extractor for social media comments about internet/telecom issues.

TASK: Extract the USER'S ACTUAL LOCATION from the text. Focus on where the user is physically located.

CRITICAL RULES:
1. Extract only the user's location, not mentioned people or companies
2. @mentions are usernames, NOT locations
3. #hashtags are tags, NOT locations (e.g., #AlterBacolod is a hashtag, not Bacolod City)
4. Political figures and celebrities are PEOPLE, NOT locations
5. Company names (Globe, PLDT, Converge) are NOT locations

LOCATION PATTERNS TO RECOGNIZE:
- "dito sa [location]" = "here in [location]"
- "dto sa [location]" = shortened form
- "area [location]" = "[location] area"
- "taga [location]" = "from [location]"
- "sa [location]" = "in/at [location]"
- "Brgy./Barangay [name]" = barangay
- Common abbreviations: QC (Quezon City), BGC (Taguig City), MOA (Pasay City)

CASCADE INFERENCE RULES:
When you identify a location at any level, infer the complete hierarchy:
- If only barangay → infer most likely city, province, and region
- If only city → infer province and region
- If only province → infer region
- Always provide complete hierarchy when possible

PHILIPPINE GEOGRAPHY KNOWLEDGE:
- NCR/Metro Manila cities: Quezon City, Manila, Makati, Taguig, Pasig, Pasay, Caloocan, etc.
- Major provinces: Cavite, Laguna, Batangas, Rizal, Bulacan, Pampanga, Cebu, Davao, etc.
- Regions: NCR, CALABARZON, Central Luzon, Central Visayas, Davao Region, etc.

Text to analyze: "${text}"

Return JSON with STRICT format:
{
  "hasLocation": true/false,
  "confidence": 0-100,
  "location": {
    "region": "full region name or None",
    "province": "full province name or None",
    "city": "full city/municipality name or None",
    "barangay": "barangay name or None"
  },
  "reasoning": "brief explanation of extraction"
}

EXAMPLES:
Input: "dito sa QC walang internet"
Output: {"hasLocation": true, "confidence": 95, "location": {"region": "National Capital Region (NCR)", "province": "Metro Manila", "city": "Quezon City", "barangay": "None"}, "reasoning": "QC is Quezon City in Metro Manila"}

Input: "Brgy. 171, North Caloocan. Hehe."
Output: {"hasLocation": true, "confidence": 100, "location": {"region": "National Capital Region (NCR)", "province": "Metro Manila", "city": "Caloocan City", "barangay": "171"}, "reasoning": "Explicit barangay and city mention"}

Input: "@enjoyGLOBE fix your service!"
Output: {"hasLocation": false, "confidence": 100, "location": null, "reasoning": "Only contains company mention, no user location"}

Input: "dto sa Burgos wala pa rin"
Output: {"hasLocation": true, "confidence": 85, "location": {"region": "Cagayan Valley", "province": "Isabela", "city": "Burgos", "barangay": "None"}, "reasoning": "Burgos municipality in Isabela based on context"}

Input: "area Rizal since yesterday"
Output: {"hasLocation": true, "confidence": 90, "location": {"region": "CALABARZON", "province": "Rizal", "city": "None", "barangay": "None"}, "reasoning": "Rizal province mentioned"}

IMPORTANT:
- Be aggressive in finding locations but accurate in extraction
- Always complete the hierarchy when possible
- Use "None" for unknown levels, not null
- Filipino text patterns are common - recognize them`;
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

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
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
      /^(no|walang|wala|nawala)\s+(signal|internet|connection|net)$/i,
      /^(down|offline|disconnected)$/i,
      /^(fix|ayusin|please|pls)$/i
    ];

    return noLocationPatterns.some(pattern => pattern.test(trimmed));
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