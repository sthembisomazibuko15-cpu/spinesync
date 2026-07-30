import { useEffect, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { POSE_CONNECTIONS } from "@mediapipe/pose";
import { jointAngles, summarizeSession } from "./lib/poseMath";

const C = { shaft:"#1A1C1E", dust:"#2E3135", slate:"#4A5058", seam:"#6B7785", day:"#F2EDE6", ore:"#C9862A", bio:"#3AA88C", danger:"#D94F3B", warn:"#E8A020" };
const font = "'Segoe UI',system-ui,sans-serif";
const mono = "'Courier New',monospace";

// AI Movement Analysis — records a functional movement (squat, lift, reach) via
// live camera or an uploaded video, runs MediaPipe Pose to track joints in
// real time, and summarizes symmetry/posture/movement quality for the FCE record.
export default function MovementScreen({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const framesRef = useRef([]);
  const rafRef = useRef(null);

  const [mode, setMode] = useState(null); // "camera" | "video" | null
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState(null); // latest per-frame angles, for the live readout
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onPoseResults);
    poseRef.current = pose;
    return () => { pose.close?.(); cameraRef.current?.stop?.(); cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPoseResults(results) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = results.image.width; canvas.height = results.image.height;
    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: C.bio, lineWidth: 3 });
      drawLandmarks(ctx, results.poseLandmarks, { color: C.ore, lineWidth: 1, radius: 3 });
      const angles = jointAngles(results.poseLandmarks);
      if (angles) { framesRef.current.push(angles); setLive(angles); }
    }
    ctx.restore();
  }

  async function startCamera() {
    setError(""); setMode("camera"); setSummary(null); framesRef.current = [];
    try {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => { await poseRef.current.send({ image: videoRef.current }); },
        width: 640, height: 480,
      });
      cameraRef.current = camera;
      await camera.start();
      setRunning(true);
    } catch (err) {
      setError(`Camera unavailable: ${err.message}. Check browser permissions.`);
    }
  }

  function stopCamera() {
    cameraRef.current?.stop?.();
    setRunning(false);
    finalizeSummary();
  }

  function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(""); setMode("video"); setSummary(null); framesRef.current = [];
    const url = URL.createObjectURL(file);
    videoRef.current.srcObject = null;
    videoRef.current.src = url;
    videoRef.current.onloadeddata = () => { videoRef.current.play(); setRunning(true); processVideoFrame(); };
    videoRef.current.onended = () => { setRunning(false); finalizeSummary(); };
  }

  function processVideoFrame() {
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      poseRef.current.send({ image: videoRef.current });
      rafRef.current = requestAnimationFrame(processVideoFrame);
    }
  }

  function finalizeSummary() {
    const s = summarizeSession(framesRef.current);
    setSummary(s);
  }

  const band = (v) => v >= 80 ? C.bio : v >= 60 ? C.warn : C.danger;

  return (
    <div style={{ fontFamily: font }}>
      {!mode && <div style={{ display:"flex", gap:"0.8rem", flexWrap:"wrap" }}>
        <button onClick={startCamera} style={btnStyle(C.bio)}>📷 Use Live Camera</button>
        <label style={{ ...btnStyle(C.ore), cursor:"pointer" }}>
          🎞 Upload Video
          <input type="file" accept="video/*" onChange={handleVideoUpload} style={{ display:"none" }} />
        </label>
      </div>}

      {error && <div style={{ background:C.danger+"18", border:"1px solid "+C.danger+"55", color:C.danger, padding:"0.7rem 0.9rem", fontSize:"0.82rem", marginTop:"0.8rem" }}>{error}</div>}

      {mode && <div style={{ marginTop:"1rem" }}>
        <div style={{ position:"relative", maxWidth:"560px" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ display:"none" }} />
          <canvas ref={canvasRef} style={{ width:"100%", borderRadius:"4px", border:"1px solid "+C.slate, background:"#000" }} />
        </div>

        {live && running && <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", marginTop:"0.8rem", fontFamily:mono, fontSize:"0.72rem", color:C.seam }}>
          <span>L Knee: <b style={{color:C.day}}>{live.leftKnee?.toFixed(0)}°</b></span>
          <span>R Knee: <b style={{color:C.day}}>{live.rightKnee?.toFixed(0)}°</b></span>
          <span>L Hip: <b style={{color:C.day}}>{live.leftHip?.toFixed(0)}°</b></span>
          <span>R Hip: <b style={{color:C.day}}>{live.rightHip?.toFixed(0)}°</b></span>
          <span>Trunk Lean: <b style={{color:C.day}}>{live.trunkLean?.toFixed(0)}°</b></span>
        </div>}

        <div style={{ display:"flex", gap:"0.6rem", marginTop:"0.9rem" }}>
          {mode==="camera" && running && <button onClick={stopCamera} style={btnStyle(C.danger)}>■ Stop &amp; Analyze</button>}
          {!running && summary && <button onClick={() => { setMode(null); setSummary(null); setLive(null); }} style={btnStyle(C.slate)}>Reset</button>}
        </div>

        {summary && <div style={{ marginTop:"1rem", background:C.dust, border:"1px solid "+C.slate, borderLeft:"3px solid "+band(summary.movementQuality), padding:"1rem", borderRadius:"2px" }}>
          <div style={{ fontFamily:mono, fontSize:"0.6rem", letterSpacing:"0.22em", textTransform:"uppercase", color:C.ore, marginBottom:"0.6rem" }}>Movement Analysis Result</div>
          <div style={{ display:"flex", gap:"2rem", flexWrap:"wrap", marginBottom:"0.8rem" }}>
            <Stat label="Movement Quality" value={summary.movementQuality} color={band(summary.movementQuality)} />
            <Stat label="Symmetry" value={summary.symmetryScore} color={band(summary.symmetryScore)} />
            <Stat label="Posture" value={summary.postureScore} color={band(summary.postureScore)} />
          </div>
          <div style={{ fontSize:"0.78rem", color:C.seam, marginBottom:"0.8rem" }}>
            Max trunk lean {summary.maxTrunkLean}° across {summary.frameCount} tracked frames.
            {summary.maxTrunkLean > 45 && <span style={{color:C.danger}}> Excessive forward lean detected — review lifting technique.</span>}
          </div>
          {onResult && <button onClick={() => onResult(summary)} style={btnStyle(C.bio)}>Save to Assessment</button>}
        </div>}
      </div>}

      <div style={{ fontSize:"0.68rem", color:C.seam, marginTop:"1rem" }}>
        Requires camera permission and HTTPS. Scores are a computer-vision-assisted screening aid, not a substitute for clinical judgement.
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return <div>
    <div style={{ fontSize:"0.68rem", color:"#6B7785" }}>{label}</div>
    <div style={{ fontSize:"1.4rem", fontWeight:900, color }}>{value}</div>
  </div>;
}

function btnStyle(color) {
  return { background:"transparent", border:"1px solid "+color, color, padding:"0.55rem 1rem", fontSize:"0.82rem", fontWeight:700, fontFamily:font, cursor:"pointer", borderRadius:"2px" };
}
