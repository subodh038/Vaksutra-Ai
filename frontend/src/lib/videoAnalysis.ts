// ─── Post-recording video analysis ─────────────────────────────────────────
//
//  Runs MediaPipe FaceLandmarker against an already-recorded video blob,
//  AFTER the user has finished recording and is reviewing it.
//
//  CPU-FIRST DESIGN: this app targets devices without a dedicated GPU.
//  Every choice below is tuned for single-threaded WASM execution:
//    - CPU delegate only — no GPU attempt (saves the failed-init roundtrip)
//    - FaceLandmarker only — PoseLandmarker dropped (2× the compute, rarely
//      visible in a typical webcam framing anyway)
//    - 5 samples/sec — enough for gaze/pose trends; every extra sample is
//      a full MediaPipe inference pass on the main thread
//    - 8× playback speed — halves wall-clock time vs. 4×
//    - Pinned WASM CDN URL — avoids a version-resolution request on every run
//    - O(1) blendshape lookup — build a Map once per frame instead of 9×
//      Array.find() linear scans
//
//  SAMPLING STRATEGY: play the video through (sped up) rather than seeking.
//  Seeking forces a re-decode from the nearest keyframe on every jump.
//  Playing through is sequential decode — one pass, much faster.
//
//  Timestamps use the video's own playback position (ms) so they align with
//  the audio blob's timeline (both share the same t=0 from RecordingScreen).

export type Landmark = { x: number; y: number; z: number };
type BlendshapeCategory = { categoryName: string; score: number };
type MPResult = {
  faceLandmarks?: Landmark[][];
  faceBlendshapes?: { categories: BlendshapeCategory[] }[];
};

export interface FrameAnalysisEntry {
  timestamp: number; // ms from video start (aligns with audio timeline)

  // ── Face: gaze & pose ───────────────────────────────────────────────────
  eyeContactScore: number;
  headPoseScore: number;
  faceDetected: boolean;
  headPitch: number;
  headRoll: number;

  // ── Face: blendshape basics ─────────────────────────────────────────────
  mouthOpenScore: number;
  smileScore: number;
  blinkScore: number;

  // ── Face: extended blendshape signals ────────────────────────────────────
  // browRaiseScore = MediaPipe `browInnerUp` (AU1). It fires on surprise,
  // emphasis and concern alike — it is an OBSERVATION, not an emotion
  // diagnosis. Named honestly per our grounding rules.
  browRaiseScore: number;
  cheekSquintScore: number;   // AU6 cheek raiser — canonical Duchenne marker
  confusionScore: number;
  stressScore: number;
  frownScore: number;
  squintScore: number;
  mockingScore: number;

  // ── Gaze zone classification (geometric iris method) ────────────────────
  gazeZone: "center" | "left" | "right" | "down" | "up" | "away";

  // ── Gaze prototype: blendshape-derived gaze (−1…+1 per axis) ────────────
  // From the 8 eyeLook* coefficients. Captured alongside the geometric
  // method so beta recordings let us A/B both offline before switching.
  gazeXBs: number;   // −1 left … +1 right
  gazeYBs: number;   // −1 down … +1 up

  // ── Advanced metrics ──────────────────────────────────────────────────
  faceWidth: number;

  // ── Body pose — always zeroed (PoseLandmarker dropped for CPU perf) ──────
  poseDetected: false;
  postureScore: 0;
  shoulderLevelDiff: 0;
  spineAngle: 0;
  armsCrossed: false;
}

