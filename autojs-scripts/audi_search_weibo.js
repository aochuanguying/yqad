/**
 * 微博搜索脚本
 * 功能：搜索微博热门帖子，抓取图文内容
 * 平台：微博 (Weibo)
 * 用途：汽车热点、品牌活动、用户口碑
 */

// ==================== 配置参数 ====================
const SCRIPT_VERSION = '1.0.0';
const PLATFORM = 'weibo';
const MAX_RESULTS = 5;  // 最大结果数
const SEARCH_TIMEOUT = 60000;  // 搜索超时（毫秒）

// ==================== 初始化 ====================
auto.waitFor();  // 等待无障碍服务

// 获取脚本参数
const params = getParams() || {};
const keywords = params.keywords || ['奥迪'];
const maxResults = params.maxResults || MAX_RESULTS;

log(`=== 微博搜索脚本 v${SCRIPT_VERSION} ===`);
log(`关键词：${keywords.join(', ')}`);
log(`最大结果数：${maxResults}`);

// ==================== 主函数 ====================
function main() {
  try {
    // 1. 打开微博 APP
    if (!openWeiboApp()) {
      callback({
        success: false,
        error: '无法打开微博 APP',
      });
      return;
    }
    
    sleep(2000);  // 等待 APP 加载
    
    // 2. 执行搜索
    const searchResults = searchKeywords(keywords[0], maxResults);
    
    if (!searchResults || searchResults.length === 0) {
      callback({
        success: false,
        error: '未找到搜索结果',
      });
      return;
    }
    
    log(`搜索到 ${searchResults.length} 条结果`);
    
    // 3. 返回结果
    callback({
      success: true,
      results: searchResults,
      platform: PLATFORM,
    });
    
  } catch (error) {
    logError(error);
    callback({
      success: false,
      error: error.message,
    });
  }
}

// ==================== 打开微博 APP ====================
function openWeiboApp() {
  log('打开微博 APP...');
  
  // 尝试多种方式打开微博
  const packageName = 'com.sina.weibo';
  
  // 方法 1: 启动 APP
  launch(packageName);
  sleep(3000);
  
  // 方法 2: 检查是否成功打开
  if (!currentPackage().includes(packageName)) {
    log('启动失败，尝试通过桌面图标打开...');
    app.open(packageName);
    sleep(3000);
  }
  
  const opened = currentPackage().includes(packageName);
  log(opened ? '微博 APP 已打开' : '微博 APP 打开失败');
  
  return opened;
}

// ==================== 搜索关键词 ====================
function searchKeywords(keyword, maxResults) {
  log(`搜索关键词：${keyword}`);
  
  try {
    // 1. 点击搜索框
    const searchBox = findElementByText('搜索', 3000) || 
                      findElementByDesc('搜索', 3000) ||
                      findElementById('search_input', 3000);
    
    if (!searchBox) {
      throw new Error('未找到搜索框');
    }
    
    searchBox.click();
    sleep(1000);
    
    // 2. 输入关键词
    setText(keyword);
    sleep(1000);
    
    // 3. 点击搜索按钮
    const searchButton = findElementByText('搜索', 2000) || 
                         findElementByDesc('搜索', 2000);
    
    if (searchButton) {
      searchButton.click();
      sleep(3000);  // 等待搜索结果
    } else {
      // 直接按回车
      keyCode('KEYCODE_ENTER');
      sleep(3000);
    }
    
    // 4. 抓取搜索结果
    const results = [];
    const startTime = Date.now();
    
    while (results.length < maxResults) {
      // 检查是否超时
      if (Date.now() - startTime > SEARCH_TIMEOUT) {
        log('搜索超时');
        break;
      }
      
      // 查找微博卡片
      const cards = findWeiboCards();
      
      for (const card of cards) {
        if (results.length >= maxResults) break;
        
        const result = parseWeiboCard(card);
        if (result) {
          results.push(result);
          log(`抓取到：${result.title.substring(0, 30)}...`);
        }
      }
      
      // 向下滚动
      if (results.length < maxResults) {
        scrollDown();
        sleep(2000);
      }
    }
    
    return results;
    
  } catch (error) {
    logError(error);
    return [];
  }
}

