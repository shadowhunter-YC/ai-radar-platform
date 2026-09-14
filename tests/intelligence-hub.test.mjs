import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeCategory, matchesType, getCategoryMeta, normalizeTags } from '../lib/tag-taxonomy.mjs';
import { isOpinionArticle, matchArticleToTimeline, matchOpinionToTopic, assembleTopicDossier } from '../lib/topic-matcher.mjs';

test('Taxonomy: normalizeCategory maps legacy and standard types accurately', () => {
  assert.equal(normalizeCategory('合规动态'), '法规政策');
  assert.equal(normalizeCategory('监管政策'), '法规政策');
  assert.equal(normalizeCategory('法规政策'), '法规政策');

  assert.equal(normalizeCategory('产品动态'), '安全产品突破');
  assert.equal(normalizeCategory('AI安全'), '安全产品突破');
  assert.equal(normalizeCategory('安全产品突破'), '安全产品突破');

  assert.equal(normalizeCategory('AI安全标准'), 'AI安全标准');
  assert.equal(normalizeCategory('标准规范'), 'AI安全标准');
  assert.equal(normalizeCategory('安全事件', 'OWASP Top 10 for LLM', 'owasp.org'), 'AI安全标准');
  assert.equal(normalizeCategory('行业动态', 'ISO/IEC 42001:2023 AIMS Standard', 'iso.org'), 'AI安全标准');

  assert.equal(normalizeCategory('GitHub开源'), 'GitHub开源');
  assert.equal(normalizeCategory('GitHub项目'), 'GitHub开源');
  assert.equal(normalizeCategory('产品动态', 'leondz/garak LLM vulnerability scanner', 'github.com'), 'GitHub开源');

  assert.equal(normalizeCategory('安全事件'), '违规处罚与事件');
  assert.equal(normalizeCategory('违规处罚与事件'), '违规处罚与事件');

  assert.equal(normalizeCategory('行业动态'), '行业动态');
  assert.equal(normalizeCategory('其他'), '行业动态');
});

test('RadarConsole: matchesType matches legacy and standard categories', () => {
  assert.equal(matchesType('合规动态', '法规政策'), true);
  assert.equal(matchesType('法规政策', '法规政策'), true);
  assert.equal(matchesType('违规处罚与事件', '法规政策'), false);

  assert.equal(matchesType('AI安全标准', 'AI安全标准'), true);
  assert.equal(matchesType('标准规范', 'AI安全标准'), true);
  assert.equal(matchesType('法规政策', 'AI安全标准'), false);

  assert.equal(matchesType('GitHub开源', 'GitHub开源'), true);
  assert.equal(matchesType('GitHub项目', 'GitHub开源'), true);
  assert.equal(matchesType('安全产品突破', 'GitHub开源'), false);

  assert.equal(matchesType('产品动态', '安全产品突破'), true);
  assert.equal(matchesType('安全产品突破', '安全产品突破'), true);

  assert.equal(matchesType('安全事件', '违规处罚与事件'), true);
  assert.equal(matchesType('违规处罚与事件', '违规处罚与事件'), true);

  assert.equal(matchesType('安全事件', '全部'), true);
});

test('RadarConsole: getCategoryMeta provides badge colors and labels for all categories', () => {
  const stdMeta = getCategoryMeta('AI安全标准');
  assert.equal(stdMeta.shortLabel, '安全标准');
  assert.equal(stdMeta.color, '#0284c7');

  const gitMeta = getCategoryMeta('GitHub开源');
  assert.equal(gitMeta.shortLabel, 'GitHub');
  assert.equal(gitMeta.color, '#6366f1');

  const regMeta = getCategoryMeta('法规政策');
  assert.equal(regMeta.shortLabel, '法规政策');
  assert.equal(regMeta.color, '#c084fc');

  const prodMeta = getCategoryMeta('安全产品突破');
  assert.equal(prodMeta.shortLabel, '产品突破');
  assert.equal(prodMeta.color, '#86bc25');

  const incMeta = getCategoryMeta('违规处罚与事件');
  assert.equal(incMeta.shortLabel, '安全事件');
  assert.equal(incMeta.color, '#f87171');

  // Dynamic penalty vs attack incident distinction
  const penaltyMeta = getCategoryMeta('违规处罚与事件', { title: '因违法违规被开出监管罚单与罚款' });
  assert.equal(penaltyMeta.shortLabel, '违规处罚');
  assert.equal(penaltyMeta.label, '违规处罚');

  const attackMeta = getCategoryMeta('违规处罚与事件', { title: '大模型遭受提示注入与越狱利用' });
  assert.equal(attackMeta.shortLabel, '安全事件');
  assert.equal(attackMeta.label, '安全事件');

  // NIST / standards organization defense-in-depth safeguard
  assert.equal(normalizeCategory('安全事件', 'NIST Mathematical Proof Supports Transition', 'www.nist.gov'), 'AI安全标准');
});

