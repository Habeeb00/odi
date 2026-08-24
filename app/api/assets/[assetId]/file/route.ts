import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDataUrl } from "@/lib/media";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseDataUrl(asset.file);
  if (!parsed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.buffer), {
    headers: {
      "Content-Type": parsed.mime,
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
