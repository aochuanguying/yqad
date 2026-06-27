import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../index';
import type { GatewayConfig } from '../config';

function listen(app: any): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(r => server.close(() => r())),
      });
    });
  });
}

const config: GatewayConfig = {
  port: 3000,
  gatewayApiKey: 'gw-test',
  higpt: {
    baseUrl: 'https://example.com/v1',
    apiKey: 'up-test',
    userKey: 'uk-test',
    proxyUrl: '',
    timeoutMs: 1000,
  },
  modelAliases: { higpt: 'qwen3-5-397b' },
};

test('GET /health 无需鉴权', async () => {
  const app = createApp(config);
  const s = await listen(app);
  try {
    const res = await fetch(`${s.baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.ok, true);
  } finally {
    await s.close();
  }
});

test('缺少 Authorization 返回 401（OpenAI 风格）', async () => {
  const app = createApp(config);
  const s = await listen(app);
  try {
    const res = await fetch(`${s.baseUrl}/v1/models`);
    assert.equal(res.status, 401);
    const json = (await res.json()) as any;
    assert.equal(json.error.type, 'authentication_error');
  } finally {
    await s.close();
  }
});

test('无效 JSON 返回 400（OpenAI 风格）', async () => {
  const app = createApp(config);
  const s = await listen(app);
  try {
    const res = await fetch(`${s.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gw-test',
        'content-type': 'application/json',
      },
      body: '{',
    });
    assert.equal(res.status, 400);
    const json = (await res.json()) as any;
    assert.equal(json.error.type, 'invalid_request_error');
  } finally {
    await s.close();
  }
});

test('请求体过大返回 413（OpenAI 风格）', async () => {
  const app = createApp(config, { jsonBodyLimit: '1kb' });
  const s = await listen(app);
  try {
    const res = await fetch(`${s.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gw-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'higpt', messages: [], extra: 'x'.repeat(2 * 1024) }),
    });
    assert.equal(res.status, 413);
    const json = (await res.json()) as any;
    assert.equal(json.error.type, 'invalid_request_error');
  } finally {
    await s.close();
  }
});

test('正常请求返回成功（mock 上游）', async () => {
  // 创建一个 mock 上游服务
  const mockUpstream = await new Promise<{port: number, close: () => void}>((resolve) => {
    const http = require('http');
    const server = http.createServer((req: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'test-123',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }]
      }));
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        close: () => server.close()
      });
    });
  });

  const upstreamConfig: GatewayConfig = {
    ...config,
    higpt: {
      ...config.higpt,
      baseUrl: `http://127.0.0.1:${mockUpstream.port}`,
      timeoutMs: 5000,
    },
  };

  const app = createApp(upstreamConfig);
  const s = await listen(app);
  try {
    const res = await fetch(`${s.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gw-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'higpt',
        messages: [{ role: 'user', content: 'Hello' }]
      }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.id, 'test-123');
    assert.equal(json.choices[0].message.content, 'Hello!');
  } finally {
    await s.close();
    mockUpstream.close();
  }
});
