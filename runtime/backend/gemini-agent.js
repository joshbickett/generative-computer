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

const REPO_ROOT = join(__dirname, '..', '..');
const FRONTEND_SRC = join(REPO_ROOT, 'runtime', 'frontend', 'src');
const COMPONENTS_DIR = join(FRONTEND_SRC, 'components');
const GENERATED_CONTENT_PATH = join(COMPONENTS_DIR, 'GeneratedContent.tsx');
const GEMINI_BUNDLE = join(REPO_ROOT, 'bundle', 'gemini.js');
const LOG_DIR = join(REPO_ROOT, 'logs', 'agent');
const DEBUG_AGENT = process.env.DEBUG_AGENT === 'true';

let latestUsageRecord = null;
let aggregateUsage = null;

const emptyDecisions = () => ({
  accept: 0,
  reject: 0,
  modify: 0,
  auto_accept: 0,
});

const deepClone = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const normalizeModelStats = (stats) => ({
  api: {
    totalRequests: stats?.api?.totalRequests ?? 0,
    totalErrors: stats?.api?.totalErrors ?? 0,
    totalLatencyMs: stats?.api?.totalLatencyMs ?? 0,
  },
  tokens: {
    prompt: stats?.tokens?.prompt ?? 0,
    candidates: stats?.tokens?.candidates ?? 0,
    total: stats?.tokens?.total ?? 0,
    cached: stats?.tokens?.cached ?? 0,
    thoughts: stats?.tokens?.thoughts ?? 0,
    tool: stats?.tokens?.tool ?? 0,
  },
});

const normalizeToolStats = (stats) => ({
  count: stats?.count ?? 0,
  success: stats?.success ?? 0,
  fail: stats?.fail ?? 0,
  durationMs: stats?.durationMs ?? 0,
  decisions: {
    accept: stats?.decisions?.accept ?? 0,
    reject: stats?.decisions?.reject ?? 0,
    modify: stats?.decisions?.modify ?? 0,
    auto_accept: stats?.decisions?.auto_accept ?? 0,
  },
});

const mergeModelStats = (target, source) => {
  for (const [modelName, modelStats] of Object.entries(source?.models ?? {})) {
    const existing = target.models[modelName]
      ? normalizeModelStats(target.models[modelName])
      : normalizeModelStats();
    const incoming = normalizeModelStats(modelStats);
    existing.api.totalRequests += incoming.api.totalRequests;
    existing.api.totalErrors += incoming.api.totalErrors;
    existing.api.totalLatencyMs += incoming.api.totalLatencyMs;
    existing.tokens.prompt += incoming.tokens.prompt;
    existing.tokens.candidates += incoming.tokens.candidates;
    existing.tokens.total += incoming.tokens.total;
    existing.tokens.cached += incoming.tokens.cached;
    existing.tokens.thoughts += incoming.tokens.thoughts;
    existing.tokens.tool += incoming.tokens.tool;
    target.models[modelName] = existing;
  }
};

const mergeToolStats = (target, source) => {
  const incomingTools = source?.tools;
  if (!incomingTools) return;

  target.tools.totalCalls += incomingTools.totalCalls ?? 0;
  target.tools.totalSuccess += incomingTools.totalSuccess ?? 0;
  target.tools.totalFail += incomingTools.totalFail ?? 0;
  target.tools.totalDurationMs += incomingTools.totalDurationMs ?? 0;

  const incomingDecisions = incomingTools.totalDecisions ?? emptyDecisions();
  target.tools.totalDecisions.accept += incomingDecisions.accept ?? 0;
  target.tools.totalDecisions.reject += incomingDecisions.reject ?? 0;
  target.tools.totalDecisions.modify += incomingDecisions.modify ?? 0;
  target.tools.totalDecisions.auto_accept += incomingDecisions.auto_accept ?? 0;

  for (const [toolName, stats] of Object.entries(incomingTools.byName ?? {})) {
    const existing = target.tools.byName[toolName]
      ? normalizeToolStats(target.tools.byName[toolName])
      : normalizeToolStats();
    const incoming = normalizeToolStats(stats);
    existing.count += incoming.count;
    existing.success += incoming.success;
    existing.fail += incoming.fail;
    existing.durationMs += incoming.durationMs;
    existing.decisions.accept += incoming.decisions.accept;
    existing.decisions.reject += incoming.decisions.reject;
    existing.decisions.modify += incoming.decisions.modify;
    existing.decisions.auto_accept += incoming.decisions.auto_accept;
    target.tools.byName[toolName] = existing;
  }
};

const mergeFileStats = (target, source) => {
  target.files.totalLinesAdded += source?.files?.totalLinesAdded ?? 0;
  target.files.totalLinesRemoved += source?.files?.totalLinesRemoved ?? 0;
};

const mergeStats = (target, source) => {
  mergeModelStats(target, source);
  mergeToolStats(target, source);
  mergeFileStats(target, source);
};

