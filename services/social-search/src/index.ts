// 让 Node 原生 fetch 走 HTTP_PROXY/NO_PROXY 环境变量（Node fetch 默认忽略代理环境变量）
// 部署在无法直连公网的内网机器时，知乎等外部请求需经代理；NO_PROXY 排除内网数据库
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy) {
  try {
    const { setGlobalDispatcher, EnvHttpProxyAgent } = require('undici');
    setGlobalDispatcher(new EnvHttpProxyAgent());
    console.log('[social-search] 已启用 undici 全局代理（读取 HTTP(S)_PROXY / NO_PROXY）');
  } catch (err: any) {
    console.warn('[social-search] 启用 undici 代理失败:', err?.message);
  }
}

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
