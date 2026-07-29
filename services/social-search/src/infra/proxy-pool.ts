export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'socks5';
}

/**
 * 代理 IP 池管理
 * 初期为预留接口，默认直连（返回 null）
 */
export class ProxyPool {
  private proxies: ProxyConfig[] = [];
  private currentIndex: number = 0;
  private failedProxies: Set<string> = new Set();

  constructor(proxies: ProxyConfig[] = []) {
    this.proxies = proxies;
  }

  /**
   * 获取下一个可用代理，如果没有可用代理则返回 null（直连）
   */
  getNext(): ProxyConfig | null {
    const available = this.proxies.filter(p => !this.failedProxies.has(this.proxyKey(p)));
    if (available.length === 0) return null;

    const proxy = available[this.currentIndex % available.length];
    this.currentIndex++;
    return proxy;
  }

  /**
   * 标记代理失败
   */
  markFailed(proxy: ProxyConfig): void {
    this.failedProxies.add(this.proxyKey(proxy));
  }

  /**
   * 重置所有失败标记
   */
  reset(): void {
    this.failedProxies.clear();
    this.currentIndex = 0;
  }

  /**
   * 获取可用代理数量
   */
  get availableCount(): number {
    return this.proxies.filter(p => !this.failedProxies.has(this.proxyKey(p))).length;
  }

  private proxyKey(proxy: ProxyConfig): string {
    return `${proxy.host}:${proxy.port}`;
  }
}

// 默认空池（直连）
export const proxyPool = new ProxyPool();
