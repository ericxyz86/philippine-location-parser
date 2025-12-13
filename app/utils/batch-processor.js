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
/**
 * Process texts in parallel with sliding window concurrency
 * Eliminates "straggler" problem by starting new tasks immediately when one finishes
 * @param {Array<string>} texts - Array of texts to process
 * @param {Function} processFn - Processing function for each text
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Results array
 */
async function processBatch(texts, processFn, options = {}) {
  const {
    batchSize = 5,           // Concurrency limit
    useLLM = true,
    onProgress = null,       // Progress callback
    abortSignal = null       // AbortController signal for cancellation
  } = options;

  const totalTexts = texts.length;
  // Initialize results array with proper size
  const results = new Array(totalTexts);
  
  console.log(`📊 Starting optimized batch processing: ${totalTexts} texts (concurrency: ${batchSize})`);
  const startTime = Date.now();

  let currentIndex = 0;
  let activeWorkers = 0;
  let processedCount = 0;
  
  return new Promise((resolve, reject) => {
    // If no texts, resolve immediately
    if (totalTexts === 0) {
      resolve([]);
      return;
    }

    // Function to start next worker
    const next = () => {
      // Check if we need to stop
      if (abortSignal && abortSignal.aborted) {
        // Resolve with what we have so far
        console.log('❌ Batch processing aborted');
        resolve(results); 
        return;
      }

      // If all items processed, resolve
      if (processedCount === totalTexts) {
        const totalTime = Date.now() - startTime;
        const avgTime = Math.round(totalTime / totalTexts);
        
        console.log('\n═'.repeat(50));
        console.log(`✨ Batch processing complete!`);
        console.log(`  Total: ${totalTexts} texts`);
        console.log(`  Time: ${totalTime}ms (avg: ${avgTime}ms/item)`);
        console.log('═'.repeat(50));
        resolve(results);
        return;
      }

      // Start new workers while we have capacity and items left
      while (activeWorkers < batchSize && currentIndex < totalTexts) {
        // Capture current index for this worker
        const index = currentIndex++;
        const text = texts[index];
        activeWorkers++;

        // Log progress occasionally
        if (index % 10 === 0 && index > 0) {
           // Optional verbose logging
        }

        // Execute task
        processFn(text, useLLM)
          .then(result => {
             results[index] = result;
             processedCount++;
             
             if (onProgress) {
               onProgress({
                 current: processedCount,
                 total: totalTexts,
                 percentage: Math.round((processedCount / totalTexts) * 100),
                 result
               });
             }
          })
          .catch(error => {
             console.error(`❌ Error processing item ${index + 1}: ${error.message}`);
             results[index] = {
                text,
                location: null,
                error: error.message,
                method: 'error'
             };
             processedCount++;
          })
          .finally(() => {
             activeWorkers--;
             // Trigger next task since a slot opened up
             next();
          });
      }
    };

    // Kick off initial set of workers
    next();
  });
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