const computeSummary = (stats) => {
  const summary = {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCachedTokens: 0,
    models: [],
  };

  for (const [name, model] of Object.entries(stats?.models ?? {})) {
    const requests = model.api?.totalRequests ?? 0;
    const promptTokens = model.tokens?.prompt ?? 0;
    const outputTokens = model.tokens?.candidates ?? 0;
    const totalTokens = model.tokens?.total ?? promptTokens + outputTokens;
    const cachedTokens = model.tokens?.cached ?? 0;

    summary.totalRequests += requests;
    summary.totalPromptTokens += promptTokens;
    summary.totalOutputTokens += outputTokens;
    summary.totalTokens += totalTokens;
    summary.totalCachedTokens += cachedTokens;

    summary.models.push({
      name,
      requests,
      promptTokens,
      outputTokens,
      totalTokens,
      cachedTokens,
    });
  }

  return summary;
};

const recordUsageStats = (stats) => {
  if (!stats) return;

  const timestamp = new Date().toISOString();
  const clonedStats = deepClone(stats);
  const summary = computeSummary(clonedStats);

  latestUsageRecord = {
    stats: clonedStats,
    summary,
    recordedAt: timestamp,
  };

  if (!aggregateUsage) {
    aggregateUsage = {
      stats: deepClone(clonedStats),
      summary: computeSummary(clonedStats),
      sessions: 1,
      since: timestamp,
      updatedAt: timestamp,
    };
    return;
  }

  mergeStats(aggregateUsage.stats, stats);
  aggregateUsage.summary = computeSummary(aggregateUsage.stats);
  aggregateUsage.sessions += 1;
  aggregateUsage.updatedAt = timestamp;
};

const parseGeminiJsonOutput = (rawOutput) => {
  if (!rawOutput) return null;
  const trimmed = rawOutput.trim();
  if (!trimmed) return null;

  const firstBraceIndex = trimmed.indexOf('{');
  if (firstBraceIndex === -1) return null;

  const jsonCandidate = trimmed.slice(firstBraceIndex);

  try {
    return JSON.parse(jsonCandidate);
  } catch (error) {
    console.warn('⚠️  Failed to parse Gemini JSON output:', error);
    return null;
  }
};

export const getUsageSummary = () => {
  const latest = latestUsageRecord
    ? {
        ...latestUsageRecord,
        stats: deepClone(latestUsageRecord.stats),
        summary: { ...latestUsageRecord.summary },
      }
    : null;

  const aggregate = aggregateUsage
    ? {
        ...aggregateUsage,
        stats: deepClone(aggregateUsage.stats),
        summary: { ...aggregateUsage.summary },
      }
    : null;

  return { latest, aggregate };
};

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

  const systemPrompt = `You are an AI coding agent helping power the "Generative Computer" React experience.

CRITICAL CONSTRAINTS:
1. You can ONLY modify files under: ${COMPONENTS_DIR}
2. The following files must remain untouched:
   - CommandInput.tsx / CommandInput.css
   - Desktop.tsx / Desktop.css
   - Window.tsx / Window.css
3. GeneratedContent.tsx must always exist in the same folder, export default function GeneratedContent, and continue rendering the user's desktop window.
4. Never remove, hide, or disable the command input text box rendered by CommandInput.
5. When embedding multi-line ASCII art or code, wrap it in a <pre> element and call String.raw on the string literal so the JSX remains valid without escape errors.

TOOLS:
- You have a special "drawing" tool available.
- If the user asks to draw something, use the drawing tool.
- The tool takes a list of drawing commands.
- Schema: { tool: 'drawing', commands: [{ shape: 'line' | 'circle' | 'rectangle', color: string (hex), positions: [x, y, x2, y2, ...] }] }

REQUEST:
The user said: "${userCommand}".
Translate this into a compelling end product in GeneratedContent.tsx only. Remember you can create anything that can be rendered in a browser!

STRUCTURE GUIDELINES:
- Use semantic HTML elements inside JSX.
- Include a title, a short description citing the original request, and (when helpful) structured content such as bullet lists, galleries, or data cards.
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
    'json',
    '--tools',
    'drawing',
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
        const parsed = parseGeminiJsonOutput(trimmedOutput);
        const responseText = parsed?.response ?? trimmedOutput;
        const stats = parsed?.stats;

        if (stats) {
          recordUsageStats(stats);
        }

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

        if (!responseText.trim()) {
          const logPath = await writeDebugLog(
            `${new Date().toISOString().replace(/[:.]/g, '-')}-empty-output.log`,
            `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout empty.\nStderr:\n${errorOutput}\n`,
          );
          const error = new Error('Gemini agent returned no output.');
          if (logPath) error.debugLogPath = logPath;
          reject(error);
          return;
        }

        if (!/DONE\b/.test(responseText)) {
          console.warn('⚠️  Gemini agent finished without DONE confirmation.');
        }

        const logPath = await writeDebugLog(
          `${new Date().toISOString().replace(/[:.]/g, '-')}-success.log`,
          `User command: ${userCommand}\nArgs: ${JSON.stringify(args)}\nStdout:\n${output}\n\nStderr:\n${errorOutput}\n`,
        );

        console.log('✅ Gemini agent completed successfully');
        resolve({
          success: true,
          output: responseText,
          rawOutput: output,
          stats: stats ? deepClone(stats) : null,
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
