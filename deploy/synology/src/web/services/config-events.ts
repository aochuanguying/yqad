/**
 * 配置事件
 */

import { EventEmitter } from 'events';

export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
}

export const configEvents = new EventEmitter();

export function emitConfigChange(event: ConfigChangeEvent): void {
  configEvents.emit('change', event);
}
