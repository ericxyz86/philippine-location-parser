# Philippine Location Parser - Architectural Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[Web Interface<br/>index.html + app-v4.js]
        API_KEY[API Key Management<br/>Browser Storage]
    end
    
    subgraph "API Gateway Layer"
        V4_SERVER[Server V4<br/>Rule-based<br/>Port 3002]
        V5_SERVER[Server V5<br/>LLM-first<br/>Port 3002]
    end
    
    subgraph "Processing Layer"
        V4_PARSER[V4 Parser<br/>Pattern Matching]
        V5_PARSER[V5 Parser<br/>LLM Utilities]
        HIERARCHICAL[Hierarchical Parser V2<br/>Advanced Patterns]
        LLM_EXTRACTOR[LLM Extractor<br/>GPT-4o-mini Integration]
    end
    
    subgraph "Utility Layer"
        NORMALIZER[Location Normalizer<br/>Format Standardization]
        CACHE[Cache Manager<br/>LRU + TTL]
        BATCH[Batch Processor<br/>Parallel Processing]
        CONTEXT[Context Detector<br/>False Positive Filter]
        SHEET[Sheet Parser<br/>Excel/Google Sheets]
    end
    
    subgraph "Data Layer"
        V4_DB[Location DB V4<br/>5.5MB JSON]
        V5_DB[Location DB V5<br/>6.9MB JSON]
        PSGC_API[PSGC API<br/>Philippine Geographic Codes]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API<br/>GPT-4o-mini]
        GOOGLE_SHEETS[Google Sheets API]
    end
    
    UI --> V4_SERVER
    UI --> V5_SERVER
    API_KEY --> V5_SERVER
    
    V4_SERVER --> V4_PARSER
    V5_SERVER --> V5_PARSER
    V5_SERVER --> LLM_EXTRACTOR
    
    V4_PARSER --> HIERARCHICAL
    V5_PARSER --> HIERARCHICAL
    
    HIERARCHICAL --> NORMALIZER
    LLM_EXTRACTOR --> NORMALIZER
    
    V4_PARSER --> V4_DB
    V5_PARSER --> V5_DB
    
    V5_SERVER --> CACHE
    V5_SERVER --> BATCH
    V5_SERVER --> CONTEXT
    V5_SERVER --> SHEET
    
    LLM_EXTRACTOR --> OPENAI
    SHEET --> GOOGLE_SHEETS
    NORMALIZER --> PSGC_API
```

## Dual-Mode Processing Flow

```mermaid
flowchart TD
    START[Input Text] --> MODE_CHECK{Operating Mode?}
    
    MODE_CHECK -->|V4 Rule-based| V4_FLOW[V4 Processing Flow]
    MODE_CHECK -->|V5 LLM-first| V5_FLOW[V5 Processing Flow]
    
    subgraph "V4 Processing Flow"
        V4_FLOW --> V4_PREPROCESS[Preprocess Text<br/>Expand abbreviations<br/>Handle hashtags]
        V4_PREPROCESS --> V4_EXTRACT[Extract Candidates<br/>Pattern matching<br/>Filipino/English support]
        V4_EXTRACT --> V4_MATCH[Find Best Match<br/>Fuzzy scoring<br/>Context validation]
        V4_MATCH --> V4_NORMALIZE[Normalize Location<br/>Proper case<br/>Standard formatting]
        V4_NORMALIZE --> V4_RESULT[Return Location<br/>~10-50ms]
    end
    
    subgraph "V5 Processing Flow"
        V5_FLOW --> V5_CACHE_CHECK{Cache Hit?}
        V5_CACHE_CHECK -->|Yes| V5_CACHE_RETURN[Return Cached Result]
        V5_CACHE_CHECK -->|No| V5_PREFILTER{Should Skip LLM?}
        V5_PREFILTER -->|Yes| V5_EMPTY[Return Empty Location]
        V5_PREFILTER -->|No| V5_LLM[LLM Extraction<br/>GPT-4o-mini<br/>Cascading inference]
        V5_LLM --> V5_NORMALIZE[Normalize Location<br/>Standard formatting]
        V5_NORMALIZE --> V5_CACHE_STORE[Store in Cache]
        V5_CACHE_STORE --> V5_RESULT[Return Location<br/>~500-2000ms]
    end
    
    V4_RESULT --> END[Final Result]
    V5_CACHE_RETURN --> END
    V5_EMPTY --> END
    V5_RESULT --> END
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Server
    participant Parser
    participant LLM
    participant Database
    participant Cache
    
    User->>UI: Submit text for parsing
    UI->>Server: POST /api/parse-text
    Server->>Parser: parseLocation(text)
    
    alt V4 Mode
        Parser->>Database: Query location database
        Database-->>Parser: Return matches
        Parser->>Parser: Pattern matching & scoring
        Parser-->>Server: Return location
    else V5 Mode
        Parser->>Cache: Check cache
        alt Cache Hit
            Cache-->>Parser: Return cached result
        else Cache Miss
            Parser->>LLM: extractLocation(text)
            LLM-->>Parser: Return extracted location
            Parser->>Cache: Store result
        end
        Parser-->>Server: Return location
    end
    
    Server->>Server: Normalize location format
    Server-->>UI: Return formatted result
    UI-->>User: Display location
