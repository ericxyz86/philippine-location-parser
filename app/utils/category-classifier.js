/**
 * Category Classifier for Philippine Location Parser
 * Uses GPT-4.1-mini for category classification with strict label validation
 * Supports batch classification (multiple texts per API call) for speed
 */

const OpenAI = require('openai');

const CONCURRENCY = 5;  // Parallel API workers (balanced to avoid 429 rate limits)
const BATCH_SIZE = 30;  // Texts per API call (smaller batches = less token burst)

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
   * Classify a single text (backwards-compatible API)
   */
  async classifyCategory(text, categories, description = '', categoryHints = {}) {
    if (!this.enabled) {
      return { text, classification: null, confidence: 0, method: 'disabled', reasoning: 'Disabled' };
    }
    if (!categories || categories.length === 0) {
      return { text, classification: null, confidence: 0, method: 'validation_error', reasoning: 'Missing categories' };
    }

    const cacheKey = this.generateCacheKey(text, categories, categoryHints);
    if (this.cache.has(cacheKey)) {
      return { ...this.cache.get(cacheKey), cached: true };
    }

    const results = await this.classifyBatch([text], categories, description, categoryHints);
    return results[0];
  }

  /**
   * Classify a batch of texts in one API call
   */
  async classifyBatch(texts, categories, description = '', categoryHints = {}) {
    if (!this.enabled) {
      return texts.map(text => ({ text, classification: null, confidence: 0, method: 'disabled' }));
    }

    // Check cache
    const results = new Array(texts.length);
    const uncachedIndices = [];
    const uncachedTexts = [];

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.generateCacheKey(texts[i], categories, categoryHints);
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

    const hintLines = categories
      .map(c => categoryHints[c] ? `- ${c}: ${categoryHints[c]}` : null)
      .filter(Boolean);
    const hintSection = hintLines.length > 0
      ? `\nCATEGORY HINTS:\n${hintLines.join('\n')}\n`
      : '';

    const prompt = `You are a category classifier for text content organization.

TASK: Classify each text below into one of the provided categories.
${description ? `\nCONTEXT: ${description}\n` : ''}
ALLOWED CATEGORIES: ${categories.join(', ')}
${hintSection}
RULES:
1. Return ONLY a JSON array of strings — one category per text, in order.
2. Each category must be EXACTLY one of: ${categories.join(', ')}
3. Choose the single most relevant category for each text.
4. The array must have exactly ${uncachedTexts.length} elements.

TEXTS TO CLASSIFY:
${numberedTexts}

Return ONLY a JSON array like: ["${categories[0]}", "${categories[1] || categories[0]}", ...]`;

    let attempt = 0;
    let lastError = null;

    while (attempt <= this.maxRetries) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: uncachedTexts.length * 25 + 100
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? '';
        const jsonMatch = raw.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          let parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            const normalizedCategories = categories.map(c => c.toLowerCase().trim());
            while (parsed.length < uncachedTexts.length) parsed.push(categories[0]);
            parsed = parsed.slice(0, uncachedTexts.length);

            for (let j = 0; j < uncachedTexts.length; j++) {
              const label = String(parsed[j]).trim();
              const matchIdx = normalizedCategories.indexOf(label.toLowerCase().trim());
              const validLabel = matchIdx >= 0 ? categories[matchIdx] : categories[0];

              const result = {
                text: uncachedTexts[j],
                classification: validLabel,
                confidence: matchIdx >= 0 ? 90 : 50,
                method: attempt > 0 ? `llm_batch_retry_${attempt}` : 'llm_batch',
                reasoning: 'Batch classified'
              };

              const cacheKey = this.generateCacheKey(uncachedTexts[j], categories, categoryHints);
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
          const isRateLimit = error.status === 429 || error.message?.includes('429');
          const backoffMs = isRateLimit ? 5000 * attempt : 1000 * attempt;
          console.log(`  ⏳ Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries exhausted
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
   * Classify all texts with parallel batched workers
   */
  async classifyAll(allTexts, categories, description = '', categoryHints = {}, onProgress = null) {
    if (!this.enabled) {
      return allTexts.map(text => ({ text, classification: null, confidence: 0, method: 'disabled' }));
    }

    const batches = [];
    for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
      batches.push({ start: i, texts: allTexts.slice(i, i + BATCH_SIZE) });
    }

    const allResults = new Array(allTexts.length);
    let completedCount = 0;

    let batchIdx = 0;
    const processBatchWorker = async () => {
      while (batchIdx < batches.length) {
        const myIdx = batchIdx++;
        const batch = batches[myIdx];
        const batchResults = await this.classifyBatch(batch.texts, categories, description, categoryHints);

        for (let j = 0; j < batchResults.length; j++) {
          allResults[batch.start + j] = batchResults[j];
        }

        completedCount += batch.texts.length;
        if (onProgress) {
          onProgress(Math.min(completedCount, allTexts.length), allTexts.length);
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY, batches.length);
    const workers = Array.from({ length: workerCount }, () => processBatchWorker());
    await Promise.all(workers);

    return allResults;
  }

  generateCacheKey(text, categories, categoryHints = {}) {
    const catKey = categories.map(c => c.toLowerCase()).sort().join(',');
    const hintsKey = Object.keys(categoryHints || {}).sort().map(k => `${k.toLowerCase()}:${(categoryHints[k] || '').toLowerCase()}`).join('|');
    return `${text.toLowerCase().trim()}|${catKey}|${hintsKey}`;
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

module.exports = CategoryClassifier;
