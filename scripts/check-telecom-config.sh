#!/bin/bash
# 查询生产数据库中的 Telecom API 配置

sshpass -p 'Wfw7539148@' ssh -o StrictHostKeyChecking=no root@192.168.50.10 "docker exec mysql mysql -uroot -p'Wfw7539148@' yqad_prod_db -e \"SELECT * FROM telecom_api_config\""
