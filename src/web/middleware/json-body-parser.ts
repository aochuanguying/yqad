import express from 'express';

export const WEB_JSON_BODY_LIMIT = '50mb';

export function jsonBodyParser() {
  return express.json({ limit: WEB_JSON_BODY_LIMIT });
}
