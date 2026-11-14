import { findSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Foto hasil uji lab untuk satu pengajuan. Hanya untuk pengguna yang sudah login. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await findSessionUser())) return new Response("Silakan login terlebih dahulu", { status: 401 });

  const photo = await prisma.resultPhoto.findUnique({ where: { sampleId: params.id } });
  if (!photo) return new Response("Foto hasil uji tidak ditemukan", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="hasil-uji-${params.id}.${photo.mimeType.split("/")[1] ?? "jpg"}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
