# Concurrent Processing Testing Strategy

## Testing Overview

This document outlines the comprehensive testing strategy for implementing concurrent processing support in the Philippine Location Parser application.

## Test Categories

### 1. Unit Tests

#### State Management Tests
```javascript
// Test: initializeModeState
describe('initializeModeState', () => {
    test('should reset mode state to default values', () => {
        // Set initial state
        setModeState('location', { isActive: true, results: [1, 2, 3] });
        
        // Initialize
        initializeModeState('location');
        
        // Verify reset
        const state = getModeState('location');
        expect(state.isActive).toBe(false);
        expect(state.results).toEqual([]);
        expect(state.isProcessing).toBe(false);
    });
    
    test('should handle invalid mode gracefully', () => {
        expect(() => initializeModeState('invalid')).not.toThrow();
    });
});

// Test: setModeState
describe('setModeState', () => {
    test('should update mode state correctly', () => {
        setModeState('sentiment', { isActive: true, progress: 50 });
        
        const state = getModeState('sentiment');
        expect(state.isActive).toBe(true);
        expect(state.progress).toBe(50);
    });
    
    test('should preserve existing state properties', () => {
        setModeState('category', { sessionId: 'test-123' });
        setModeState('category', { progress: 75 });
        
        const state = getModeState('category');
        expect(state.sessionId).toBe('test-123');
        expect(state.progress).toBe(75);
    });
});
```

#### UI Update Tests
```javascript
// Test: updateModeUI
describe('updateModeUI', () => {
    test('should update panel classes based on processing state', () => {
        const panel = document.getElementById('locationPanel');
        
        setModeState('location', { isProcessing: true });
        expect(panel.classList.contains('processing')).toBe(true);
        
        setModeState('location', { isProcessing: false, isActive: true, results: [1] });
        expect(panel.classList.contains('completed')).toBe(true);
    });
    
    test('should update status badge correctly', () => {
        const badge = document.getElementById('sentimentStatusBadge');
        
        setModeState('sentiment', { isProcessing: true });
        expect(badge.textContent).toBe('Processing');
        expect(badge.classList.contains('processing')).toBe(true);
    });
});
```

### 2. Integration Tests

#### Concurrent Processing Tests
```javascript
// Test: Multiple concurrent sessions
describe('Concurrent Processing', () => {
    test('should handle multiple simultaneous processing requests', async () => {
        // Mock fetch responses
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [], processed: 0 })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [], processed: 0 })
            });
        
        // Start location processing
        const locationPromise = processTextWithMode('location');
        
        // Start sentiment processing shortly after
        setTimeout(() => {
            processTextWithMode('sentiment');
        }, 100);
        
        // Wait for both to complete
        await Promise.all([locationPromise]);
        
        // Verify both modes have active states
        expect(getModeState('location').isActive).toBe(true);
        expect(getModeState('sentiment').isActive).toBe(true);
    });
    
    test('should maintain separate SSE connections', async () => {
        const mockEventSource = jest.fn();
        global.EventSource = mockEventSource;
        
        // Start processing for all three modes
        await Promise.all([
            processTextWithMode('location'),
            processTextWithMode('sentiment'),
            processTextWithMode('category')
        ]);
        
        // Verify three EventSource instances were created
        expect(mockEventSource).toHaveBeenCalledTimes(3);
    });
});
```

#### UI State Consistency Tests
```javascript
// Test: UI state consistency
describe('UI State Consistency', () => {
    test('should not interfere with other modes when one completes', () => {
        // Set up all modes as processing
        setModeState('location', { isProcessing: true, progress: 50 });
        setModeState('sentiment', { isProcessing: true, progress: 75 });
        setModeState('category', { isProcessing: true, progress: 25 });
        
        // Complete location processing
        setModeState('location', { 
            isProcessing: false, 
            isActive: true, 
            results: [1, 2, 3],
            progress: 100 
        });
        
        // Verify other modes are unaffected
        expect(getModeState('sentiment').isProcessing).toBe(true);
        expect(getModeState('sentiment').progress).toBe(75);
        expect(getModeState('category').isProcessing).toBe(true);
        expect(getModeState('category').progress).toBe(25);
    });
});
```

