import { useState, useEffect } from "react";
import { fetchSiteReport } from "./lib/data";

const C = { shaft:"#1A1C1E",dust:"#2E3135",slate:"#4A5058",seam:"#6B7785",day:"#F2EDE6",ore:"#C9862A",bio:"#3AA88C",danger:"#D94F3B",warn:"#E8A020" };
const font = "'Segoe UI',system-ui,sans-serif";
const mono = "'Courier New',monospace";

const Pill=({text,color})=><span style={{background:color+"22",border:`1px solid ${color}55`,color,padding:"0.15rem 0.5rem",fontSize:"0.62rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{text}</span>;
const Card=({children,style,accent})=><div style={{background:C.dust,border:`1px solid ${C.slate}`,borderLeft:accent?`3px solid ${accent}`:undefined,padding:"1.2rem",borderRadius:"2px",...style}}>{children}</div>;

export default function MineClient({ user, profile, onLogout }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const siteId = profile?.site_id;

  useEffect(() => {
    if (!siteId) { setLoading(false); return; }
    fetchSiteReport(siteId).then(w => { setWorkers(w); setLoading(false); });
  }, [siteId]);

  const riskColors = { LOW:C.bio, MOD:C.warn, HIGH:C.ore, CRIT:C.danger };
  const rc = { LOW:0, MOD:0, HIGH:0, CRIT:0 };
  workers.forEach(w => { if(w.risk) rc[w.risk] = (rc[w.risk]||0)+1; });
  const total = workers.length || 1;

  return (
    <div style={{minHeight:"100vh",background:C.shaft,color:C.day,fontFamily:font,fontSize:"14px"}}>
      {/* Nav */}
      <nav style={{background:"rgba(26,28,30,0.97)",borderBottom:`1px solid ${C.dust}`,padding:"0 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:48,position:"sticky",top:0,zIndex:50}}>
        <div style={{fontWeight:900,fontSize:"1.1rem"}}>Spine<span style={{color:C.bio}}>Sync</span> <span style={{fontSize:"0.7rem",color:C.seam,fontFamily:mono}}>MINE CLIENT PORTAL</span></div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
          <span style={{fontSize:"0.75rem",color:C.seam}}>{profile?.full_name || user.email}</span>
          <button onClick={onLogout} style={{background:"none",border:`1px solid ${C.slate}`,color:C.seam,padding:"0.3rem 0.7rem",fontSize:"0.7rem",cursor:"pointer",fontFamily:font,borderRadius:"2px"}}>Sign Out</button>
        </div>
      </nav>

      <div style={{maxWidth:960,margin:"0 auto",padding:"1.8rem 1.5rem"}}>
        {/* Header */}
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.ore,letterSpacing:"0.2em",marginBottom:"0.3rem"}}>SITE MSK RISK REPORT</div>
          <h2 style={{fontSize:"1.6rem",fontWeight:800,color:C.day,marginBottom:"0.3rem"}}>Site Overview</h2>
          <p style={{color:C.seam,fontSize:"0.88rem"}}>Worker identities are protected under POPIA. Names and IDs are only visible where the worker has provided written consent for sharing with site management.</p>
        </div>

        {/* POPIA notice */}
        <Card accent={C.bio} style={{marginBottom:"1.5rem",background:C.bio+"10"}}>
          <div style={{display:"flex",gap:"0.8rem",alignItems:"flex-start"}}>
            <span style={{fontSize:"1.2rem"}}>🔒</span>
            <div>
              <div style={{fontWeight:700,color:C.bio,marginBottom:"0.2rem",fontSize:"0.9rem"}}>POPIA Data Protection Notice</div>
              <div style={{fontSize:"0.84rem",color:C.seam,lineHeight:1.6}}>
                This report is provided to you as the authorised site Health & Safety representative under the terms of the SpineSync Service Level Agreement. Worker health data is classified as special personal information under POPIA Section 26. Individual identification is only disclosed where the worker has signed a consent form authorising disclosure to site management. Aggregate risk data is provided for your MHSA compliance obligations.
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div style={{textAlign:"center",padding:"3rem",color:C.seam}}>Loading site report…</div>
        ) : !siteId ? (
          <Card style={{textAlign:"center",padding:"3rem"}}>
            <div style={{color:C.seam}}>No site assigned to your account. Contact your SpineSync Biokineticist.</div>
          </Card>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.7rem",marginBottom:"1.5rem"}}>
              {[
                {l:"Total Workers Assessed",v:workers.length,c:C.bio},
                {l:"High / Critical Risk",v:(rc.HIGH||0)+(rc.CRIT||0),c:C.danger},
                {l:"Active MSK Programmes",v:workers.filter(w=>w.programStarted).length,c:C.ore},
                {l:"FCE Reports Pending",v:workers.filter(w=>w.fcePending).length,c:C.warn},
              ].map(s=>(
                <Card key={s.l} accent={s.c}>
                  <div style={{fontFamily:mono,fontSize:"0.6rem",color:C.seam,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"0.3rem"}}>{s.l}</div>
                  <div style={{fontSize:"1.8rem",fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                </Card>
              ))}
            </div>

            {/* Risk distribution */}
            <Card style={{marginBottom:"1.2rem"}}>
              <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.bio,letterSpacing:"0.2em",marginBottom:"1rem"}}>RISK TIER DISTRIBUTION</div>
              {[{k:"LOW",l:"Low Risk",c:C.bio},{k:"MOD",l:"Moderate Risk",c:C.warn},{k:"HIGH",l:"High Risk",c:C.ore},{k:"CRIT",l:"Critical Risk",c:C.danger}].map(t=>(
                <div key={t.k} style={{marginBottom:"0.7rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.2rem"}}>
                    <span style={{fontSize:"0.84rem",color:C.day}}>{t.l}</span>
                    <span style={{fontSize:"0.84rem",fontWeight:700,color:t.c,fontFamily:mono}}>{rc[t.k]||0} workers ({Math.round(((rc[t.k]||0)/total)*100)}%)</span>
                  </div>
                  <div style={{height:10,background:C.shaft,borderRadius:5,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${((rc[t.k]||0)/total)*100}%`,background:t.c,borderRadius:5,transition:"width 0.8s ease"}}/>
                  </div>
                </div>
              ))}
            </Card>

            {/* Worker list — anonymised unless consented */}
            <Card>
              <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.ore,letterSpacing:"0.2em",marginBottom:"0.8rem"}}>WORKER MSK STATUS</div>
              <div style={{fontSize:"0.78rem",color:C.seam,marginBottom:"1rem",padding:"0.5rem 0.7rem",background:C.shaft,borderLeft:`2px solid ${C.ore}`}}>
                Workers marked with 🔒 have not provided consent to share their identity with site management. Their clinical data is managed exclusively by the attending Biokineticist.
              </div>

              <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr",gap:"0.6rem",padding:"0.4rem 0.7rem",borderBottom:`1px solid ${C.slate}`,marginBottom:"0.4rem"}}>
                {["Worker","Role","Risk","Programme","FCE"].map(h=>(
                  <div key={h} style={{fontSize:"0.62rem",color:C.seam,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:mono}}>{h}</div>
                ))}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                {workers.map((w,i)=>{
                  const rc2 = riskColors[w.risk]||C.seam;
                  return (
                    <div key={w.id} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr",gap:"0.6rem",alignItems:"center",padding:"0.7rem 0.7rem",background:C.shaft,border:`1px solid ${C.slate}`,borderRadius:"2px"}}>
                      <div>
                        <div style={{fontWeight:600,color:C.day,fontSize:"0.86rem"}}>
                          {!w.consentShared&&<span style={{marginRight:"0.3rem"}}>🔒</span>}
                          {w.displayName}
                        </div>
                        <div style={{fontSize:"0.7rem",color:C.seam}}>{w.displayId}</div>
                      </div>
                      <div style={{fontSize:"0.8rem",color:C.seam}}>{w.role?.split(" ").slice(0,2).join(" ") || "—"}</div>
                      <div>{w.risk?<Pill text={w.risk} color={rc2}/>:<span style={{color:C.slate,fontSize:"0.7rem"}}>—</span>}</div>
                      <div>{w.programStarted?<Pill text="Active" color={C.bio}/>:<span style={{color:C.slate,fontSize:"0.7rem"}}>Not started</span>}</div>
                      <div>{w.fcePending?<Pill text="Pending" color={C.warn}/>:w.fceComplete?<Pill text="Done" color={C.bio}/>:<span style={{color:C.slate,fontSize:"0.7rem"}}>—</span>}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div style={{marginTop:"1rem",fontSize:"0.74rem",color:C.seam,lineHeight:1.6,textAlign:"center"}}>
              Report generated {new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"})} · SpineSync (Pty) Ltd · HPCSA Registered Biokineticist · POPIA Compliant
            </div>
          </>
        )}
      </div>
    </div>
  );
}
