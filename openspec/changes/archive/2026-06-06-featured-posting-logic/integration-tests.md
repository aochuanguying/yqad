## 前置

- 服务已启动（默认端口 3000）

## 1. 获取精华策略配置

```bash
curl -sS http://localhost:3000/api/config/featuredPosting
```

## 2. 更新精华策略配置

```bash
curl -sS -X PUT http://localhost:3000/api/config/featuredPosting \
  -H 'Content-Type: application/json' \
  -d '{
    "enabled": true,
    "minContentChars": 250,
    "minImages": 4,
    "maxGenerateRetries": 2,
    "maxImageUploadRetries": 2
  }'
```

## 3. 验证更新已生效

```bash
curl -sS http://localhost:3000/api/config/featuredPosting
```