### 3. End-to-End Tests

#### User Workflow Tests
```javascript
// Test: Complete user workflow
describe('User Workflow', () => {
    test('should support complete concurrent processing workflow', async () => {
        // 1. User starts location processing
        await fillAndSubmitForm('location', {
            text: 'Test location text\nAnother location',
            apiKey: 'test-key'
        });
        
        // 2. User switches to sentiment tab while location processes
        await switchToTab('sentiment');
        
        // 3. User starts sentiment processing
        await fillAndSubmitForm('sentiment', {
            text: 'Test sentiment text\nAnother sentiment',
            entity: 'Test Entity',
            sentimentLabels: 'Positive, Negative',
            apiKey: 'test-key'
        });
        
        // 4. User switches to category tab
        await switchToTab('category');
        
        // 5. User starts category processing
        await fillAndSubmitForm('category', {
            text: 'Test category text\nAnother category',
            categories: 'Support, Billing, Technical',
            apiKey: 'test-key'
        });
        
        // 6. Wait for all processing to complete
        await waitForProcessingComplete(['location', 'sentiment', 'category']);
        
        // 7. Verify all results are displayed
        expect(document.getElementById('locationResultsSection').children.length).toBeGreaterThan(0);
        expect(document.getElementById('sentimentResultsSection').children.length).toBeGreaterThan(0);
        expect(document.getElementById('categoryResultsSection').children.length).toBeGreaterThan(0);
        
        // 8. Verify download buttons are visible
        expect(document.getElementById('locationDownloadSection').style.display).toBe('block');
        expect(document.getElementById('sentimentDownloadSection').style.display).toBe('block');
        expect(document.getElementById('categoryDownloadSection').style.display).toBe('block');
    });
});
```

### 4. Performance Tests

#### Memory Usage Tests
```javascript
// Test: Memory management
describe('Memory Management', () => {
    test('should not leak memory with multiple concurrent sessions', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Run multiple concurrent processing sessions
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(processTextWithMode('location'));
        }
        
        await Promise.all(promises);
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
});
```

#### Performance Benchmarks
```javascript
// Test: Processing performance
describe('Performance Benchmarks', () => {
    test('should maintain acceptable processing times with concurrent operations', async () => {
        const startTime = Date.now();
        
        // Start three concurrent processes
        const promises = [
            processTextWithMode('location'),
            processTextWithMode('sentiment'),
            processTextWithMode('category')
        ];
        
        await Promise.all(promises);
        
        const totalTime = Date.now() - startTime;
        
        // Concurrent processing should be faster than sequential
        // Allow some overhead for concurrent management
        expect(totalTime).toBeLessThan(15000); // 15 seconds max
    });
});
```

### 5. Error Handling Tests

#### Network Error Tests
```javascript
// Test: Network error handling
describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
        // Mock network error
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        
        // Start processing
        await processTextWithMode('location');
        
        // Verify error state
        const state = getModeState('location');
        expect(state.isProcessing).toBe(false);
        expect(document.getElementById('locationPanel').classList.contains('error')).toBe(true);
    });
    
    test('should handle SSE connection failures', async () => {
        // Mock EventSource failure
        global.EventSource = jest.fn().mockImplementation(() => ({
            onmessage: null,
            onerror: () => {
                // Simulate connection error
            },
            close: jest.fn()
        }));
        
        // Start processing
        await processTextWithMode('sentiment');
        
        // Should still complete processing even without SSE
        const state = getModeState('sentiment');
        expect(state.isProcessing).toBe(false);
    });
});
```

### 6. Cross-Browser Compatibility Tests