// ==================== 查找微博卡片 ====================
function findWeiboCards() {
  const cards = [];
  
  try {
    // 查找微博卡片（根据实际 UI 调整选择器）
    const selectors = [
      className('android.widget.LinearLayout').textContains('#'),
      className('android.widget.RelativeLayout').descContains('微博'),
      classNameContains('Card'),
    ];
    
    for (const selector of selectors) {
      const elements = selector.find();
      if (elements && elements.length > 0) {
        for (let i = 0; i < Math.min(elements.length, 10); i++) {
          cards.push(elements[i]);
        }
        break;
      }
    }
    
  } catch (error) {
    logError(error);
  }
  
  return cards;
}

// ==================== 解析微博卡片 ====================
function parseWeiboCard(card) {
  try {
    // 1. 提取标题（微博正文）
    let title = '';
    const titleElement = card.findOne(className('TextView').textContains('#'));
    if (titleElement) {
      title = titleElement.text();
    }
    
    // 如果没有找到标题，尝试其他选择器
    if (!title) {
      const textElements = card.find(className('TextView'));
      if (textElements && textElements.length > 0) {
        title = textElements[0].text();
      }
    }
    
    if (!title || title.length < 5) {
      return null;  // 标题太短，跳过
    }
    
    // 2. 提取内容（截取前 200 字）
    const content = title.length > 200 ? title.substring(0, 200) + '...' : title;
    
    // 3. 提取图片
    const imageUrls = extractImages(card);
    
    // 4. 提取作者
    let author = '';
    const authorElement = card.findOne(className('TextView').desc());
    if (authorElement) {
      author = authorElement.text();
    }
    
    // 5. 提取点赞数、评论数等（可选）
    const likes = extractLikes(card);
    const comments = extractComments(card);
    
    return {
      title: title.replace(/#/g, '').trim(),
      content: content,
      source: PLATFORM,
      author: author,
      likes: likes,
      comments: comments,
      imageUrls: imageUrls,
      url: '',  // 微博链接（需要点击进入详情页获取）
    };
    
  } catch (error) {
    logError(error);
    return null;
  }
}

// ==================== 提取图片 ====================
function extractImages(card) {
  const imageUrls = [];
  
  try {
    // 查找图片控件
    const imageViews = card.find(className('android.widget.ImageView'));
    
    for (let i = 0; i < Math.min(imageViews.length, 9); i++) {
      const imageView = imageViews[i];
      
      // 获取图片 URL（如果可用）
      const imageUrl = imageView.url();  // 某些设备支持
      if (imageUrl && imageUrl.startsWith('http')) {
        imageUrls.push(imageUrl);
      }
      
      // 或者获取图片描述
      const imageDesc = imageView.desc();
      if (imageDesc && imageDesc.startsWith('http')) {
        imageUrls.push(imageDesc);
      }
    }
    
  } catch (error) {
    logError(error);
  }
  
  log(`提取到 ${imageUrls.length} 张图片`);
  return imageUrls;
}

// ==================== 提取点赞数 ====================
function extractLikes(card) {
  try {
    const likeElement = card.findOne(textContains('赞'));
    if (likeElement) {
      const text = likeElement.text();
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
  } catch (error) {
    logError(error);
  }
  return 0;
}

// ==================== 提取评论数 ====================
function extractComments(card) {
  try {
    const commentElement = card.findOne(textContains('评论'));
    if (commentElement) {
      const text = commentElement.text();
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
  } catch (error) {
    logError(error);
  }
  return 0;
}

// ==================== 向下滚动 ====================
function scrollDown() {
  try {
    const deviceHeight = device.height;
    swipe(device.width / 2, deviceHeight * 0.8, device.width / 2, deviceHeight * 0.3, 500);
    log('向下滚动');
  } catch (error) {
    logError(error);
  }
}

// ==================== 辅助函数 ====================

function findElementByText(text, timeout) {
  return className('android.widget.Button').textContains(text).findOne(timeout);
}

function findElementByDesc(desc, timeout) {
  return className('android.widget.Button').descContains(desc).findOne(timeout);
}

function findElementById(id, timeout) {
  return id(id).findOne(timeout);
}

function log(message) {
  console.log(`[Weibo] ${message}`);
}

function logError(error) {
  console.error(`[Weibo] 错误：${error.message}`);
}

// ==================== 执行主函数 ====================
main();
