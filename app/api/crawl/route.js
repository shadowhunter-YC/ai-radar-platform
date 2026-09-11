import { NextResponse } from "next/server";

import { crawlPlan } from "@/lib/repository";

export async function GET() {
  return NextResponse.json({
    data: crawlPlan
  });
}

export async function POST() {
  return NextResponse.json({ error: '模拟采集入口已停用，请前往资讯源配置使用手动采集。' }, { status: 410 });
}
