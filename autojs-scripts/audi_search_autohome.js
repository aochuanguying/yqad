/**
 * 汽车之家搜索脚本
 * 功能：搜索汽车之家论坛/口碑，抓取专业内容
 * 平台：汽车之家 (Autohome)
 * 用途：车型对比、改装案例、用车报告
 */

// ==================== 配置参数 ====================
const SCRIPT_VERSION = '1.0.0';
const PLATFORM = 'autohome';
const MAX_RESULTS = 5;
const SEARCH_TIMEOUT = 60000;

// ==================== 初始化 ====================
auto.waitFor();

const params = getParams() || {};
const keywords = params.keywords || ['奥迪'];
const maxResults = params.maxResults || MAX_RESULTS;

log(`=== 汽车之家搜索脚本 v${SCRIPT_VERSION} ===`);
log(`关键词：${keywords.join(', ')}`);
log(`最大结果数：${maxResults}`);

// ==================== 主函数 ====================
function main() {
  try {
    // 1. 打开汽车之家 APP
    if (!openAutohomeApp()) {
      callback({ success: false, error: '无法打开汽车之家 APP' });
      return;
    }
    
    sleep(2000);
    
    // 2. 执行搜索
    const searchResults = searchKeywords(keywords[0], maxResults);
    
    if (!searchResults || searchResults.length === 0) {
      callback({ success: false, error: '未找到搜索结果' });
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
    callback({ success: false, error: error.message });
  }
}

// ==================== 打开汽车之家 APP ====================
function openAutohomeApp() {
  log('打开汽车之家 APP...');
  
  const packageName = 'com.autohome.app';
  launch(packageName);
  sleep(3000);
  
  const opened = currentPackage().includes(packageName);
  log(opened ? '汽车之家 APP 已打开' : '汽车之家 APP 打开失败');
  
  return opened;
}

// ==================== 搜索关键词 ====================
function searchKeywords(keyword, maxResults) {
  log(`搜索关键词：${keyword}`);
  
  try {
    // 1. 点击搜索框
    const searchBox = findElementByText('搜索', 3000) || 
                      findElementById('search_input', 3000);
    
    if (!searchBox) {
      throw new Error('未找到搜索框');
    }
    
    searchBox.click();
    sleep(1000);
    
    // 2. 输入关键词
    setText(keyword);
    sleep(1000);
    
    // 3. 点击搜索
    const searchButton = findElementByText('搜索', 2000);
    if (searchButton) {
      searchButton.click();
      sleep(3000);
    } else {
      keyCode('KEYCODE_ENTER');
      sleep(3000);
    }
    
    // 4. 切换到"论坛"标签
    clickTab('论坛');
    sleep(2000);
    
    // 5. 抓取搜索结果
    const results = [];
    const startTime = Date.now();
    
    while (results.length < maxResults) {
      if (Date.now() - startTime > SEARCH_TIMEOUT) {
        log('搜索超时');
        break;
      }
      
      const posts = findForumPosts();
      
      for (const post of posts) {
        if (results.length >= maxResults) break;
        
        const result = parseForumPost(post);
        if (result) {
          results.push(result);
          log(`抓取到：${result.title.substring(0, 30)}...`);
        }
      }
      
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

// ==================== 点击标签 ====================
function clickTab(tabName) {
  try {
    const tab = findElementByText(tabName, 2000);
    if (tab) {
      tab.click();
      log(`切换到"${tabName}"标签`);
    }
  } catch (error) {
    logError(error);
  }
}

// ==================== 查找论坛帖子 ====================
function findForumPosts() {
  const posts = [];
  
  try {
    const selectors = [
      className('android.widget.LinearLayout').textContains('论坛'),
      className('android.widget.RelativeLayout').descContains('帖子'),
      classNameContains('Card'),
    ];
    
    for (const selector of selectors) {
      const elements = selector.find();
      if (elements && elements.length > 0) {
        for (let i = 0; i < Math.min(elements.length, 10); i++) {
          posts.push(elements[i]);
        }
        break;
      }
    }
    
  } catch (error) {
    logError(error);
  }
  
  return posts;
}

// ==================== 解析论坛帖子 ====================
function parseForumPost(post) {
  try {
    // 1. 提取标题
    let title = '';
    const titleElement = post.findOne(className('TextView').text());
    if (titleElement) {
      title = titleElement.text();
    }
    
    if (!title || title.length < 10) {
      return null;
    }
    
    // 2. 提取内容摘要
    let content = '';
    const contentElement = post.findOne(className('TextView').desc());
    if (contentElement) {
      content = contentElement.text();
    }
    
    // 3. 提取图片
    const imageUrls = extractImages(post);
    
    // 4. 提取作者
    let author = '';
    const authorElement = post.findOne(textContains('楼主'));
    if (authorElement) {
      const parent = authorElement.parent();
      if (parent) {
        const authorText = parent.findOne(className('TextView'));
        if (authorText) {
          author = authorText.text();
        }
      }
    }
    
    // 5. 提取回复数
    let replies = 0;
    const replyElement = post.findOne(textContains('回复'));
    if (replyElement) {
      const text = replyElement.text();
      const match = text.match(/(\d+)/);
      if (match) {
        replies = parseInt(match[1]);
      }
    }
    
    return {
      title: title.trim(),
      content: content ? content.substring(0, 300) : title,
      source: PLATFORM,
      author: author,
      replies: replies,
      imageUrls: imageUrls,
      url: '',
    };
    
  } catch (error) {
    logError(error);
    return null;
  }
}

// ==================== 提取图片 ====================
function extractImages(post) {
  const imageUrls = [];
  
  try {
    const imageViews = post.find(className('android.widget.ImageView'));
    
    for (let i = 0; i < Math.min(imageViews.length, 9); i++) {
      const imageView = imageViews[i];
      const imageUrl = imageView.url();
      if (imageUrl && imageUrl.startsWith('http')) {
        imageUrls.push(imageUrl);
      }
    }
    
  } catch (error) {
    logError(error);
  }
  
  return imageUrls;
}

// ==================== 向下滚动 ====================
function scrollDown() {
  try {
    const deviceHeight = device.height;
    swipe(device.width / 2, deviceHeight * 0.8, device.width / 2, deviceHeight * 0.3, 500);
  } catch (error) {
    logError(error);
  }
}

// ==================== 辅助函数 ====================
function findElementByText(text, timeout) {
  return className('android.widget.Button').textContains(text).findOne(timeout);
}

function findElementById(id, timeout) {
  return id(id).findOne(timeout);
}

function log(message) {
  console.log(`[Autohome] ${message}`);
}

function logError(error) {
  console.error(`[Autohome] 错误：${error.message}`);
}

// ==================== 执行主函数 ====================
main();