#### Browser-Specific Tests
```javascript
// Test: Browser compatibility
describe('Browser Compatibility', () => {
    test('should work in browsers without EventSource support', async () => {
        // Mock no EventSource support
        const originalEventSource = global.EventSource;
        global.EventSource = undefined;
        
        // Should fall back to polling
        await processTextWithMode('location');
        
        // Restore
        global.EventSource = originalEventSource;
        
        // Should still complete processing
        const state = getModeState('location');
        expect(state.isProcessing).toBe(false);
    });
    
    test('should handle different CSS grid support', () => {
        // Test fallback layout for older browsers
        const container = document.getElementById('modeResultsContainer');
        
        // Should apply flexbox fallback if grid not supported
        expect(container.style.display).toBe('flex');
    });
});
```

### 7. Responsive Design Tests

#### Mobile Device Tests
```javascript
// Test: Responsive design
describe('Responsive Design', () => {
    test('should adapt layout for mobile devices', () => {
        // Mock mobile viewport
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 375
        });
        
        // Trigger resize
        window.dispatchEvent(new Event('resize'));
        
        // Verify mobile layout
        const container = document.getElementById('modeResultsContainer');
        expect(container.style.gridTemplateColumns).toBe('1fr');
    });
    
    test('should handle touch interactions on mobile', () => {
        // Test touch events on mobile
        const panel = document.getElementById('locationPanel');
        
        // Should handle touch events
        const touchEvent = new TouchEvent('touchstart');
        panel.dispatchEvent(touchEvent);
        
        // Should not interfere with processing
        expect(getModeState('location')).toBeDefined();
    });
});
```

## Test Data and Mocks

### Mock API Responses
```javascript
// Mock successful processing response
const mockSuccessResponse = {
    success: true,
    mode: 'location',
    processed: 100,
    successful: 85,
    successRate: '85.0',
    llmEnabled: true,
    processingTime: 5000,
    averageTime: 50,
    parallel: true,
    results: [
        {
            text: 'Test text 1',
            location: {
                region: 'National Capital Region (NCR)',
                province: 'Metro Manila',
                city: 'Quezon City',
                barangay: 'None'
            },
            confidence: 95,
            method: 'llm_extracted'
        }
    ]
};

// Mock SSE progress events
const mockProgressEvents = [
    { type: 'started', total: 100, estimatedTime: 10 },
    { type: 'progress', current: 25, total: 100, percentage: 25 },
    { type: 'progress', current: 50, total: 100, percentage: 50 },
    { type: 'progress', current: 75, total: 100, percentage: 75 },
    { type: 'progress', current: 100, total: 100, percentage: 100 },
    { type: 'completed', total: 100, successful: 85 }
];
```

## Test Execution Plan

### Phase 1: Unit Tests
- Run all unit tests
- Target: 100% code coverage for new functions
- Focus: State management and UI updates

### Phase 2: Integration Tests
- Test concurrent processing scenarios
- Verify UI state consistency
- Target: All integration scenarios covered

### Phase 3: End-to-End Tests
- Test complete user workflows
- Verify cross-browser compatibility
- Target: All major user journeys tested

### Phase 4: Performance Tests
- Memory usage monitoring
- Processing time benchmarks
- Target: No performance degradation

### Phase 5: Error Handling Tests
- Network failure scenarios
- Edge cases and boundary conditions
- Target: Graceful error handling

## Test Automation

### Continuous Integration
```yaml
# .github/workflows/test.yml
name: Concurrent Processing Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run e2e tests
      run: npm run test:e2e
    
    - name: Run performance tests
      run: npm run test:performance
    
    - name: Generate coverage report
      run: npm run test:coverage
```

### Test Scripts
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:performance": "node tests/performance/run-tests.js",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

## Success Criteria

### Functional Requirements
- ✅ All three modes can process concurrently
- ✅ Results are preserved independently
- ✅ UI updates don't interfere with each other
- ✅ Error handling works for each mode

### Performance Requirements
- ✅ No memory leaks with concurrent operations
- ✅ Processing times remain acceptable
- ✅ UI remains responsive during concurrent operations

### User Experience Requirements
- ✅ Clear visual indicators for each mode
- ✅ Intuitive workflow for concurrent processing
- ✅ Responsive design works on all devices

### Technical Requirements
- ✅ 100% test coverage for new code
- ✅ Cross-browser compatibility
- ✅ Graceful degradation for older browsers