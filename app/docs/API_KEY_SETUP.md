# OpenAI API Key Setup Instructions

## Quick Setup

1. **Get your OpenAI API Key**
   - Go to https://platform.openai.com/api-keys
   - Sign in or create an account
   - Click "Create new secret key"
   - Copy the key (starts with `sk-...`)

2. **Configure the API Key**
   - Open the `.env` file in this directory
   - Replace `your_openai_api_key_here` with your actual API key
   - Save the file

   Example:
   ```
   OPENAI_API_KEY=sk-proj-abcd1234...your-actual-key-here
   ```

3. **Start the Server**
   ```bash
   node server-v5.js
   ```

## How the API Key is Used

- The API key is stored in the `.env` file (not tracked by git)
- It's loaded using the `dotenv` package when the server starts
- The key is used by `llm-validator.js` to call GPT-4o-mini for location validation
- If no API key is provided, the system falls back to rule-based parsing only

## Security Notes

- **NEVER** commit the `.env` file to git (it's in `.gitignore`)
- **NEVER** share your API key publicly
- The `.env.example` file shows the structure without real keys
- Keep your API key secure and rotate it regularly

## Cost Information

- GPT-4o-mini costs approximately $0.00015 per 1K input tokens
- Each validation request uses ~200 tokens
- Processing 1000 comments costs approximately $0.03 USD
- The system includes caching to minimize API calls

## Troubleshooting

If LLM validation isn't working:

1. Check if the API key is correctly set in `.env`
2. Verify the key starts with `sk-`
3. Check server logs for "LLM validation: ENABLED" message
4. Ensure you have credits in your OpenAI account

## Testing the Setup

After configuring the API key, test it by:

1. Starting the server: `node server-v5.js`
2. Opening http://localhost:3002
3. Testing with: "I'm from Quezon City"
4. Check if "method: llm_validated" appears in results