// ── Gaze zone classifier — with head-yaw compensation ────────────────────
// Iris groups follow Google's official mapping (tensors_to_face_landmarks_
// graph.cc): iris-A = 468-472 (center,right,top,left,bottom), iris-B =
// 473-477. Group A pairs with eye corners 33/133; group B with 263/362.
function classifyGazeZone(
  pts: Landmark[],
): "center" | "left" | "right" | "down" | "up" | "away" {
  const irisAIdx = [468, 469, 470, 471, 472];
  const irisBIdx = [473, 474, 475, 476, 477];
  if (pts.length <= 477) return "away";
  const ok = [
    ...irisAIdx,
    ...irisBIdx,
    33,
    133,
    263,
    362,
    1,
    234,
    454,
  ].every((i) => pts[i]);
  if (!ok) return "away";

  const aX = irisAIdx.reduce((s, i) => s + pts[i].x, 0) / irisAIdx.length;
  const aY = irisAIdx.reduce((s, i) => s + pts[i].y, 0) / irisAIdx.length;
  const aEyeW = Math.abs(pts[33].x - pts[133].x) || 0.01;
  const aOffsetX = (aX - (pts[33].x + pts[133].x) / 2) / aEyeW;

  const bX = irisBIdx.reduce((s, i) => s + pts[i].x, 0) / irisBIdx.length;
  const bY = irisBIdx.reduce((s, i) => s + pts[i].y, 0) / irisBIdx.length;
  const bEyeW = Math.abs(pts[263].x - pts[362].x) || 0.01;
  const bOffsetX = (bX - (pts[263].x + pts[362].x) / 2) / bEyeW;

  const rawOffsetX = (aOffsetX + bOffsetX) / 2;

  const noseTip = pts[1];
  const leftCheek = pts[234];
  const rightCheek = pts[454];
  const cheekMidX = (leftCheek.x + rightCheek.x) / 2;
  const cheekSpanX = Math.abs(leftCheek.x - rightCheek.x) || 0.1;
  const headYaw = (noseTip.x - cheekMidX) / cheekSpanX;
  const compensatedOffsetX = rawOffsetX - headYaw * 0.55;

  const aEyeMidY =
    ((pts[159]?.y ?? aY) + (pts[145]?.y ?? aY)) / 2;
  const bEyeMidY =
    ((pts[386]?.y ?? bY) + (pts[374]?.y ?? bY)) / 2;
  const aEyeH = Math.abs((pts[159]?.y ?? 0) - (pts[145]?.y ?? 0)) || 0.01;
  const bEyeH = Math.abs((pts[386]?.y ?? 0) - (pts[374]?.y ?? 0)) || 0.01;
  const aOffsetY = (aY - aEyeMidY) / aEyeH;
  const bOffsetY = (bY - bEyeMidY) / bEyeH;
  const avgOffsetY = (aOffsetY + bOffsetY) / 2;

  // Mobile-accommodated gaze gates:
  // +0.42 accounts for downward screen-to-camera parallax on phones
  // ±0.32 catches genuine sideways/thinking glances without requiring extreme socket strain
  if (avgOffsetY > 0.42) return "down";
  if (avgOffsetY < -0.35) return "up";
  if (compensatedOffsetX < -0.32) return "left";
  if (compensatedOffsetX > 0.32) return "right";
  return "center";
}

// ── Blendshape-derived gaze prototype (−1…+1 per axis) ───────────────────
// Uses the 8 purpose-built eyeLook* coefficients instead of geometric iris
// offsets. Captured alongside the geometric method for offline A/B during
// beta — NOT yet used for classification.
//
// Convention (ARKit/FACS): for LEFTWARD gaze the subject-left eye rotates
// OUT (temple-ward) and the subject-right eye rotates IN (nose-ward).
function blendshapeGaze(bs: Map<string, number>): { x: number; y: number } {
  const g = (n: string) => bs.get(n) ?? 0;
  const x = ((g("eyeLookOutLeft") - g("eyeLookInLeft")) +
             (g("eyeLookInRight") - g("eyeLookOutRight"))) / 2;
  const y = ((g("eyeLookUpLeft") + g("eyeLookUpRight")) -
             (g("eyeLookDownLeft") + g("eyeLookDownRight"))) / 2;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}

