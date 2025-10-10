# Concurrent Processing Support Plan

## Overview
This plan outlines the architectural changes needed to support concurrent processing of location, sentiment, and classification modes with independent UI components for each mode.

## Current Issues Identified
- Shared UI components cause result overwriting
- Single statistics panel for all modes
- Common results section that gets cleared
- Single download button
- No visual indication of multiple active processes

## Proposed Architecture

### 1. Mode-Specific Component Structure

#### HTML Structure Changes
```
container
├── input-section (shared)
├── mode-results-container
│   ├── location-results-panel
│   │   ├── location-stats-panel
│   │   ├── location-status-section
│   │   ├── location-results-section
│   │   └── location-download-section
│   ├── sentiment-results-panel
│   │   ├── sentiment-stats-panel
│   │   ├── sentiment-status-section
│   │   ├── sentiment-results-section
│   │   └── sentiment-download-section
│   └── category-results-panel
│       ├── category-stats-panel
│       ├── category-status-section
│       ├── category-results-section
│       └── category-download-section
```

#### Component Naming Convention
- Prefix all mode-specific elements with mode name:
  - `location-stats-panel`, `sentiment-stats-panel`, `category-stats-panel`
  - `location-results-section`, `sentiment-results-section`, `category-results-section`
  - `location-progress-bar`, `sentiment-progress-bar`, `category-progress-bar`

### 2. State Management Architecture

#### Global State Object
```javascript
const modeStates = {
    location: {
        isActive: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null
    },
    sentiment: {
        isActive: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null
    },
    category: {
        isActive: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null
    }
};
```

#### Session Management
- Each mode gets unique sessionId: `${mode}-${Date.now()}`
- Track active sessions in global state
- Support multiple concurrent SSE connections

### 3. UI Layout Design

#### Tab-Based Results Display
- Keep existing tab navigation for input configuration
- Add results area below tabs with all three panels visible
- Use accordion or card layout for space efficiency
- Active processing panels expand automatically

#### Visual Indicators
- Tab badges showing active status
- Progress bars in each panel
- Color-coded status indicators
- Processing time displays

### 4. CSS Architecture

#### Layout Styles
```css
.mode-results-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    margin-top: 30px;
}

.mode-panel {
    border: 2px solid #e1e4e8;
    border-radius: 12px;
    overflow: hidden;
}

.mode-panel.active {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.mode-panel.processing {
    border-color: #28a745;
    animation: pulse 2s infinite;
}
```

#### Responsive Design
- Stack panels vertically on mobile
- Horizontal scroll on small tablets
- Full-width panels for each mode on mobile

### 5. JavaScript Refactoring Plan

#### Core Functions to Update
1. **displayResults(mode, results)** - Target mode-specific results section
2. **updateStatistics(mode, data)** - Update mode-specific statistics
3. **updateStatus(mode, message, progress)** - Update mode-specific status
4. **showStatus(mode)** - Show mode-specific status section
5. **downloadCSV(mode)** - Download mode-specific results

#### New Functions Needed
1. **initializeModeState(mode)** - Initialize mode state
2. **getModeState(mode)** - Get mode-specific state
3. **setModeState(mode, updates)** - Update mode state
4. **handleModeCompletion(mode, data)** - Handle completion for specific mode
5. **clearModeResults(mode)** - Clear specific mode results

#### Processing Function Updates
- Modify `processSheet()` and `processText()` to accept mode parameter
- Update SSE connection handling to route to correct mode
- Add concurrent session management

### 6. Concurrent Processing Flow

#### User Workflow
1. User configures Location mode and starts processing
2. Location panel becomes active, shows progress
3. User switches to Sentiment tab while location processes
4. User configures Sentiment mode and starts processing
5. Both panels show independent progress
6. User can switch to Category and start third process
7. All three processes run concurrently with independent UI updates

#### Technical Flow
1. Each processing request generates unique sessionId
2. SSE connections established for each active mode
3. Progress updates routed to correct UI components
4. Results stored in mode-specific state arrays
5. Completion triggers mode-specific UI updates

### 7. Implementation Phases

#### Phase 1: HTML Structure
- Create mode-specific panel HTML
- Update element IDs with mode prefixes
- Add responsive grid layout

#### Phase 2: CSS Styling
- Implement panel layout styles
- Add active/processing state styles
- Create responsive breakpoints
- Add transition animations

#### Phase 3: JavaScript State Management
- Implement mode state object
- Create state management functions
- Update existing functions to use mode parameters

#### Phase 4: Processing Functions
- Update processing functions for mode-specific UI
- Implement concurrent session handling
- Add mode-specific progress tracking

#### Phase 5: UI Interactions
- Add visual indicators for active states
- Implement mode-specific clear/reset
- Add individual download functionality
- Test concurrent workflows

### 8. Testing Strategy

#### Unit Tests
- Test state management functions
- Test UI update functions
- Test session management

#### Integration Tests
- Test concurrent processing scenarios
- Test UI state consistency
- Test error handling

#### User Testing
- Test workflow with multiple concurrent processes
- Test responsive design on different devices
- Test edge cases (errors, interruptions)

### 9. Performance Considerations

#### Memory Management
- Limit stored results per mode
- Implement cleanup for completed sessions
- Optimize DOM updates for concurrent operations

#### Network Efficiency
- Reuse SSE connections where possible
- Implement request queuing for rate limits
- Add retry logic for failed connections

### 10. Backward Compatibility

- Maintain existing API endpoints
- Keep current single-mode functionality
- Add concurrent mode as enhancement
- Provide fallback for older browsers

## Success Metrics
- Users can run 3+ concurrent processes without UI conflicts
- Each mode maintains independent results and statistics
- Visual indicators clearly show active processing states
- Responsive design works on all device sizes
- No performance degradation with concurrent operations