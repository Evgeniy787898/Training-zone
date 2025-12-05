import { createHash } from 'crypto';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

type Occurrence = {
  file: string;
  name: string;
  line: number;
  normalized: string;
};

type DuplicateGroup = {
  hash: string;
  normalizedSize: number;
  occurrences: Occurrence[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const sourceRoots = [
  path.join(repoRoot, 'backend', 'src'),
  path.join(repoRoot, 'services'),
  path.join(repoRoot, 'frontend', 'src'),
];

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'node_modules',
  'prisma',
  'public',
  '__generated__',
]);

const allowedExtensions = new Set(['.ts', '.tsx']);
const minNormalizedLength = 160;

async function collectFiles(root: string): Promise<string[]> {
  const entries: string[] = [];

  async function walk(current: string) {
    let dirEntries;
    try {
      dirEntries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      return;
    }

    for (const entry of dirEntries) {
      if (entry.name.startsWith('.')) {
        if (!allowedExtensions.has(path.extname(entry.name))) {
          continue;
        }
      }

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (!allowedExtensions.has(path.extname(entry.name))) {
        continue;
      }

      entries.push(fullPath);
    }
  }

  await walk(root);
  return entries;
}

const normalizeCode = (code: string) =>
  code
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([^:]|^)\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();

function extractFunctions(filePath: string, contents: string) {
  const source = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fnBodies: Occurrence[] = [];

  const pushOccurrence = (node: ts.Node, name: string) => {
    const text = node.getText(source);
    const normalized = normalizeCode(text);

    if (normalized.length < minNormalizedLength) {
      return;
    }

    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    fnBodies.push({
      file: path.relative(repoRoot, filePath),
      name,
      line: line + 1,
      normalized,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      pushOccurrence(node, node.name.getText(source));
    } else if (ts.isMethodDeclaration(node) && node.name) {
      pushOccurrence(node, node.name.getText(source));
    } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && parent.name) {
        pushOccurrence(node, parent.name.getText(source));
      } else if (ts.isPropertyAssignment(parent) && parent.name) {
        pushOccurrence(node, parent.name.getText(source));
      }
    }

    node.forEachChild(visit);
  };

  source.forEachChild(visit);
  return fnBodies;
}

const strictMode = process.argv.includes('--strict');

async function auditDuplicates() {
  const hashMap = new Map<string, DuplicateGroup>();

  for (const root of sourceRoots) {
    const files = await collectFiles(root);
    for (const file of files) {
      const contents = await readFile(file, 'utf8');
      const occurrences = extractFunctions(file, contents);
      for (const occurrence of occurrences) {
        const hash = createHash('sha1').update(occurrence.normalized).digest('hex');

        if (!hashMap.has(hash)) {
          hashMap.set(hash, {
            hash,
            normalizedSize: occurrence.normalized.length,
            occurrences: [],
          });
        }

        hashMap.get(hash)?.occurrences.push(occurrence);
      }
    }
  }

  const duplicates = Array.from(hashMap.values())
    .filter((group) => group.occurrences.length > 1)
    .sort((a, b) => b.normalizedSize - a.normalizedSize);

  const timestamp = new Date().toISOString();
  const lines = [
    '# Отчет о дублировании кода',
    '',
    `Сгенерировано: ${timestamp}`,
    '',
  ];

  if (!duplicates.length) {
    lines.push('Совпадений не обнаружено.');
  } else {
    lines.push(`Найдено групп совпадений: ${duplicates.length}`);
    lines.push('');
    for (const group of duplicates) {
      lines.push(`## Дубликат ${group.hash}`);
      lines.push(`Размер (нормализованный): ${group.normalizedSize} символов`);
      lines.push('Местоположения:');
      for (const occurrence of group.occurrences) {
        lines.push(`- ${occurrence.file}:${occurrence.line} — ${occurrence.name}`);
      }
      lines.push('');
    }
  }

  const outputDir = path.join(repoRoot, 'docs');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'duplicate-code-report.md'), lines.join('\n'));

  console.log(`Аудит завершен. Найдено групп дубликатов: ${duplicates.length}`);

  if (strictMode && duplicates.length) {
    console.error('Строгий режим: обнаружено дублирование кода. Перечень проблемных функций:');
    for (const group of duplicates) {
      console.error(`- Хеш ${group.hash} (${group.occurrences.length} вх.)`);
      for (const occurrence of group.occurrences) {
        console.error(`  • ${occurrence.file}:${occurrence.line} — ${occurrence.name}`);
      }
    }
    console.error('Сгенерирован отчет docs/duplicate-code-report.md. Требуется рефакторинг.');
    process.exitCode = 1;
  }
}

auditDuplicates().catch((error) => {
  console.error('Аудит завершился ошибкой', error);
  process.exitCode = 1;
});
