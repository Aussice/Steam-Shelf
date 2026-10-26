import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoGames, coverUrl } from '../src/library.js';
const folder = fileURLToPath(new URL('../public/covers/', import.meta.url));
await fs.mkdir(folder, { recursive: true });
let pointer = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pointer < demoGames.length) {
    const game = demoGames[pointer++];
    const destination = path.join(folder, `${game.appid}.jpg`);
    try {
      const response = await fetch(coverUrl(game.appid), { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(String(response.status));
      await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
      console.log(`OK ${game.appid}`);
    } catch (error) { console.error(`Cover ${game.appid}: ${error.message}`); process.exitCode = 1; }
  }
}));
