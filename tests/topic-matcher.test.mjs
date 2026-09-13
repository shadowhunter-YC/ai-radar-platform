import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchKeywords,
  matchArticleToTimeline,
  matchOpinionToTopic,
  assembleTopicDossier
} from '../lib/topic-matcher.mjs';

test('关键词与标签智能匹配引擎 (AND 规则与 OR 组合)', () => {
  const article = {
    title: '中央网信办发布第五批境内深度合成服务算法备案清单',
    summary: '根据国家网信办相关规定，共计120个大模型算法通过备案审查。',
    detailTag: '备案清单',
    affectedEntity: '中央网信办',
    tags: ['算法备案', '生成式AI', '合规']
  };

  // 1. 命中两组必选条件
  const rule1 = ['中国|网信办|工信部', '生成式|大模型|算法备案'];
  assert.equal(matchKeywords(article, rule1), true);

  // 2. 未命中第二组条件
  const rule2 = ['网信办', '自动驾驶|车载系统'];
  assert.equal(matchKeywords(article, rule2), false);

  // 3. 空规则默认命中
  assert.equal(matchKeywords(article, []), true);
});

test('第一级严格分类隔离：法规动态绝不混入产品或事件动态', () => {
  const topicRegulation = {
    category: 'AI 法规动态',
    ruleKeywords: ['大模型']
  };

  const regArticle = {
    title: '生成式人工智能服务安全基本要求发布',
    intelligenceType: '法规政策',
    contentNature: 'fact',
    verificationStatus: 'verified',
    publishedAt: '2024-03-01',
    tags: ['大模型']
  };

  const prodArticle = {
    title: '某厂商发布大模型安全护栏 Guardrails 3.0',
    intelligenceType: '安全产品突破',
    contentNature: 'fact',
    verificationStatus: 'verified',
    publishedAt: '2024-03-02',
    tags: ['大模型']
  };

  assert.equal(matchArticleToTimeline(regArticle, topicRegulation), true);
  assert.equal(matchArticleToTimeline(prodArticle, topicRegulation), false);
});

test('观点随笔类文章严格排除在时间线里程碑外，归入关联解读', () => {
  const topic = {
    category: 'AI 法规动态',
    ruleKeywords: ['中国|网信办', '生成式|备案']
  };

  const factArticle = {
    id: 1,
    title: '网信办关于深度合成算法备案公告',
    intelligenceType: '法规政策',
    contentNature: 'fact',
    verificationStatus: 'verified',
    publishedAt: '2026-03-01',
    tags: ['生成式', '网信办']
  };

  const opinionArticle = {
    id: 2,
    title: '从网信办最新备案看中国生成式AI治理体系演进与架构思考',
    intelligenceType: '法规政策',
    contentNature: 'opinion',
    verificationStatus: 'opinion',
    publishedAt: '2026-03-02',
    tags: ['生成式', '网信办']
  };

  assert.equal(matchArticleToTimeline(factArticle, topic), true);
  assert.equal(matchArticleToTimeline(opinionArticle, topic), false);
  assert.equal(matchOpinionToTopic(opinionArticle, topic), true);

  const dossier = assembleTopicDossier(topic, [factArticle, opinionArticle]);
  assert.equal(dossier.milestones.length, 1);
  assert.equal(dossier.milestones[0].id, 1);
  assert.equal(dossier.associatedOpinions.length, 1);
  assert.equal(dossier.associatedOpinions[0].id, 2);
});

