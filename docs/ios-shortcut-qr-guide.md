# 🚗 CarPlay 断开告警 - 快捷指令配置

**扫码查看完整配置步骤**

由于无法直接生成二维码图片，请使用以下任一方式：

## 方式 1: 使用在线二维码生成器

1. 访问：https://www.qr-code-generator.com/
2. 输入 URL: `file:///Users/mac/Documents/workspace/krio/yqad/docs/ios-shortcut-guide.html`
3. 生成二维码并保存

## 方式 2: 使用命令行生成（推荐）

```bash
# 安装 qrcode 工具
npm install -g qrcode-terminal

# 生成二维码（在终端显示）
qrcode "file:///Users/mac/Documents/workspace/krio/yqad/docs/ios-shortcut-guide.html"

# 或生成图片文件
qrcode -o ios-shortcut-qr.png "file:///Users/mac/Documents/workspace/krio/yqad/docs/ios-shortcut-guide.html"
```

## 方式 3: 使用 Python 生成

```bash
# 安装库
pip install qrcode[pil]

# 生成二维码
python -c "
import qrcode
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data('file:///Users/mac/Documents/workspace/krio/yqad/docs/ios-shortcut-guide.html')
qr.make(fit=True)
img = qr.make_image(fill_color='black', back_color='white')
img.save('ios-shortcut-qr.png')
"
```

## 方式 4: 使用 iOS 快捷指令分享链接

由于本地文件无法生成分享链接，建议：

1. **手动创建快捷指令**（3 分钟）
   - 查看文档：/Users/mac/Documents/workspace/krio/yqad/docs/ios-shortcut-simple.md
   
2. **或使用在线文档**
   - 将 HTML 文件部署到可访问的 URL
   - 然后生成二维码

---

**快速配置步骤**（无需二维码）:

1. 打开快捷指令 App
2. 添加 URL: `https://yqad.hxfssc.com:8088/api/vehicle-monitor/manual-alert`
3. 添加字典：`anomalies → ["CarPlay 已断开"]`
4. 添加请求：POST + 请求头
5. 配置自动化：CarPlay 断开时触发
6. 关闭"运行前询问"

**完成！** ✅