// ── Per-frame face/gaze/emotion scorer ────────────────────────────────────
// blendshapes is a pre-built Map<name, score> — O(1) lookup vs. Array.find()
function scoreFrame(landmarks: Landmark[], blendshapeMap: Map<string, number>) {
  const zero = {
    eyeContactScore: 0,
    headPoseScore: 0,
    mouthOpenScore: 0,
    smileScore: 0,
    blinkScore: 0,
    headPitch: 0,
    headRoll: 0,
    browRaiseScore: 0,
    cheekSquintScore: 0,
    confusionScore: 0,
    stressScore: 0,
    frownScore: 0,
    squintScore: 0,
    mockingScore: 0,
    gazeZone: "away" as const,
    gazeXBs: 0,
    gazeYBs: 0,
    faceWidth: 0,
  };
  if (!landmarks || landmarks.length === 0) return zero;
  const pts = landmarks;

  // Head pose (yaw) — nose tip vs. cheek midpoint
  const noseTip = pts[1];
  const leftCheek = pts[234];
  const rightCheek = pts[454];
  let headPoseScore = 1;
  if (noseTip && leftCheek && rightCheek) {
    const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
    const cheekSpanX = Math.abs(leftCheek.x - rightCheek.x) || 0.1;
    const yawRatio = Math.abs(noseTip.x - faceCenterX) / (cheekSpanX / 2 || 0.1);
    // Deadband: full credit up to 0.30 (approx ±18° conversational angle / handheld wobble)
    headPoseScore = yawRatio <= 0.30 ? 1.0 : Math.max(0, 1.0 - (yawRatio - 0.30) / 0.70);
  }

  // Eye contact — iris offset within eye socket
  let eyeContactScore = 0.5;
  if (pts.length > 475) {
    const lIx = (pts[468].x + pts[469].x + pts[470].x + pts[471].x) / 4;
    const rIx = (pts[472].x + pts[473].x + pts[474].x + pts[475].x) / 4;
    const lEyeW = Math.abs((pts[33]?.x ?? 1) - (pts[133]?.x ?? 0)) || 1;
    const rEyeW = Math.abs((pts[263]?.x ?? 1) - (pts[362]?.x ?? 0)) || 1;
    const lGaze =
      Math.abs(lIx - ((pts[33]?.x ?? 0) + (pts[133]?.x ?? 1)) / 2) / lEyeW;
    const rGaze =
      Math.abs(rIx - ((pts[263]?.x ?? 0) + (pts[362]?.x ?? 1)) / 2) / rEyeW;
    eyeContactScore = Math.max(0, 1 - (lGaze + rGaze) / 2 / 0.6);
  }

  // Head pitch — nose position along face height axis
  let headPitch = 0;
  const foreheadTop = pts[10];
  const chin = pts[152];
  if (noseTip && foreheadTop && chin) {
    const faceH = chin.y - foreheadTop.y;
    if (faceH > 0)
      headPitch = ((noseTip.y - foreheadTop.y) / faceH - 0.45) * 60;
  }

  // Head roll — tilt of eye line
  let headRoll = 0;
  const lEyeInner = pts[133];
  const rEyeInner = pts[362];
  if (lEyeInner && rEyeInner)
    headRoll =
      Math.atan2(rEyeInner.y - lEyeInner.y, rEyeInner.x - lEyeInner.x) *
      (180 / Math.PI);

  // Blendshape scores — O(1) Map lookups
  const get = (name: string) => blendshapeMap.get(name) ?? 0;

  // Google Recommended Mouth Open (Speaking) calculation using inner lip landmarks
  const upperLip = pts[13];
  const lowerLip = pts[14];
  let mouthOpenScore = 0.0;
  if (upperLip && lowerLip) {
    const lipDistance = Math.abs(upperLip.y - lowerLip.y);
    // Y coordinates are normalized (0 to 1). A typical distance > 0.01 indicates speaking.
    mouthOpenScore = lipDistance > 0.01 ? 1.0 : 0.0;
  }
  // Average per side (was: sum — saturated to 1.0 on any real smile).
  // Genuine smile ≈ 0.4-0.8 avg; slight smile ≈ 0.15-0.3.
  const smileScore = Math.min(
    1,
    (get("mouthSmileLeft") + get("mouthSmileRight")) / 2,
  );
  const blinkScore = (get("eyeBlinkLeft") + get("eyeBlinkRight")) / 2;
  // browInnerUp (AU1): fires on surprise/emphasis/concern alike — an
  // observation, NOT an anxiety diagnosis. Honest name per grounding rules.
  const browRaiseScore = get("browInnerUp");
  // AU6 cheek raiser — the canonical Duchenne-smile marker.
  const cheekSquintScore =
    (get("cheekSquintLeft") + get("cheekSquintRight")) / 2;
  // Guard confusion against smiling squints (AU4 vs AU6/AU12)
  const rawConfusion = (get("browDownLeft") + get("browDownRight")) / 2;
  const confusionScore = smileScore > 0.25 ? rawConfusion * 0.5 : rawConfusion;
  // Composite conversational stress: tracks lip press, brow furrow, and nose sneer
  const stressScore = Math.min(
    1,
    ((get("mouthPressLeft") + get("mouthPressRight")) / 2) * 0.4 +
      rawConfusion * 0.3 +
      ((get("noseSneerLeft") + get("noseSneerRight")) / 2) * 0.3,
  );
  const frownScore = (get("mouthFrownLeft") + get("mouthFrownRight")) / 2;
  const squintScore = (get("eyeSquintLeft") + get("eyeSquintRight")) / 2;

  // Mocking/Unprofessional: Asymmetry (goofy faces, winking, smirks), Sneers (disgust), Pucker (kissy face)
  const asymmetryScore = Math.max(
    Math.abs(get("mouthSmileLeft") - get("mouthSmileRight")),
    Math.abs(get("mouthFrownLeft") - get("mouthFrownRight")),
    Math.abs(get("mouthStretchLeft") - get("mouthStretchRight")),
    Math.abs(get("mouthDimpleLeft") - get("mouthDimpleRight")),
    Math.abs(get("mouthLowerDownLeft") - get("mouthLowerDownRight")),
    Math.abs(get("eyeSquintLeft") - get("eyeSquintRight")),
    Math.abs(get("eyeBlinkLeft") - get("eyeBlinkRight")),
  );

  // Lip-to-Jaw Ratio (AU19 detection): Lips parted but jaw closed
  let tongueProtrusion = 0;
  if (pts[13] && pts[14] && pts[10] && pts[152]) {
    const lipGap = Math.abs(pts[13].y - pts[14].y);
    const faceHeight = Math.abs(pts[10].y - pts[152].y) || 1;
    const normalizedGap = lipGap / faceHeight;
    // If lips are parted > 2% of face height, but jaw is nearly shut
    if (normalizedGap > 0.02 && get("jawOpen") < 0.1) {
      tongueProtrusion = 1.0;
    }
  }

  const sneerScore = (get("noseSneerLeft") + get("noseSneerRight")) / 2;
  const puckerScore = get("mouthPucker");
  const mockingScore = Math.max(
    asymmetryScore,
    sneerScore,
    puckerScore,
    tongueProtrusion,
  );

  const gazeZone = classifyGazeZone(pts);
  const bsGaze = blendshapeGaze(blendshapeMap);

  const faceWidth =
    pts[234] && pts[454] ? Math.abs(pts[454].x - pts[234].x) : 0;

  return {
    eyeContactScore,
    headPoseScore,
    mouthOpenScore,
    smileScore,
    blinkScore,
    headPitch,
    headRoll,
    browRaiseScore,
    cheekSquintScore,
    confusionScore,
    stressScore,
    frownScore,
    squintScore,
    mockingScore,
    gazeZone,
    gazeXBs: bsGaze.x,
    gazeYBs: bsGaze.y,
    faceWidth,
  };
}

