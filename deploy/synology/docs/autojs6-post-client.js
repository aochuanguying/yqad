/**
 * 奥迪社区自动发帖客户端 - Auto.js6 版本
 * 适用于 Android 15 (已 root)
 * 
 * 功能：
 * 1. 调用远程 API 获取发帖内容
 * 2. 下载图片到本地
 * 3. 自动打开奥迪 APP 并发布帖子
 * 
 * 使用前请配置：
 * - SERVER_URL: 服务端地址
 * - AUTH_TOKEN: 认证 Token
 * - APP_PACKAGE: 奥迪 APP 包名
 */

// ==================== 配置区域 ====================

/** 服务端地址（请修改为实际 IP） */
const SERVER_URL = 'http://192.168.1.100:3000/api';

/** 认证 Token（从 data/token.json 获取） */
const AUTH_TOKEN = 'your-token-here';

/** 奥迪 APP 包名 */
const APP_PACKAGE = 'com.faw.audi';

/** 图片保存路径 */
const IMAGE_SAVE_PATH = '/sdcard/Pictures/AudiPosts/';

/** 发帖模式：'featured' | 'normal' */
const POST_MODE = 'featured';

/** 是否使用主题 */
const USE_TOPIC = true;

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 60000;

// ==================== 全局变量 ====================

let currentPost = null;
let downloadedImages = [];

// ==================== 工具函数 ====================

/**
 * 发送 HTTP 请求
 * @param {string} url 请求 URL
 * @param {object} options 请求选项
 * @returns {object} 响应数据
 */
