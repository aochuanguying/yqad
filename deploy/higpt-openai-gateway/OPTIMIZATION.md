# Nginx 和 Docker 配置优化说明

## 优化总结

本次优化主要针对 Nginx 反向代理配置、Docker 容器配置和安全性进行了全面改进。

## 主要优化点

### 1. Nginx 配置优化

#### 1.1 请求体大小限制统一
**优化前：**
- Nginx: `client_max_body_size 50m`
- 网关代码：`JSON_BODY_LIMIT = '10mb'`

**优化后：**
- Nginx: `client_max_body_size 10m`
- 网关代码：`JSON_BODY_LIMIT = '10mb'`

**理由：** 保持一致，避免 Nginx 允许 50MB 但网关只接受 10MB 导致的资源浪费。

#### 1.2 流式输出缓冲优化
**优化前：**
```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

**优化后：**
```nginx
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;
```

**理由：** 
- 流式响应（SSE）需要实时推送数据
- 启用缓冲会导致数据累积后才发送，增加延迟
- 关闭缓冲确保每个 chunk 立即发送给客户端

#### 1.3 超时配置优化
**优化前：**
- 所有超时统一设置为 300s

**优化后：**
```nginx
# HiGPT 网关（匹配网关 timeoutMs: 120s）
proxy_connect_timeout 120s;
proxy_read_timeout 120s;
proxy_send_timeout 120s;

# v2ray WebSocket（长连接）
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 3600s;  # WebSocket 需要更长超时
```

**理由：**
- 网关默认超时 120 秒，Nginx 应该匹配
- WebSocket 是长连接，需要更长的 read timeout

### 2. Docker 配置优化

#### 2.1 添加健康检查
```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

**理由：**
- 自动检测容器健康状态
- Docker 可以自动重启不健康的容器
- 编排工具（如 Swarm、K8s）依赖健康检查

#### 2.2 添加资源限制
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 256M
```

**理由：**
- 防止内存泄漏时占用全部系统资源
- 保证其他服务的资源可用性
- 预留基础资源确保服务稳定

#### 2.3 日志大小限制
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "3"
```

**理由：**
- 避免日志无限增长占满磁盘
- 保留最近 3 个文件，每个最多 50MB
- 总计最多 150MB 日志

#### 2.4 端口绑定调整
**优化前：** `127.0.0.1:3000:3000`（仅本地访问）
**优化后：** `3000:3000`（允许外部访问）

**理由：**
- 配合 Nginx 反向代理使用
- 如需限制访问，应在防火墙层面控制

### 3. Dockerfile 优化

#### 3.1 添加健康检查支持
```dockerfile
RUN apk add --no-cache wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --spider -q http://localhost:3000/health || exit 1
```

#### 3.2 安全性加固（非 root 用户）
```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs
```

**理由：**
- 不以 root 用户运行容器
- 减少容器被攻破后的权限
- 符合安全最佳实践

## 优化后的配置对比

| 配置项 | 优化前 | 优化后 | 改进 |
|--------|--------|--------|------|
| 请求体限制 | 50MB (Nginx) / 10MB (代码) | 10MB (统一) | ✅ 一致性 |
| 流式缓冲 | 启用 (1.1MB) | 关闭 | ✅ 实时性 |
| 超时配置 | 300s (固定) | 120s/3600s (分类) | ✅ 合理性 |
| 健康检查 | 无 | 30s 间隔检查 | ✅ 可观测性 |
| 资源限制 | 无限制 | 2CPU/1G 内存 | ✅ 稳定性 |
| 日志限制 | 无限制 | 150MB 上限 | ✅ 磁盘保护 |
| 容器用户 | root | nodejs (非 root) | ✅ 安全性 |

## 部署建议

### 应用优化后的配置

1. **Nginx 配置更新：**
```bash
# 选择对应的配置文件
sudo cp higpt-gateway-ssl.conf /etc/nginx/conf.d/
sudo nginx -t
sudo nginx -s reload
```

2. **Docker 容器重建：**
```bash
cd /path/to/higpt-openai-gateway
docker-compose down
docker-compose build
docker-compose up -d
```

3. **验证健康检查：**
```bash
docker ps  # 查看 HEALTH 列
docker inspect higpt-gateway | grep -A 10 Health
```

4. **监控日志大小：**
```bash
docker logs higpt-gateway --tail 100
ls -lh /var/lib/docker/containers/*/
```

## 注意事项

1. **内存限制调整：** 如果遇到 OOM，根据实际使用情况调整 `memory` 限制
2. **超时时间调整：** 如果需要处理更长的请求，增加 `proxy_read_timeout` 和网关的 `timeoutMs`
3. **端口暴露：** 生产环境建议仅绑定 `127.0.0.1`，通过 Nginx 对外提供服务

## 参考资料

- [Nginx 反向代理最佳实践](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Docker 健康检查文档](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Docker 资源限制](https://docs.docker.com/compose/compose-file/deploy/#resources)
