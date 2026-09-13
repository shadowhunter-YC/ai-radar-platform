/**
 * 专题两级规则匹配引擎
 * 严格执行：
 * 1. 观点类 (opinion) 严格排除在时间线里程碑之外，归入专题关联观点
 * 2. 未核实一手源头的二手文章 (unverified) 不进入严肃时间线
 * 3. 第一级：固定三大分类硬隔离 (AI 法规动态 / AI 安全产品动态 / 事件动态)
 * 4. 第二级：关键词与标签智能匹配
 */

export const TOPIC_CATEGORY_MAP = {
  'AI 法规动态': ['法规政策', 'AI安全标准', '合规动态', '行业动态'],
  'AI 安全产品动态': ['安全产品突破', '产品突破', 'GitHub开源', '行业动态'],
  '事件动态': ['违规处罚与事件', '安全事件', '行业动态'],
  'AI安全标准': ['AI安全标准', '标准规范', '安全标准', '法规政策'],
  'GitHub开源': ['GitHub开源', 'GitHub项目', 'GitHub', '安全产品突破']
};

export const STRICT_CATEGORY_MAP = {
  'AI 法规动态': ['法规政策', 'AI安全标准', '合规动态', '标准规范'],
  'AI 安全产品动态': ['安全产品突破', '产品突破', 'GitHub开源', 'GitHub项目'],
  '事件动态': ['违规处罚与事件', '安全事件'],
  'AI安全标准': ['AI安全标准', '标准规范', '安全标准'],
  'GitHub开源': ['GitHub开源', 'GitHub项目', 'GitHub']
};

/**
 * 检查文章是否命中关键词组规则
 * @param {Object} article
 * @param {Array<string>|string} ruleKeywords
 * @returns {boolean}
 */
export function matchKeywords(article, ruleKeywords) {
  let groups = [];
  if (Array.isArray(ruleKeywords)) {
    groups = ruleKeywords;
  } else if (typeof ruleKeywords === 'string') {
    try {
      const parsed = JSON.parse(ruleKeywords);
      if (Array.isArray(parsed)) groups = parsed;
      else groups = ruleKeywords.split(/[,，\n]/).filter(Boolean);
    } catch {
      groups = ruleKeywords.split(/[,，\n]/).filter(Boolean);
    }
  }

  if (!groups || groups.length === 0) return true;

  const haystack = [
    article.title || '',
    article.summary || '',
    article.detailTag || '',
    article.affectedEntity || '',
    article.primaryAuthority || '',
    article.primaryDocTitle || '',
    article.impact || '',
    article.insight || '',
    ...(Array.isArray(article.tags) ? article.tags : [])
  ].join(' ').toLowerCase();

  // 每个 keyword group 是与 (AND) 关系，group 内部由 | 分隔的是或 (OR) 关系
  return groups.every(group => {
    const tokens = String(group).split('|').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tokens.length === 0) return true;
    return tokens.some(token => {
      // 常见英文/行业词语义容错扩展
      if (token === 'cyber') {
        return haystack.includes('cyber') || haystack.includes('网络安全') || haystack.includes('攻防') || haystack.includes('安全') || haystack.includes('护栏');
      }
      if (token === 'guardrails' || token === '护栏') {
        return haystack.includes('guardrail') || haystack.includes('护栏') || haystack.includes('prompt shield') || haystack.includes('安全防护') || haystack.includes('防线');
      }
      if (token === 'huggingface' || token === 'hugging face' || token === 'hugging') {
        return haystack.includes('huggingface') || haystack.includes('hugging face') || haystack.includes('hugging');
      }
      return haystack.includes(token);
    });
  });
}

/**
 * 根据用户输入的专题名称智能推荐关键词规则
 * 避免用户因生僻或过窄词导致完全抓不到内容
 * @param {string} title
 * @param {string} category
 * @returns {Array<string>}
 */
export function suggestRuleKeywords(title = '', category = '') {
  const t = (title || '').toLowerCase().trim();
  const suggestions = [];

  if (t.includes('openai') || t.includes('chatgpt') || t.includes('gpt') || t.includes('o1') || t.includes('sora')) {
    suggestions.push('OpenAI|ChatGPT|GPT|o1|Sora');
  } else if (t.includes('anthropic') || t.includes('claude')) {
    suggestions.push('Anthropic|Claude|RSP');
  } else if (t.includes('deepseek') || t.includes('深度求索') || t.includes('r1')) {
    suggestions.push('DeepSeek|深度求索|R1');
  } else if (t.includes('hugging') || t.includes('hf') || t.includes('抱脸')) {
    suggestions.push('HuggingFace|Hugging Face|Spaces|Pickle|Token|逃逸|渗透|后门');
  } else if (t.includes('欧盟') || t.includes('eu') || t.includes('ai act') || t.includes('法案')) {
    suggestions.push('欧盟|EU|AI Act|人工智能法案|欧洲议会');
  } else if (t.includes('备案') || t.includes('网信办') || t.includes('中国') || t.includes('tc260')) {
    suggestions.push('中国|网信办|工信部|TC260|备案');
  } else if (t.includes('owasp') || t.includes('iso') || t.includes('42001') || t.includes('aiuc') || t.includes('nist') || t.includes('标准') || t.includes('白皮书')) {
    suggestions.push('OWASP|ISO 42001|AIUC|NIST|标准|框架|白皮书');
  } else if (t.includes('github') || t.includes('开源') || t.includes('garak') || t.includes('promptfoo') || t.includes('pyrit') || t.includes('guardrails') || t.includes('护栏')) {
    suggestions.push('GitHub|开源|garak|promptfoo|PyRIT|Guardrails|护栏');
  } else if (t.includes('漏洞') || t.includes('越狱') || t.includes('攻击') || t.includes('注入') || t.includes('后门')) {
    suggestions.push('漏洞|越狱|注入|后门|攻击|数据泄露|逃逸|渗透');
  }

  // 若未能识别特殊品牌或机构，提取标题中的实体词
  if (suggestions.length === 0 && title) {
    const cleaned = title
      .replace(/[专题动态全景时间线进展跟踪监测分析研究监管规制]/g, ' ')
      .trim();
    const tokens = cleaned.split(/\s+/).filter(w => w.length >= 2);
    if (tokens.length > 0) {
      suggestions.push(tokens.join('|'));
    }
  }

  return suggestions;
}