function httpRequest(url, options = {}) {
    try {
        const response = http.post(url, options.data || {}, {
            headers: options.headers || {},
            timeout: options.timeout || REQUEST_TIMEOUT
        });
        
        if (response.statusCode === 200) {
            return JSON.parse(response.body.string());
        } else {
            log(`HTTP 错误：${response.statusCode}`);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (e) {
        log(`请求异常：${e.message}`);
        return { success: false, error: e.message };
    }
}

/**
 * 下载图片到本地
 * @param {string} imageUrl 图片 URL
 * @param {string} filename 保存文件名
 * @returns {string} 本地文件路径
 */
function downloadImage(imageUrl, filename) {
    try {
        const savePath = IMAGE_SAVE_PATH + filename;
        
        // 创建目录
        files.createWithDirs(savePath);
        
        // 下载图片
        const response = http.get(imageUrl, {
            headers: {
                'Authorization': 'Bearer ' + AUTH_TOKEN
            },
            timeout: REQUEST_TIMEOUT
        });
        
        if (response.statusCode === 200) {
            files.writeBytes(savePath, response.body.bytes());
            log(`图片下载成功：${savePath}`);
            return savePath;
        } else {
            log(`图片下载失败：HTTP ${response.statusCode}`);
            return null;
        }
    } catch (e) {
        log(`图片下载异常：${e.message}`);
        return null;
    }
}

/**
 * 格式化时间
 * @param {number} timestamp 时间戳
 * @returns {string} 格式化后的时间
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ==================== 核心功能 ====================

/**
 * 获取发帖内容
 * @param {object} options 请求参数
 * @returns {object} 发帖内容
 */
function fetchPostContent(options = {}) {
    log('正在获取发帖内容...');
    
    const url = SERVER_URL + '/posts/generate';
    const response = httpRequest(url, {
        data: {
            useTopic: options.useTopic !== undefined ? options.useTopic : USE_TOPIC,
            mode: options.mode || POST_MODE,
            topicId: options.topicId || undefined
        },
        headers: {
            'Authorization': 'Bearer ' + AUTH_TOKEN,
            'Content-Type': 'application/json'
        }
    });
    
    if (response.success && response.data) {
        log(`✓ 发帖内容获取成功`);
        log(`  标题：${response.data.title}`);
        log(`  字数：${response.data.content.length}`);
        log(`  图片：${response.data.images.length}张`);
        log(`  模式：${response.data.mode}`);
        
        if (response.data.topics && response.data.topics.length > 0) {
            log(`  话题：${response.data.topics.map(t => t.name).join(', ')}`);
        }
        
        currentPost = response.data;
        return currentPost;
    } else {
        log(`✗ 发帖内容获取失败：${response.error}`);
        return null;
    }
}

/**
 * 下载所有图片
 * @returns {boolean} 是否全部下载成功
 */
function downloadAllImages() {
    if (!currentPost || !currentPost.images || currentPost.images.length === 0) {
        log('没有图片需要下载');
        return true;
    }
    
    log(`开始下载 ${currentPost.images.length} 张图片...`);
    downloadedImages = [];
    
    for (let i = 0; i < currentPost.images.length; i++) {
        const image = currentPost.images[i];
        const filename = `post_${Date.now()}_${i}.jpg`;
        
        log(`下载图片 ${i + 1}/${currentPost.images.length}: ${image.filename}`);
        const localPath = downloadImage(image.url, filename);
        
        if (localPath) {
            downloadedImages.push(localPath);
        } else {
            log(`警告：图片 ${i + 1} 下载失败`);
        }
    }
    
    const success = downloadedImages.length === currentPost.images.length;
    log(`图片下载完成：成功 ${downloadedImages.length}/${currentPost.images.length} 张`);
    return success;
}

/**
 * 自动发布帖子到奥迪社区
 * 需要根据实际 APP 界面调整控件选择器
 */
function autoPublishPost() {
    if (!currentPost) {
        log('错误：没有发帖内容');
        return false;
    }
    
    if (downloadedImages.length === 0) {
        log('错误：没有图片');
        return false;
    }
    
    log('开始自动发布帖子...');
    
    try {
        // 1. 打开奥迪 APP
        log('打开奥迪 APP...');
        launch(APP_PACKAGE);
        sleep(3000);
        
        // 2. 进入发帖页面（需要根据实际 APP 调整）
        log('进入发帖页面...');
        // 示例：点击底部导航栏的发布按钮
        // 需要根据实际 APP 的 UI 结构调整选择器
        const publishButton = className('android.widget.Button')
            .text('发布')
            .findOne(5000);
        
        if (publishButton) {
            publishButton.click();
            sleep(2000);
        } else {
            log('未找到发布按钮，请手动进入发帖页面');
            // 等待用户手动进入发帖页面
            toast('请手动进入发帖页面');
            sleep(5000);
        }
        
        // 3. 输入标题
        log('输入标题...');
        const titleInput = className('android.widget.EditText')
            .desc('标题')
            .findOne(5000);
        
        if (titleInput) {
            titleInput.setText(currentPost.title);
            sleep(500);
        } else {
            log('未找到标题输入框');
        }
        
        // 4. 输入内容
        log('输入正文内容...');
        const contentInput = className('android.widget.EditText')
            .desc('内容')
            .findOne(5000);
        
        if (contentInput) {
            contentInput.setText(currentPost.content);
            sleep(500);
        } else {
            log('未找到内容输入框');
        }
        
        // 5. 上传图片
        log('上传图片...');
        const addButton = className('android.widget.ImageView')
            .desc('添加图片')
            .findOne(5000);
        
        if (addButton) {
            addButton.click();
            sleep(1000);
            
            // 选择图片（系统相册）
            // 这里需要根据实际系统调整
            for (let i = 0; i < downloadedImages.length && i < 9; i++) {
                const imagePath = downloadedImages[i];
                log(`选择图片：${imagePath}`);
                
                // 使用 Auto.js 的图片选择功能
                // 注意：这可能需要辅助功能权限
                images.requestScreenCapture();
                
                // 这里需要根据实际的文件选择器 UI 调整
                // 简化处理：提示用户手动选择
                toast(`请手动选择第 ${i + 1} 张图片`);
                sleep(2000);
            }
        }
        
        // 6. 选择话题（如果有）
        if (currentPost.topics && currentPost.topics.length > 0) {
            log('选择话题...');
            const topicButton = className('android.widget.TextView')
                .text('添加话题')
                .findOne(5000);
            
            if (topicButton) {
                topicButton.click();
                sleep(1000);
                
                // 选择第一个推荐话题
                const firstTopic = className('android.widget.TextView')
                    .text(currentPost.topics[0].name)
                    .findOne(5000);
                
                if (firstTopic) {
                    firstTopic.click();
                    sleep(500);
                }
            }
        }
        
        // 7. 点击发布
        log('点击发布...');
        const submitButton = className('android.widget.Button')
            .text('发布')
            .findOne(5000);
        
        if (submitButton) {
            submitButton.click();
            sleep(3000);
            
            // 检查是否发布成功
            const successToast = text('发布成功').findOne(3000);
            if (successToast) {
                log('✓ 帖子发布成功！');
                toast('发帖成功！');
                return true;
            } else {
                log('发布状态未知，请检查 APP');
                toast('请检查发布状态');
                return false;
            }
        } else {
            log('未找到发布按钮');
            return false;
        }
        
    } catch (e) {
        log(`发布异常：${e.message}`);
        log(e.stack);
        return false;
    }
}

/**
 * 完整流程：获取内容 -> 下载图片 -> 发布
 */
function runAutoPost() {
    log('=== 奥迪社区自动发帖 ===');
    log(`时间：${formatTime(Date.now())}`);
    log(`模式：${POST_MODE}`);
    log(`使用主题：${USE_TOPIC}`);
    log('');
    
    // 1. 获取发帖内容
    const post = fetchPostContent({
        mode: POST_MODE,
        useTopic: USE_TOPIC
    });
    
    if (!post) {
        log('发帖内容获取失败，终止流程');
        toast('发帖失败：无法获取内容');
        return false;
    }
    
    // 2. 下载图片
    if (!downloadAllImages()) {
        log('图片下载失败，终止流程');
        toast('发帖失败：图片下载失败');
        return false;
    }
    
    // 3. 发布帖子
    const published = autoPublishPost();
    
    if (published) {
        log('发帖流程完成！');
        toast('发帖成功！');
        return true;
    } else {
        log('发帖失败，请检查日志');
        toast('发帖失败');
        return false;
    }
}

// ==================== 主程序 ====================

// 显示配置对话框
function showConfigDialog() {
    const config = dialogs.build({
        title: '发帖配置',
        content: `当前配置：\n` +
                 `服务端：${SERVER_URL}\n` +
                 `模式：${POST_MODE}\n` +
                 `使用主题：${USE_TOPIC}\n\n` +
                 `点击"确定"开始发帖`,
        positive: '确定',
        negative: '取消'
    })
    .on('positive', () => {
        runAutoPost();
    })
    .on('negative', () => {
        log('用户取消发帖');
    })
    .show();
}

// 启动
log('Auto.js6 发帖客户端已启动');
log(`服务端：${SERVER_URL}`);
log('');

// 检查权限
if (!device.isRooted()) {
    log('警告：设备未 root，部分功能可能受限');
}

// 确保图片目录存在
files.createWithDirs(IMAGE_SAVE_PATH);

// 显示配置对话框
showConfigDialog();
