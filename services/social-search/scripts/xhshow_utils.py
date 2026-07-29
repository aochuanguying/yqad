#!/usr/bin/env python3
"""
xhshow 工具函数 - 用于小红书搜索和详情获取
"""

from xhshow import Xhshow
import requests
import json

class XhsClient:
    """小红书客户端，封装搜索和详情获取功能"""
    
    def __init__(self, cookie: str):
        self.client = Xhshow()
        self.cookie = cookie
        self.cookie_dict = {}
        for item in cookie.split("; "):
            if "=" in item:
                key, value = item.split("=", 1)
                self.cookie_dict[key] = value
    
    def search_notes(self, keyword: str, page: int = 1, page_size: int = 10) -> dict:
        """
        搜索笔记
        
        Args:
            keyword: 搜索关键词
            page: 页码
            page_size: 每页数量
            
        Returns:
            搜索结果字典
        """
        payload = {
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
            "search_id": self.client.get_search_request_id(),
            "extend": {
                "title_encoding": 1,
                "desc_encoding": 1
            }
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v2/search/notes",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=False
        )
        headers["Content-Type"] = "application/json"
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/explore"
        
        response = requests.post(
            "https://so.xiaohongshu.com/api/sns/web/v2/search/notes",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"搜索失败：HTTP {response.status_code}, {response.text}")
    
    def get_note_detail(self, note_id: str, xsec_token: str, xsec_source: str = "pc_search") -> dict:
        """
        获取笔记详情
        
        Args:
            note_id: 笔记 ID
            xsec_token: 从搜索 API 获取的 xsec_token
            xsec_source: 来源，默认 pc_search
            
        Returns:
            笔记详情字典
        """
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"],
            "extra": {"need_body_topic": "1"},
            "xsec_source": xsec_source,
            "xsec_token": xsec_token
        }
        
        headers = self.client.sign_headers(
            method="POST",
            uri="/api/sns/web/v1/feed",
            cookies=self.cookie_dict,
            payload=payload,
            x_rap=True
        )
        headers["Content-Type"] = "application/json"
        headers["Origin"] = "https://www.xiaohongshu.com"
        headers["Referer"] = "https://www.xiaohongshu.com/"
        
        response = requests.post(
            "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
            headers=headers,
            cookies=self.cookie_dict,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"获取详情失败：HTTP {response.status_code}, {response.text}")
    
    def search_and_get_first_detail(self, keyword: str) -> dict:
        """
        搜索并获取第一个笔记的详情
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            第一个笔记的详情字典
        """
        # 搜索
        search_result = self.search_notes(keyword)
        
        if not search_result.get('data') or not search_result['data'].get('items'):
            raise Exception("未获取到搜索结果")
        
        # 获取第一个笔记的信息
        first_note = search_result['data']['items'][0]
        note_id = first_note['id']
        xsec_token = first_note.get('xsec_token')
        
        if not xsec_token:
            raise Exception("未获取到 xsec_token")
        
        # 获取详情
        detail_result = self.get_note_detail(note_id, xsec_token)
        
        if not detail_result.get('data') or not detail_result['data'].get('items'):
            raise Exception(f"未获取到详情数据：{detail_result.get('msg', 'Unknown error')}")
        
        return detail_result['data']['items'][0]


def main():
    """测试函数"""
    # 用户提供的 Cookie
    COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; webBuild=6.25.2; acw_tc=0ad58b9a1782653515456605ed304f5cf65e03c9b4523d548086b589efb17; loadts=1782653689111; unread={%22ub%22:%226a40ba4b000000001603eaee%22%2C%22ue%22:%226a353ef2000000000f0329e6%22%2C%22uc%22:24}; websectiga=3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad; sec_poison_id=5bb0ecf4-2e0b-4a52-8235-5e4911cbf62e"
    
    client = XhsClient(COOKIE)
    
    print("=" * 60)
    print("测试 1: 搜索笔记")
    print("=" * 60)
    
    search_result = client.search_notes("Python 编程")
    print(f"搜索成功，获取到 {len(search_result['data']['items'])} 条笔记")
    
    # 显示第一个笔记的搜索信息
    first_item = search_result['data']['items'][0]
    print(f"\n第一个笔记:")
    print(f"  ID: {first_item['id']}")
    print(f"  xsec_token: {first_item.get('xsec_token', 'N/A')}")
    if 'note_card' in first_item:
        print(f"  标题：{first_item['note_card'].get('display_title', 'N/A')}")
    
    print("\n" + "=" * 60)
    print("测试 2: 获取笔记详情")
    print("=" * 60)
    
    detail_item = client.search_and_get_first_detail("Python 编程")
    print(f"\n笔记详情:")
    print(f"  ID: {detail_item.get('id')}")
    if 'note_card' in detail_item:
        card = detail_item['note_card']
        print(f"  标题：{card.get('title', 'N/A')}")
        print(f"  描述：{card.get('desc', 'N/A')[:100]}...")
        if 'user' in card:
            print(f"  用户：{card['user'].get('nickname', 'N/A')}")
        print(f"  图片数：{len(card.get('image_list', []))}")
        if 'interact_info' in card:
            interact = card['interact_info']
            print(f"  点赞：{interact.get('liked_count', 0)}")
            print(f"  收藏：{interact.get('collected_count', 0)}")
            print(f"  评论：{interact.get('comment_count', 0)}")
    
    print("\n✅ 所有测试通过！")


if __name__ == "__main__":
    main()
