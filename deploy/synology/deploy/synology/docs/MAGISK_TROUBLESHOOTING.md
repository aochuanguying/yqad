# 小米6 Magisk App 无法打开问题排查报告

## 设备信息

- 设备: 小米6 (MI 6)
- Android版本: 15 (SDK 35)
- Magisk Daemon版本: v30.7 (versionCode 30700)
- Root状态: 已root，Magisk daemon正常运行
- 网络: 可正常访问GitHub及所有国外网站

## 问题现象

Magisk App打开后提示"需要下载完整版Magisk才能正常打开"，点击下载会卡死很久。手工安装最新版APK后，点击打开仍然异常（闪退/消失）。

## 排查过程

### 第一步：确认设备连接和基本信息

```bash
adb devices
# fc5e4b15    device

adb shell "magisk -v"
# 30.7:MAGISK:R

adb shell "magisk -V"
# 30700

adb shell "getprop ro.build.version.sdk"
# 35

adb shell "getprop ro.build.version.release"
# 15

adb shell "getprop ro.product.model"
# MI 6
```

**结论**: Magisk daemon v30.7正常运行，设备本身root正常。

### 第二步：检查已安装的Magisk App版本

```bash
adb shell "dumpsys package com.topjohnwu.magisk | grep -E 'versionCode|versionName'"
# versionCode=1 minSdk=23 targetSdk=36
# versionName=1.0
```

**关键发现**: 安装的Magisk App版本是 `versionCode=1, versionName=1.0`，这是一个 **Stub（桩/占位）版本**，不是完整版App。

### 第三步：尝试安装完整版Magisk v28.1

```bash
# 下载v28.1完整APK（GitHub release最新stable）
curl -L -o /tmp/Magisk-v28.1.apk "https://github.com/topjohnwu/Magisk/releases/download/v28.1/Magisk-v28.1.apk"
# 文件大小: 11716982 bytes (11.1MB)

# 卸载stub后安装
adb shell "pm uninstall com.topjohnwu.magisk"
adb install /tmp/Magisk-v28.1.apk
# Success

adb shell "dumpsys package com.topjohnwu.magisk | grep -E 'versionCode|versionName'"
# versionCode=28100 minSdk=23 targetSdk=35
# versionName=28.1
```

**结果**: 安装成功，但打开App后仍然闪退。

### 第四步：分析v28.1的崩溃日志

从logcat中发现v28.1实际上也是stub架构（Magisk v22+的APK设计）：

```
dex2oat64 ... --comments=app-name:com.topjohnwu.magisk,app-version-name:1.0,app-version-code:1
ComponentInfo{com.topjohnwu.magisk/x.COMPONENT_PLACEHOLDER_2}
```

系统在编译(dex2oat)时仍然报告versionCode=1，组件名全是`COMPONENT_PLACEHOLDER`，说明APK内部的真实结构就是stub。

### 第五步：尝试安装旧版Magisk v26.4（非stub架构）

```bash
curl -sL -o /tmp/Magisk-v26.4.apk "https://github.com/topjohnwu/Magisk/releases/download/v26.4/Magisk-v26.4.apk"
# 文件大小: 12526383 bytes

adb shell "pm uninstall com.topjohnwu.magisk"
adb install /tmp/Magisk-v26.4.apk
# Success
```

Activity验证确认这次是完整版（有真实的Activity类名）：
```
com.topjohnwu.magisk/.ui.MainActivity
com.topjohnwu.magisk/.ui.surequest.SuRequestActivity
```

**结果**: 打开App后仍然闪退/消失。

### 第六步：通过日志发现真正的根因

```
06-16 21:29:49.098 I/Magisk  (15414): pm_install: /data/stub.apk
06-16 21:29:49.122 I/ActivityManager: Force stopping com.topjohnwu.magisk appid=10273 user=-1: deletePackageX
06-16 21:29:49.128 I/ActivityManager: Killing 15384:com.topjohnwu.magisk/u0a273 (adj 0): stop com.topjohnwu.magisk due to deletePackageX
06-16 21:29:49.254 I/Magisk  (15435): pm_uninstall: Success
...
06-16 21:29:51.499 I/Magisk  (15492): pm_install: Success
```

## 核心发现（根因）

**Magisk Daemon (v30.7) 在主动替换App！** 完整流程如下：