export interface AnalyzeVideoOptions {
  /** Real recording duration in ms — WebM blobs often report Infinity; passing
   *  this keeps progress % and the fps benchmark accurate. */
  durationMs?: number;
  /** Poll between samples — return true to abort early (e.g. screen unmounted).
   *  Partial frame data already collected is still returned. */
  shouldCancel?: () => boolean;
}

export interface AnalyzeVideoResult {
  frameAnalysis: FrameAnalysisEntry[];
  mediapipeReady: boolean;
}

// ── CPU-tuned constants ────────────────────────────────────────────────────

// Pinned to match the installed package version — avoids a CDN version
// resolution request on every analysis run.
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

// 8× is the practical maximum most browsers honour before capping.
const PLAYBACK_RATE = 8;

// Sample rate bounds (fps) — derived from Nyquist:
//   gaze/emotion signals change at ~1-2Hz → need ≥4fps to capture them
//   above ~8fps there's no new behavioral information, just wasted CPU
const MIN_SAMPLE_FPS = 4; // floor — never go slower than this
const MAX_SAMPLE_FPS = 8; // ceiling — no useful signal above this
const ANALYSIS_BUDGET_MS = 12_000; // target: finish in ≤12 seconds of wall-clock time

/**
 * Analyze a recorded video blob AFTER the fact — call this from the Review
 * screen's "Analyze" action, not during recording.
 *
 * CPU-first: skips GPU delegate entirely, drops PoseLandmarker, and plays
 * the video through at 8× speed rather than seeking frame-by-frame.
 */