test('未核实一手源头的二手文章不进入时间线，已穿透者进入并按原始发生时间对齐', () => {
  const topic = {
    category: 'AI 法规动态',
    ruleKeywords: ['网信办']
  };

  const unverifiedArticle = {
    id: 10,
    title: '传闻网信办将出台大模型安全新规',
    intelligenceType: '法规政策',
    contentNature: 'fact',
    sourceOrigin: 'wechat',
    verificationStatus: 'unverified',
    tags: ['网信办']
  };

  const verifiedArticle = {
    id: 11,
    title: '深度合成管理规定正式实施',
    intelligenceType: '法规政策',
    contentNature: 'fact',
    sourceOrigin: 'wechat',
    verificationStatus: 'verified',
    primaryAuthority: '中央网信办',
    primaryDate: '2024-01-10',
    publishedAt: '2024-01-15', // 微信发文晚于官方
    tags: ['网信办']
  };

  assert.equal(matchArticleToTimeline(unverifiedArticle, topic), false);
  assert.equal(matchArticleToTimeline(verifiedArticle, topic), true);

  const dossier = assembleTopicDossier(topic, [unverifiedArticle, verifiedArticle]);
  assert.equal(dossier.milestones.length, 1);
  assert.equal(dossier.milestones[0].id, 11);
  assert.equal(dossier.milestones[0].timelineDate, '2024-01-10'); // 成功对齐一手原始发生时间
});

test('时间线事件日期提取与抓取时间防污染', async () => {
  const { getMilestoneEventDate } = await import('../lib/topic-matcher.mjs');

  // 1. 优先使用一手源发布或事件日期
  const articleWithPrimary = {
    primaryDate: '2024-03-13',
    publishedAt: '2026-09-12T00:00:00Z',
    collectedAt: '2026-09-12T00:00:00Z'
  };
  assert.equal(getMilestoneEventDate(articleWithPrimary), '2024-03-13');

  // 2. 标题中包含明确官方发布日期时优先提取
  const articleWithRegexDate = {
    title: '欧盟官方公报于2024年7月12日正式刊登人工智能法案全文',
    publishedAt: '2026-09-12T10:00:00Z',
    collectedAt: '2026-09-12T10:00:00Z'
  };
  assert.equal(getMilestoneEventDate(articleWithRegexDate), '2024-07-12');

  // 3. 仅有抓取时间或标记为 dateIsCollection 时拒绝伪充事件时间
  const crawledArticle = {
    title: '行业最新快讯',
    dateIsCollection: true,
    publishedAt: '2026-09-12T10:00:00Z',
    collectedAt: '2026-09-12T10:00:00Z'
  };
  assert.equal(getMilestoneEventDate(crawledArticle), null);
});

test('专题名称智能推荐关键词与英文cyber语义容错', async () => {
  const { suggestRuleKeywords, matchKeywords } = await import('../lib/topic-matcher.mjs');

  // 1. OpenAI 实体名称自动推断
  const openAiKws = suggestRuleKeywords('openAI 模型动态', 'AI 安全产品动态');
  assert.equal(openAiKws.length > 0, true);
  assert.equal(openAiKws[0].includes('OpenAI'), true);

  // 2. Claude 实体名称自动推断
  const claudeKws = suggestRuleKeywords('Claude 前沿防御');
  assert.equal(claudeKws[0].includes('Claude'), true);

  // 3. cyber 语义容错能够命中含“网络安全/攻防/安全/护栏”的中文技术文章
  const article = {
    title: 'OpenAI 发布 GPT-4 Turbo 并引入 Assistant API 安全沙箱隔离架构',
    summary: '构建了多层安全护栏与沙箱防护体系。',
    tags: ['沙箱安全', '模型攻防']
  };
  assert.equal(matchKeywords(article, ['cyber']), true);

  // 4. 标准与 GitHub 工具智能推断
  const owaspKws = suggestRuleKeywords('OWASP Top 10 安全标准');
  assert.equal(owaspKws.length > 0, true);
  assert.equal(owaspKws[0].includes('OWASP'), true);

  const garakKws = suggestRuleKeywords('garak 开源漏洞扫描工具');
  assert.equal(garakKws.length > 0, true);
  assert.equal(garakKws[0].includes('GitHub'), true);
});

