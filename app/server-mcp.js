require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const {
  HierarchicalLocationParserV2
} = require('./parsers/hierarchical-parser-v2');
const {
  normalizeLocation,
  formatNormalizedLocation
} = require('./parsers/location-normalizer');
const {
  createEmptyLocation,
  normalizeLocationFields,
  hasLocationData
} = require('./parsers/location-parser-v5');
const LLMExtractor = require('./utils/llm-extractor');

const SERVER_VERSION = '1.0.0';

const server = new McpServer({
  name: 'philippine-location-parser',
  version: SERVER_VERSION
});

const hierarchicalParser = new HierarchicalLocationParserV2();
const llmExtractor = new LLMExtractor(process.env.OPENAI_API_KEY);

function parseWithRuleBased(text) {
  const rawLocation = hierarchicalParser.parseLocation(text);
  const normalized = rawLocation
    ? normalizeLocation(rawLocation)
    : createEmptyLocation();

  return {
    text,
    location: normalized,
    formatted: formatNormalizedLocation(normalized),
    hasLocation: hasLocationData(normalized),
    method: rawLocation ? 'rule_based_match' : 'rule_based_no_match'
  };
}

async function parseWithLLM(text) {
  const llmResult = await llmExtractor.extractLocation(text);
  const normalizedFields = normalizeLocationFields(llmResult.location);
  const normalized = normalizeLocation(normalizedFields);

  return {
    text,
    location: normalized,
    formatted: formatNormalizedLocation(normalized),
    hasLocation: hasLocationData(normalized),
    confidence: llmResult.confidence ?? 0,
    method: llmResult.method || 'llm_extracted',
    reasoning: llmResult.reasoning || null,
    cached: Boolean(llmResult.cached)
  };
}

server.registerTool(
  'parse_location',
  {
    title: 'Parse Philippine Location',
    description: 'Extract Philippine region, province, city, and barangay from text.',
    inputSchema: z.object({
      text: z.string().min(1, 'text is required'),
      mode: z.enum(['auto', 'v4', 'v5']).default('auto'),
      useLLM: z.boolean().optional().default(true)
    })
  },
  async ({ text, mode, useLLM }) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        content: [{ type: 'text', text: 'Error: text must not be empty.' }],
        isError: true
      };
    }

    const requestedMode = mode || 'auto';
    const allowLLM = useLLM ?? true;
    const effectiveMode =
      requestedMode === 'auto'
        ? allowLLM && llmExtractor.enabled
          ? 'v5'
          : 'v4'
        : requestedMode;

    const startedAt = Date.now();

    try {
      let result;

      if (effectiveMode === 'v5') {
        if (!allowLLM) {
          throw new Error('LLM parsing requested but useLLM=false.');
        }
        if (!llmExtractor.enabled) {
          throw new Error('LLM parsing is disabled. Set OPENAI_API_KEY to enable v5 mode.');
        }

        result = await parseWithLLM(trimmedText);
      } else {
        result = parseWithRuleBased(trimmedText);
      }

      const durationMs = Date.now() - startedAt;
      const response = {
        ...result,
        mode: effectiveMode,
        requestedMode,
        useLLM: allowLLM,
        durationMs
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server ready: philippine-location-parser');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

module.exports = {
  server,
  parseWithRuleBased,
  parseWithLLM,
  llmExtractor,
  main
};