export async function analyzeVideo(
  videoBlob: Blob,
  onProgress?: (pct: number) => void,
  opts: AnalyzeVideoOptions = {},
): Promise<AnalyzeVideoResult> {
  // MediaPipe's WASM runtime logs a benign "Created TensorFlow Lite XNNPACK
  // delegate for CPU" line via console.error on every init. Suppress it for
  // the duration of this call only — never patch globally.
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Created TensorFlow Lite XNNPACK delegate for CPU")
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  try {
    // Enforce a hard 15-second safety timeout so visual analysis can NEVER
    // hang the UI. On timeout we also signal cancellation so the still-running
    // runAnalysis tears itself down instead of leaking WASM/DOM resources.
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      console.warn("[analyzeVideo] Hard safety timeout reached (15s) — resolving with fallback.");
    }, 15000);
    const timeoutPromise = new Promise<AnalyzeVideoResult>((resolve) => {
      setTimeout(() => {
        resolve({ frameAnalysis: [], mediapipeReady: false });
      }, 15000);
    });
    try {
      return await Promise.race([
        runAnalysis(videoBlob, onProgress, {
          ...opts,
          shouldCancel: opts.shouldCancel ?? (() => timedOut),
        }),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeoutTimer);
    }
  } finally {
    console.error = originalConsoleError;
  }
}