test('CollectionStore: seedRssFeeds & confirmDraft with detailTag, affectedEntity, and severity', async () => {
  const tmpDir = path.join(process.cwd(), 'data-test-hub');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  process.env.COLLECTION_DATA_DIR = tmpDir;

  const {
    listRssFeeds,
    seedRssFeedsIfEmpty,
    addDraft,
    setAnalysis,
    confirmDraft,
    importedArticles
  } = await import('../lib/collection-store.mjs?' + Date.now());

  seedRssFeedsIfEmpty();
  const feeds = listRssFeeds();
  assert.ok(feeds.length >= 7, 'Should have seeded at least 7 authoritative feeds');

  const incidentFeed = feeds.find(f => f.name.includes('AI Incident Database'));
  assert.ok(incidentFeed, 'Should include AI Incident Database');
  assert.equal(incidentFeed.category, '违规处罚与事件');

  const euFeed = feeds.find(f => f.name.includes('EU AI Act'));
  assert.ok(euFeed, 'Should include EU AI Act feed');
  assert.equal(euFeed.category, '法规政策');

  // Test confirmDraft persistence of structured fields
  const draft = addDraft({
    url: 'https://example.com/test-incident',
    title: '模型越狱与提示注入攻击事件',
    source: 'AI Incident Database',
    text: '测试文本',
    collectedAt: new Date().toISOString()
  });

  setAnalysis(draft.id, {
    summary: '某大模型被通过多轮提示注入绕过安全对齐。',
    intelligenceType: '违规处罚与事件',
    detailTag: '提示注入绕过',
    affectedEntity: '某头部开源模型',
    severity: '重大',
    tags: ['提示注入', '越狱'],
    impact: '造成隐私泄露',
    action: '部署输入护栏',
    model: 'deepseek-chat'
  });

  const articleId = confirmDraft(draft.id);
  assert.ok(articleId > 0, 'Article ID should be valid');

  const imported = importedArticles();
  const found = imported.find(a => a.id === articleId);
  assert.ok(found, 'Should find imported article');
  assert.equal(found.intelligenceType, '违规处罚与事件');
  assert.equal(found.detailTag, '提示注入绕过');
  assert.equal(found.affectedEntity, '某头部开源模型');
  assert.equal(found.severity, '重大');
  assert.equal(found.riskLevel, '高风险');

  // Test updating category dynamically
  const { updateImportedArticle } = await import('../lib/collection-store.mjs?' + Date.now());
  const updated = updateImportedArticle(articleId, {
    intelligenceType: '法规政策',
    detailTag: 'AI安全评估模型'
  });
  assert.ok(updated);
  assert.equal(updated.intelligenceType, '法规政策');
  assert.equal(updated.detailTag, 'AI安全评估模型');

  const afterUpdate = importedArticles().find(a => a.id === articleId);
  assert.equal(afterUpdate.intelligenceType, '法规政策');

  rmSync(tmpDir, { recursive: true, force: true });
});