/**
 * 严格提取客观时间线里程碑的真实官方发布/发生时间
 * 杜绝抓取时间（collectedAt）被误用为历史里程碑发生时间
 * @param {Object} article
 * @returns {string|null} YYYY-MM-DD 或 null
 */
export function getMilestoneEventDate(article) {
  if (!article) return null;

  // 1. 优先使用已核准的一手源发布时间或真实事件发生时间
  if (article.eventDate && typeof article.eventDate === 'string') {
    const match = article.eventDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  if (article.primaryDate && typeof article.primaryDate === 'string') {
    const match = article.primaryDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  // 2. 尝试从一手公报名称、标题或摘要正文中正则匹配明确的真实发布/发生日期 (如 2024年3月13日, 2023-12-09)
  const text = [article.primaryDocTitle, article.title, article.summary].filter(Boolean).join(' ');
  const dateMatch = text.match(/\b(202[0-9])[-/.年](0?[1-9]|1[0-2])[-/.月](0?[1-9]|[12]\d|3[01])\b/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, '0');
    const d = dateMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. 检查 publishedAt：若明确为抓取时间（dateIsCollection），绝对不能作为真实事件发生时间
  if (!article.dateIsCollection && article.publishedAt && typeof article.publishedAt === 'string') {
    const pub = article.publishedAt.slice(0, 10);
    const col = article.collectedAt ? String(article.collectedAt).slice(0, 10) : null;
    // 只有当发布时间与抓取时间不同，或者没有抓取时间时，才采信 publishedAt
    if (!col || pub !== col) {
      return pub;
    }
  }

  return null;
}

/**
 * 判断文章是否可作为专题的客观时间线里程碑
 * @param {Object} article
 * @param {Object} topic
 * @returns {boolean}
 */
export function matchArticleToTimeline(article, topic) {
  // 1. 观点类文章严格不进时间线
  if (article.contentNature === 'opinion') {
    return false;
  }

  // 2. 未穿透核实源头的二手文章，暂不进入时间线里程碑
  if (article.verificationStatus === 'unverified') {
    return false;
  }

  // 3. 严格要求具备真实的事件/发布时间，杜绝抓取时间充斥时间线
  const eventDate = getMilestoneEventDate(article);
  if (!eventDate) {
    return false;
  }

  // 4. 第一级：严格分类硬边界匹配
  const allowed = STRICT_CATEGORY_MAP[topic.category] || [topic.category];
  const articleCat = article.intelligenceType || article.category;
  if (!allowed.includes(articleCat)) {
    return false;
  }

  // 5. 第二级：关键词规则匹配
  return matchKeywords(article, topic.ruleKeywords || topic.rule_keywords);
}

/**
 * 判断观点类文章是否作为专题的关联专家解读参考
 * @param {Object} article
 * @param {Object} topic
 * @returns {boolean}
 */
export function matchOpinionToTopic(article, topic) {
  if (article.contentNature !== 'opinion') {
    return false;
  }
  return matchKeywords(article, topic.ruleKeywords || topic.rule_keywords);
}

/**
 * 为专题组装时间线序列与关联观点
 * @param {Object} topic
 * @param {Array<Object>} allArticles
 * @returns {{ milestones: Array<Object>, associatedOpinions: Array<Object> }}
 */
export function assembleTopicDossier(topic, allArticles = []) {
  const milestones = [];
  const associatedOpinions = [];

  for (const a of allArticles) {
    if (matchArticleToTimeline(a, topic)) {
      const eventDate = getMilestoneEventDate(a);
      milestones.push({
        ...a,
        // 时间线严格以真实发生/发布时间为对齐基准
        timelineDate: eventDate,
        isVerifiedPrimary: a.verificationStatus === 'verified' || a.sourceOrigin === 'direct'
      });
    } else if (matchOpinionToTopic(a, topic)) {
      associatedOpinions.push(a);
    }
  }

  // 时间线默认按真实发生时间倒序排列（最新进展在最上方）
  milestones.sort((a, b) => new Date(b.timelineDate || 0) - new Date(a.timelineDate || 0));
  associatedOpinions.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  return {
    milestones,
    associatedOpinions
  };
}
