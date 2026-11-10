#!/bin/bash
# 线上网关测试：与 test.sh 相同用例，默认指向生产地址。
# 用法：GATEWAY_API_KEY=xxx ./test-real.sh
export GATEWAY_URL="${GATEWAY_URL:-https://ai.fssc.top}"
exec "$(dirname "$0")/test.sh"