async function runAnalysis(
  videoBlob: Blob,
  onProgress: ((pct: number) => void) | undefined,
  opts: AnalyzeVideoOptions,
): Promise<AnalyzeVideoResult> {
  console.log("[videoAnalysis] ▶ Step 1: Initializing MediaPipe FaceLandmarker...");
  const { FaceLandmarker, FilesetResolver } =
    await import("@mediapipe/tasks-vision");

  // ── Init MediaPipe — CPU delegate only ────────────────────────────────────
  let faceLandmarker: {
    detectForVideo: (v: HTMLVideoElement, t: number) => MPResult;
  } | null = null;

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    console.log("[videoAnalysis] ✔ Step 2: MediaPipe initialized successfully.");
  } catch (err) {
    console.error("[analyzeVideo] ✖ MediaPipe init failed:", err);
    return { frameAnalysis: [], mediapipeReady: false };
  }

  // ── Load video off-screen for playback-based sampling ─────────────────────
  console.log("[videoAnalysis] ▶ Step 3: Loading video blob into offscreen player...");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.width = 640;
  video.height = 480;
  video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:640px;height:480px;opacity:0;pointer-events:none;";
  video.src = URL.createObjectURL(videoBlob);
  document.body.appendChild(video);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn("[analyzeVideo] Video canplay timeout (3s) — proceeding anyway");
      resolve();
    }, 3000);
    const onReady = () => {
      clearTimeout(timer);
      video.width = video.videoWidth || 640;
      video.height = video.videoHeight || 480;
      resolve();
    };
    if (video.readyState >= 2) {
      onReady();
      return;
    }
    video.oncanplay = onReady;
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load recorded video for analysis"));
    };
  });

  let durationMs = video.duration * 1000;
  if (!isFinite(durationMs) || durationMs <= 0) {
    durationMs = opts.durationMs ?? Math.max((videoBlob.size / 58_000) * 1000, 1000);
  }
  console.log(`[videoAnalysis] ✔ Video ready. Duration: ${(durationMs / 1000).toFixed(1)}s, Size: ${(videoBlob.size / 1024).toFixed(1)} KB`);

  const frameAnalysis: FrameAnalysisEntry[] = [];
  const sampleIntervalMs = 1000 / 5; // 5 samples per second
  let lastMpTimestamp = -1;

  try {
    video.playbackRate = PLAYBACK_RATE;
  } catch {
    /* browser cap — fine */
  }

  // ── Playback loop ──────────────────────────────────────────────────────────
  console.log("[videoAnalysis] ▶ Step 4: Starting 8x playback loop for frame sampling...");
  await new Promise<void>((resolve, reject) => {
    let lastSampledMs = -Infinity;
    let settled = false;
    let lastTMs = -1;
    let stalledTicks = 0;
    const loopStartTime = performance.now();
    const maxPlaybackWallClockMs = Math.max(4000, (durationMs / PLAYBACK_RATE) + 3000);

    const finish = () => {
      if (!settled) {
        settled = true;
        console.log(`[videoAnalysis] ✔ Step 5: Playback loop finished. Total frames captured: ${frameAnalysis.length}`);
        resolve();
      }
    };

    function tick() {
      if (settled) return;
      // Caller requested abort (e.g. user left the Review screen) — stop
      // burning CPU and resolve with whatever frames we already collected.
      if (opts.shouldCancel?.()) {
        finish();
        return;
      }
      if (video.ended || video.paused) {
        finish();
        return;
      }

      // Hard wall-clock timeout for playback loop
      if (performance.now() - loopStartTime > maxPlaybackWallClockMs) {
        finish();
        return;
      }

      const tMs = video.currentTime * 1000;

      // WebM blobs recorded live often report duration=Infinity and never fire
      // the 'ended' event. If currentTime stops progressing within 5ms delta, assume done.
      if (Math.abs(tMs - lastTMs) < 5) {
        stalledTicks++;
        if (stalledTicks > 30) { // ~500ms of stalled playback at 60fps
          finish();
          return;
        }
      } else {
        stalledTicks = 0;
        lastTMs = tMs;
      }

      if (tMs - lastSampledMs >= sampleIntervalMs) {
        lastSampledMs = tMs;
        try {
          // Always use a strictly increasing timestamp for MediaPipe.
          // performance.now() is guaranteed monotonically increasing, unlike
          // video.currentTime which can repeat (e.g. stalls, first frame = 0).
          const mpTs = Math.max(performance.now(), lastMpTimestamp + 1);
          lastMpTimestamp = mpTs;
          const faceResult = faceLandmarker!.detectForVideo(video, mpTs);
          const landmarks = faceResult.faceLandmarks?.[0] ?? [];

          // Build an O(1) blendshape lookup map once per sampled frame
          const blendshapeMap = new Map<string, number>(
            (faceResult.faceBlendshapes?.[0]?.categories ?? []).map((c) => [
              c.categoryName,
              c.score,
            ]),
          );

          const scores = scoreFrame(landmarks, blendshapeMap);

          frameAnalysis.push({
            timestamp: tMs,
            eyeContactScore: scores.eyeContactScore,
            headPoseScore: scores.headPoseScore,
            faceDetected: landmarks.length > 0,
            headPitch: scores.headPitch,
            headRoll: scores.headRoll,
            mouthOpenScore: scores.mouthOpenScore,
            smileScore: scores.smileScore,
            blinkScore: scores.blinkScore,
            browRaiseScore: scores.browRaiseScore,
            cheekSquintScore: scores.cheekSquintScore,
            confusionScore: scores.confusionScore,
            stressScore: scores.stressScore,
            frownScore: scores.frownScore,
            squintScore: scores.squintScore,
            mockingScore: scores.mockingScore,
            gazeZone: scores.gazeZone,
            gazeXBs: scores.gazeXBs,
            gazeYBs: scores.gazeYBs,
            faceWidth: scores.faceWidth,
            // PoseLandmarker dropped — too expensive on CPU
            poseDetected: false,
            postureScore: 0,
            shoulderLevelDiff: 0,
            spineAngle: 0,
            armsCrossed: false,
          });
        } catch (err) {
          console.error("[analyzeVideo] detectForVideo threw — finishing immediately:", err);
          finish();
          return;
        }

        onProgress?.(Math.min(99, Math.round((tMs / durationMs) * 100)));
      }

      requestAnimationFrame(tick);
    }

    video.onended = finish;
    video
      .play()
      .then(() => requestAnimationFrame(tick))
      .catch((err) => {
        console.warn("[analyzeVideo] video.play() failed or was blocked:", err);
        finish();
      });
  });

  if (document.body.contains(video)) {
    document.body.removeChild(video);
  }
  URL.revokeObjectURL(video.src);
  onProgress?.(100);

  if (faceLandmarker) {
    try {
      (faceLandmarker as unknown as { close?: () => void }).close?.();
    } catch {
      /* instance already released */
    }
  }

  return { frameAnalysis, mediapipeReady: true };
}
