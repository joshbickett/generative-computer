import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..');
const FRONTEND_SRC = join(REPO_ROOT, 'frontend/src');
const GENERATED_CONTENT_PATH = join(FRONTEND_SRC, 'components/GeneratedContent.tsx');

export async function invokeGeminiAgent(userCommand) {
  return new Promise((resolve, reject) => {
    console.log('🤖 Invoking Gemini agent...');
    console.log('📝 User command:', userCommand);

    // Construct the prompt for the Gemini CLI agent
    const systemPrompt = `You are an AI coding agent integrated with a React application called "Open Imagine".

CRITICAL CONSTRAINTS:
1. You can ONLY modify files in: ${FRONTEND_SRC}/components/
2. You MUST preserve these protected files exactly as they are:
   - CommandInput.tsx (the user input component)
   - CommandInput.css
   - Desktop.tsx
   - Desktop.css
   - Window.tsx
   - Window.css
3. You can ONLY modify GeneratedContent.tsx
4. The GeneratedContent.tsx file MUST always export a default function called "GeneratedContent"

YOUR TASK:
The user said: "${userCommand}"

Convert this request into a TODO LIST format and update GeneratedContent.tsx.

RULES FOR TODO LISTS:
- If user asks for a blog post → Create "Todo list for writing a blog post"
- If user asks for code → Create "Todo list for implementing that code"
- If user asks for a recipe → Create "Todo list of recipe steps"
- If user asks for anything → Convert it to a todo list format

Make it engaging, well-formatted, and use proper React/TypeScript syntax with inline styles.
The content should look good in a desktop window.

Now, please modify ONLY the GeneratedContent.tsx file.`;

    // Path to the gemini CLI script
    const geminiScript = join(REPO_ROOT, 'scripts/start.js');

    // Invoke Gemini CLI with the prompt
    const gemini = spawn('node', [
      geminiScript,
      '-p',
      systemPrompt,
      '--output-format',
      'text',
      '--working-directory',
      FRONTEND_SRC
    ], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    gemini.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📤 Gemini output:', text);
    });

    gemini.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error('⚠️  Gemini error:', text);
    });

    gemini.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Gemini agent completed successfully');
        resolve({
          success: true,
          output,
          modifiedFile: GENERATED_CONTENT_PATH
        });
      } else {
        console.error('❌ Gemini agent failed with code:', code);
        reject(new Error(`Gemini CLI exited with code ${code}: ${errorOutput}`));
      }
    });

    gemini.on('error', (error) => {
      console.error('❌ Failed to start Gemini agent:', error);
      reject(error);
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      gemini.kill();
      reject(new Error('Gemini agent timed out after 30 seconds'));
    }, 30000);
  });
}

export function getGeneratedContentPath() {
  return GENERATED_CONTENT_PATH;
}

export function getFrontendSrcPath() {
  return FRONTEND_SRC;
}