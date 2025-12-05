import fs from 'fs';
import path from 'path';
import inspector from 'inspector';

const DEFAULT_DIR = '.profiles';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeHeapSnapshot(outFile: string) {
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true });

  // import inspector from 'inspector';
  // import fs from 'fs';

  // const session = new inspector.Session();
  // session.connect();

  // export const takeHeapSnapshot = (filename: string) => {
  //   const fd = fs.openSync(filename, 'w');

  //   session.on('HeapProfiler.addHeapSnapshotChunk', (m: any) => {
  //     fs.writeSync(fd, m.params.chunk);
  //   });

  //   session.post('HeapProfiler.takeHeapSnapshot', null, (err, r) => {
  //     console.log('HeapSnapshot done:', err, r);
  //     session.disconnect();
  //     fs.closeSync(fd);
  //   });
  // };

}

async function main() {
  const delayMs = Number(process.env.HEAP_SNAPSHOT_DELAY_MS ?? '0');
  const dir = process.env.HEAP_SNAPSHOT_DIR ?? DEFAULT_DIR;
  const fileName = process.env.HEAP_SNAPSHOT_NAME ?? `heap-${Date.now()}.heapsnapshot`;
  const outPath = path.resolve(process.cwd(), dir, fileName);

  if (Number.isFinite(delayMs) && delayMs > 0) {
    console.log(`Waiting ${delayMs}ms before taking heap snapshot...`);
    await wait(delayMs);
  }

  console.log(`Writing heap snapshot to ${outPath}`);
  await takeHeapSnapshot(outPath);
  console.log('Heap snapshot completed');
}

main().catch((error) => {
  console.error('Failed to capture heap snapshot', error);
  process.exitCode = 1;
});
