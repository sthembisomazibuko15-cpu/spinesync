// Pose landmark indices (MediaPipe Pose 33-point model) and joint angle math
// used by the AI Movement Analysis screen.

export const LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

function angleBetween(a, b, c) {
  // Angle at vertex b, formed by points a-b-c, in degrees (law of cosines)
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(a.x - c.x, a.y - c.y);
  if (ab === 0 || bc === 0) return null;
  let cos = (ab * ab + bc * bc - ac * ac) / (2 * ab * bc);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) * (180 / Math.PI);
}

function angleFromVertical(a, b) {
  // Angle of the line a->b relative to a vertical reference, in degrees.
  // Used for trunk lean, since spinal loading risk is about deviation from upright, not a 3-point joint angle.
  const dx = b.x - a.x, dy = b.y - a.y;
  const angle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
  return angle;
}

export function jointAngles(landmarks) {
  if (!landmarks || landmarks.length < 29) return null;
  const L = LANDMARK;
  const midShoulder = { x:(landmarks[L.LEFT_SHOULDER].x+landmarks[L.RIGHT_SHOULDER].x)/2, y:(landmarks[L.LEFT_SHOULDER].y+landmarks[L.RIGHT_SHOULDER].y)/2 };
  const midHip = { x:(landmarks[L.LEFT_HIP].x+landmarks[L.RIGHT_HIP].x)/2, y:(landmarks[L.LEFT_HIP].y+landmarks[L.RIGHT_HIP].y)/2 };
  return {
    leftKnee: angleBetween(landmarks[L.LEFT_HIP], landmarks[L.LEFT_KNEE], landmarks[L.LEFT_ANKLE]),
    rightKnee: angleBetween(landmarks[L.RIGHT_HIP], landmarks[L.RIGHT_KNEE], landmarks[L.RIGHT_ANKLE]),
    leftHip: angleBetween(landmarks[L.LEFT_SHOULDER], landmarks[L.LEFT_HIP], landmarks[L.LEFT_KNEE]),
    rightHip: angleBetween(landmarks[L.RIGHT_SHOULDER], landmarks[L.RIGHT_HIP], landmarks[L.RIGHT_KNEE]),
    leftShoulder: angleBetween(landmarks[L.LEFT_ELBOW], landmarks[L.LEFT_SHOULDER], landmarks[L.LEFT_HIP]),
    rightShoulder: angleBetween(landmarks[L.RIGHT_ELBOW], landmarks[L.RIGHT_SHOULDER], landmarks[L.RIGHT_HIP]),
    trunkLean: angleFromVertical(midHip, midShoulder),
  };
}

// Rolls a session's worth of per-frame angle readings into a simple summary:
// min/max/avg per joint, a symmetry score (left vs right agreement), and a
// posture score (how much the trunk stayed within a safe lean range).
export function summarizeSession(frames) {
  if (!frames.length) return null;
  const keys = ["leftKnee","rightKnee","leftHip","rightHip","leftShoulder","rightShoulder","trunkLean"];
  const stats = {};
  keys.forEach(k => {
    const vals = frames.map(f => f[k]).filter(v => typeof v === "number");
    if (vals.length) {
      stats[k] = { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((a,b)=>a+b,0)/vals.length };
    }
  });

  const kneeDiffs = frames.map(f => (typeof f.leftKnee==="number"&&typeof f.rightKnee==="number") ? Math.abs(f.leftKnee-f.rightKnee) : null).filter(v=>v!==null);
  const hipDiffs = frames.map(f => (typeof f.leftHip==="number"&&typeof f.rightHip==="number") ? Math.abs(f.leftHip-f.rightHip) : null).filter(v=>v!==null);
  const avgDiff = [...kneeDiffs, ...hipDiffs].length ? [...kneeDiffs, ...hipDiffs].reduce((a,b)=>a+b,0) / [...kneeDiffs, ...hipDiffs].length : 0;
  const symmetryScore = Math.max(0, Math.round(100 - avgDiff * 2.5));

  const trunkVals = frames.map(f=>f.trunkLean).filter(v=>typeof v==="number");
  const maxLean = trunkVals.length ? Math.max(...trunkVals) : 0;
  // Trunk lean under ~20 deg = safe posture during lifting/bending; heavier penalty beyond ~45 deg
  const postureScore = Math.max(0, Math.round(100 - Math.max(0, maxLean - 20) * 1.8));

  const movementQuality = Math.round((symmetryScore + postureScore) / 2);

  return { stats, symmetryScore, postureScore, movementQuality, maxTrunkLean: Math.round(maxLean), frameCount: frames.length };
}
