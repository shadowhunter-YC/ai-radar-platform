import { NextResponse } from "next/server";

import { buildDashboard, getArticles, getSources } from "@/lib/repository";

export async function GET() {
  const [{ data: articles, mode }, { data: sources }] = await Promise.all([
    getArticles(),
    getSources()
  ]);

  return NextResponse.json({
    mode,
    data: buildDashboard(articles, sources)
  });
}
