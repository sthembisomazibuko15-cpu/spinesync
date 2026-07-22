import { useState } from "react";
import { signIn, signUp } from "./lib/data";

const C = { shaft:"#1A1C1E",dust:"#2E3135",slate:"#4A5058",seam:"#6B7785",day:"#F2EDE6",ore:"#C9862A",bio:"#3AA88C",danger:"#D94F3B" };
const font = "'Segoe UI',system-ui,sans-serif";
const mono = "'Courier New',monospace";

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("biokineticist");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const inp = { width:"100%",background:C.shaft,border:`1px solid ${C.slate}`,color:C.day,padding:"0.7rem 0.9rem",fontSize:"0.9rem",fontFamily:font,outline:"none",borderRadius:"2px",marginBottom:"0.9rem" };
  const lbl = { display:"block",fontSize:"0.76rem",color:C.seam,marginBottom:"0.28rem" };

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const { data, error } = await signIn(email, password);
    setLoading(false);
    if (error) { setError(error.message); return; }
    onLoggedIn(data.user);
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const { error } = await signUp(email, password, fullName, role);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setInfo("Account created. An administrator must approve your access before you can log in.");
    setMode("signin");
  };

  return (
    <div style={{minHeight:"100vh",background:C.shaft,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font,padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{fontWeight:900,fontSize:"2rem",letterSpacing:"0.04em"}}>
            Spine<span style={{color:C.bio}}>Sync</span>
          </div>
          <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.seam,letterSpacing:"0.2em",marginTop:"0.3rem"}}>
            MSK RISK MANAGEMENT PLATFORM
          </div>
        </div>

        <div style={{background:C.dust,border:`1px solid ${C.slate}`,padding:"1.8rem",borderRadius:"2px"}}>
          <div style={{display:"flex",marginBottom:"1.4rem",borderBottom:`1px solid ${C.slate}`}}>
            {["signin","signup"].map(m => (
              <button key={m} onClick={()=>{setMode(m);setError("");setInfo("");}} style={{flex:1,padding:"0.6rem",background:"none",border:"none",cursor:"pointer",color:mode===m?C.bio:C.seam,fontWeight:mode===m?700:400,borderBottom:mode===m?`2px solid ${C.bio}`:"2px solid transparent",marginBottom:"-1px",fontFamily:font,fontSize:"0.84rem"}}>
                {m==="signin"?"Sign In":"Request Access"}
              </button>
            ))}
          </div>

          {error&&<div style={{background:C.danger+"18",border:`1px solid ${C.danger}`,color:C.danger,padding:"0.6rem 0.8rem",fontSize:"0.82rem",marginBottom:"1rem",borderRadius:"2px"}}>{error}</div>}
          {info&&<div style={{background:C.bio+"18",border:`1px solid ${C.bio}`,color:C.bio,padding:"0.6rem 0.8rem",fontSize:"0.82rem",marginBottom:"1rem",borderRadius:"2px",lineHeight:1.5}}>{info}</div>}

          {mode==="signin"?(
            <form onSubmit={handleSignIn}>
              <label style={lbl}>Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
              <label style={lbl}>Password</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={inp}/>
              <button type="submit" disabled={loading} style={{width:"100%",background:C.bio,color:C.shaft,border:"none",padding:"0.78rem",fontWeight:700,fontSize:"0.85rem",letterSpacing:"0.06em",textTransform:"uppercase",cursor:loading?"wait":"pointer",borderRadius:"2px",opacity:loading?0.6:1,fontFamily:font}}>
                {loading?"Signing in…":"Sign In"}
              </button>
            </form>
          ):(
            <form onSubmit={handleSignUp}>
              <label style={lbl}>Full Name</label>
              <input type="text" required value={fullName} onChange={e=>setFullName(e.target.value)} style={inp}/>
              <label style={lbl}>Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
              <label style={lbl}>Password</label>
              <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} style={inp}/>
              <label style={lbl}>Account Type</label>
              <select value={role} onChange={e=>setRole(e.target.value)} style={{...inp,color:C.day}}>
                <option value="biokineticist">Biokineticist</option>
                <option value="mine_client">Mine Client (Safety / OH Officer)</option>
              </select>
              <button type="submit" disabled={loading} style={{width:"100%",background:C.ore,color:C.shaft,border:"none",padding:"0.78rem",fontWeight:700,fontSize:"0.85rem",letterSpacing:"0.06em",textTransform:"uppercase",cursor:loading?"wait":"pointer",borderRadius:"2px",opacity:loading?0.6:1,fontFamily:font}}>
                {loading?"Creating…":"Request Access"}
              </button>
              <div style={{fontSize:"0.73rem",color:C.seam,marginTop:"0.8rem",lineHeight:1.5}}>New accounts require administrator approval before login is enabled.</div>
            </form>
          )}
        </div>
        <div style={{textAlign:"center",marginTop:"1.2rem",fontSize:"0.7rem",color:C.seam}}>
          HPCSA Registered Biokineticist · POPIA Compliant · © {new Date().getFullYear()} SpineSync (Pty) Ltd
        </div>
      </div>
    </div>
  );
}