test('Taxonomy: 五大标准分类精细化规则（绣花打磨）严密判定', () => {
  // 1. 法规政策硬隔离判定
  assert.equal(normalizeCategory('未归类', '国家网信办发布境内深度合成服务算法备案清单', 'cac.gov.cn'), '法规政策');
  assert.equal(normalizeCategory('合规动态', 'EU AI Act enters into force across EU member states', 'europa.eu'), '法规政策');
  assert.equal(normalizeCategory('其他', '关于生成式人工智能服务管理暂行办法的监管指南', 'gov.cn'), '法规政策');

  // 2. AI安全标准与白皮书判定（防止误入法规或事件）
  assert.equal(normalizeCategory('法规政策', 'TC260-003 生成式人工智能服务安全基本要求实践指南', 'tc260.org.cn'), 'AI安全标准');
  assert.equal(normalizeCategory('安全事件', 'NIST Releases AI Risk Management Framework Generative AI Profile', 'nist.gov'), 'AI安全标准');
  assert.equal(normalizeCategory('其他', 'OWASP Top 10 for Large Language Model Applications 2026', 'owasp.org'), 'AI安全标准');
  assert.equal(normalizeCategory('未归类', 'ISO/IEC 42001:2023 人工智能管理体系实施白皮书', 'iso.org'), 'AI安全标准');

  // 3. GitHub 开源生态判定
  assert.equal(normalizeCategory('产品动态', 'leondz/garak automated LLM vulnerability scanner release on GitHub', 'github.com'), 'GitHub开源');
  assert.equal(normalizeCategory('未归类', '微软开源自动化AI红队评测编排工具 PyRIT', 'github.com/Azure/PyRIT'), 'GitHub开源');

  // 4. 真实违规处罚与攻击事件判定（排除防御工具）
  assert.equal(normalizeCategory('其他', 'FTC 对某AI公司违规窃取训练数据开出 500 万美元罚单', 'ftc.gov'), '违规处罚与事件');
  assert.equal(normalizeCategory('安全产品突破', '某知名大模型遭遇间接提示注入攻击导致数万用户数据泄露', 'securityweek.com'), '违规处罚与事件');

  // 5. 安全产品突破（专有防御模型、护栏与行业通用演进归并）
  assert.equal(normalizeCategory('其他', 'Meta 推出 Llama Guard 3 运行时提示词安全防护模型', 'meta.com'), '安全产品突破');
  assert.equal(normalizeCategory('行业动态', 'OpenAI 发布 GPT-6 基础大模型与新版推理引擎', 'openai.com'), '安全产品突破');

  // 6. 标签映射别名打磨测试
  const tags = normalizeTags(['安全护栏', '越狱防护', '算法备案', 'TC260', '数据脱敏', '水印溯源']);
  assert.deepEqual(tags.sort(), ['AI安全', 'AI合规治理', '内容与身份风险', '安全标准与规范', '数据与隐私'].sort());
});

test('WeChat & Opinion: 微信二手报道溯源提取与专家深度解读双重打标', () => {
  // 1. 观点与深度解读判定守卫
  const opinionArticle1 = {
    title: '深度解读：欧盟 AI Act 正式生效对跨国企业合规抗辩的七大核心挑战',
    contentNature: 'opinion',
    detailTag: '深度解读',
    tags: ['行业观点', 'EU AI Act'],
    intelligenceType: '法规政策'
  };
  const opinionArticle2 = {
    title: '专家视点：中国大模型境内算法备案技术演进',
    detailTag: '专家视角',
    tags: ['算法备案'],
    intelligenceType: '法规政策'
  };
  const factArticle = {
    title: '欧盟官方公报正式公布 AI Act 全文法规',
    contentNature: 'fact',
    verificationStatus: 'verified',
    detailTag: '官方正式发布',
    tags: ['EU AI Act', '法规'],
    intelligenceType: '法规政策',
    primaryDate: '2024-07-12',
    primaryAuthority: '欧盟委员会',
    primaryDocTitle: 'Regulation (EU) 2024/1689',
    primaryUrl: 'https://eur-lex.europa.eu'
  };

  assert.equal(isOpinionArticle(opinionArticle1), true);
  assert.equal(isOpinionArticle(opinionArticle2), true);
  assert.equal(isOpinionArticle(factArticle), false);

  // 2. 专题分流逻辑：客观时间线 vs 关联观点
  const topic = {
    id: 'topic-eu-act',
    title: '欧盟AI法案全景',
    category: 'AI 法规动态',
    ruleKeywords: ['欧盟|EU|AI Act']
  };

  // 观点文章严禁进入时间线里程碑，只能进入 associatedOpinions
  assert.equal(matchArticleToTimeline(opinionArticle1, topic), false);
  assert.equal(matchArticleToTimeline(factArticle, topic), true);

  assert.equal(matchOpinionToTopic(opinionArticle1, topic), true);
  assert.equal(matchOpinionToTopic(factArticle, topic), false);

  // 3. 组装专题档案
  const dossier = assembleTopicDossier(topic, [opinionArticle1, factArticle]);
  assert.equal(dossier.milestones.length, 1);
  assert.equal(dossier.milestones[0].title, factArticle.title);
  assert.equal(dossier.associatedOpinions.length, 1);
  assert.equal(dossier.associatedOpinions[0].title, opinionArticle1.title);
});

