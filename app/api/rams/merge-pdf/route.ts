import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface SignatureRecord {
  signer_name: string;
  signature_data: string | null;
  signed_at: string | null;
}

interface MergePdfBody {
  pdf_url: string;
  document_ref: string | null;
  document_type: "risk_assessment" | "method_statement";
  job_id: string;
  signatures: SignatureRecord[];
}

export async function POST(req: Request) {
  const secret = req.headers.get("X-BillyBot-Secret");
  if (!process.env.N8N_SHARED_SECRET || secret !== process.env.N8N_SHARED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
  }

  const body = (await req.json()) as MergePdfBody;
  const { pdf_url, document_ref, document_type, job_id, signatures } = body;

  if (!pdf_url || !job_id) {
    return NextResponse.json({ error: "Missing pdf_url or job_id" }, { status: 400 });
  }

  // Download original PDF
  const pdfRes = await fetch(pdf_url);
  if (!pdfRes.ok) {
    return NextResponse.json({ error: `Failed to download PDF: ${pdfRes.status}` }, { status: 502 });
  }
  const pdfBytes = await pdfRes.arrayBuffer();

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add signature page (A4)
  const sigPage = pdfDoc.addPage([595, 842]);
  const { width, height } = sigPage.getSize();
  let y = height - 60;

  // Title
  const docLabel =
    document_type === "risk_assessment" ? "Risk Assessment" : "Method Statement";

  sigPage.drawText(`${docLabel} — Signatures`, {
    x: 50,
    y,
    font: boldFont,
    size: 18,
    color: rgb(0.05, 0.1, 0.2),
  });
  y -= 22;

  if (document_ref) {
    sigPage.drawText(`Reference: ${document_ref}`, {
      x: 50,
      y,
      font,
      size: 10,
      color: rgb(0.45, 0.45, 0.45),
    });
    y -= 16;
  }

  sigPage.drawText(
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
    { x: 50, y, font, size: 10, color: rgb(0.45, 0.45, 0.45) }
  );
  y -= 36;

  // Top divider
  sigPage.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 30;

  // Each signature
  for (const sig of signatures) {
    if (y < 160) break;

    // Name
    sigPage.drawText(sig.signer_name, {
      x: 50,
      y,
      font: boldFont,
      size: 13,
      color: rgb(0.05, 0.1, 0.2),
    });
    y -= 18;

    // Signed date
    if (sig.signed_at) {
      const signedDate = new Date(sig.signed_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      sigPage.drawText(`Signed: ${signedDate}`, {
        x: 50,
        y,
        font,
        size: 10,
        color: rgb(0.45, 0.45, 0.45),
      });
      y -= 20;
    }

    // Signature image
    if (sig.signature_data?.startsWith("data:image/png;base64,")) {
      try {
        const base64Data = sig.signature_data.replace("data:image/png;base64,", "");
        const imgBytes = Buffer.from(base64Data, "base64");
        const pngImage = await pdfDoc.embedPng(imgBytes);
        const imgWidth = 220;
        const imgHeight = 80;
        sigPage.drawImage(pngImage, {
          x: 50,
          y: y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        y -= imgHeight + 16;
      } catch {
        // skip malformed image
        y -= 10;
      }
    }

    // Divider
    sigPage.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    y -= 30;
  }

  // Save
  const mergedBytes = await pdfDoc.save();

  // Upload to Supabase storage
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const fileName = `${job_id}/${document_type}-signed-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("rams_signed")
    .upload(fileName, mergedBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from("rams_signed").getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
