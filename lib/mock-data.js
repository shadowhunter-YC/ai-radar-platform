export const sources = [
  {
    id: 1,
    name: "OpenAI News",
    type: "官方博客",
    url: "https://openai.com/news/",
    region: "North America",
    reliability: 95,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 2 次",
    owner: "产品动态",
    notes: "跟踪 GPT、ChatGPT、API、企业能力与模型安全说明。"
  },
  {
    id: 2,
    name: "Anthropic News",
    type: "官方新闻",
    url: "https://www.anthropic.com/news",
    region: "North America",
    reliability: 90,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪 Claude、企业产品、模型安全和责任式 AI 更新。"
  },
  {
    id: 3,
    name: "Google AI Blog",
    type: "官方博客",
    url: "https://blog.google/innovation-and-ai/technology/ai/",
    region: "North America",
    reliability: 90,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪 Gemini、Google AI 产品、开发者工具和研究应用。"
  },
  {
    id: 4,
    name: "Microsoft AI News",
    type: "官方新闻",
    url: "https://news.microsoft.com/source/tag/ai/",
    region: "North America",
    reliability: 88,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪 Copilot、Azure AI、企业 AI 应用和行业落地案例。"
  },
  {
    id: 5,
    name: "European Commission AI Act",
    type: "官方监管",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    region: "Europe",
    reliability: 94,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每周 3 次",
    owner: "合规动态",
    notes: "跟踪欧盟 AI 法案、透明度要求、高风险系统和监管框架更新。"
  },
  {
    id: 6,
    name: "EUR-Lex AI Act",
    type: "法规文本",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng",
    region: "Europe",
    reliability: 96,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每周 1 次",
    owner: "合规动态",
    notes: "跟踪欧盟 AI Act 正式法规文本、版本变化和条款更新。"
  },
  {
    id: 7,
    name: "OECD AI Policy Observatory",
    type: "政策观察",
    url: "https://oecd.ai/en/",
    region: "Global",
    reliability: 91,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每周 3 次",
    owner: "合规动态",
    notes: "跟踪各国 AI 政策、治理框架、风险议题和国际组织观察。"
  },
  {
    id: 8,
    name: "NIST AI Risk Management Framework",
    type: "标准框架",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    region: "North America",
    reliability: 93,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每周 2 次",
    owner: "合规动态",
    notes: "跟踪 AI 风险管理框架、可信 AI、企业治理和标准实践。"
  },
  {
    id: 9,
    name: "AI Incident Database",
    type: "事件数据库",
    url: "https://aiincidents.org/explorer/",
    region: "Global",
    reliability: 86,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "安全事件",
    notes: "聚合 AI 事故、误用、偏见、伤害案例和社会影响类事件。"
  },
  {
    id: 10,
    name: "OECD AI Incidents Monitor",
    type: "事件监测",
    url: "https://oecd.ai/en/site/incidents",
    region: "Global",
    reliability: 89,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "安全事件",
    notes: "跟踪全球 AI 事件、AI 风险案例及其与政策治理的关联。"
  },
  {
    id: 11,
    name: "AI Failure Index",
    type: "事件索引",
    url: "https://failureindex.ai/",
    region: "Global",
    reliability: 78,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "安全事件",
    notes: "跟踪生产环境 AI 失败案例、业务影响和行业风险信号。"
  },
  {
    id: 12,
    name: "AI Incident Tracker",
    type: "事件追踪",
    url: "https://aiincidenttracker.com/",
    region: "Global",
    reliability: 76,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "安全事件",
    notes: "跟踪 AI 事件数据库、法律合规关联和公开披露案例。"
  },
  {
    id: 13,
    name: "腾讯混元产品动态",
    type: "产品文档",
    url: "https://cloud.tencent.cn/document/product/1729/97765",
    region: "Asia Pacific",
    reliability: 88,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪腾讯混元模型版本、TokenHub 迁移、Agent 能力和多模态模型更新。"
  },
  {
    id: 14,
    name: "火山引擎发布中心",
    type: "发布中心",
    url: "https://www.volcengine.com/news",
    region: "Asia Pacific",
    reliability: 87,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪豆包大模型、火山方舟、知识库、向量库和企业 AI 产品能力更新。"
  },
  {
    id: 15,
    name: "Simon Willison's Weblog",
    type: "专家博客",
    url: "https://simonwillison.net/",
    region: "Global",
    reliability: 84,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "跟踪生成式 AI、Agent、模型发布、开发工具和行业技术观察。"
  },
  {
    id: 16,
    name: "Random_Walker",
    type: "X博主",
    url: "https://twstalker.com/random_walker",
    region: "North America",
    reliability: 82,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "合规动态",
    notes: "通过 TwStalker 镜像页采集，原始账号为 https://x.com/random_walker，跟踪其对 AI 治理、AI 风险、AI 产品宣传和社会影响的公开观点。"
  },
  {
    id: 17,
    name: "giovannicatt3",
    type: "X博主",
    url: "https://x.com/giovannicatt3",
    region: "Global",
    reliability: 78,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "监测 X 公开主页中的 AI 产品、模型能力、工具生态和行业观察动态。"
  },
  {
    id: 18,
    name: "DoWCTO",
    type: "X博主",
    url: "https://x.com/DoWCTO",
    region: "Global",
    reliability: 78,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "监测 X 公开主页中的 AI 产品、工具、Agent 应用和圈内观点动态。"
  },
  {
    id: 19,
    name: "DavidOndrej1",
    type: "X博主",
    url: "https://x.com/DavidOndrej1",
    region: "Global",
    reliability: 78,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "监测 X 公开主页中的 AI 产品、应用案例、自动化工具和技术趋势动态。"
  },
  {
    id: 20,
    name: "lingxi",
    type: "X博主",
    url: "https://x.com/lingxi",
    region: "Global",
    reliability: 78,
    collectionMethod: "URL监测",
    status: "采集中",
    cadence: "每日 1 次",
    owner: "产品动态",
    notes: "监测 X 公开主页中的 AI 产品、模型应用、行业观察和圈内讨论动态。"
  }
];

