/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env node */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..');
const FRONTEND_SRC = join(REPO_ROOT, 'frontend/src');
const COMPONENTS_DIR = join(FRONTEND_SRC, 'components');
const GENERATED_CONTENT_PATH = join(COMPONENTS_DIR, 'GeneratedContent.tsx');
const GEMINI_BUNDLE = join(REPO_ROOT, 'bundle', 'gemini.js');
const LOG_DIR = join(REPO_ROOT, 'logs', 'agent');
const DEBUG_AGENT = process.env.DEBUG_AGENT === 'true';

function ensureNodeVersion() {
  const [major] = process.versions.node.split('.');
  const majorNumber = Number(major);
  if (!Number.isFinite(majorNumber) || majorNumber < 20) {
    throw new Error(
      `Gemini agent requires Node.js 20+. Detected ${process.versions.node}. Run 'nvm use 20' (or equivalent) before starting the backend.`,
    );
  }
}

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.warn('⚠️  Unable to create agent log directory:', error);
  }
}

async function writeDebugLog(filename, contents) {
  if (!DEBUG_AGENT) return null;
  try {
    await ensureLogDir();
    const filePath = join(LOG_DIR, filename);
    await fs.writeFile(filePath, contents, 'utf-8');
    console.log(`🪵 Agent debug log written to ${filePath}`);
    return filePath;
  } catch (error) {
    console.warn('⚠️  Failed to write agent debug log:', error);
    return null;
  }
}

export async function invokeGeminiAgent(userCommand) {
  ensureNodeVersion();

  console.log('🤖 Invoking Gemini agent...');
  console.log('📝 User command:', userCommand);

  const systemPrompt = `You are an AI coding agent helping power the "Open Imagine" React experience.

CRITICAL CONSTRAINTS:
1. You can ONLY modify files under: ${COMPONENTS_DIR}
2. The following files must remain untouched:
   - CommandInput.tsx / CommandInput.css
   - Desktop.tsx / Desktop.css
   - Window.tsx / Window.css
3. GeneratedContent.tsx must always exist in the same folder, export default function GeneratedContent, and continue rendering the user's desktop window.
4. Never remove, hide, or disable the command input text box rendered by CommandInput.
5. Default to a vibrant TODO-list presentation, but if the user explicitly requests another layout (e.g. ASCII art, desk widgets, poems), honor that request while keeping the desktop aesthetic upbeat.

REQUEST:
The user said: "${userCommand}".
Translate this into a compelling desktop-style TODO window by editing GeneratedContent.tsx only.

STRUCTURE GUIDELINES:
- Use semantic HTML elements inside JSX.
- Include a title, a short description citing the original request, and (when applicable) a list of actionable todo items.
- Feel free to add subtle styling (inline styles are fine) that fits within the retro desktop aesthetic.
- Avoid importing new modules; rely on React and inline styles.

When finished, print the single word DONE as the final line of your response.`;

  let existingContent = '';
  try {
    existingContent = await fs.readFile(GENERATED_CONTENT_PATH, 'utf-8');
  } catch (error) {
    console.warn('⚠️  Unable to read current GeneratedContent.tsx:', error);
  }

  const promptWithContext = `${systemPrompt}

The current contents of GeneratedContent.tsx are:
\n\`\`\`tsx
${existingContent}
\`\`\`

Please apply the requested update and include DONE at the very end.`;

  await fs.access(GEMINI_BUNDLE).catch(() => {
    throw new Error(
      'Gemini CLI bundle missing. Run `npm run build` in the project root.',
    );
  });

  const args = [
    GEMINI_BUNDLE,
    '--yolo',
    '--prompt',
    promptWithContext,
    '--output-format',
    'text',
  ];

  return new Promise((resolve, reject) => {
    const gemini = spawn('node', args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NODE_NO_WARNINGS: '1',
      },
    });

    let output = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      gemini.kill();
      reject(new Error('Gemini agent timed out after 45 seconds'));
    }, 45000);

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

    gemini.on('close', async (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        const trimmedOutput = output.trim();

        if (/Error when talking to Gemini API/i.test(errorOutput)) {
          const logPath = await writeDebugLog(
            `${new Date().toISOString().replace(/[:.]/g, '-')}-api-error.log`,
            `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout:\n${output}\n\nStderr:\n${errorOutput}\n`,
          );
          const error = new Error(
            'Gemini API reported an error while processing the command.',
          );
          if (logPath) error.debugLogPath = logPath;
          reject(error); // triggers fallback
          return;
        }

        if (!trimmedOutput) {
          const logPath = await writeDebugLog(
            `${new Date().toISOString().replace(/[:.]/g, '-')}-empty-output.log`,
            `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout empty.\nStderr:\n${errorOutput}\n`,
          );
          const error = new Error('Gemini agent returned no output.');
          if (logPath) error.debugLogPath = logPath;
          reject(error);
          return;
        }

        if (!/DONE\b/.test(trimmedOutput)) {
          console.warn('⚠️  Gemini agent finished without DONE confirmation.');
        }

        const logPath = await writeDebugLog(
          `${new Date().toISOString().replace(/[:.]/g, '-')}-success.log`,
          `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout:\n${output}\n\nStderr:\n${errorOutput}\n`,
        );

        console.log('✅ Gemini agent completed successfully');
        resolve({
          success: true,
          output,
          modifiedFile: GENERATED_CONTENT_PATH,
          debugLogPath: logPath,
        });
      } else {
        console.error('❌ Gemini agent failed with code:', code);
        const message = errorOutput || output || `Exit code ${code}`;
        const logPath = await writeDebugLog(
          `${new Date().toISOString().replace(/[:.]/g, '-')}-exit-${code}.log`,
          `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout:\n${output}\n\nStderr:\n${errorOutput}\n`,
        );
        const error = new Error(
          `Gemini CLI exited with code ${code}: ${message.trim()}`,
        );
        if (logPath) error.debugLogPath = logPath;
        reject(error);
      }
    });

    gemini.on('error', async (error) => {
      clearTimeout(timeout);
      console.error('❌ Failed to start Gemini agent:', error);
      const logPath = await writeDebugLog(
        `${new Date().toISOString().replace(/[:.]/g, '-')}-spawn-error.log`,
        `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nError: ${error.stack || error.message}`,
      );
      if (logPath) error.debugLogPath = logPath;
      reject(error);
    });
  });
}

export function getGeneratedContentPath() {
  return GENERATED_CONTENT_PATH;
}

export function getFrontendSrcPath() {
  return FRONTEND_SRC;
}
