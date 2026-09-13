export const CANONICAL_TAGS = [
  '模型与产品', '智能体与应用', 'AI安全', '数据与隐私', 'AI合规治理',
  '模型评测', '基础设施与算力', '行业与市场', '内容与身份风险', '供应链安全',
  '安全标准与规范', 'GitHub与开源安全'
];

const ALIASES = new Map([
  ['OpenAI','模型与产品'], ['GPT-5.5','模型与产品'], ['GPT-6 Astra','模型与产品'], ['Claude','模型与产品'], ['Anthropic','模型与产品'], ['ChatGPT','模型与产品'], ['AI模型发布','模型与产品'],
  ['AI Agent','智能体与应用'], ['Agent','智能体与应用'], ['企业AI','智能体与应用'], ['企业知识库','智能体与应用'],
  ['AI安全','AI安全'], ['漏洞分析','AI安全'], ['漏洞识别','AI安全'], ['网络安全评估','AI安全'], ['红队测试','AI安全'], ['Jailbreak','AI安全'], ['提示注入','AI安全'], ['Prompt Injection','AI安全'], ['工具滥用','AI安全'],
  ['企业数据','数据与隐私'], ['数据泄露','数据与隐私'], ['数据外传','数据与隐私'], ['数据留存','数据与隐私'],
  ['AI合规','AI合规治理'], ['EU AI Act','AI合规治理'], ['风险评估','AI合规治理'], ['安全日志','AI合规治理'],
  ['模型评测','模型评测'], ['模型定价','行业与市场'], ['产品动态','模型与产品'],
  ['供应链安全','供应链安全'], ['代码安全','供应链安全'], ['密钥泄露','供应链安全'],
  ['深度伪造','内容与身份风险'], ['语音克隆','内容与身份风险'], ['财务欺诈','内容与身份风险'], ['身份验证','内容与身份风险'],
  ['ISO 42001','安全标准与规范'], ['OWASP Top 10','安全标准与规范'], ['AIUC-1','安全标准与规范'], ['NIST AI RMF','安全标准与规范'], ['MITRE ATLAS','安全标准与规范'], ['国家标准','安全标准与规范'],
  ['GitHub','GitHub与开源安全'], ['garak','GitHub与开源安全'], ['promptfoo','GitHub与开源安全'], ['PyRIT','GitHub与开源安全'], ['NeMo Guardrails','GitHub与开源安全']
]);

export function normalizeTags(tags = []) {
  const result = [];
  for (const tag of tags) {
    const canonical = ALIASES.get(tag) || (CANONICAL_TAGS.includes(tag) ? tag : null);
    if (canonical && !result.includes(canonical)) result.push(canonical);
  }
  return result.length ? result : ['行业与市场'];
}

export function normalizeCategory(cat, title = '', source = '') {
  const text = `${title} ${source}`.toLowerCase();

  // 显式优先识别 GitHub 与开源工具类别
  if (['GitHub', 'GitHub开源', 'GitHub项目', '开源生态'].includes(cat)) {
    return 'GitHub开源';
  }
  if (text.includes('github.com') || (text.includes('github') && (text.includes('repo') || text.includes('开源') || text.includes('工具')))) {
    return 'GitHub开源';
  }

  // 显式优先识别 AI 安全标准与白皮书规范类别
  if (['AI安全标准', '标准规范', '安全标准', '行业标准'].includes(cat)) {
    return 'AI安全标准';
  }
  if (
    text.includes('iso 42001') ||
    text.includes('iso/iec 42001') ||
    text.includes('aiuc-1') ||
    text.includes('aiuc') ||
    text.includes('owasp') ||
    text.includes('mitre atlas') ||
    text.includes('tc260') ||
    (text.includes('nist') && (text.includes('rmf') || text.includes('sp 800') || text.includes('standard') || text.includes('标准') || text.includes('guidance') || text.includes('proof'))) ||
    text.includes('安全标准') ||
    text.includes('安全规范') ||
    text.includes('评估指南')
  ) {
    return 'AI安全标准';
  }

  // 防御性守卫：若标题或来源为 NIST/OWASP 等标准组织发布的研究、标准或理论，避免误归为安全事件
  if (['安全事件', '违规处罚与事件'].includes(cat)) {
    if (text.includes('nist') || text.includes('owasp') || text.includes('standard') || text.includes('标准') || text.includes('proof') || text.includes('guidance')) {
      return 'AI安全标准';
    }
  }

  if (!cat) return '行业动态';
  if (['法规政策', '合规动态', '监管政策'].includes(cat)) return '法规政策';
  if (['安全产品突破', '产品动态', 'AI安全'].includes(cat)) return '安全产品突破';
  if (['违规处罚与事件', '安全事件'].includes(cat)) return '违规处罚与事件';
  if (['行业动态', '行业应用', '头部厂商', '其他'].includes(cat)) return '行业动态';
  return cat;
}