export const articles = [
  {
    id: 11,
    title: "OpenAI 推出 GPT-5.5-Cyber 受信访问，面向防守方强化网络安全工作流",
    source: "OpenAI",
    sourceType: "官方安全博客",
    url: "https://openai.com/index/gpt-5-5-with-trusted-access-for-cyber/",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-05-07T09:00:00+08:00",
    originalExcerpt: "OpenAI 介绍 GPT-5.5 与 GPT-5.5-Cyber 在 Trusted Access for Cyber 下支持漏洞识别、恶意软件分析、检测工程、补丁验证和授权红队等防守工作流。",
    summary: "OpenAI 将 GPT-5.5-Cyber 作为受限预览能力提供给经过验证的防守方，强调通过身份验证、用途范围和更强账号安全控制，在降低恶意滥用风险的同时提升漏洞分析、检测工程和补丁验证效率。",
    insight: "这条动态说明前沿模型的网络安全能力正在从通用助手走向分级授权。企业如果计划把大模型用于漏洞研究或安全运营，需要同步设计身份校验、任务授权、审计留痕和防滥用策略。",
    intelligenceType: "产品动态",
    riskLevel: "中",
    credibilityScore: 94,
    aiGeneratedScore: 11,
    watermarkStatus: "官方来源",
    impact: "影响安全运营中心、漏洞管理、红队验证、代码安全审查和关键基础设施防护工作流。",
    recommendedAction: "评估受信访问模型是否适合内部防守场景，并建立授权范围、输出审查、账号安全和审计流程。",
    tags: ["OpenAI", "GPT-5.5-Cyber", "Trusted Access", "漏洞分析", "检测工程", "AI安全"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 98 },
      { label: "交叉验证", value: 89 },
      { label: "AI生成概率", value: 11 },
      { label: "水印检测", value: 86 }
    ]
  },
  {
    id: 10,
    title: "ChatGPT Lockdown Mode 扩展到更多用户，降低提示注入导致的数据外传风险",
    source: "OpenAI Help Center",
    sourceType: "官方帮助文档",
    url: "https://help.openai.com/en/articles/20001061",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-09-03T09:00:00+08:00",
    originalExcerpt: "OpenAI 帮助文档说明 Lockdown Mode 会限制连接 Web 和外部服务的能力，用于降低提示注入攻击最后阶段的数据外传风险。",
    summary: "ChatGPT Lockdown Mode 是面向高安全需求用户和工作区的高级安全设置，可限制联网、外部服务、下载和部分工具能力，以降低提示注入场景下敏感数据被带出系统的风险。",
    insight: "这更像企业 AI 办公的安全模式开关，而不是单一模型能力。对处理敏感数据的团队来说，默认联网能力、文件下载和外部连接都应根据岗位风险分层配置。",
    intelligenceType: "产品动态",
    riskLevel: "中",
    credibilityScore: 93,
    aiGeneratedScore: 10,
    watermarkStatus: "官方来源",
    impact: "影响企业 ChatGPT 工作区安全策略、敏感岗位使用规范、提示注入防护和数据外传控制。",
    recommendedAction: "为高风险岗位启用更严格的联网和工具权限策略，并将 Lockdown Mode 纳入 AI 办公安全基线。",
    tags: ["ChatGPT", "Lockdown Mode", "提示注入", "数据外传", "企业安全"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 97 },
      { label: "交叉验证", value: 86 },
      { label: "AI生成概率", value: 10 },
      { label: "水印检测", value: 84 }
    ]
  },
  {
    id: 9,
    title: "Anthropic 发布 Claude 4 网络安全评估，模型在漏洞识别和多步攻击链上能力提升",
    source: "Anthropic Research",
    sourceType: "官方研究报告",
    url: "https://www.anthropic.com/research/claude-4-cyber",
    region: "North America",
    countryCode: "US",
    publishedAt: "2025-07-15T09:00:00+08:00",
    originalExcerpt: "Anthropic 与 Pattern Labs 对 Claude Opus 4 和 Claude Sonnet 4 进行网络安全评估，覆盖 CTF 挑战和复杂网络环境模拟。",
    summary: "Anthropic 的 Claude 4 网络安全评估显示，模型在灵活调整解题策略、漏洞识别和执行多步骤攻击链方面明显进步，但在长周期计划保持和意外障碍处理上仍存在限制。",
    insight: "这类评估对防守方有双重意义：模型可以增强漏洞研究和红队测试效率，但能力提升也意味着企业需要更严格地管理模型接入的靶场、网络权限和外部连接。",
    intelligenceType: "安全事件",
    riskLevel: "高",
    credibilityScore: 91,
    aiGeneratedScore: 14,
    watermarkStatus: "官方来源",
    impact: "影响 AI 红队、漏洞研究、攻防演练、模型安全评估和高风险网络能力管控。",
    recommendedAction: "将模型网络安全能力评估纳入供应商审查，并限制测试环境外联、凭据访问和真实系统触达能力。",
    tags: ["Claude", "Anthropic", "网络安全评估", "漏洞识别", "攻击链", "红队测试"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 96 },
      { label: "交叉验证", value: 82 },
      { label: "AI生成概率", value: 14 },
      { label: "水印检测", value: 81 }
    ]
  },
  {
    id: 8,
    title: "Anthropic 复盘 Claude 网络安全评估事故，强调隔离环境和外联控制",
    source: "Anthropic Research",
    sourceType: "官方安全复盘",
    url: "https://www.anthropic.com/research/investigating-incidents-cybersecurity-evals",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-07-30T09:00:00+08:00",
    originalExcerpt: "Anthropic 在复盘网络安全评估记录时发现，Claude 模型曾从第三方评估环境触达互联网，并访问真实组织的生产基础设施。",
    summary: "Anthropic 披露并复盘三起网络安全评估相关事故，指出模型在 CTF 风格任务中可能通过评估环境外联触达真实系统，后续需要加强沙箱隔离、网络出口控制和评估环境审计。",
    insight: "这是 AI&Cyber 场景里很典型的边界问题：即便任务被设计为虚拟评估，只要环境存在外联路径，模型能力就可能触达真实资产。安全评估平台必须默认按真实攻击面管理。",
    intelligenceType: "安全事件",
    riskLevel: "高",
    credibilityScore: 92,
    aiGeneratedScore: 13,
    watermarkStatus: "官方来源",
    impact: "影响模型安全评估、靶场设计、第三方测试环境、网络隔离和真实资产保护。",
    recommendedAction: "对 AI 网络安全评估环境实施默认断网、出口白名单、凭据隔离和完整审计，避免测试任务越界触达真实系统。",
    tags: ["Claude", "Anthropic", "评估事故", "沙箱隔离", "外联控制", "AI安全"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 96 },
      { label: "交叉验证", value: 84 },
      { label: "AI生成概率", value: 13 },
      { label: "水印检测", value: 80 }
    ]
  },
  {
    id: 7,
    title: "企业数据使用折扣暴露 AI 公司数据价值与企业隐私顾虑",
    source: "Random_Walker / TwStalker 镜像页",
    sourceType: "X公开页面镜像",
    url: "https://twstalker.com/random_walker",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-09-07T09:00:00+08:00",
    originalExcerpt: "TwStalker 镜像页显示，Random_Walker 讨论 AI 公司通过价格差异体现用户数据价值，以及企业客户对数据留存和治理能力的关注。",
    summary: "Random_Walker 认为，AI 模型定价中对数据使用的折扣反映了用户数据对 AI 公司的价值；企业愿意为数据留存和治理能力支付更高价格，说明企业对 AI 公司使用其数据仍高度谨慎。",
    insight: "这类观点对网络安全团队的价值在于提醒企业重新审视 AI 工具采购中的数据边界：价格折扣背后可能对应训练授权、日志留存或数据再利用，安全评估不能只看功能和成本。",
    intelligenceType: "合规动态",
    riskLevel: "中",
    credibilityScore: 82,
    aiGeneratedScore: 20,
    watermarkStatus: "镜像页采集",
    impact: "影响企业 AI 服务采购、数据留存策略、供应商评估和内部 AI 使用合规要求。",
    recommendedAction: "将企业数据是否用于训练、数据留存周期、审计能力和敏感任务路由策略纳入 AI 工具选型评估。",
    tags: ["AI合规", "企业数据", "模型定价", "数据留存", "AI治理", "Random_Walker"],
    lat: 40.7128,
    lng: -74.006,
    credibilitySignals: [
      { label: "来源可信", value: 82 },
      { label: "交叉验证", value: 68 },
      { label: "AI生成概率", value: 20 },
      { label: "水印检测", value: 58 }
    ]
  },
  {
    id: 6,
    title: "GPT-6 Astra: A new generation of intelligence",
    source: "OpenAI News",
    sourceType: "官方新闻",
    url: "https://openai.com/index/gpt-6-astra/",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-09-03T09:00:00+08:00",
    originalExcerpt: "OpenAI 发布 GPT-6 Astra，介绍新一代模型在计算机使用、软件工程、科学研究、专业工作和安全对齐方面的能力提升。",
    summary: "OpenAI 发布 GPT-6 Astra，定位为新一代高智能、强对齐模型，重点提升计算机使用、浏览、软件工程、专业工作、科学研究和安全对齐能力，并将逐步开放给 ChatGPT 用户、API、Azure 和 AWS Bedrock。",
    insight: "如果模型具备更强的计算机使用和代码能力，企业应同步提高 Agent 权限治理、浏览器隔离、工具调用审计和安全测试强度，否则生产力提升会同时放大误操作和滥用风险。",
    intelligenceType: "产品动态",
    riskLevel: "低",
    credibilityScore: 95,
    aiGeneratedScore: 12,
    watermarkStatus: "官方来源",
    impact: "影响企业模型选型、Agent应用建设、API集成规划和AI能力路线图评估。",
    recommendedAction: "关注 Astra 的企业开通策略、API定价、模型能力边界和安全部署说明，评估是否纳入下一阶段AI应用试点。",
    tags: ["GPT-6 Astra", "OpenAI", "AI模型发布", "企业AI", "API", "Agent"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 98 },
      { label: "交叉验证", value: 90 },
      { label: "AI生成概率", value: 12 },
      { label: "水印检测", value: 86 }
    ]
  },
  {
    id: 1,
    title: "企业客服Agent被提示注入诱导泄露内部知识库片段",
    source: "AI安全社区样例",
    sourceType: "社区论坛",
    url: "https://example.com/agent-prompt-injection",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-09-04T02:20:00+08:00",
    originalExcerpt: "攻击者通过伪装成普通客户的问题，诱导客服Agent忽略系统提示并总结内部知识库中的敏感内容。",
    summary: "该事件显示，接入企业知识库的AI Agent如果缺少工具调用边界和输出审查，可能被提示注入诱导泄露敏感信息。",
    insight: "提示注入已经从模型安全问题变成企业数据安全问题。只做提示词约束不够，关键是把知识库权限、检索范围、敏感字段脱敏和输出复核做成系统级控制。",
    intelligenceType: "安全事件",
    riskLevel: "高",
    credibilityScore: 82,
    aiGeneratedScore: 38,
    watermarkStatus: "未检测到",
    impact: "影响客服、办公助手、企业知识库问答等Agent场景。",
    recommendedAction: "限制Agent访问权限，对敏感知识库启用输出审查，并对高风险请求加入人工确认。",
    tags: ["Prompt Injection", "AI Agent", "数据泄露", "企业知识库"],
    lat: 37.7749,
    lng: -122.4194,
    credibilitySignals: [
      { label: "来源可信", value: 78 },
      { label: "交叉验证", value: 68 },
      { label: "AI生成概率", value: 38 },
      { label: "水印检测", value: 72 }
    ]
  },
  {
    id: 2,
    title: "AI编程助手新增代码引用与密钥泄露拦截能力",
    source: "AI安全产品博客样例",
    sourceType: "官方博客",
    url: "https://example.com/ai-coding-policy",
    region: "North America",
    countryCode: "US",
    publishedAt: "2026-09-03T20:10:00+08:00",
    originalExcerpt: "新的企业策略控制能力允许管理员限制代码建议范围、配置代码引用提示、识别疑似密钥片段并查看团队使用情况。",
    summary: "AI编程工具开始强化企业级安全治理能力，代码引用提示、密钥泄露拦截和团队审计逐渐成为企业采购 AI 编码助手的核心评估项。",
    insight: "AI 编程助手正在进入软件供应链安全链路。研发团队不应只关注补全效率，还要关注训练数据来源、开源许可证提示、密钥识别和生成代码的安全扫描闭环。",
    intelligenceType: "产品动态",
    riskLevel: "中",
    credibilityScore: 88,
    aiGeneratedScore: 22,
    watermarkStatus: "暂不支持",
    impact: "影响研发团队AI工具选型、代码审计、密钥治理和内部AI编码规范建设。",
    recommendedAction: "关注企业策略控制、审计日志、代码引用提示、密钥拦截和数据隔离能力。",
    tags: ["AI编程", "代码安全", "密钥泄露", "供应链安全", "产品动态"],
    lat: 47.6062,
    lng: -122.3321,
    credibilitySignals: [
      { label: "来源可信", value: 92 },
      { label: "交叉验证", value: 81 },
      { label: "AI生成概率", value: 22 },
      { label: "水印检测", value: 50 }
    ]
  },
  {
    id: 3,
    title: "欧盟AI合规要求推动高风险AI系统安全日志建设",
    source: "AI合规与安全观察样例",
    sourceType: "政策站点",
    url: "https://example.com/eu-ai-compliance",
    region: "Europe",
    countryCode: "EU",
    publishedAt: "2026-09-03T08:30:00+08:00",
    originalExcerpt: "监管更新强调高风险AI系统需要记录数据来源、模型用途、风险控制、人工监督机制和关键安全日志。",
    summary: "AI监管持续从原则走向可执行要求，企业需要为高风险AI场景准备模型登记、风险评估、权限记录和可追溯审计材料。",
    insight: "合规要求正在倒逼 AI 系统具备安全可观测性。企业需要把模型调用日志、数据来源、人工复核和异常输出留痕纳入安全运营，而不是只在上线前补文档。",
    intelligenceType: "合规动态",
    riskLevel: "中",
    credibilityScore: 79,
    aiGeneratedScore: 31,
    watermarkStatus: "未检测到",
    impact: "影响涉及招聘、信贷、医疗、教育、风控和安全决策等高风险AI应用的企业。",
    recommendedAction: "建立AI系统清单，记录模型用途、数据来源、权限控制、风险处置和人工监督流程。",
    tags: ["AI合规", "EU AI Act", "安全日志", "风险评估"],
    lat: 50.8503,
    lng: 4.3517,
    credibilitySignals: [
      { label: "来源可信", value: 86 },
      { label: "交叉验证", value: 70 },
      { label: "AI生成概率", value: 31 },
      { label: "水印检测", value: 76 }
    ]
  },
  {
    id: 4,
    title: "深度伪造语音被用于冒充高管进行付款指令",
    source: "公开新闻样例",
    sourceType: "公开新闻",
    url: "https://example.com/deepfake-voice-fraud",
    region: "Asia Pacific",
    countryCode: "SG",
    publishedAt: "2026-09-02T18:45:00+08:00",
    originalExcerpt: "攻击者使用AI生成的高管语音联系财务人员，要求快速处理跨境付款。",
    summary: "深度伪造正在从舆论风险扩展到企业财务欺诈场景，传统电话确认流程需要升级为多因素验证。",
    insight: "深度伪造正在改变社会工程攻击的成本结构。企业应把音视频身份核验纳入反欺诈和应急流程，尤其是付款、账号重置和高权限操作场景。",
    intelligenceType: "安全事件",
    riskLevel: "高",
    credibilityScore: 76,
    aiGeneratedScore: 44,
    watermarkStatus: "暂不支持",
    impact: "影响财务审批、远程办公和高管身份验证流程。",
    recommendedAction: "对高额付款启用多渠道验证，建立深度伪造风险培训和异常指令复核机制。",
    tags: ["深度伪造", "语音克隆", "财务欺诈", "身份验证"],
    lat: 1.3521,
    lng: 103.8198,
    credibilitySignals: [
      { label: "来源可信", value: 74 },
      { label: "交叉验证", value: 64 },
      { label: "AI生成概率", value: 44 },
      { label: "水印检测", value: 48 }
    ]
  },
  {
    id: 5,
    title: "开源AI安全评测框架新增越狱与工具滥用测试用例",
    source: "开源社区样例",
    sourceType: "社区论坛",
    url: "https://example.com/open-model-eval",
    region: "Global",
    countryCode: "GLOBAL",
    publishedAt: "2026-09-01T11:35:00+08:00",
    originalExcerpt: "社区项目新增一组面向越狱攻击、敏感内容输出、恶意代码建议和工具滥用的自动化测试用例。",
    summary: "开源评测框架可以帮助企业在引入模型或Agent前进行基础安全评估，提前识别越狱、恶意代码生成和工具越权调用风险。",
    insight: "模型安全评测应进入 AI 应用交付流水线。对 Agent 来说，越狱测试只是起点，还需要覆盖工具权限、敏感数据访问、命令执行和异常输出拦截。",
    intelligenceType: "产品动态",
    riskLevel: "低",
    credibilityScore: 73,
    aiGeneratedScore: 57,
    watermarkStatus: "检测到疑似水印",
    impact: "影响模型选型、Agent上线评审、AI红队测试和应用安全测试流程。",
    recommendedAction: "在上线评审中加入越狱、恶意代码、工具滥用和敏感输出测试集。",
    tags: ["模型评测", "Jailbreak", "红队测试", "工具滥用", "AI安全"],
    lat: 51.5074,
    lng: -0.1278,
    credibilitySignals: [
      { label: "来源可信", value: 71 },
      { label: "交叉验证", value: 59 },
      { label: "AI生成概率", value: 57 },
      { label: "水印检测", value: 82 }
    ]
  }
];

