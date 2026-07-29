export function getOpenApiSpec(): object {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Social Search API',
      version: '1.0.0',
      description: '社交平台内容搜索服务，支持知乎和小红书',
    },
    servers: [{ url: '/api/search' }],
    paths: {
      '/zhihu': {
        post: {
          summary: '搜索知乎问答和文章',
          operationId: 'searchZhihu',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string', description: '搜索关键词' },
                    type: { type: 'string', enum: ['general', 'article'], description: '搜索类型' },
                    maxResults: { type: 'number', default: 10, description: '最大返回结果数' },
                    summaryMode: { type: 'boolean', default: false, description: '摘要模式' },
                    noCache: { type: 'boolean', default: false, description: '跳过缓存' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: '搜索成功',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchResponse' } } },
            },
          },
        },
      },
      '/zhihu/content': {
        post: {
          summary: '获取知乎内容详情',
          operationId: 'getZhihuContent',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url'],
                  properties: {
                    url: { type: 'string', description: '知乎回答或文章 URL' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: '获取成功' } },
        },
      },
      '/xiaohongshu': {
        post: {
          summary: '搜索小红书笔记',
          operationId: 'searchXiaohongshu',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string', description: '搜索关键词' },
                    sortBy: { type: 'string', enum: ['relevance', 'latest'], description: '排序方式' },
                    maxResults: { type: 'number', default: 10, description: '最大返回结果数' },
                    summaryMode: { type: 'boolean', default: false, description: '摘要模式' },
                    noCache: { type: 'boolean', default: false, description: '跳过缓存' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: '搜索成功',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchResponse' } } },
            },
          },
        },
      },
      '/xiaohongshu/note': {
        post: {
          summary: '获取小红书笔记详情',
          operationId: 'getXiaohongshuNote',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['noteId'],
                  properties: {
                    noteId: { type: 'string', description: '小红书笔记 ID' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: '获取成功' } },
        },
      },
    },
    components: {
      schemas: {
        SearchResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
            count: { type: 'number' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            snippet: { type: 'string' },
            author: { type: 'string' },
            url: { type: 'string' },
            publishedAt: { type: 'string' },
            extra: { type: 'object' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}
