import { NextResponse } from "next/server";
import { getTopics, createTopic, updateTopic, deleteTopic, importedArticles } from "@/lib/collection-store.mjs";
import { assembleTopicDossier, suggestRuleKeywords } from "@/lib/topic-matcher.mjs";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawArticles = importedArticles();
    const rawTopics = getTopics();

    const topics = rawTopics.map(t => {
      const { milestones, associatedOpinions } = assembleTopicDossier(t, rawArticles);
      return {
        ...t,
        milestoneCount: milestones.length,
        opinionCount: associatedOpinions.length,
        milestones,
        associatedOpinions
      };
    });

    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: error.message || '获取专题列表失败' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, category, ruleKeywords, ruleTags, summary } = body;

    if (!title || !category) {
      return NextResponse.json({ error: '专题名称和分类为必填项' }, { status: 400 });
    }

    let finalKeywords = ruleKeywords && ruleKeywords.length > 0
      ? ruleKeywords
      : suggestRuleKeywords(title, category);

    const created = createTopic({
      title,
      category,
      ruleKeywords: finalKeywords,
      ruleTags: ruleTags || [],
      summary: summary || ''
    });

    const rawArticles = importedArticles();
    const { milestones, associatedOpinions } = assembleTopicDossier(created, rawArticles);

    return NextResponse.json({
      topic: {
        ...created,
        milestoneCount: milestones.length,
        opinionCount: associatedOpinions.length,
        milestones,
        associatedOpinions
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || '创建专题失败' }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, title, category, ruleKeywords, ruleTags, summary } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少专题ID' }, { status: 400 });
    }

    const updated = updateTopic(id, {
      title,
      category,
      ruleKeywords: ruleKeywords || [],
      ruleTags: ruleTags || [],
      summary: summary || ''
    });

    if (!updated) {
      return NextResponse.json({ error: '专题不存在' }, { status: 404 });
    }

    const rawArticles = importedArticles();
    const { milestones, associatedOpinions } = assembleTopicDossier(updated, rawArticles);

    return NextResponse.json({
      topic: {
        ...updated,
        milestoneCount: milestones.length,
        opinionCount: associatedOpinions.length,
        milestones,
        associatedOpinions
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || '更新专题失败' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少专题ID' }, { status: 400 });
    }

    deleteTopic(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: error.message || '删除专题失败' }, { status: 400 });
  }
}