export function matchesType(itemType, targetType) {
  if (!targetType || targetType === "全部") return true;
  if (targetType === "AI安全标准" || targetType === "安全标准") return ['AI安全标准', '标准规范', '安全标准', '行业标准'].includes(itemType);
  if (targetType === "GitHub开源" || targetType === "GitHub" || targetType === "GitHub项目") return ['GitHub开源', 'GitHub项目', 'GitHub', '开源生态'].includes(itemType);
  if (targetType === "法规政策" || targetType === "合规动态") return ['法规政策', '合规动态', '监管政策'].includes(itemType);
  if (targetType === "安全产品突破" || targetType === "产品动态") return ['安全产品突破', '产品动态', 'AI安全', '行业动态', '行业应用', '其他', '头部厂商'].includes(itemType);
  if (targetType === "违规处罚与事件" || targetType === "安全事件") return ['违规处罚与事件', '安全事件'].includes(itemType);
  if (targetType === "行业动态") return ['行业动态', '行业应用', '其他', '头部厂商'].includes(itemType);
  return itemType === targetType;
}

export function getCategoryMeta(type, item = null) {
  if (['AI安全标准', '标准规范', '安全标准', '行业标准'].includes(type)) {
    return {
      label: 'AI安全标准',
      shortLabel: '安全标准',
      color: '#0284c7',
      border: '#0ea5e9',
      bg: 'rgba(14, 165, 233, 0.14)'
    };
  }
  if (['GitHub开源', 'GitHub项目', 'GitHub', '开源生态'].includes(type)) {
    return {
      label: 'GitHub开源',
      shortLabel: 'GitHub',
      color: '#6366f1',
      border: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.14)'
    };
  }
  if (['法规政策', '合规动态', '监管政策'].includes(type)) {
    return {
      label: '法规政策',
      shortLabel: '法规政策',
      color: '#c084fc',
      border: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.16)'
    };
  }
  if (['安全产品突破', '产品动态', 'AI安全', '行业动态', '行业应用', '其他', '头部厂商'].includes(type)) {
    return {
      label: '产品突破',
      shortLabel: '产品突破',
      color: '#86bc25',
      border: '#86bc25',
      bg: 'rgba(134, 188, 37, 0.16)'
    };
  }
  if (['违规处罚与事件', '安全事件'].includes(type)) {
    // 智能细分：如果明确涉及行政处罚、罚款、立案、诉讼、下架、通报批评，展示“违规处罚”；若是攻击利用、越狱、漏洞利用，展示“安全事件”
    const text = [item?.detailTag, item?.title, item?.summary, typeof item === 'string' ? item : ''].filter(Boolean).join(' ');
    const isPenalty = /(处罚|罚款|罚单|撤销|下架|立案|诉讼|起诉|判决|禁令|通报批评)/i.test(text);

    if (isPenalty) {
      return {
        label: '违规处罚',
        shortLabel: '违规处罚',
        color: '#f87171',
        border: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.16)'
      };
    }

    return {
      label: '安全事件',
      shortLabel: '安全事件',
      color: '#f87171',
      border: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.16)'
    };
  }
  return {
    label: '产品突破',
    shortLabel: '产品突破',
    color: '#86bc25',
    border: '#86bc25',
    bg: 'rgba(134, 188, 37, 0.16)'
  };
}

