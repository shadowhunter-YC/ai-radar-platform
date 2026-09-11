CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  region TEXT,
  reliability INT DEFAULT 70,
  collection_method TEXT DEFAULT 'rss_or_api',
  status TEXT DEFAULT 'planned'
);

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  region TEXT,
  country_code TEXT,
  published_at TIMESTAMP,
  original_excerpt TEXT,
  summary TEXT,
  intelligence_type TEXT,
  risk_level TEXT,
  credibility_score INT,
  ai_generated_score INT,
  watermark_status TEXT,
  impact TEXT,
  recommended_action TEXT,
  tags TEXT[] DEFAULT '{}',
  lat NUMERIC,
  lng NUMERIC
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  email_subject TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO sources (name, type, url, region, reliability, collection_method, status)
VALUES
  ('OpenAI Blog', 'official_blog', 'https://openai.com/blog', 'North America', 92, 'rss_or_sitemap', 'planned'),
  ('Google AI Blog', 'official_blog', 'https://blog.google/technology/ai/', 'North America', 90, 'rss_or_sitemap', 'planned'),
  ('Anthropic News', 'official_blog', 'https://www.anthropic.com/news', 'North America', 90, 'rss_or_sitemap', 'planned'),
  ('AI Incident Database', 'incident_database', 'https://incidentdatabase.ai/', 'Global', 86, 'api_or_export', 'planned'),
  ('EU AI Act Public Updates', 'policy_site', 'https://artificialintelligenceact.eu/', 'Europe', 84, 'public_page_monitor', 'planned')
ON CONFLICT DO NOTHING;

INSERT INTO articles (
  title, source, source_type, url, region, country_code, published_at,
  original_excerpt, summary, intelligence_type, risk_level, credibility_score,
  ai_generated_score, watermark_status, impact, recommended_action, tags, lat, lng
)
VALUES
  (
    '企业客服Agent被提示注入诱导泄露内部知识库片段',
    'AI安全社区样例',
    'community',
    'https://example.com/agent-prompt-injection',
    'North America',
    'US',
    NOW() - INTERVAL '6 hours',
    '攻击者通过伪装成普通客户的问题，诱导客服Agent忽略系统提示并总结内部知识库中的敏感内容。',
    '该事件显示，接入企业知识库的AI Agent如果缺少工具调用边界和输出审查，可能被提示注入诱导泄露敏感信息。',
    '安全事件',
    '高',
    82,
    38,
    'not_detected',
    '影响客服、办公助手、企业知识库问答等Agent场景。',
    '限制Agent访问权限，对敏感知识库启用输出审查，并对高风险请求加入人工确认。',
    ARRAY['Prompt Injection','AI Agent','数据泄露','企业知识库'],
    37.7749,
    -122.4194
  ),
  (
    '某AI编程助手发布企业策略控制功能',
    'AI产品官方博客样例',
    'official_blog',
    'https://example.com/ai-coding-policy',
    'North America',
    'US',
    NOW() - INTERVAL '12 hours',
    '新的企业策略控制能力允许管理员限制代码建议范围、配置代码引用提示并查看团队使用情况。',
    'AI编程工具开始强化企业级治理能力，说明企业采购AI编码助手时需要同时评估效率、合规和审计能力。',
    '产品动态',
    '中',
    88,
    22,
    'unsupported',
    '影响研发团队AI工具选型和内部AI编码规范建设。',
    '关注企业策略控制、审计日志、代码引用提示和数据隔离能力。',
    ARRAY['AI编程','企业治理','代码安全','产品动态'],
    47.6062,
    -122.3321
  ),
  (
    '欧盟AI合规要求推动高风险AI系统透明度建设',
    'AI合规观察样例',
    'policy_site',
    'https://example.com/eu-ai-compliance',
    'Europe',
    'EU',
    NOW() - INTERVAL '1 day',
    '监管更新强调高风险AI系统需要记录数据来源、模型用途、风险控制和人工监督机制。',
    'AI监管持续从原则走向可执行要求，企业需要为高风险AI场景准备模型登记、风险评估和审计材料。',
    '合规动态',
    '中',
    79,
    31,
    'not_detected',
    '影响涉及招聘、信贷、医疗、教育、风控等高风险AI应用的企业。',
    '建立AI系统清单，记录模型用途、数据来源、风险控制和人工监督流程。',
    ARRAY['AI合规','EU AI Act','透明度','风险评估'],
    50.8503,
    4.3517
  ),
  (
    '深度伪造语音被用于冒充高管进行付款指令',
    '公开新闻样例',
    'news',
    'https://example.com/deepfake-voice-fraud',
    'Asia Pacific',
    'SG',
    NOW() - INTERVAL '2 days',
    '攻击者使用AI生成的高管语音联系财务人员，要求快速处理跨境付款。',
    '深度伪造正在从舆论风险扩展到企业财务欺诈场景，传统电话确认流程需要升级为多因素验证。',
    '安全事件',
    '高',
    76,
    44,
    'unsupported',
    '影响财务审批、远程办公和高管身份验证流程。',
    '对高额付款启用多渠道验证，建立深度伪造风险培训和异常指令复核机制。',
    ARRAY['深度伪造','语音克隆','财务欺诈','身份验证'],
    1.3521,
    103.8198
  ),
  (
    '开源模型安全评测框架新增越狱测试用例',
    '开源社区样例',
    'community',
    'https://example.com/open-model-eval',
    'Global',
    'GLOBAL',
    NOW() - INTERVAL '3 days',
    '社区项目新增一组面向越狱攻击、敏感内容输出和工具滥用的自动化测试用例。',
    '开源评测框架可以帮助企业在引入模型或Agent前进行基础安全评估，降低上线后的不可控输出风险。',
    '产品动态',
    '低',
    73,
    57,
    'detected',
    '影响模型选型、Agent上线评审和AI应用安全测试流程。',
    '在POC或上线评审中加入越狱、工具滥用和敏感输出测试集。',
    ARRAY['模型评测','Jailbreak','红队测试','开源工具'],
    51.5074,
    -0.1278
  )
ON CONFLICT DO NOTHING;
