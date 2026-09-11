export const CANONICAL_TAGS = [
  '模型与产品', '智能体与应用', 'AI安全', '数据与隐私', 'AI合规治理',
  '模型评测', '基础设施与算力', '行业与市场', '内容与身份风险', '供应链安全'
];

const ALIASES = new Map([
  ['OpenAI','模型与产品'], ['GPT-5.5','模型与产品'], ['GPT-6 Astra','模型与产品'], ['Claude','模型与产品'], ['Anthropic','模型与产品'], ['ChatGPT','模型与产品'], ['AI模型发布','模型与产品'],
  ['AI Agent','智能体与应用'], ['Agent','智能体与应用'], ['企业AI','智能体与应用'], ['企业知识库','智能体与应用'],
  ['AI安全','AI安全'], ['漏洞分析','AI安全'], ['漏洞识别','AI安全'], ['网络安全评估','AI安全'], ['红队测试','AI安全'], ['Jailbreak','AI安全'], ['提示注入','AI安全'], ['Prompt Injection','AI安全'], ['工具滥用','AI安全'],
  ['企业数据','数据与隐私'], ['数据泄露','数据与隐私'], ['数据外传','数据与隐私'], ['数据留存','数据与隐私'],
  ['AI合规','AI合规治理'], ['EU AI Act','AI合规治理'], ['风险评估','AI合规治理'], ['安全日志','AI合规治理'],
  ['模型评测','模型评测'], ['模型定价','行业与市场'], ['产品动态','模型与产品'],
  ['供应链安全','供应链安全'], ['代码安全','供应链安全'], ['密钥泄露','供应链安全'],
  ['深度伪造','内容与身份风险'], ['语音克隆','内容与身份风险'], ['财务欺诈','内容与身份风险'], ['身份验证','内容与身份风险']
]);

export function normalizeTags(tags = []) {
  const result = [];
  for (const tag of tags) {
    const canonical = ALIASES.get(tag) || (CANONICAL_TAGS.includes(tag) ? tag : null);
    if (canonical && !result.includes(canonical)) result.push(canonical);
  }
  return result.length ? result : ['行业与市场'];
}
