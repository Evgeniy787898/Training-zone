import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface Task {
  title: string;
  done: boolean;
}

interface Block {
  section: string | null;
  title: string;
  tasks: Task[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(currentDir, '../../..');
const PLAN_PATH = path.join(PROJECT_ROOT, 'PLAN_IMPROVEMENTS.md');
const SUMMARY_PATH = path.join(PROJECT_ROOT, 'IMPROVEMENT_SUMMARY.md');

async function readPlan(): Promise<Block[]> {
  const raw = await fs.readFile(PLAN_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  const blocks: Block[] = [];
  let currentSection: string | null = null;
  let currentBlock: Block | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.replace(/^##\s+/, '').trim();
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const title = trimmed.replace(/^###\s+/, '').trim();
      if (title.toLowerCase().includes('блок')) {
        currentBlock = { section: currentSection, title, tasks: [] };
        blocks.push(currentBlock);
      } else {
        currentBlock = null;
      }
      continue;
    }

    const taskMatch = line.match(/^\s*-\s*\[(x|X| )]\s+(.*)$/);
    if (taskMatch && currentBlock) {
      const [, flag, taskTitle] = taskMatch;
      currentBlock.tasks.push({
        done: flag.toLowerCase() === 'x',
        title: taskTitle.trim(),
      });
    }
  }

  return blocks.filter((block) => block.tasks.length > 0);
}

function buildSummary(blocks: Block[]): string {
  const totalTasks = blocks.reduce((acc, block) => acc + block.tasks.length, 0);
  const completedTasks = blocks.reduce(
    (acc, block) => acc + block.tasks.filter((task) => task.done).length,
    0,
  );
  const completedBlocks = blocks.filter((block) => block.tasks.every((task) => task.done)).length;
  const timestamp = new Date().toISOString();

  const lines: string[] = [];
  lines.push('# TZONA Improvement Summary (auto-generated)');
  lines.push('');
  lines.push(`_Generated: ${timestamp}_`);
  lines.push('');
  lines.push('## Overall Progress');
  lines.push('');
  lines.push(`- Blocks completed: **${completedBlocks}/${blocks.length}**`);
  lines.push(`- Tasks completed: **${completedTasks}/${totalTasks}**`);
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  lines.push(`- Overall completion: **${percent}%**`);
  lines.push('');
  lines.push('## Block Status');
  lines.push('');
  lines.push('| Section | Block | Progress | Remaining |');
  lines.push('| --- | --- | --- | --- |');

  blocks.forEach((block) => {
    const done = block.tasks.filter((task) => task.done).length;
    const total = block.tasks.length;
    const remaining = total - done;
    lines.push(
      `| ${block.section ?? '—'} | ${block.title} | ${done}/${total} | ${remaining === 0 ? '—' : remaining} |`,
    );
  });

  lines.push('');
  lines.push('## Remaining Tasks');
  lines.push('');
  const pendingBlocks = blocks.filter((block) => block.tasks.some((task) => !task.done));

  if (pendingBlocks.length === 0) {
    lines.push('All tasks across every block are completed. ✅');
  } else {
    pendingBlocks.forEach((block) => {
      lines.push(`### ${block.title}`);
      if (block.section) {
        lines.push(`_Section: ${block.section}_`);
      }
      block.tasks.forEach((task) => {
        const box = task.done ? 'x' : ' ';
        lines.push(`- [${box}] ${task.title}`);
      });
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');
  lines.push('> This summary is generated automatically from `PLAN_IMPROVEMENTS.md`. Do not edit manually; run `npm run generate:summary --prefix backend` after plan updates.');

  return `${lines.join('\n')}`;
}

async function main() {
  const blocks = await readPlan();
  if (blocks.length === 0) {
    throw new Error('PLAN_IMPROVEMENTS.md не содержит блоков с задачами.');
  }
  const summary = buildSummary(blocks);
  await fs.writeFile(SUMMARY_PATH, summary, 'utf8');
  console.log(`Improvement summary updated at ${SUMMARY_PATH}`);
}

main().catch((error) => {
  console.error('Failed to generate improvement summary');
  console.error(error);
  process.exitCode = 1;
});