```

## Component Interaction Diagram

```mermaid
graph LR
    subgraph "Core Components"
        A[Location Parser V4]
        B[Location Parser V5]
        C[Hierarchical Parser V2]
        D[LLM Extractor]
    end
    
    subgraph "Supporting Utilities"
        E[Location Normalizer]
        F[Context Detector]
        G[Batch Processor]
        H[Cache Manager]
        I[Sheet Parser]
    end
    
    subgraph "Data Sources"
        J[Location Database V4]
        K[Location Database V5]
        L[OpenAI API]
        M[Google Sheets API]
    end
    
    A --> C
    B --> C
    B --> D
    C --> E
    D --> E
    
    A --> J
    B --> K
    D --> L
    I --> M
    
    B --> F
    B --> G
    B --> H
    B --> I
    
    F --> E
    G --> E
    H --> E
    I --> E
```

## Multi-Sheet Processing Flow

```mermaid
flowchart TD
    START[File Upload/URL Input] --> DETECT{File Type?}
    
    DETECT -->|Google Sheets| GS_FLOW[Google Sheets Flow]
    DETECT -->|Excel File| EXCEL_FLOW[Excel Flow]
    DETECT -->|CSV File| CSV_FLOW[CSV Flow]
    
    subgraph "Google Sheets Flow"
        GS_FLOW --> GS_DETECT[Detect Sheets<br/>API call to get tabs]
        GS_DETECT --> GS_SELECT[Display Sheet Selector]
        GS_SELECT --> GS_EXPORT[Export as CSV<br/>Selected sheet + gid]
        GS_EXPORT --> CSV_PARSE
    end
    
    subgraph "Excel Flow"
        EXCEL_FLOW --> EXCEL_UPLOAD[Upload File<br/>Multer processing]
        EXCEL_UPLOAD --> EXCEL_DETECT[Detect Sheets<br/>XLSX library]
        EXCEL_DETECT --> EXCEL_SELECT[Display Sheet Selector]
        EXCEL_SELECT --> EXCEL_PARSE[Parse Selected Sheet<br/>Extract column data]
        EXCEL_PARSE --> TEXT_ARRAY[Array of texts]
    end
    
    subgraph "CSV Flow"
        CSV_FLOW --> CSV_PARSE[Parse CSV<br/>Extract column range]
    end
    
    CSV_PARSE --> TEXT_ARRAY
    TEXT_ARRAY --> BATCH_PROCESS[Batch Processing<br/>Parallel execution]
    BATCH_PROCESS --> RESULTS[Location Results]
    RESULTS --> EXPORT[Export CSV<br/>Single/Multi-column]
```

## Caching Architecture

```mermaid
graph TB
    subgraph "Cache Layer"
        CACHE[Cache Manager<br/>LRU + TTL]
        MEMORY[In-Memory Store<br/>Map-based]
        CLEANUP[Periodic Cleanup<br/>Every 5 minutes]
    end
    
    subgraph "Cache Operations"
        GENERATE[Generate Key<br/>MD5 hash]
        GET[Get Item<br/>TTL check]
        SET[Set Item<br/>LRU eviction]
        STATS[Cache Statistics<br/>Hit rate tracking]
    end
    
    subgraph "Cache Flow"
        INPUT[Input Text + Options] --> GENERATE
        GENERATE --> KEY[Cache Key]
        KEY --> GET
        GET -->|Hit| RETURN[Return Cached]
        GET -->|Miss| PROCESS[Process Item]
        PROCESS --> SET
        SET --> KEY
        RETURN --> OUTPUT[Output Result]
        SET --> OUTPUT
    end
    
    CACHE --> MEMORY
    CACHE --> CLEANUP
    CACHE --> STATS
    
    GENERATE --> CACHE
    GET --> CACHE
    SET --> CACHE