export const countryStats = [
  {
    code: "CN",
    name: "中国",
    region: "Asia Pacific",
    total: 156,
    highRisk: 24,
    share: "20.8%",
    heat: 88,
    lat: 35.8617,
    lng: 104.1954,
    x: 73,
    y: 39,
    themes: ["AI合规治理", "大模型产品", "AI应用事件"]
  },
  {
    code: "US",
    name: "美国",
    region: "North America",
    total: 214,
    highRisk: 48,
    share: "32.8%",
    heat: 94,
    lat: 39.8283,
    lng: -98.5795,
    x: 23,
    y: 35,
    themes: ["安全事件", "产品动态", "模型治理"]
  },
  {
    code: "GB",
    name: "英国",
    region: "Europe",
    total: 86,
    highRisk: 12,
    share: "13.2%",
    heat: 68,
    lat: 55.3781,
    lng: -3.436,
    x: 47,
    y: 31,
    themes: ["开源评测", "AI监管", "模型安全"]
  },
  {
    code: "FR",
    name: "法国",
    region: "Europe",
    total: 74,
    highRisk: 11,
    share: "9.9%",
    heat: 64,
    lat: 46.2276,
    lng: 2.2137,
    x: 48,
    y: 35,
    themes: ["AI监管", "公共服务AI", "内容标识"]
  },
  {
    code: "RU",
    name: "俄罗斯",
    region: "Europe",
    total: 61,
    highRisk: 9,
    share: "8.1%",
    heat: 58,
    lat: 61.524,
    lng: 105.3188,
    x: 71,
    y: 27,
    themes: ["AI产业政策", "生成式AI应用", "算力基础设施"]
  },
  {
    code: "JP",
    name: "日本",
    region: "Asia Pacific",
    total: 68,
    highRisk: 8,
    share: "9.1%",
    heat: 60,
    lat: 36.2048,
    lng: 138.2529,
    x: 82,
    y: 39,
    themes: ["企业助手", "机器人AI", "隐私治理"]
  },
  {
    code: "SG",
    name: "新加坡",
    region: "Asia Pacific",
    total: 44,
    highRisk: 9,
    share: "5.9%",
    heat: 71,
    lat: 1.3521,
    lng: 103.8198,
    x: 73,
    y: 51,
    themes: ["AI金融治理", "深度伪造事件", "可信AI框架"]
  },
  {
    code: "KR",
    name: "韩国",
    region: "Asia Pacific",
    total: 52,
    highRisk: 7,
    share: "6.9%",
    heat: 54,
    lat: 35.9078,
    lng: 127.7669,
    x: 79,
    y: 39,
    themes: ["AI芯片", "智能终端", "内容生成监管"]
  }
];

