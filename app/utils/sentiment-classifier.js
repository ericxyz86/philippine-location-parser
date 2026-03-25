/**
 * Sentiment Classifier for Philippine Location Parser
 * Uses GPT-4.1-mini for sentiment classification with strict label validation
 * Supports batch classification (multiple texts per API call) for speed
 */

const OpenAI = require('openai');

const CONCURRENCY = 5;  // Parallel API workers (balanced to avoid 429 rate limits)
const BATCH_SIZE = 30;  // Texts per API call (smaller batches = less token burst)

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
   * Classify sentiment of a single text (backwards-compatible API)
   */
  async classifySentiment(text, entity, sentimentLabels, description = '') {
    if (!this.enabled) {
      return { text, classification: null, confidence: 0, method: 'disabled', reasoning: 'Sentiment classification disabled' };
    }
    if (!entity || !sentimentLabels || sentimentLabels.length === 0) {
      return { text, classification: null, confidence: 0, method: 'validation_error', reasoning: 'Missing required fields: entity and sentimentLabels' };
    }

    // Check cache
    const cacheKey = this.generateCacheKey(text, entity, sentimentLabels);
    if (this.cache.has(cacheKey)) {
      return { ...this.cache.get(cacheKey), cached: true };
    }

    // Use batch method with single item
    const results = await this.classifyBatch([text], entity, sentimentLabels, description);
    return results[0];
  }

  /**
   * Classify a batch of texts in one API call (up to BATCH_SIZE)
   * Returns array of classification results in same order as input
   */
  async classifyBatch(texts, entity, sentimentLabels, description = '') {
    if (!this.enabled) {
      return texts.map(text => ({ text, classification: null, confidence: 0, method: 'disabled', reasoning: 'Disabled' }));
    }

    // Check cache for each text, identify uncached
    const results = new Array(texts.length);
    const uncachedIndices = [];
    const uncachedTexts = [];

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.generateCacheKey(texts[i], entity, sentimentLabels);
      if (this.cache.has(cacheKey)) {
        results[i] = { ...this.cache.get(cacheKey), cached: true };
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    if (uncachedTexts.length === 0) return results;

    // Build batch prompt
    const sanitize = (s) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const numberedTexts = uncachedTexts.map((t, i) => `${i + 1}. ${sanitize(t) || '(empty)'}`).join('\n');

    const prompt = `You are a sentiment classifier for social media text analysis.

TASK: Classify the sentiment of each text below toward the entity "${entity}".
${description ? `\nCONTEXT: ${description}\n` : ''}
ALLOWED LABELS (choose exactly one per text): ${sentimentLabels.join(', ')}

RULES:
1. Return ONLY a JSON array of strings — one label per text, in order.
2. Each label must be EXACTLY one of: ${sentimentLabels.join(', ')}
3. If text doesn't mention the entity, classify overall sentiment.
4. The array must have exactly ${uncachedTexts.length} elements.

TEXTS TO CLASSIFY:
${numberedTexts}

Return ONLY a JSON array like: ["${sentimentLabels[0]}", "${sentimentLabels[1] || sentimentLabels[0]}", ...]`;

    let attempt = 0;
    let lastError = null;

    while (attempt <= this.maxRetries) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: uncachedTexts.length * 20 + 100
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? '';
        const jsonMatch = raw.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          let parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            // Normalize: pad or trim to exact length
            const normalizedLabels = sentimentLabels.map(l => l.toLowerCase().trim());
            while (parsed.length < uncachedTexts.length) parsed.push(sentimentLabels[0]);
            parsed = parsed.slice(0, uncachedTexts.length);

            // Map results back
            for (let j = 0; j < uncachedTexts.length; j++) {
              const label = String(parsed[j]).trim();
              const matchIdx = normalizedLabels.indexOf(label.toLowerCase().trim());
              const validLabel = matchIdx >= 0 ? sentimentLabels[matchIdx] : sentimentLabels[0];

              const result = {
                text: uncachedTexts[j],
                classification: validLabel,
                confidence: matchIdx >= 0 ? 90 : 50,
                method: attempt > 0 ? `llm_batch_retry_${attempt}` : 'llm_batch',
                reasoning: 'Batch classified'
              };

              // Cache it
              const cacheKey = this.generateCacheKey(uncachedTexts[j], entity, sentimentLabels);
              this.cache.set(cacheKey, result);

              results[uncachedIndices[j]] = result;
            }

            this.maintainCacheSize();
            return results;
          }
        }

        lastError = 'Failed to parse batch response as JSON array';
        attempt++;
      } catch (error) {
        console.error(`[Batch attempt ${attempt + 1}/${this.maxRetries + 1}] LLM API error:`, error.message);
        lastError = error.message;
        attempt++;
        if (attempt <= this.maxRetries) {
          // Respect 429 rate limits with longer backoff
          const isRateLimit = error.status === 429 || error.message?.includes('429');
          const backoffMs = isRateLimit ? 5000 * attempt : 1000 * attempt;
          console.log(`  ⏳ Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries exhausted — fill uncached with error
    for (let j = 0; j < uncachedTexts.length; j++) {
      results[uncachedIndices[j]] = {
        text: uncachedTexts[j],
        classification: 'Error: Classification Failed',
        confidence: 0,
        method: 'retry_exhausted',
        reasoning: `Batch failed: ${lastError}`
      };
    }
    return results;
  }

  /**
   * Classify all texts with parallel batched workers (main entry point for large datasets)
   * @param {string[]} allTexts - All texts to classify
   * @param {string} entity - Entity to evaluate sentiment toward
   * @param {string[]} sentimentLabels - Allowed labels
   * @param {string} description - Optional context
   * @param {Function} onProgress - Progress callback(done, total)
   * @returns {Array} Classification results in order
   */
  async classifyAll(allTexts, entity, sentimentLabels, description = '', onProgress = null) {
    if (!this.enabled) {
      return allTexts.map(text => ({ text, classification: null, confidence: 0, method: 'disabled' }));
    }

    // Split into batches
    const batches = [];
    for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
      batches.push({ start: i, texts: allTexts.slice(i, i + BATCH_SIZE) });
    }

    const allResults = new Array(allTexts.length);
    let completedCount = 0;

    // Worker function
    let batchIdx = 0;
    const processBatchWorker = async () => {
      while (batchIdx < batches.length) {
        const myIdx = batchIdx++;
        const batch = batches[myIdx];
        const batchResults = await this.classifyBatch(batch.texts, entity, sentimentLabels, description);

        for (let j = 0; j < batchResults.length; j++) {
          allResults[batch.start + j] = batchResults[j];
        }

        completedCount += batch.texts.length;
        if (onProgress) {
          onProgress(Math.min(completedCount, allTexts.length), allTexts.length);
        }
      }
    };

    // Spawn concurrent workers
    const workerCount = Math.min(CONCURRENCY, batches.length);
    const workers = Array.from({ length: workerCount }, () => processBatchWorker());
    await Promise.all(workers);

    return allResults;
  }

  generateCacheKey(text, entity, sentimentLabels) {
    return `${text.toLowerCase().trim()}|${entity.toLowerCase().trim()}|${sentimentLabels.map(l => l.toLowerCase()).sort().join(',')}`;
  }

  clearCache() { this.cache.clear(); }

  getCacheStats() {
    return { size: this.cache.size, enabled: this.enabled, maxSize: 5000 };
  }

  maintainCacheSize() {
    const maxSize = 5000;
    if (this.cache.size > maxSize) {
      const entriesToRemove = this.cache.size - maxSize;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }
}

module.exports = SentimentClassifier;
