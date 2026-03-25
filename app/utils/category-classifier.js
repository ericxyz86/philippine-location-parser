/**
 * Category Classifier for Philippine Location Parser
 * Uses GPT-4.1-mini for category classification with strict label validation
 * Supports custom category taxonomies
 */

const OpenAI = require('openai');

class CategoryClassifier {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided. Category classification will be disabled.');
      this.enabled = false;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.enabled = true;
    this.cache = new Map();
    this.maxRetries = 2;
  }

  /**
   * Classify text into one of the provided categories
   * @param {string} text - Text to classify
   * @param {string[]} categories - Allowed categories (e.g., ["Billing", "Technical Support", "Network Issues"])
   * @param {string} description - Classification description for context
   * @param {Object} categoryHints - Optional mapping of category labels to descriptive hints
   * @returns {Object} Classification result
   */
  async classifyCategory(text, categories, description = '', categoryHints = {}) {
    if (!this.enabled) {
      return {
        text,
        classification: null,
        confidence: 0,
        method: 'disabled',
        reasoning: 'Category classification disabled'
      };
    }

    // Validate inputs
    if (!categories || categories.length === 0) {
      return {
        text,
        classification: null,
        confidence: 0,
        method: 'validation_error',
        reasoning: 'Missing required field: categories'
      };
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(text, categories, categoryHints);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return { ...cached, cached: true };
    }

    // Attempt classification with retry logic
    let attempt = 0;
    let lastError = null;

    while (attempt <= this.maxRetries) {
      try {
        const prompt = this.buildCategoryPrompt(text, categories, description, attempt, categoryHints);
        const response = await this.callGPT4oMini(prompt);

        // Validate the classification
        const validation = this.validateCategoryClassification(response, categories);

        if (validation.valid) {
          const result = {
            text,
            classification: validation.classification,
            confidence: response.confidence || 90,
            method: attempt > 0 ? `llm_retry_${attempt}` : 'llm_classified',
            reasoning: response.reasoning || 'Category classified successfully'
          };

          // Cache the result
          this.cache.set(cacheKey, result);
          this.maintainCacheSize();

          return result;
        }

        // Invalid classification - retry
        lastError = `Invalid classification: received "${response.classification}", expected one of: ${categories.join(', ')}`;
        console.warn(`[Attempt ${attempt + 1}/${this.maxRetries + 1}] ${lastError}`);
        attempt++;

      } catch (error) {
        console.error(`[Attempt ${attempt + 1}/${this.maxRetries + 1}] LLM API error:`, error.message);
        lastError = error.message;
        attempt++;

        if (attempt <= this.maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries exhausted
    const result = {
      text,
      classification: 'Error: Invalid Classification',
      confidence: 0,
      method: 'retry_exhausted',
      reasoning: `Failed after ${this.maxRetries + 1} attempts: ${lastError}`
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Build category classification prompt
   */
  buildCategoryPrompt(text, categories, description, retryAttempt = 0, categoryHints = {}) {
    const strictnessNote = retryAttempt > 0
      ? '\n\n⚠️ CRITICAL: Your previous response was invalid. You MUST return EXACTLY one of the allowed categories.'
      : '';

    const allowedCategoriesList = categories.map(category => `- ${category}`).join('\n');
    const hintEntries = categories
      .map(category => {
        const hint = categoryHints && categoryHints[category];
        if (hint) {
          return `- ${category}: ${hint}`;
        }
        return null;
      })
      .filter(Boolean);

    const hintSection = hintEntries.length > 0
      ? `\nCATEGORY HINTS (use for decision context only, do NOT return this text):\n${hintEntries.join('\n')}\n`
      : '\n';

    return `You are a category classifier for text content organization.

TASK: Classify the text into one of the provided categories.

${description ? `CONTEXT: ${description}\n` : ''}
STRICT RULES:
1. Return ONLY ONE of these categories: ${categories.join(', ')}
2. Do not create new categories or variations
3. Do not add any other text, explanation, or labels beyond the category
4. Choose the single most relevant category
5. Your response must be EXACTLY one of the provided categories (case-insensitive matching)${strictnessNote}

TEXT TO CLASSIFY: "${text}"

ALLOWED CATEGORIES (choose exactly one of the following labels):
${allowedCategoriesList}

${hintSection}

Return your classification as a JSON object with this EXACT format:
{
  "classification": "one of the allowed categories",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}

IMPORTANT: The "classification" field must contain ONLY one of these exact categories: ${categories.join(', ')}`;
  }

  /**
   * Call GPT-4.1-mini API
   */
  async callGPT4oMini(prompt) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.1,  // Low temperature for consistency
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  }

  /**
   * Sanitize label strings by removing numbering and parenthetical context.
   */
  sanitizeCategoryLabel(label) {
    if (!label) return '';

    const labelString = typeof label === 'string' ? label : String(label);

    return labelString
      .replace(/\(([^)]+)\)/g, '')
      .replace(/^[\s]*[-–—•]+\s*/, '')
      .replace(/^[\s]*\d+\)\s*/, '')
      .replace(/^[\s]*\d+\.\s*/, '')
      .replace(/^[\s]*[IVXLC]+\.\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/:\s*$/, '');
  }

  /**
   * Validate category classification against allowed categories
   */
  validateCategoryClassification(llmResponse, allowedCategories) {
    if (!llmResponse || !llmResponse.classification) {
      return { valid: false, classification: null };
    }

    const classification = llmResponse.classification.trim();

    // Exact match (case-insensitive)
    const normalizedCategories = allowedCategories.map(c => c.toLowerCase().trim());
    const normalizedResponse = classification.toLowerCase().trim();

    if (normalizedCategories.includes(normalizedResponse)) {
      // Return the original category format from allowedCategories
      const originalCategory = allowedCategories[normalizedCategories.indexOf(normalizedResponse)];
      return { valid: true, classification: originalCategory };
    }

    const sanitizedResponse = this.sanitizeCategoryLabel(classification).toLowerCase();
    if (normalizedCategories.includes(sanitizedResponse)) {
      const originalCategory = allowedCategories[normalizedCategories.indexOf(sanitizedResponse)];
      return { valid: true, classification: originalCategory };
    }

    // Log validation error
    console.error('Invalid category classification:', {
      received: classification,
      allowed: allowedCategories
    });

    return { valid: false, classification: null };
  }

  /**
   * Generate cache key
   */
  generateCacheKey(text, categories, categoryHints = {}) {
    const categoriesKey = categories
      .map(c => c.toLowerCase())
      .sort()
      .join(',');

    const hintsKey = Object.keys(categoryHints || {})
      .sort()
      .map(key => `${key.toLowerCase()}:${(categoryHints[key] || '').toLowerCase()}`)
      .join('|');

    return `${text.toLowerCase().trim()}|${categoriesKey}|${hintsKey}`;
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
      maxSize: 5000
    };
  }

  /**
   * Maintain cache size
   */
  maintainCacheSize() {
    const maxSize = 5000;
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

module.exports = CategoryClassifier;
