/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKSPACE_DIR = join(__dirname, '..', 'my-computer');

/**
 * Smart simulator that generates contextual desktop experiences based on user requests.
 * Instead of writing to GeneratedContent.tsx, we now create collaborative files
 * in the shared "My Computer" workspace so both the user and the agent can edit them.
 */

export async function generateSmartExperience(userCommand) {
  const experience = buildExperienceProfile(userCommand);

  await fs.mkdir(WORKSPACE_DIR, { recursive: true });

  const noteFileName = buildWorkspaceFileName(experience.title || userCommand);
  const absolutePath = join(WORKSPACE_DIR, noteFileName);

  const lines = [];
  lines.push(`# ${experience.title}`);
  lines.push('');
  lines.push(`> Generated for request: “${userCommand}”.`);

  if (experience.customContent) {
    lines.push('');
    lines.push('```');
    lines.push(experience.customContent);
    lines.push('```');
  }

  if (experience.items?.length) {
    lines.push('');
    lines.push('## Suggested Plan');
    lines.push('');
    for (const item of experience.items) {
      lines.push(`- ${item}`);
    }
  }

  if (experience.tips) {
    lines.push('');
    lines.push('## Tip');
    lines.push('');
    lines.push(`> ${experience.tips}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'This note lives in `runtime/my-computer/`. Ask the agent to expand it, turn it into a React experience, or export the data elsewhere.',
  );

  await fs.writeFile(absolutePath, lines.join('\n'), 'utf-8');

  return {
    title: experience.title,
    notePath: noteFileName,
    noteAbsolutePath: absolutePath,
    tips: experience.tips,
  };
}

function buildWorkspaceFileName(label) {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const base = normalized || 'workspace-note';
  return `${base}-${randomUUID().slice(0, 8)}.md`;
}

function buildExperienceProfile(command) {
  const lower = command.toLowerCase();

  if (lower.includes('ascii') || lower.includes('art')) {
    const art = String.raw`  /\_/\\
 ( o.o )  🍎 ASCII Orchard Controller
  > ^ <`;
    return {
      title: '🎨 ASCII Art Showcase',
      items: [],
      customContent: art,
      tips: 'Ask for a new scene to regenerate fresh terminal art.',
    };
  }

  // Shopping/grocery lists
  if (
    lower.includes('shop') ||
    lower.includes('groceries') ||
    lower.includes('grocery') ||
    lower.includes('buy') ||
    lower.includes('carrots') ||
    lower.includes('apples')
  ) {
    return {
      title: '🛒 Shopping Companion',
      items: extractItems(command, [
        'carrots',
        'apples',
        'potatoes',
        'milk',
        'bread',
        'eggs',
      ]),
      tips: 'Check your pantry before heading out to avoid buying duplicates!',
    };
  }

  // Blog/writing
  if (
    lower.includes('blog') ||
    lower.includes('write') ||
    lower.includes('article')
  ) {
    return {
      title: '✍️ Blog Writing Toolkit',
      items: [
        '📋 Research topic and gather sources',
        '🎯 Define target audience and key message',
        '✏️ Write compelling headline and introduction',
        '📝 Draft main content sections',
        '🖼️ Add images, code examples, or diagrams',
        '🔍 Proofread and edit for clarity',
        '🚀 Publish and share on social media',
      ],
      tips: 'Start with an outline to keep your writing focused and structured.',
    };
  }

  // Code/development
  if (
    lower.includes('code') ||
    lower.includes('app') ||
    lower.includes('build') ||
    lower.includes('implement') ||
    lower.includes('develop')
  ) {
    return {
      title: '💻 Development Sprint Plan',
      items: [
        '📐 Design architecture and component structure',
        '🎨 Create UI mockups or wireframes',
        '⚙️ Set up development environment',
        '🔨 Implement core functionality',
        '✅ Write unit and integration tests',
        '🐛 Debug and fix issues',
        '📚 Document code and API',
        '🚀 Deploy to production',
      ],
      tips: 'Break work into small, testable chunks for faster iteration.',
    };
  }

  // Travel/vacation
  if (
    lower.includes('travel') ||
    lower.includes('vacation') ||
    lower.includes('trip') ||
    lower.includes('holiday')
  ) {
    return {
      title: '✈️ Travel Planner',
      items: [
        '🎯 Choose destination and dates',
        '✈️ Book flights and accommodation',
        '📋 Create daily itinerary',
        '💳 Arrange travel insurance',
        '🎒 Pack essentials (clothes, documents, chargers)',
        '💱 Exchange currency or notify bank',
        '📸 Charge camera and devices',
        '🏠 Arrange pet/plant care if needed',
      ],
      tips: 'Book accommodations and flights at least 2-3 months in advance for better deals.',
    };
  }

  // Twitter/social media
  if (
    lower.includes('twitter') ||
    lower.includes('tweet') ||
    lower.includes('post') ||
    lower.includes('social media')
  ) {
    return {
      title: '🐦 Social Media Launch Checklist',
      items: [
        '💡 Draft engaging tweet copy (keep it under 280 chars)',
        '🖼️ Create eye-catching visual or screenshot',
        '🔗 Add relevant links or call-to-action',
        '🏷️ Include 2-3 relevant hashtags',
        '⏰ Schedule for optimal posting time',
        '👥 Tag relevant accounts or collaborators',
        '📊 Monitor engagement and reply to comments',
        '🔄 Retweet and amplify responses',
      ],
      tips: 'Posts with images get 150% more engagement. Make it visual!',
    };
  }

  // Default general planning flow
  return {
    title: `📋 Project Brief: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
    items: [
      '🎯 Define clear goals and success criteria',
      '📋 Break down into smaller actionable steps',
      '⏰ Set realistic deadlines for each step',
      '🚀 Start with the highest priority item',
      '✅ Complete and verify each step',
      '📝 Document progress and learnings',
      '🎉 Celebrate completion!',
    ],
    tips: 'Focus on one task at a time for maximum productivity.',
  };
}

function extractItems(command, defaults) {
  // Try to extract items from quotes or commas
  const quoted = command.match(/"([^"]+)"/g);
  if (quoted && quoted.length > 0) {
    return quoted.map((q) => `🛒 ${q.replace(/"/g, '')}`);
  }

  // Look for comma-separated items
  const items = command.match(/:\s*(.+)/);
  if (items && items[1].includes(',')) {
    return items[1].split(',').map((item) => `🛒 ${item.trim()}`);
  }

  // Fall back to defaults
  return defaults.map((item) => `🛒 ${item}`);
}
