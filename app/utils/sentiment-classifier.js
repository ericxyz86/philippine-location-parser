/**
 * Sentiment Classifier for Philippine Location Parser
 * Uses GPT-4o-mini for sentiment classification with strict label validation
 * Supports custom entities and sentiment labels
 */

const OpenAI = require('openai');

class SentimentClassifier {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided. Sentiment classification will be disabled.');
      this.enabled = false;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.enabled = true;
    this.cache = new Map();
    this.maxRetries = 2;
  }

  /**
   * Classify sentiment of text toward specified entity
   * @param {string} text - Text to classify
   * @param {string} entity - Entity to evaluate sentiment toward (e.g., "PLDT Home")
   * @param {string[]} sentimentLabels - Allowed sentiment labels (e.g., ["Positive", "Neutral", "Negative"])
   * @param {string} description - Classification description for context
   * @returns {Object} Classification result
   */
  async classifySentiment(text, entity, sentimentLabels, description = '') {
    if (!this.enabled) {
      return {
        text,
        classification: null,
        confidence: 0,
        method: 'disabled',
        reasoning: 'Sentiment classification disabled'
      };
    }

    // Validate inputs
    if (!entity || !sentimentLabels || sentimentLabels.length === 0) {
      return {
        text,
        classification: null,
        confidence: 0,
        method: 'validation_error',
        reasoning: 'Missing required fields: entity and sentimentLabels'
      };
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(text, entity, sentimentLabels);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return { ...cached, cached: true };
    }

    // Attempt classification with retry logic
    let attempt = 0;
    let lastError = null;

    while (attempt <= this.maxRetries) {
      try {
        const prompt = this.buildSentimentPrompt(text, entity, sentimentLabels, description, attempt);
        const response = await this.callGPT4oMini(prompt);

        // Validate the classification
        const validation = this.validateSentimentClassification(response, sentimentLabels);

        if (validation.valid) {
          const result = {
            text,
            classification: validation.classification,
            confidence: response.confidence || 90,
            method: attempt > 0 ? `llm_retry_${attempt}` : 'llm_classified',
            reasoning: response.reasoning || 'Sentiment classified successfully'
          };

          // Cache the result
          this.cache.set(cacheKey, result);
          this.maintainCacheSize();

          return result;
        }

        // Invalid classification - retry
        lastError = `Invalid classification: received "${response.classification}", expected one of: ${sentimentLabels.join(', ')}`;
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
   * Build sentiment classification prompt
   */
  buildSentimentPrompt(text, entity, sentimentLabels, description, retryAttempt = 0) {
    const strictnessNote = retryAttempt > 0
      ? '\n\n⚠️ CRITICAL: Your previous response was invalid. You MUST return EXACTLY one of the allowed labels.'
      : '';

    return `You are a sentiment classifier for social media text analysis.

TASK: Classify the sentiment of the text toward the entity "${entity}".

${description ? `CONTEXT: ${description}\n` : ''}
STRICT RULES:
1. Return ONLY ONE of these labels: ${sentimentLabels.join(', ')}
2. Do not add any other text, explanation, or labels
3. Do not create variations or similar labels
4. If text doesn't mention the entity, classify the overall sentiment
5. Your response must be EXACTLY one of the provided labels (case-insensitive matching)${strictnessNote}

TEXT TO CLASSIFY: "${text}"

ALLOWED LABELS (choose exactly one): ${sentimentLabels.join(', ')}

Return your classification as a JSON object with this EXACT format:
{
  "classification": "one of the allowed labels",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}

IMPORTANT: The "classification" field must contain ONLY one of these exact labels: ${sentimentLabels.join(', ')}`;
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
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  }

  /**
   * Validate sentiment classification against allowed labels
   */
  validateSentimentClassification(llmResponse, allowedLabels) {
    if (!llmResponse || !llmResponse.classification) {
      return { valid: false, classification: null };
    }

    const classification = llmResponse.classification.trim();

    // Exact match (case-insensitive)
    const normalizedLabels = allowedLabels.map(l => l.toLowerCase().trim());
    const normalizedResponse = classification.toLowerCase().trim();

    if (normalizedLabels.includes(normalizedResponse)) {
      // Return the original label format from allowedLabels
      const originalLabel = allowedLabels[normalizedLabels.indexOf(normalizedResponse)];
      return { valid: true, classification: originalLabel };
    }

    // Log validation error
    console.error('Invalid sentiment classification:', {
      received: classification,
      allowed: allowedLabels
    });

    return { valid: false, classification: null };
  }

  /**
   * Generate cache key
   */
  generateCacheKey(text, entity, sentimentLabels) {
    return `${text.toLowerCase().trim()}|${entity.toLowerCase().trim()}|${sentimentLabels.map(l => l.toLowerCase()).sort().join(',')}`;
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

module.exports = SentimentClassifier;
