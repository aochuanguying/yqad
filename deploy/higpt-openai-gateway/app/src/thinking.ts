/**
 * 思考模式参数归一化。
 *
 * 上游（qwen3-5-397b、histar-ultra/GLM-5.2）唯一都认的开关是 chat_template_kwargs.enable_thinking（2026-11-10 实测）。
 * 各家 SDK / 平台的写法不同，网关把常见写法统一翻译成这一个参数，并从请求体中移除别名，避免上游误读
 * （例如 GLM 对 thinking_budget 的处理会让回答失控）。
 *
 * 识别顺序（先出现的有效值生效，后面的忽略）：
 *   1. chat_template_kwargs.enable_thinking   vLLM / SGLang（Qwen3 等）原生写法
 *   2. chat_template_kwargs.thinking          vLLM DeepSeek-V3.1 写法
 *   3. enable_thinking                        阿里云百炼 DashScope、硅基流动
 *   4. thinking: { type }                     智谱 GLM、火山方舟、Anthropic、Kimi；type=enabled/disabled（auto 视为未指定）
 *   5. reasoning: { enabled, effort, max_tokens }  OpenRouter
 *   6. reasoning_effort                       OpenAI；none/minimal=关，low/medium/high/xhigh=开
 *   7. thinking_budget                        DashScope / Gemini 风格；0=关，>0=开（预算本身不下发）
 *   8. 都没有 → 模型路由的「默认思考」
 * 以上字段同样支持放在 extra_body 里（部分客户端会把 extra_body 原样写进 JSON）。
 */

export class ThinkingParamError extends Error {}

export type ThinkingSource =
  | 'chat_template_kwargs.enable_thinking'
  | 'chat_template_kwargs.thinking'
  | 'enable_thinking'
  | 'thinking.type'
  | 'reasoning'
  | 'reasoning_effort'
  | 'thinking_budget'
  | 'route_default';

const EFFORT_OFF = new Set(['none', 'minimal']);
const EFFORT_ON = new Set(['low', 'medium', 'high', 'xhigh']);

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 宽松布尔：true/false、"true"/"false"、1/0、"1"/"0"、"on"/"off"、"enabled"/"disabled" */
function toBool(v: unknown, field: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'enabled', 'enable'].includes(s)) return true;
    if (['false', '0', 'off', 'no', 'disabled', 'disable'].includes(s)) return false;
  }
  throw new ThinkingParamError(`${field} 取值无效: ${JSON.stringify(v)}（应为 true/false）`);
}

function fromEffort(v: unknown, field: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (EFFORT_OFF.has(s)) return false;
  if (EFFORT_ON.has(s)) return true;
  throw new ThinkingParamError(`${field} 取值无效: ${JSON.stringify(v)}（可用 none/minimal/low/medium/high）`);
}

function fromThinkingType(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v; // 个别客户端直接传 thinking: true/false
  if (!isObj(v)) throw new ThinkingParamError('thinking 应为对象，例如 {"type": "enabled"} 或 {"type": "disabled"}');
  const t = typeof v.type === 'string' ? v.type.trim().toLowerCase() : v.type;
  if (t === undefined || t === null || t === 'auto') return undefined;
  if (t === 'enabled' || t === 'enable') return true;
  if (t === 'disabled' || t === 'disable') return false;
  throw new ThinkingParamError(`thinking.type 取值无效: ${JSON.stringify(v.type)}（可用 enabled/disabled/auto）`);
}

function fromReasoning(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v)) throw new ThinkingParamError('reasoning 应为对象，例如 {"enabled": false} 或 {"effort": "high"}');
  const enabled = toBool(v.enabled, 'reasoning.enabled');
  if (enabled !== undefined) return enabled;
  const effort = fromEffort(v.effort, 'reasoning.effort');
  if (effort !== undefined) return effort;
  if (v.max_tokens !== undefined && v.max_tokens !== null) {
    const n = Number(v.max_tokens);
    if (!Number.isFinite(n) || n < 0) throw new ThinkingParamError(`reasoning.max_tokens 取值无效: ${JSON.stringify(v.max_tokens)}`);
    return n > 0;
  }
  return undefined; // 仅有 exclude 等不影响开关的字段
}

function fromBudget(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ThinkingParamError(`thinking_budget 取值无效: ${JSON.stringify(v)}`);
  return n > 0 || n === -1; // Gemini: -1 = 动态思考
}

/**
 * 归一化请求体中的思考参数。返回新的请求体（不修改入参）与生效的开关值及来源。
 * 结果：chat_template_kwargs.enable_thinking = <开关>，其余别名字段被移除。
 */
export function normalizeThinking(input: any, routeDefault: boolean): { body: any; thinking: boolean; source: ThinkingSource } {
  const body: any = { ...input };

  // extra_body：把其中的思考相关字段提到顶层（顶层已有同名字段时以顶层为准）
  if (isObj(body.extra_body)) {
    const extra: any = { ...body.extra_body };
    for (const k of ['chat_template_kwargs', 'enable_thinking', 'thinking', 'reasoning', 'reasoning_effort', 'thinking_budget']) {
      if (extra[k] !== undefined) {
        if (body[k] === undefined) body[k] = extra[k];
        else if (k === 'chat_template_kwargs' && isObj(body[k]) && isObj(extra[k])) body[k] = { ...extra[k], ...body[k] };
        delete extra[k];
      }
    }
    if (Object.keys(extra).length) body.extra_body = extra;
    else delete body.extra_body;
  }

  let ctk: Record<string, any> | undefined;
  if (body.chat_template_kwargs !== undefined && body.chat_template_kwargs !== null) {
    if (!isObj(body.chat_template_kwargs)) throw new ThinkingParamError('chat_template_kwargs 应为对象');
    ctk = { ...body.chat_template_kwargs };
  }

  const candidates: Array<[ThinkingSource, () => boolean | undefined]> = [
    ['chat_template_kwargs.enable_thinking', () => toBool(ctk?.enable_thinking, 'chat_template_kwargs.enable_thinking')],
    ['chat_template_kwargs.thinking', () => toBool(ctk?.thinking, 'chat_template_kwargs.thinking')],
    ['enable_thinking', () => toBool(body.enable_thinking, 'enable_thinking')],
    ['thinking.type', () => fromThinkingType(body.thinking)],
    ['reasoning', () => fromReasoning(body.reasoning)],
    ['reasoning_effort', () => fromEffort(body.reasoning_effort, 'reasoning_effort')],
    ['thinking_budget', () => fromBudget(body.thinking_budget)],
  ];

  // 每个字段都要解析一遍（非法值即使优先级低也报错，避免静默忽略写错的参数）
  let thinking: boolean | undefined;
  let source: ThinkingSource = 'route_default';
  for (const [name, get] of candidates) {
    const v = get();
    if (thinking === undefined && v !== undefined) {
      thinking = v;
      source = name;
    }
  }
  if (thinking === undefined) thinking = routeDefault;

  // 只下发上游认的一个参数，移除所有别名
  delete body.enable_thinking;
  delete body.thinking;
  delete body.reasoning;
  delete body.reasoning_effort;
  delete body.thinking_budget;
  const nextCtk = { ...(ctk || {}) };
  delete nextCtk.thinking;
  nextCtk.enable_thinking = thinking;
  body.chat_template_kwargs = nextCtk;

  return { body, thinking, source };
}
