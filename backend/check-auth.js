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
const BUNDLE_PATH = join(REPO_ROOT, 'bundle', 'gemini.js');

async function hasAuthFiles() {
  const paths = [
    join(process.env.HOME || '', '.gemini', 'oauth_creds.json'),
    join(process.env.HOME || '', '.gemini', 'google_accounts.json'),
    join(process.env.HOME || '', '.gemini', 'api_keys.json'),
    join(process.env.HOME || '', '.config', 'gemini', 'oauth_creds.json'),
    join(process.env.HOME || '', '.config', 'gemini', 'google_accounts.json'),
    join(process.env.HOME || '', '.config', 'gemini', 'api_keys.json'),
  ].filter(Boolean);

  for (const path of paths) {
    try {
      await fs.access(path);
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

/**
 * Check if Gemini CLI is authenticated and working
 */
export async function checkGeminiAuth() {
  const [major] = process.versions.node.split('.');
  const majorNumber = Number(major);

  if (!Number.isFinite(majorNumber) || majorNumber < 20) {
    return {
      authenticated: false,
      error: 'Node.js 20+ required for Gemini CLI headless mode',
      details: `Detected Node.js ${process.versions.node}. Run 'nvm use 20' (or equivalent) and rebuild the project.`,
    };
  }

  const bundleExists = await fs
    .access(BUNDLE_PATH)
    .then(() => true)
    .catch(() => false);

  if (!bundleExists) {
    return {
      authenticated: false,
      error: 'Gemini CLI bundle missing',
      details:
        'Run `npm run build` in the project root to generate bundle/gemini.js.',
    };
  }

  return new Promise((resolve) => {
    console.log('🔍 Checking Gemini CLI authentication...');

    const prompt =
      'Respond with the single word AUTH_OK if your credentials are active. Do not include quotes or additional text.';

    const gemini = spawn(
      'node',
      [BUNDLE_PATH, '--yolo', '--prompt', prompt, '--output-format', 'text'],
      {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      },
    );

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      gemini.kill();
      resolve({
        authenticated: false,
        error: 'Timeout waiting for Gemini CLI',
      });
    }, 20000);

    gemini.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gemini.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gemini.on('close', async (code) => {
      clearTimeout(timeout);

      if (code === 0 && stdout.includes('AUTH_OK')) {
        resolve({
          authenticated: true,
          message: 'Gemini CLI is authenticated and ready.',
        });
        return;
      }

      if (await hasAuthFiles()) {
        resolve({
          authenticated: true,
          message: 'Gemini credentials detected on disk.',
        });
        return;
      }

      // Help diagnose common failures
      if (/login/i.test(stdout) || /login/i.test(stderr)) {
        resolve({
          authenticated: false,
          error: 'Gemini CLI requires authentication',
          details:
            'Run `npm start` in the project root and complete the login flow.',
        });
        return;
      }

      resolve({
        authenticated: false,
        error: `Gemini CLI exited with code ${code}`,
        details: stderr.trim() || stdout.trim(),
      });
    });

    gemini.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        authenticated: false,
        error: `Failed to start Gemini CLI: ${error.message}`,
      });
    });
  });
}
