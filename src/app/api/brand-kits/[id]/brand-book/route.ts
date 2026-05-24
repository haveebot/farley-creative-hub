/**
 * POST /api/brand-kits/[id]/brand-book
 *
 * Upload a brand book PDF for a brand kit. Two things happen:
 *   1. PDF saved to Vercel Blob → URL stored as an `assets` row with
 *      kind='brand_book' and brand_kit_id linking it back here.
 *   2. PDF text extracted server-side → appended to brand_book_notes
 *      with a clear separator.
 *
 * Multipart body:
 *   file (required, application/pdf)
 *   mode? = "append" | "replace" (default "append")
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getBrandKit, updateBrandKit } from "@/lib/db/brand-kits";
import { createAsset } from "@/lib/db/assets";
import { uploadBlob } from "@/lib/storage/blob";
import { extractPdfText } from "@/lib/ai/pdf";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  const kit = await getBrandKit(numId);
  if (!kit) {
    return NextResponse.json({ ok: false, error: "kit-not-found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected-multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file-required" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { ok: false, error: "pdf-only", message: "Brand book upload accepts PDF only." },
      { status: 400 },
    );
  }

  const mode = (form.get("mode") as string | null) === "replace" ? "replace" : "append";

  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. Extract text first — fail fast if PDF can't be parsed.
  let extraction;
  try {
    extraction = await extractPdfText(buffer);
  } catch (err) {
    console.error("[brand-book] pdf parse failed", err);
    return NextResponse.json(
      { ok: false, error: "pdf-parse-failed", message: (err as Error).message },
      { status: 400 },
    );
  }

  // 2. Upload PDF to Blob.
  let uploaded;
  try {
    uploaded = await uploadBlob(
      `brand-books/${kit.id}/${file.name}`,
      buffer,
      "application/pdf",
    );
  } catch (err) {
    console.error("[brand-book] blob upload failed", err);
    return NextResponse.json(
      { ok: false, error: "blob-upload-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  // 3. Create asset record linked to the kit.
  let asset;
  try {
    asset = await createAsset({
      name: `${kit.name} — brand book`,
      filename: file.name,
      url: uploaded.url,
      mime_type: "application/pdf",
      size_bytes: file.size,
      kind: "brand_book",
      brand_kit_id: kit.id,
      description: `${extraction.numPages} pages, uploaded ${new Date().toISOString()}`,
      uploaded_by: uploadedByLabel(auth),
    });
  } catch (err) {
    console.error("[brand-book] asset insert failed", err);
    return NextResponse.json(
      { ok: false, error: "asset-insert-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  // 4. Update brand_book_notes.
  const separator = `\n\n--- From ${file.name} (${extraction.numPages} pages, uploaded ${new Date().toLocaleDateString()}) ---\n\n`;
  const newNotes =
    mode === "replace"
      ? extraction.text
      : `${kit.brand_book_notes.trim()}${separator}${extraction.text}`.trim();

  const updatedKit = await updateBrandKit(kit.id, { brand_book_notes: newNotes });

  return NextResponse.json({
    ok: true,
    kit: updatedKit,
    asset,
    extraction: {
      numPages: extraction.numPages,
      charsExtracted: extraction.text.length,
    },
  });
}

function uploadedByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