```

## API Endpoint Architecture

```mermaid
graph TD
    subgraph "API Gateway"
        GATEWAY[Express.js Server<br/>Port 3002]
        MIDDLEWARE[CORS, JSON Parser<br/>File Upload, Static Files]
    end
    
    subgraph "V4 Endpoints"
        V4_PARSE[POST /api/parse-text<br/>Single text parsing]
        V4_BATCH[POST /api/batch-parse<br/>Multiple texts]
        V4_SHEET[POST /api/process-google-sheet<br/>Sheets integration]
        V4_HEALTH[GET /api/health<br/>Status check]
    end
    
    subgraph "V5 Endpoints"
        V5_PARSE[POST /api/parse-text<br/>With LLM support]
        V5_BATCH[POST /api/batch-parse<br/>Parallel processing]
        V5_SHEET[POST /api/process-google-sheet<br/>Multi-sheet support]
        V5_VALIDATE[POST /api/validate<br/>Location validation]
        V5_STATUS[GET /api/status<br/>System status]
        V5_PROGRESS[GET /api/progress-stream/:id<br/>SSE progress updates]
        V5_DETECT_SHEETS[POST /api/detect-google-sheets<br/>Sheet detection]
        V5_DETECT_EXCEL[POST /api/detect-excel-sheets<br/>Excel sheet detection]
        V5_UPLOAD[POST /api/upload-excel<br/>Excel file processing]
    end
    
    subgraph "Response Processing"
        NORMALIZE[Location Normalization]
        FORMAT[Response Formatting]
        ERROR[Error Handling]
    end
    
    GATEWAY --> MIDDLEWARE
    MIDDLEWARE --> V4_PARSE
    MIDDLEWARE --> V4_BATCH
    MIDDLEWARE --> V4_SHEET
    MIDDLEWARE --> V4_HEALTH
    
    MIDDLEWARE --> V5_PARSE
    MIDDLEWARE --> V5_BATCH
    MIDDLEWARE --> V5_SHEET
    MIDDLEWARE --> V5_VALIDATE
    MIDDLEWARE --> V5_STATUS
    MIDDLEWARE --> V5_PROGRESS
    MIDDLEWARE --> V5_DETECT_SHEETS
    MIDDLEWARE --> V5_DETECT_EXCEL
    MIDDLEWARE --> V5_UPLOAD
    
    V4_PARSE --> NORMALIZE
    V4_BATCH --> NORMALIZE
    V4_SHEET --> NORMALIZE
    
    V5_PARSE --> NORMALIZE
    V5_BATCH --> NORMALIZE
    V5_SHEET --> NORMALIZE
    V5_VALIDATE --> NORMALIZE
    
    NORMALIZE --> FORMAT
    FORMAT --> ERROR
```

## Performance Optimization Architecture

```mermaid
graph TB
    subgraph "Performance Layers"
        INPUT[Input Processing<br/>Pre-filtering]
        PARALLEL[Parallel Processing<br/>Batch execution]
        CACHE_STRATEGY[Caching Strategy<br/>Multi-level]
        OUTPUT[Output Optimization<br/>Streaming]
    end
    
    subgraph "Optimization Techniques"
        PREFILTER[Pre-filtering<br/>Skip obvious non-locations]
        SMART_BATCH[Smart Batching<br/>Group by characteristics]
        LRU_CACHE[LRU Cache<br/>Memory-efficient]
        SSE_STREAM[SSE Streaming<br/>Real-time updates]
    end
    
    subgraph "Performance Metrics"
        THROUGHPUT[Throughput<br/>Items/second]
        LATENCY[Latency<br/>Response time]
        MEMORY[Memory Usage<br/>RAM consumption]
        ACCURACY[Accuracy<br/>Success rate]
    end
    
    INPUT --> PREFILTER
    PARALLEL --> SMART_BATCH
    CACHE_STRATEGY --> LRU_CACHE
    OUTPUT --> SSE_STREAM
    
    PREFILTER --> THROUGHPUT
    SMART_BATCH --> LATENCY
    LRU_CACHE --> MEMORY
    SSE_STREAM --> ACCURACY
```

## Security Architecture

```mermaid
graph TD
    subgraph "Security Layers"
        AUTH[Authentication<br/>API Key Validation]
        INPUT_VALID[Input Validation<br/>Sanitization]
        RATE_LIMIT[Rate Limiting<br/>Abuse Prevention]
        FILE_SECURITY[File Security<br/>Upload validation]
        DATA_PROTECTION[Data Protection<br/>Sensitive info handling]
    end
    
    subgraph "Security Measures"
        KEY_VALIDATION[API Key Format Check<br/>sk- prefix validation]
        INPUT_SANITIZE[Input Sanitization<br/>XSS prevention]
        REQUEST_LIMIT[Request Limiting<br/>Per-client throttling]
        FILE_TYPE_CHECK[File Type Validation<br/>CSV/Excel only]
        ENCRYPTION[Data Encryption<br/>In transit]
    end
    
    subgraph "Security Monitoring"
        LOGGING[Security Logging<br/>Audit trail]
        MONITORING[Monitoring<br/>Anomaly detection]
        ALERTS[Alerts<br/>Security incidents]
    end
    
    AUTH --> KEY_VALIDATION
    INPUT_VALID --> INPUT_SANITIZE
    RATE_LIMIT --> REQUEST_LIMIT
    FILE_SECURITY --> FILE_TYPE_CHECK
    DATA_PROTECTION --> ENCRYPTION
    
    KEY_VALIDATION --> LOGGING
    INPUT_SANITIZE --> MONITORING
    REQUEST_LIMIT --> ALERTS
    FILE_TYPE_CHECK --> LOGGING
    ENCRYPTION --> MONITORING
```

These diagrams provide a comprehensive visual representation of the Philippine Location Parser's architecture, showing how components interact, data flows through the system, and various optimization strategies are implemented. The dual-mode nature of the system is clearly illustrated, along with the sophisticated caching, processing, and security mechanisms that make it a robust solution for location extraction from Philippine text.