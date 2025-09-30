/**
 * Batch Processor for Parallel Location Extraction
 * Provides concurrent processing with rate limiting
 */

/**
 * Process texts in parallel batches with concurrency control
 * @param {Array<string>} texts - Array of texts to process
 * @param {Function} processFn - Processing function for each text
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Results array
 */
async function processBatch(texts, processFn, options = {}) {
  const {
    batchSize = 5,           // Process 5 items concurrently
    useLLM = true,
    onProgress = null,       // Progress callback
    abortSignal = null       // AbortController signal for cancellation
  } = options;

  const results = [];
  const totalTexts = texts.length;
  let processedCount = 0;

  console.log(`📊 Starting batch processing: ${totalTexts} texts in batches of ${batchSize}`);
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < totalTexts; i += batchSize) {
    // Check for abort signal
    if (abortSignal && abortSignal.aborted) {
      console.log('❌ Batch processing aborted');
      break;
    }

    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalTexts / batchSize);

    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

    // Process batch items in parallel
    const batchPromises = batch.map(async (text, index) => {
      const itemIndex = i + index;
      try {
        const result = await processFn(text, useLLM);
        processedCount++;

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            current: processedCount,
            total: totalTexts,
            percentage: Math.round((processedCount / totalTexts) * 100),
            result
          });
        }

        return { success: true, result, index: itemIndex };
      } catch (error) {
        console.error(`❌ Error processing item ${itemIndex + 1}: ${error.message}`);
        return {
          success: false,
          error: error.message,
          index: itemIndex,
          result: {
            text,
            location: null,
            error: error.message,
            method: 'error'
          }
        };
      }
    });

    // Wait for all items in batch to complete
    const batchResults = await Promise.allSettled(batchPromises);

    // Process results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[i + index] = result.value.result;
      } else {
        // Handle rejected promises
        results[i + index] = {
          text: batch[index],
          location: null,
          error: result.reason,
          method: 'error'
        };
      }
    });

    // Log batch completion
    const batchTime = Date.now() - startTime;
    const avgTimePerItem = Math.round(batchTime / processedCount);
    console.log(`✅ Batch ${batchNum} complete (avg: ${avgTimePerItem}ms/item)`);
  }

  const totalTime = Date.now() - startTime;
  const avgTime = Math.round(totalTime / totalTexts);

  console.log('\n═'.repeat(50));
  console.log(`✨ Batch processing complete!`);
  console.log(`  Total: ${totalTexts} texts`);
  console.log(`  Time: ${totalTime}ms (avg: ${avgTime}ms/item)`);
  console.log(`  Speedup: ${batchSize}x parallel processing`);
  console.log('═'.repeat(50));

  return results;
}

/**
 * Process texts with smart batching based on content
 * Groups similar texts for better LLM efficiency
 */
async function processSmartBatch(texts, processFn, options = {}) {
  const {
    batchSize = 5,
    groupBySimilarity = true,
    useLLM = true
  } = options;

  // Group texts by characteristics for better batching
  if (groupBySimilarity) {
    const groups = groupTextsByCharacteristics(texts);
    const results = new Array(texts.length);

    for (const group of groups) {
      const groupResults = await processBatch(
        group.texts,
        processFn,
        { ...options, batchSize }
      );

      // Place results back in original order
      group.indices.forEach((originalIndex, i) => {
        results[originalIndex] = groupResults[i];
      });
    }

    return results;
  }

  return processBatch(texts, processFn, options);
}

/**
 * Group texts by characteristics for optimized processing
 */
function groupTextsByCharacteristics(texts) {
  const groups = {
    veryShort: { texts: [], indices: [] },      // < 20 chars
    shortNoLocation: { texts: [], indices: [] }, // Short, likely no location
    withMentions: { texts: [], indices: [] },    // Contains @mentions
    withLocation: { texts: [], indices: [] },    // Likely has location
    complex: { texts: [], indices: [] }          // Long or complex texts
  };

  texts.forEach((text, index) => {
    if (!text || text.length < 20) {
      groups.veryShort.texts.push(text);
      groups.veryShort.indices.push(index);
    } else if (text.includes('@') || text.includes('#')) {
      groups.withMentions.texts.push(text);
      groups.withMentions.indices.push(index);
    } else if (/\b(city|province|barangay|brgy|manila|cebu|davao)\b/i.test(text)) {
      groups.withLocation.texts.push(text);
      groups.withLocation.indices.push(index);
    } else if (text.length < 50) {
      groups.shortNoLocation.texts.push(text);
      groups.shortNoLocation.indices.push(index);
    } else {
      groups.complex.texts.push(text);
      groups.complex.indices.push(index);
    }
  });

  // Return non-empty groups
  return Object.values(groups).filter(g => g.texts.length > 0);
}

/**
 * Estimate processing time based on text characteristics
 */
function estimateProcessingTime(texts, useLLM = true) {
  const baseTimePerText = 50;  // ms for rule-based
  const llmTimePerText = 300;  // ms for LLM validation
  const batchSize = 5;

  let estimatedTime = 0;
  let llmCount = 0;

  texts.forEach(text => {
    if (!text || text.length < 10) {
      estimatedTime += 10; // Very fast for empty/short
    } else if (useLLM && text.length > 30 && !/@\w+/.test(text)) {
      estimatedTime += llmTimePerText / batchSize; // Parallel LLM
      llmCount++;
    } else {
      estimatedTime += baseTimePerText;
    }
  });

  return {
    estimatedMs: Math.round(estimatedTime),
    estimatedSeconds: (estimatedTime / 1000).toFixed(1),
    llmCalls: llmCount,
    parallelSpeedup: batchSize
  };
}

module.exports = {
  processBatch,
  processSmartBatch,
  groupTextsByCharacteristics,
  estimateProcessingTime
};