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
