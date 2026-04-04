import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      app: "legions-club",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        status: "degraded",
        app: "legions-club",
        database: "error",
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}