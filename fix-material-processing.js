const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'dist/services/material-processing.js');
let content = fs.readFileSync(filePath, 'utf-8');

// 替换 runVisionIfEnabled 函数
const oldFunction = `async function runVisionIfEnabled(imagePath, forceEnabled) {
    const p = (0, materials_paths_1.getMaterialsProcessingConfig)();
    if (!(forceEnabled ?? p.enableVision))
        return undefined;
    const vision = buildVisionClient();
    if (!vision)
        return { tags: [], intro: '', error: 'Vision 配置缺失' };
    let buffer;
    try {
        buffer = await (0, sharp_1.default)(imagePath).rotate().resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { tags: [], intro: '', error: `图片预处理失败：${msg}` };
    }
    const base64 = buffer.toString('base64');
    const mimeType = 'image/jpeg';
    try {
        const resp = await vision.client.chat.completions.create({
            model: vision.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '请识别这张图片的主要内容，并严格输出 JSON（不要输出多余文字）。字段：tags(字符串数组，3-10 个)，intro(用于检索与发帖参考的中文介绍，80-150 字)。',
                        },
                        { type: 'image_url', image_url: { url: \`data:\${mimeType};base64,\${base64}\` } },
                    ],
                },
            ],
            max_tokens: 400,
            temperature: 0.2,
        });
        const content = resp.choices?.[0]?.message?.content || '';
        const parsed = parseVisionJson(content);
        return { tags: parsed.tags, intro: parsed.intro };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { tags: [], intro: '', error: msg };
    }
}`;

const newFunction = `async function runVisionIfEnabled(imagePath, forceEnabled) {
    const p = (0, materials_paths_1.getMaterialsProcessingConfig)();
    if (!(forceEnabled ?? p.enableVision))
        return undefined;
    const vision = buildVisionClient();
    if (!vision) {
        metrics_1.metricsCollector.recordRequest('material-vision', false, 0, { triggeredFallback: false });
        return { tags: [], intro: '', error: 'Vision 配置缺失' };
    }
    const startTime = Date.now();
    let buffer;
    try {
        buffer = await (0, sharp_1.default)(imagePath).rotate().resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const responseTime = Date.now() - startTime;
        metrics_1.metricsCollector.recordRequest('material-vision', false, responseTime, { triggeredFallback: false });
        return { tags: [], intro: '', error: \`图片预处理失败：\${msg}\` };
    }
    const base64 = buffer.toString('base64');
    const mimeType = 'image/jpeg';
    try {
        const resp = await vision.client.chat.completions.create({
            model: vision.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '请识别这张图片的主要内容，并严格输出 JSON（不要输出多余文字）。字段��tags(字符串数组，3-10 个)，intro(用于检索与发帖参考的中文介绍，80-150 字)。',
                        },
                        { type: 'image_url', image_url: { url: \`data:\${mimeType};base64,\${base64}\` } },
                    ],
                },
            ],
            max_tokens: 400,
            temperature: 0.2,
        });
        const responseTime = Date.now() - startTime;
        const content = resp.choices?.[0]?.message?.content || '';
        const parsed = parseVisionJson(content);
        metrics_1.metricsCollector.recordRequest('material-vision', true, responseTime, { triggeredFallback: false });
        return { tags: parsed.tags, intro: parsed.intro };
    }
    catch (e) {
        const responseTime = Date.now() - startTime;
        const msg = e instanceof Error ? e.message : String(e);
        metrics_1.metricsCollector.recordRequest('material-vision', false, responseTime, { triggeredFallback: false });
        return { tags: [], intro: '', error: msg };
    }
}`;

if (!content.includes(oldFunction)) {
    console.error('错误：找不到要替换的函数内容');
    console.error('文件可能已被修改或格式不同');
    process.exit(1);
}

content = content.replace(oldFunction, newFunction);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('✓ 文件修改成功');
