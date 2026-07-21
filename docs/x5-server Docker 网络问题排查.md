# x5-server Docker 网络问题排查

## 环境信息

- 服务器: x5-server (192.168.50.10)，Debian 13，Docker 29.6.2
- 网络: 192.168.50.0/24，网关 192.168.50.2（旁路由）
- 客户端: Mac (192.168.50.191)，与服务器同网段二层直连

## 问题现象

Docker 桥接模式容器通过端口映射（`-p 3080:3080`）启动后：
- 宿主机 `curl localhost:3080` 正常
- 外部客户端（Mac）`curl 192.168.50.10:3080` 返回 **Connection reset by peer**
- TCP 三次握手成功，HTTP 请求发出，服务器也发了响应数据，但客户端收到后立即 RST

## 排查过程

### 1. 排除旁路由

Mac 和 x5-server 同属 /24 网段，二层直连通信不经过网关：

```bash
# x5-server 回包路由
$ ip route get 192.168.50.191
192.168.50.191 dev eno0 src 192.168.50.10  # 直连，不走网关
```

tcpdump 确认回包源 MAC 是 x5-server 真实 MAC，不经过旁路由。

### 2. 定位 Bug 一：docker-proxy `-use-listen-fd` 数据不转发

Docker 29 引入了 `-use-listen-fd` 新模式，docker-proxy 不再自己 bind 端口，而是由 dockerd 通过 fd 传入 socket。

```bash
$ ps aux | grep docker-proxy
/usr/bin/docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 3080 \
  -container-ip 172.19.0.3 -container-port 3080 -use-listen-fd
```

验证：用 `nc` 直接连 docker-proxy 监听的端口，TCP 握手成功但无数据返回。宿主机能通是因为走了 iptables DNAT 路径（lo 接口），绕过了 docker-proxy。

设置 `"userland-proxy": false` 无效——Docker 29 改为由 dockerd 进程内置代理，行为相同。

### 3. 定位 Bug 二：raw table 容器隔离规则

Docker 29 在 nftables raw PREROUTING 链中添加 drop 规则，阻止非 bridge 接口的包到达容器 IP：

```
table ip raw {
  chain PREROUTING {
    ip daddr 172.19.0.3 iifname != "br-xxx" drop
  }
}
```

**解决方案**：在 docker-compose 网络定义中添加 `trusted_host_interfaces`：

```yaml
networks:
  app-net:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.trusted_host_interfaces: "eno0"
```

这会在 drop 规则之前插入 accept 规则，允许来自物理网卡的流量：

```
ip daddr 172.19.0.3 iifname "eno0" accept    # 新增
ip daddr 172.19.0.3 iifname != "br-xxx" drop  # 原有
```

### 4. 定位 Bug 三：bridge TX checksum offload

容器回包经过 veth → bridge 时，内核将校验和计算留给 bridge 接口的 offload。但 bridge 是虚拟设备不做真正 offload，导致发出去的包校验和错误。

- 宿主机自己不验证（本机发出的包），所以 localhost 正常
- 外部客户端校验失败，发 RST

**验证**：关闭 bridge TX offload 后外部访问恢复正常：

```bash
ethtool -K br-xxx tx off
ethtool -K docker0 tx off
```

## 结论

Docker 29.6.2 的桥接端口映射在该服务器上存在三个问题叠加：

| 问题 | 影响 | 单独修复 |
|------|------|---------|
| docker-proxy `-use-listen-fd` 不转发数据 | 外部流量经 proxy 后丢失 | 无法禁用（Docker 29 强制启用） |
| raw table 容器隔离 drop 规则 | DNAT 后的包被丢弃 | `trusted_host_interfaces` |
| bridge TX checksum offload | 回包校验和错误导致 RST | `ethtool -K br-xxx tx off` |

即使修复了后两个问题，第一个 bug（docker-proxy 不转发）仍然导致桥接模式不可用。

## 最终方案

所有容器统一使用 `network_mode: host`，通过应用自身绑定不同端口来隔离：

| 服务 | 端口 |
|------|------|
| Nginx Proxy Manager | 80, 81, 443 |
| Home Assistant | 8123 |
| Portainer | 9000, 9443 |
| Uptime Kuma | 3001 |
| YQAD | 3080 |

## 后续

- 等 Docker 后续版本修复 `use-listen-fd` proxy 问题后，可切回桥接模式
- 关注 [moby/moby](https://github.com/moby/moby) 相关 issue
- 如需桥接模式临时方案，可组合使用 `trusted_host_interfaces` + 关闭 TX offload + `"userland-proxy": false`（需确认 dockerd 内置 proxy 是否也有同样 bug）
