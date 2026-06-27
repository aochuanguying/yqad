/**
 * 配置事件
 */

import { EventEmitter } from 'events';

export interface ConfigChangeEvent {
  key: string;
  group?: string;
  oldValue: any;
  newValue: any;
  newConfig?: any;
}

export interface ConfigEventHandler {
  (event: ConfigChangeEvent): void;
}

class ConfigEventEmitter extends EventEmitter {
  private handlers: Set<ConfigEventHandler> = new Set();

  onConfigChanged(handler: ConfigEventHandler): void {
    this.handlers.add(handler);
  }

  offConfigChanged(handler: ConfigEventHandler): void {
    this.handlers.delete(handler);
  }

  emitChange(event: ConfigChangeEvent): void {
    this.handlers.forEach(handler => handler(event));
    this.emit('change', event);
  }
}

export const configEvents = new ConfigEventEmitter();

export function emitConfigChange(event: ConfigChangeEvent): void {
  configEvents.emitChange(event);
}
