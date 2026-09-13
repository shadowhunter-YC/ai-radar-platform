import { NextResponse } from "next/server";

import { getArticles } from "@/lib/repository";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    type: searchParams.get("type") || "全部",
    risk: searchParams.get("risk") || "全部",
    region: searchParams.get("region") || "全部",
    tag: searchParams.get("tag") || "全部"
  };

  const { data, mode } = await getArticles(filters);

  return NextResponse.json({
    mode,
    filters,
    data
  });
}

export async function PATCH(request) {
  try {
    const { updateImportedArticle } = await import("@/lib/collection-store.mjs");
    const body = await request.json();
    const { id, intelligenceType, detailTag, affectedEntity, severity, riskLevel } = body;
    if (!id) {
      return NextResponse.json({ error: "缺少文章 ID" }, { status: 400 });
    }
    const updated = updateImportedArticle(id, {
      intelligenceType,
      detailTag,
      affectedEntity,
      severity,
      riskLevel
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}
