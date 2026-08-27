// src/lib/incidentVision.ts
// Real, on-device computer vision for E-FIR photo evidence — COCO-SSD
// object detection via TensorFlow.js, running entirely in the browser.
// Nothing here ever leaves the device: the model and the image both stay
// client-side, only the resulting tag list (a handful of strings + scores)
// travels with the filed report. TensorFlow.js and the model weights
// (~6MB) are dynamically imported, not part of the main bundle — the
// overwhelming majority of app sessions never open the incident-filing
// photo picker, so there's no reason to make every tourist download an ML
// runtime on first load.
import type { ObjectDetection, DetectedObject } from '@tensorflow-models/coco-ssd'

export interface DetectedTag {
  class: string
  score: number
}

// Only categories with a genuinely defensible visual signal get an
// auto-suggestion — no attempt to infer HARASSMENT/ASSAULT/FRAUD from
// generic object classes, since COCO-SSD has no basis for that and a
// wrong suggestion there would be actively misleading, not just unhelpful.
const CATEGORY_SIGNALS: Record<string, string[]> = {
  VEHICLE_ACCIDENT: ['car', 'motorcycle', 'bus', 'truck', 'bicycle', 'train'],
  THEFT: ['backpack', 'handbag', 'suitcase'],
}

let modelPromise: Promise<ObjectDetection> | null = null

// Cached across calls within a session — the model only loads once even
// if the tourist attaches a photo, removes it, and attaches another.
function getModel(): Promise<ObjectDetection> {
  if (!modelPromise) {
    modelPromise = Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/coco-ssd'),
    ]).then(([, cocoSsd]) => cocoSsd.load({ base: 'lite_mobilenet_v2' }))
  }
  return modelPromise
}

// Loads the model (first call only) and runs detection on the given image
// element. Returns deduplicated tags (highest confidence per class),
// sorted by confidence, plus the best category suggestion this photo's
// content supports — or null if nothing in it maps to a category with
// real signal. Never throws: a model-load failure or an inference error
// degrades to "no tags," matching every other optional integration in
// this codebase (Twilio, Gemini, OpenWeatherMap all fail this way too).
export async function detectIncidentTags(imageEl: HTMLImageElement): Promise<{
  tags: DetectedTag[]
  suggestedCategory: string | null
}> {
  try {
    const model = await getModel()
    const predictions: DetectedObject[] = await model.detect(imageEl)

    const byClass = new Map<string, number>()
    for (const p of predictions) {
      const existing = byClass.get(p.class) ?? 0
      if (p.score > existing) byClass.set(p.class, p.score)
    }
    const tags: DetectedTag[] = [...byClass.entries()]
      .map(([cls, score]) => ({ class: cls, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    let suggestedCategory: string | null = null
    let bestSignalScore = 0
    for (const [category, classes] of Object.entries(CATEGORY_SIGNALS)) {
      for (const tag of tags) {
        if (classes.includes(tag.class) && tag.score > bestSignalScore) {
          suggestedCategory = category
          bestSignalScore = tag.score
        }
      }
    }

    return { tags, suggestedCategory }
  } catch {
    return { tags: [], suggestedCategory: null }
  }
}

// Reads a File into an off-DOM <img> the model can run against — the
// standard TF.js browser-inference pattern, no canvas step needed since
// coco-ssd's detect() accepts an HTMLImageElement directly.
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file')) }
    img.src = url
  })
}
