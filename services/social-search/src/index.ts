import { getConfig } from './config/default';

type Mode = 'stdio' | 'rest' | 'all';

function parseMode(): Mode {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    const mode = args[modeIndex + 1] as Mode;
    if (['stdio', 'rest', 'all'].includes(mode)) {
      return mode;
    }
  }
  return 'all';
}

async function main() {
  const mode = parseMode();
  const config = getConfig();

  console.log(`[social-search] 启动模式: ${mode}`);

  if (mode === 'stdio') {
    const { startMcpStdio } = await import('./mcp/server');
    await startMcpStdio();
  } else if (mode === 'rest') {
    const { startRestServer } = await import('./rest/app');
    await startRestServer(config.port);
  } else {
    // all: REST + MCP Streamable HTTP 共享同一端口
    const { startCombinedServer } = await import('./rest/app');
    await startCombinedServer(config.port);
  }
}

main().catch((err) => {
  console.error('[social-search] 启动失败:', err);
  process.exit(1);
});