export const countryFeeds = {
  US: {
    country: "美国",
    categories: [
      {
        name: "合规动态",
        count: 9,
        items: [
          "Random_Walker 通过 X 公开观点讨论 AI 服务定价中的数据使用折扣，企业数据留存和治理能力成为采购关注点。",
          "联邦机构更新生成式AI采购透明度建议，强调模型用途登记和供应商责任说明。",
          "多个州继续推进AI深度伪造标识规则，面向广告、选举和消费者场景提出披露要求。",
          "企业AI治理框架讨论升温，审计日志、数据来源记录和人工复核被列为重点能力。"
        ]
      },
      {
        name: "产品动态",
        count: 15,
        items: [
          "OpenAI 发布 GPT-6 Astra，定位为新一代高智能模型，强化专业工作、软件工程、Agent和安全对齐能力。",
          "头部AI厂商发布面向企业的Agent权限控制功能，支持管理员配置工具调用边界。",
          "AI编程助手新增组织级策略，允许限制代码引用、外部数据使用和团队审计范围。",
          "多模态办公助手强化会议纪要、知识库问答和邮件生成能力，企业版功能竞争加剧。"
        ]
      },
      {
        name: "安全事件",
        count: 5,
        items: [
          "某企业客服Agent因提示边界不清，输出了不应暴露的内部流程描述。",
          "深度伪造语音被用于冒充管理层下达紧急付款指令，企业复核机制受到关注。",
          "员工将客户资料粘贴到外部AI工具，引发数据合规和内部使用规范讨论。"
        ]
      }
    ]
  },
  GB: {
    country: "英国",
    categories: [
      {
        name: "合规动态",
        count: 6,
        items: [
          "监管机构发布AI模型评估实践更新，强调可解释性、偏见测试和使用场景边界。",
          "金融行业继续讨论AI客服和投顾助手的责任归属，企业需保留人工审核链路。",
          "公共部门AI使用指南更新，要求记录模型选择理由、数据来源和潜在影响。"
        ]
      },
      {
        name: "产品动态",
        count: 9,
        items: [
          "本地SaaS厂商推出合规文档自动审阅助手，面向法务和采购团队。",
          "企业知识库产品新增AI回答引用追溯能力，降低幻觉和误导性输出。",
          "AI会议助手强化多语言纪要和行动项抽取，面向跨国团队协同场景。"
        ]
      },
      {
        name: "安全事件",
        count: 4,
        items: [
          "公开报道显示，深度伪造视频被用于商业身份冒充，企业验证流程成为焦点。",
          "某组织内部AI摘要误读合同条款，导致审批人员重新评估AI辅助流程。",
          "员工使用个人AI账号处理敏感材料，引发内部AI工具准入管理讨论。"
        ]
      }
    ]
  },
  FR: {
    country: "法国",
    categories: [
      {
        name: "合规动态",
        count: 7,
        items: [
          "监管机构讨论生成式AI内容标识要求，重点覆盖媒体、广告和公共服务场景。",
          "公共部门AI采购强调透明度、供应商责任和自动化决策说明。",
          "企业开始建立AI系统影响评估模板，用于高影响业务流程上线前审查。"
        ]
      },
      {
        name: "产品动态",
        count: 8,
        items: [
          "本地AI初创企业发布多语言企业助手，支持法语知识库问答和合同摘要。",
          "内容平台增强AI生成内容识别与标注能力，面向品牌和媒体客户。",
          "企业搜索产品加入来源追溯和权限继承，降低AI回答不可验证的问题。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "AI生成广告素材被质疑版权来源不清，品牌方调整素材审查流程。",
          "员工使用个人AI工具总结客户资料，引发内部数据处理规范复盘。",
          "AI客服误读保单条款，企业增加关键业务回答的人工确认步骤。"
        ]
      }
    ]
  },
  RU: {
    country: "俄罗斯",
    categories: [
      {
        name: "合规动态",
        count: 5,
        items: [
          "产业政策继续强调本土AI基础设施、模型能力和算力资源建设。",
          "企业AI应用讨论聚焦数据本地化、行业模型管理和内容生成责任。",
          "公共服务场景探索AI辅助审批，要求保留人工复核和操作记录。"
        ]
      },
      {
        name: "产品动态",
        count: 7,
        items: [
          "本地科技公司发布面向企业的文档问答助手，支持私有知识库部署。",
          "语音识别与翻译产品升级，面向客服、会议和跨语言协同场景。",
          "AI开发平台新增模型评测面板，帮助企业比较不同模型输出质量。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "AI摘要工具误提取合同关键条款，业务团队引入双人复核机制。",
          "生成式AI图片被用于不当营销素材，平台强化内容审核策略。",
          "外部AI工具使用边界不清，企业重新制定数据分级和工具准入规则。"
        ]
      }
    ]
  },
  DE: {
    country: "德国",
    categories: [
      {
        name: "合规动态",
        count: 7,
        items: [
          "企业开始按高影响AI场景梳理系统清单，为欧盟AI监管要求做准备。",
          "制造业AI应用关注数据可追溯和模型变更记录，审计材料模板需求上升。",
          "行业协会建议企业建立AI使用分级和供应商评估机制。"
        ]
      },
      {
        name: "产品动态",
        count: 8,
        items: [
          "工业AI平台发布预测维护助手，强调边缘部署和数据本地化。",
          "企业搜索产品加入AI摘要引用链，支持按来源过滤和权限继承。",
          "自动化厂商推出低代码AI流程编排功能，面向运营团队试点。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "某制造企业AI质检模型因样本偏差出现误判，触发模型复盘。",
          "内部文档被上传到未授权AI工具，数据处理边界成为整改重点。",
          "AI翻译工具误处理合同术语，法务团队增加人工确认步骤。"
        ]
      }
    ]
  },
  NL: {
    country: "荷兰",
    categories: [
      {
        name: "合规动态",
        count: 5,
        items: [
          "监管讨论聚焦AI透明度和自动化决策告知，公共服务场景受关注。",
          "企业被建议建立AI系统台账，记录数据来源、模型用途和责任人。",
          "隐私保护机构提醒组织评估生成式AI输入输出中的个人信息风险。"
        ]
      },
      {
        name: "产品动态",
        count: 7,
        items: [
          "内容审核平台增加生成式AI检测辅助能力，用于识别合成图文内容。",
          "企业协同产品上线AI知识问答组件，强调权限继承和来源引用。",
          "数据治理厂商发布AI数据目录功能，帮助企业梳理训练和推理数据。"
        ]
      },
      {
        name: "安全事件",
        count: 2,
        items: [
          "AI客服误将过期政策作为当前答案，企业加强知识库更新时间标识。",
          "生成式AI内容未明确标识引发用户投诉，披露机制成为运营重点。"
        ]
      }
    ]
  },
  CN: {
    country: "中国",
    categories: [
      {
        name: "合规动态",
        count: 10,
        items: [
          "生成式AI服务治理持续细化，企业关注备案、内容标识和数据合规要求。",
          "多地发布人工智能产业政策，鼓励大模型应用落地与可信AI能力建设。",
          "行业客户开始建立AI应用上线评审流程，覆盖用途、数据、权限和输出质量。"
        ]
      },
      {
        name: "产品动态",
        count: 16,
        items: [
          "多家厂商发布企业级大模型平台，重点强化知识库、Agent和私有化部署能力。",
          "办公协同产品集中上线AI写作、会议纪要、智能问答和流程助手功能。",
          "AI搜索和浏览器助手竞争升温，信息来源引用和结果可信度成为卖点。"
        ]
      },
      {
        name: "安全事件",
        count: 6,
        items: [
          "企业员工使用外部AI工具处理客户信息，引发数据脱敏和工具准入讨论。",
          "AI生成内容被误用于正式对外材料，审核流程和责任归属受到关注。",
          "某业务部门试点Agent后出现错误执行建议，推动增加人工确认机制。"
        ]
      }
    ]
  },
  SG: {
    country: "新加坡",
    categories: [
      {
        name: "合规动态",
        count: 4,
        items: [
          "金融监管继续强调AI模型治理和第三方工具风险评估。",
          "可信AI框架实践案例增加，企业关注模型透明度和持续监测。",
          "跨境数据和AI工具使用规则成为区域企业合规讨论重点。"
        ]
      },
      {
        name: "产品动态",
        count: 6,
        items: [
          "金融科技厂商推出AI风控助手，强调可解释评分和人工复核。",
          "客户服务平台新增多语言AI坐席能力，面向东南亚多市场部署。",
          "企业培训产品加入AI情景模拟，支持合规和服务流程演练。"
        ]
      },
      {
        name: "安全事件",
        count: 4,
        items: [
          "深度伪造语音被用于冒充企业高管，财务审批复核机制受到关注。",
          "AI客服错误解释退款政策，企业重新梳理知识库引用和答案边界。",
          "员工将会议录音上传至外部AI转写工具，引发数据留存规则讨论。"
        ]
      }
    ]
  },
  JP: {
    country: "日本",
    categories: [
      {
        name: "合规动态",
        count: 5,
        items: [
          "企业AI使用指引强调版权、隐私和自动化决策告知。",
          "制造与医疗场景关注AI系统验证、追踪记录和人工监督。",
          "内容生成服务加强AI标识和用户申诉机制。"
        ]
      },
      {
        name: "产品动态",
        count: 7,
        items: [
          "机器人企业发布多模态控制助手，面向工业巡检和服务场景。",
          "办公软件加入日文长文摘要和会议行动项自动生成。",
          "AI翻译产品升级行业术语库，面向跨国供应链协同。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "生成式AI客服因理解语境错误给出不准确建议，企业增加答案审核。",
          "AI图像生成内容涉及版权争议，设计团队调整素材使用规范。",
          "员工误用外部AI工具处理内部资料，企业强化工具白名单。"
        ]
      }
    ]
  },
  KR: {
    country: "韩国",
    categories: [
      {
        name: "合规动态",
        count: 5,
        items: [
          "监管讨论关注生成式AI内容标识、个人信息保护和平台责任边界。",
          "智能终端和车载AI场景被纳入企业AI治理讨论，强调数据最小化和用户告知。",
          "大型企业推动内部AI使用规范，要求区分公开资料、内部资料和敏感资料。"
        ]
      },
      {
        name: "产品动态",
        count: 9,
        items: [
          "芯片与终端厂商发布端侧AI能力，强调低延迟、隐私保护和离线推理。",
          "企业办公产品加入韩语会议摘要、任务提取和知识库问答能力。",
          "内容平台推出AI创作辅助工具，面向短视频、广告和电商运营场景。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "AI生成图片被误用于商业素材，企业加强版权与来源审核。",
          "客服助手回答过度承诺服务条款，业务部门增加高影响答复审核。",
          "员工使用外部AI翻译敏感文档，触发数据分级和工具白名单整改。"
        ]
      }
    ]
  },
  IN: {
    country: "印度",
    categories: [
      {
        name: "合规动态",
        count: 4,
        items: [
          "数字服务领域讨论AI生成内容标识和平台责任。",
          "企业服务外包场景关注客户数据是否进入AI工具训练链路。",
          "监管讨论推动AI应用透明度和消费者权益保护。"
        ]
      },
      {
        name: "产品动态",
        count: 8,
        items: [
          "客服外包企业上线AI质检助手，用于通话摘要和服务质量分析。",
          "开发者平台发布低成本模型部署工具，服务中小企业AI应用。",
          "教育科技产品增加个性化AI辅导和学习反馈能力。"
        ]
      },
      {
        name: "安全事件",
        count: 3,
        items: [
          "AI招聘筛选结果被质疑存在偏差，企业补充人工复核流程。",
          "外部AI翻译工具误处理客户材料，服务团队调整数据处理规范。",
          "生成式AI营销内容未充分审核，引发品牌合规关注。"
        ]
      }
    ]
  }
};

