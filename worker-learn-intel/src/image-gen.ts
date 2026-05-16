import { Env } from "./types";

// Generate a single image via Workers AI Flux Schnell. Returns base64 PNG.
// Flux Schnell is free-tier-friendly (~250 Neurons/image) and produces 1024x1024 output.
// For non-square needs, the client crops post-generation — Amazon A+ uploads tolerate any
// reasonable input aspect ratio (Seller Central auto-fits to module container).
export async function generateImage(
  env: Env,
  prompt: string,
  opts: { steps?: number; seed?: number } = {},
): Promise<{ image_base64?: string; error?: string }> {
  try {
    const res = await env.AI.run("@cf/black-forest-labs/flux-1-schnell" as keyof AiModels, {
      prompt,
      steps: opts.steps ?? 8,
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    });
    // Flux Schnell returns { image: "<base64>" }
    const image = (res as { image?: string }).image;
    if (!image) return { error: "no image in response" };
    return { image_base64: image };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