test('专题接入 AI安全标准与 GitHub开源 工具流', async () => {
  const { matchArticleToTimeline } = await import('../lib/topic-matcher.mjs');

  const standardTopic = {
    category: 'AI 法规动态',
    ruleKeywords: ['OWASP|ISO 42001|标准']
  };

  const owaspArticle = {
    title: 'OWASP 发布 2025 全新升级版大语言模型应用十大安全漏洞',
    intelligenceType: 'AI安全标准',
    contentNature: 'fact',
    verificationStatus: 'verified',
    eventDate: '2025-01-15',
    tags: ['OWASP', 'Top 10']
  };

  assert.equal(matchArticleToTimeline(owaspArticle, standardTopic), true);

  const githubTopic = {
    category: 'AI 安全产品动态',
    ruleKeywords: ['garak|promptfoo|漏洞扫描']
  };

  const garakArticle = {
    title: 'GitHub 热门开源：leondz/garak 大语言模型自动化漏洞扫描器',
    intelligenceType: 'GitHub开源',
    contentNature: 'fact',
    verificationStatus: 'verified',
    eventDate: '2026-09-13',
    tags: ['garak', '漏洞扫描']
  };

  assert.equal(matchArticleToTimeline(garakArticle, githubTopic), true);
});

test('Hugging Face 安全事件全景与推荐规则匹配', async () => {
  const { matchArticleToTimeline, suggestRuleKeywords, assembleTopicDossier } = await import('../lib/topic-matcher.mjs');

  const hfKws = suggestRuleKeywords('Hugging Face 安全事件动态', '事件动态');
  assert.equal(hfKws.length > 0, true);
  assert.equal(hfKws[0].includes('HuggingFace'), true);

  const incidentTopic = {
    category: '事件动态',
    ruleKeywords: ['HuggingFace|Hugging Face|Spaces|Token|渗透|后门']
  };

  const hfSpacesIncident = {
    id: 1000000048,
    title: 'Hugging Face 官方披露 Spaces 平台密钥遭未授权访问安全事件，紧急吊销受影响用户 Token 并强化沙箱隔离',
    intelligenceType: '违规处罚与事件',
    contentNature: 'fact',
    verificationStatus: 'verified',
    eventDate: '2024-05-31',
    tags: ['HuggingFace', 'Spaces', '密钥泄露']
  };

  const hfAgentCompromise = {
    id: 1000000049,
    title: 'OpenAI 首次于 Black Hat 大会复盘前沿智能体集群自主失控并横向渗透攻击 Hugging Face 基础设施重大安全事件',
    intelligenceType: '违规处罚与事件',
    contentNature: 'fact',
    verificationStatus: 'verified',
    eventDate: '2026-08-06',
    tags: ['HuggingFace', 'OpenAI', '自主智能体', '横向渗透']
  };

  assert.equal(matchArticleToTimeline(hfSpacesIncident, incidentTopic), true);
  assert.equal(matchArticleToTimeline(hfAgentCompromise, incidentTopic), true);

  const dossier = assembleTopicDossier(incidentTopic, [hfSpacesIncident, hfAgentCompromise]);
  assert.equal(dossier.milestones.length, 2);
  assert.equal(dossier.milestones[0].id, 1000000049); // 2026年最新事件排在最前
  assert.equal(dossier.milestones[1].id, 1000000048); // 2024年事件在后
});

test('标杆专题允许编辑抽取规则，且HuggingFace不再作为系统预置标杆', async () => {
  const { getTopics, updateTopic } = await import('../lib/collection-store.mjs');
  const topics = getTopics();

  // 1. 验证 HuggingFace 不再作为标杆专题存在
  const hfPreset = topics.find(t => t.id === 'topic-huggingface-security');
  assert.equal(Boolean(hfPreset), false);

  // 2. 验证预置标杆专题存在且支持修改抽取规则
  const cyberTopic = topics.find(t => t.id === 'topic-frontier-cyber-models');
  assert.equal(Boolean(cyberTopic), true);
  assert.equal(cyberTopic.isPreset, true);

  // 执行规则编辑更新
  const originalKeywords = cyberTopic.ruleKeywords;
  const updatedKeywords = [...originalKeywords, '自主渗透|红队对抗'];
  const updated = updateTopic(cyberTopic.id, {
    ruleKeywords: updatedKeywords
  });

  assert.equal(Boolean(updated), true);
  assert.equal(updated.ruleKeywords.includes('自主渗透|红队对抗'), true);

  // 恢复原规则以防测试污染
  updateTopic(cyberTopic.id, { ruleKeywords: originalKeywords });
});

