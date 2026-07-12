import type { Request, Response } from "express";
import sharp from "sharp";
import { hasuraAdminMutation } from "../_lib/hasura-admin";
import { getFilterPreset } from "../_lib/filter-presets";
import {
  buildStorageFileUrl,
  downloadStorageFile,
  uploadStorageFile,
} from "../_lib/storage-admin";

interface HasuraEventPayload {
  event: {
    op: "INSERT" | "UPDATE" | "DELETE";
    data: {
      new: MediaRow | null;
      old: MediaRow | null;
    };
  };
}

interface MediaRow {
  id: string;
  event_id: string;
  file_url: string;
  storage_file_id: string | null;
  file_type: string;
  filter_applied: string | null;
  filter_preset_id: string | null;
}

const UPDATE_MEDIA_BAKE = `
  mutation UpdateMediaBake($id: uuid!, $bakedUrl: String!, $status: String!) {
    update_media_by_pk(
      pk_columns: { id: $id }
      _set: { baked_url: $bakedUrl, bake_status: $status }
    ) {
      id
    }
  }
`;

const MARK_BAKE_FAILED = `
  mutation MarkBakeFailed($id: uuid!) {
    update_media_by_pk(
      pk_columns: { id: $id }
      _set: { bake_status: "failed" }
    ) {
      id
    }
  }
`;

async function applySharpPreset(input: Buffer, presetId: string | null): Promise<Buffer> {
  const preset = getFilterPreset(presetId);
  if (!preset.sharp || preset.id === "none") {
    return input;
  }

  let pipeline = sharp(input);

  if (preset.sharp.greyscale) {
    pipeline = pipeline.grayscale();
  }
  if (preset.sharp.sepia) {
    pipeline = pipeline.tint({ r: 112, g: 66, b: 20 });
  }
  if (preset.sharp.modulate) {
    pipeline = pipeline.modulate({
      saturation: preset.sharp.modulate.saturation,
      brightness: preset.sharp.modulate.brightness,
    });
  }
  if (preset.sharp.tint) {
    pipeline = pipeline.tint(preset.sharp.tint);
  }

  return pipeline.jpeg({ quality: 85 }).toBuffer();
}

export default async function bake(req: Request, res: Response): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, service: "media/bake" });
    return;
  }

  const payload = req.body as HasuraEventPayload;
  const media = payload?.event?.data?.new;

  if (!media?.id) {
    res.status(400).json({ ok: false, error: "Missing media row in event payload" });
    return;
  }

  if (media.file_type !== "photo") {
    res.status(200).json({ ok: true, skipped: true, reason: "video baking deferred" });
    return;
  }

  const presetId = media.filter_preset_id ?? media.filter_applied;

  if (!presetId || presetId === "none") {
    await hasuraAdminMutation(UPDATE_MEDIA_BAKE, {
      id: media.id,
      bakedUrl: media.file_url,
      status: "done",
    });
    res.status(200).json({ ok: true, skipped: true, reason: "no filter preset" });
    return;
  }

  try {
    const fileId = media.storage_file_id;
    if (!fileId) {
      throw new Error("Missing storage_file_id on media row");
    }

    const rawBytes = await downloadStorageFile(fileId);
    const bakedBytes = await applySharpPreset(rawBytes, presetId);
    const bakedName = `baked-${media.id}.jpg`;
    const uploaded = await uploadStorageFile(bakedName, bakedBytes, "image/jpeg");
    const bakedUrl = buildStorageFileUrl(uploaded.id);

    await hasuraAdminMutation(UPDATE_MEDIA_BAKE, {
      id: media.id,
      bakedUrl,
      status: "done",
    });

    res.status(200).json({ ok: true, mediaId: media.id, bakedUrl });
  } catch (error) {
    await hasuraAdminMutation(MARK_BAKE_FAILED, { id: media.id }).catch(() => {});
    const message = error instanceof Error ? error.message : "Bake failed";
    res.status(500).json({ ok: false, error: message });
  }
}