1. 用户打开了手动安装的Magisk App（无论哪个版本）
2. Magisk **守护进程（daemon v30.7）** 检测到App版本与自身不匹配
3. Daemon 强制卸载当前App（`pm_uninstall`）
4. Daemon 从 `/data/stub.apk` 重新安装stub版本（`pm_install: /data/stub.apk`）
5. 导致用户看到的现象就是App闪退/消失

这不是App崩溃（logcat中没有FATAL EXCEPTION或crash stack trace），而是daemon主动触发了卸载+重装stub的流程。

### 第七步：安装版本匹配的v30.7 APK

```bash
curl -sL -o /tmp/Magisk-v30.7.apk "https://github.com/topjohnwu/Magisk/releases/download/v30.7/Magisk-v30.7.apk"
# 文件大小: 11613864 bytes

adb shell "pm uninstall com.topjohnwu.magisk"
adb install /tmp/Magisk-v30.7.apk
# Success

adb shell "dumpsys package com.topjohnwu.magisk | grep -E 'versionCode|versionName'"
# versionCode=30700 minSdk=23 targetSdk=36
# versionName=30.7
```

**当前状态**: App版本v30.7 = Daemon版本v30.7，版本匹配。等待用户测试。

## 问题总结

| 项目 | 详情 |
|------|------|
| 根因 | Magisk daemon v30.7 检测到App版本不匹配时，会自动卸载App并从`/data/stub.apk`重装stub |
| 为什么stub打不开 | stub打开后需要动态下载完整代码运行，但由于某种原因（可能是daemon又触发了替换循环，或下载逻辑本身有问题）无法完成 |
| 为什么手动安装其他版本无效 | daemon会在检测到版本不一致时主动替换回stub |

## 待确认/后续排查方向

1. **安装v30.7后是否仍被替换？** — 如果版本匹配后daemon不再触发替换，App应该能正常打开（即使是stub架构，打开后应能正常工作）
2. **如果v30.7仍然无法打开**，可能的原因：
   - `/data/stub.apk` 文件损坏（daemon仍可能使用它覆盖）
   - Magisk daemon的root_access设置问题（参考GitHub gist关于`magisk.db`中`root_access`设为0的情况）
   - daemon本身有bug或配置损坏
3. **可能的修复方案**：
   - 通过adb root进入`/data/adb/`，检查/删除`stub.apk`
   - 修改`/data/adb/magisk.db`数据库中的配置
   - 重新刷入与v30.7匹配的完整boot.img（通过Magisk直接安装方式）
   - 终极方案：完全卸载Magisk（恢复原始boot.img），然后重新刷入

## 关键文件路径

- Magisk daemon: `/data/adb/magisk/`
- Magisk配置数据库: `/data/adb/magisk.db`
- Stub APK: `/data/stub.apk`（daemon用来替换App的源文件）
- 已安装App路径: `/data/app/~~xxxx==/com.topjohnwu.magisk-xxxx==/base.apk`

## 有用的诊断命令

```bash
# 检查daemon版本
adb shell "magisk -v"
adb shell "magisk -V"

# 检查App版本
adb shell "dumpsys package com.topjohnwu.magisk | grep -E 'versionCode|versionName'"

# 检查Activity组件（判断是否为stub）
adb shell "pm dump com.topjohnwu.magisk | grep -E 'Activity|MAIN'" | head -5

# 监听日志
adb logcat -c && adb logcat -v time | grep -iE "magisk|topjohnwu|FATAL|crash"

# 需要root权限的命令（当前su命令超时，可能需要在手机端terminal执行）
su -c "ls /data/adb/magisk/"
su -c "ls -la /data/stub.apk"
su -c "sqlite3 /data/adb/magisk.db 'SELECT * FROM settings;'"
```

## 参考资料

- [Magisk Stub fails to upgrade - Issue #4215](https://github.com/topjohnwu/Magisk/issues/4215)
- [Broken stub - Issue #7967](https://github.com/topjohnwu/Magisk/issues/7967)
- [Fixing Magisk 29.0 "Installed: N/A" issue](https://gist.github.com/hasezoey/dce46a9f656a5b861a68d8283cfa9ac8) — 通过修改magisk.db恢复root访问
- [Magisk v28.1 Release Notes](https://github.com/topjohnwu/Magisk/releases/tag/v28.1) — 包含"Fix stub APK download link"修复