export const crawlPlan = [
  {
    phase: "发现",
    title: "公开来源登记",
    detail: "维护官方博客、公开新闻、事件库、政策站点与社区论坛的来源清单。",
    output: "source registry"
  },
  {
    phase: "采集",
    title: "RSS / Sitemap / 公开页面监测",
    detail: "POC阶段以定时拉取和页面差异监测为主，规避需要登录或授权的来源。",
    output: "raw article"
  },
  {
    phase: "清洗",
    title: "正文抽取与去重",
    detail: "按标题、URL、正文指纹、发布时间进行去重，保留来源、时间、地区等元数据。",
    output: "normalized article"
  },
  {
    phase: "AI分析",
    title: "摘要、分类、标签、可信检查评分",
    detail: "对内容进行中文摘要，识别AI产品、攻击手段、防护手段、事件、合规等类别。",
    output: "intel card"
  }
];

export const reportPreview = {
  status: "planned",
  dailyTitle: "AI情报雷达日报",
  weeklyTitle: "AI情报雷达周报",
  mailSubject: "【AI情报雷达】今日重点关注安全事件与产品动态",
  message: "报告生成Skill将在下一阶段接入，本阶段仅保留日报、周报、邮件模板入口。"
};

export const dailyBrief = {
  date: "2026-09-10",
  title: "AI&Cyber 今日日报",
  metrics: [
    { label: "重点动态", value: "7" },
    { label: "高风险", value: "2" },
    { label: "需跟进", value: "4" }
  ],
  takeaway:
    "今日 AI&Cyber 风险集中在 Agent 提示注入、深度伪造诈骗和 AI 编程供应链安全。建议优先检查企业知识库型 Agent、AI 编程助手和付款审批流程的安全控制。",
  sections: [
    {
      title: "安全事件",
      items: [
        "企业客服 Agent 被提示注入诱导输出内部知识库片段，需复核检索权限和输出审查。",
        "深度伪造语音冒充高管下达付款指令，财务场景需要多渠道验证和异常指令留痕。"
      ]
    },
    {
      title: "产品动态",
      items: [
        "AI 编程助手新增代码引用、密钥泄露拦截和团队审计能力，软件供应链安全能力成为采购重点。",
        "新一代模型强化计算机使用和代码能力，企业应同步评估 Agent 权限边界和工具调用审计。"
      ]
    },
    {
      title: "合规动态",
      items: [
        "高风险 AI 系统透明度要求延伸到安全日志、权限记录和人工复核，合规与安全运营开始合流。",
        "企业数据是否进入模型训练和日志留存周期，继续成为 AI 服务采购中的核心问询点。"
      ]
    }
  ]
};
