import { useState, useRef, useEffect } from "react";
import Login from "./Login";
import MineClient from "./MineClient";
import { getCurrentUser, getProfile, signOut, fetchWorkers, createWorker, updateWorker as dbUpdateWorker, saveAssessmentRecord, fetchNotes, addNote, toggleConsent } from "./lib/data";
import { supabase } from "./lib/supabase";

const C = {
  shaft:"#1A1C1E",dust:"#2E3135",slate:"#4A5058",seam:"#6B7785",
  day:"#F2EDE6",ore:"#C9862A",bio:"#3AA88C",danger:"#D94F3B",warn:"#E8A020",
};
const font="'Segoe UI',system-ui,sans-serif";
const mono="'Courier New',monospace";

const ASSESS_TYPES = {
  "Pre-employment": {
    color: C.bio, icon: "🏗",
    purpose: "Determine fitness for specific job role before employment begins.",
    outcome: "Clearance decision: Fit / Fit with restrictions / Not fit for role",
    steps: ["Intake","Job Demands","Medical History","Physical Screen","Functional Tests","Clearance Decision"],
    stepIds: ["intake","jobdemands","history","screen","functional","clearance"],
    focusAreas: ["Job-specific physical demands","Musculoskeletal baseline","Injury history relevant to role"],
  },
  "Annual Wellness": {
    color: C.warn, icon: "🌿",
    purpose: "Broad preventive health check. Catch problems before they become injuries.",
    outcome: "Wellness score + lifestyle recommendations + MSK risk tier",
    steps: ["Intake","Wellness Screen","Lifestyle Factors","Risk Score","Recommendations"],
    stepIds: ["intake","wellness","lifestyle","risk","rx"],
    focusAreas: ["General MSK health","Sleep and recovery","Stress and lifestyle"],
  },
  "Periodic Review": {
    color: C.ore, icon: "🔄",
    purpose: "Compare against previous assessment. Track changes and intervention outcomes.",
    outcome: "Progress report vs baseline + programme adjustment",
    steps: ["Intake","Changes Since Last","Functional Tests","Comparison","Updated Plan"],
    stepIds: ["intake","changes","functional","comparison","plan"],
    focusAreas: ["Change from baseline","Programme compliance","Intervention effectiveness"],
  },
  "Post-injury / Return to Work": {
    color: C.danger, icon: "🩺",
    purpose: "Determine if worker can safely return to specific duties after injury.",
    outcome: "RTW clearance + duty modification plan + FCE summary",
    steps: ["Intake","Injury History","Clinical Assessment","FCE Battery","RTW Decision","Duty Plan"],
    stepIds: ["intake","injury","clinical","fce","rtwdecision","dutyplan"],
    focusAreas: ["Nature and recovery of injury","Current pain and function","Safe return timeline"],
  },
};

const PE_JOB_DEMANDS = [
  { id:"pe_lift",    section:"Physical Demands", question:"Maximum weight required to lift in this role?", sub:"Based on job specification", options:[{label:"Under 10 kg",value:0},{label:"10–20 kg",value:1},{label:"20–35 kg",value:2},{label:"Over 35 kg",value:3}] },
  { id:"pe_posture", section:"Physical Demands", question:"How much of the shift requires stooped or crouched posture?", sub:"Forward bending below 45°", options:[{label:"Rarely / never",value:0},{label:"Less than 25% of shift",value:1},{label:"25–50% of shift",value:2},{label:"More than 50% of shift",value:3}] },
  { id:"pe_vib",     section:"Physical Demands", question:"Does this role involve operating vibrating equipment?", sub:"Drill rigs, LHDs, haul trucks", options:[{label:"No",value:0},{label:"Less than 2 hours/shift",value:1},{label:"2–5 hours/shift",value:2},{label:"More than 5 hours/shift",value:3}] },
  { id:"pe_overhead",section:"Physical Demands", question:"Does this role require overhead work above shoulder height?", sub:"Drilling, installation, maintenance", options:[{label:"Never",value:0},{label:"Occasionally",value:1},{label:"Regularly",value:2},{label:"Most of the shift",value:3}] },
];

const PE_HISTORY = [
  { id:"pe_prev_back",  section:"Medical History", question:"Have you ever had a back or neck injury?", sub:"Including strain, disc, fracture", options:[{label:"Never",value:0},{label:"Yes — fully resolved",value:1},{label:"Yes — occasional symptoms remain",value:2},{label:"Yes — ongoing or chronic",value:3}] },
  { id:"pe_surgery",    section:"Medical History", question:"Have you had any spinal surgery?", sub:"Discectomy, fusion, decompression", options:[{label:"No",value:0},{label:"Yes — over 2 years ago, fully recovered",value:1},{label:"Yes — within 2 years",value:2},{label:"Yes — recent, still in rehab",value:3}] },
  { id:"pe_wca",        section:"Medical History", question:"Have you ever had a Workers Compensation claim?", sub:"WCA / COID claim for physical injury", options:[{label:"No",value:0},{label:"Yes — minor, resolved",value:1},{label:"Yes — moderate",value:2},{label:"Yes — major or ongoing",value:3}] },
  { id:"pe_current_pain",section:"Medical History",question:"Do you currently have any pain or physical symptoms?", sub:"Pain, numbness, weakness anywhere", options:[{label:"None",value:0},{label:"Mild — does not limit activity",value:1},{label:"Moderate — limits some activities",value:2},{label:"Severe — significantly limits function",value:3}] },
];

const PE_SCREEN = [
  { id:"pe_lbp",   section:"Physical Screen", question:"Lumbar palpation — any tenderness on examination?", sub:"Palpate L1-S1 spinous processes and paraspinals", options:[{label:"No tenderness",score:0},{label:"Mild non-specific tenderness",score:1},{label:"Moderate localised tenderness",score:2},{label:"Severe or reproduces symptoms",score:3}] },
  { id:"pe_flex",  section:"Physical Screen", question:"Forward flexion — fingertip to floor distance", sub:"Normal: fingertips reach floor", options:[{label:"Reaches floor",score:0},{label:"Within 10 cm",score:1},{label:"Mid-shin range",score:2},{label:"Knee level or restricted",score:3}] },
  { id:"pe_slr",   section:"Physical Screen", question:"Straight leg raise — bilateral", sub:"Positive if radicular pain reproduced", options:[{label:"Negative bilaterally over 70 degrees",score:0},{label:"Hamstring restriction only",score:1},{label:"Radicular pain 40-70 degrees",score:2},{label:"Radicular pain under 40 degrees",score:3}] },
  { id:"pe_grip",  section:"Physical Screen", question:"Grip strength — dominant hand", sub:"Compare to job demand norms", options:[{label:"Over 45 kg male / over 28 kg female",score:0},{label:"35-44 kg / 22-27 kg",score:1},{label:"25-34 kg / 16-21 kg",score:2},{label:"Under 25 kg / under 16 kg",score:3}] },
];

const AW_WELLNESS = [
  { id:"aw_pain_freq", section:"Musculoskeletal", question:"How often do you experience back or neck pain at work?", sub:"Over the past 3 months", options:[{label:"Never",value:0},{label:"Less than once a month",value:1},{label:"Weekly",value:2},{label:"Daily",value:3}] },
  { id:"aw_pain_int",  section:"Musculoskeletal", question:"When you have pain, how severe is it on average?", sub:"0 = no pain, 10 = worst imaginable", options:[{label:"0-2 out of 10 — minimal",value:0},{label:"3-4 out of 10 — mild",value:1},{label:"5-6 out of 10 — moderate",value:2},{label:"7 or more — severe",value:3}] },
  { id:"aw_function",  section:"Musculoskeletal", question:"Does MSK pain limit your ability to do your job?", sub:"Including working through pain", options:[{label:"Never limits me",value:0},{label:"Occasionally",value:1},{label:"Often need to modify tasks",value:2},{label:"Significantly affects productivity daily",value:3}] },
  { id:"aw_upper",     section:"Musculoskeletal", question:"Any pain in shoulders, elbows, or wrists?", sub:"Upper limb symptoms related to work tasks", options:[{label:"None",value:0},{label:"Mild, occasional",value:1},{label:"Moderate, affects work",value:2},{label:"Severe or constant",value:3}] },
];

const AW_LIFESTYLE = [
  { id:"aw_sleep",    section:"Lifestyle", question:"How many hours of sleep do you get most nights?", sub:"Including shift work impact", options:[{label:"7-9 hours — adequate",value:0},{label:"6-7 hours — slightly short",value:1},{label:"5-6 hours — insufficient",value:2},{label:"Less than 5 hours — severely deprived",value:3}] },
  { id:"aw_exercise", section:"Lifestyle", question:"How many days per week do you exercise outside work?", sub:"Any planned exercise or sport", options:[{label:"4 or more days",value:0},{label:"2-3 days",value:1},{label:"1 day",value:2},{label:"None",value:3}] },
  { id:"aw_stress",   section:"Lifestyle", question:"How would you rate your general stress levels?", sub:"Work and personal combined", options:[{label:"Low — well managed",value:0},{label:"Moderate — manageable",value:1},{label:"High — affecting wellbeing",value:2},{label:"Very high — overwhelming",value:3}] },
  { id:"aw_smoking",  section:"Lifestyle", question:"Do you smoke or use tobacco products?", sub:"Smoking increases disc degeneration risk", options:[{label:"Never",value:0},{label:"Quit more than 1 year ago",value:1},{label:"Quit less than 1 year ago",value:2},{label:"Currently smoke",value:3}] },
];

const PR_CHANGES = [
  { id:"pr_worse",    section:"Changes Since Last Review", question:"Have your MSK symptoms changed since last assessment?", sub:"Better, same, or worse overall", options:[{label:"Better — significantly improved",value:0},{label:"About the same",value:1},{label:"Slightly worse",value:2},{label:"Significantly worse",value:3}] },
  { id:"pr_new",      section:"Changes Since Last Review", question:"Have you developed any new pain or symptoms?", sub:"Areas not previously reported", options:[{label:"No new symptoms",value:0},{label:"Minor new symptom, not concerning",value:1},{label:"New symptom affecting work",value:2},{label:"New significant symptom",value:3}] },
  { id:"pr_incident", section:"Changes Since Last Review", question:"Have you had any injuries or incidents at work since last review?", sub:"Including near-misses involving physical strain", options:[{label:"No",value:0},{label:"Minor incident, no time off",value:1},{label:"Incident with brief time off",value:2},{label:"Significant injury or extended time off",value:3}] },
  { id:"pr_exercise", section:"Programme Compliance", question:"How consistently have you followed your prescribed exercise programme?", sub:"Percentage of sessions completed approximately", options:[{label:"Consistently — 80 percent or more",value:0},{label:"Mostly — 60-79 percent",value:1},{label:"Partially — 40-59 percent",value:2},{label:"Rarely — less than 40 percent",value:3}] },
  { id:"pr_ergonomic",section:"Programme Compliance", question:"Have ergonomic recommendations been implemented?", sub:"Equipment changes, posture modifications", options:[{label:"Fully implemented",value:0},{label:"Mostly implemented",value:1},{label:"Partially implemented",value:2},{label:"Not implemented",value:3}] },
];

const RTW_INJURY = [
  { id:"rtw_diagnosis",section:"Injury Details", question:"What was the nature of the injury?", sub:"As diagnosed by treating clinician", options:[{label:"Soft tissue / muscle strain",value:0},{label:"Joint sprain or ligament injury",value:1},{label:"Disc injury — herniation or prolapse",value:2},{label:"Fracture, surgery, or nerve injury",value:3}] },
  { id:"rtw_timeoff",  section:"Injury Details", question:"How long was the worker off duty?", sub:"Total absence from any work", options:[{label:"Less than 1 week",value:0},{label:"1-4 weeks",value:1},{label:"1-3 months",value:2},{label:"More than 3 months",value:3}] },
  { id:"rtw_pain_now", section:"Current Status", question:"Current pain level at rest", sub:"0 = no pain, 10 = worst imaginable", options:[{label:"0-1 out of 10 — none to minimal",value:0},{label:"2-3 out of 10 — mild",value:1},{label:"4-5 out of 10 — moderate",value:2},{label:"6 or more — severe",value:3}] },
  { id:"rtw_pain_act", section:"Current Status", question:"Current pain level with activity", sub:"With movement or physical effort", options:[{label:"0-2 out of 10",value:0},{label:"3-4 out of 10",value:1},{label:"5-6 out of 10",value:2},{label:"7 or more",value:3}] },
  { id:"rtw_neuro",    section:"Current Status", question:"Any ongoing neurological symptoms?", sub:"Numbness, tingling, weakness in limbs", options:[{label:"None",value:0},{label:"Occasional, not worsening",value:1},{label:"Persistent, affecting function",value:2},{label:"Severe or progressive",value:3}] },
  { id:"rtw_rehab",    section:"Current Status", question:"Has the worker completed a formal rehabilitation programme?", sub:"Physio, biokineticist, or hospital programme", options:[{label:"Yes — completed and discharged",value:0},{label:"Yes — ongoing, progressing well",value:1},{label:"Partial — incomplete programme",value:2},{label:"No formal rehab",value:3}] },
];

const FUNC_TESTS = [
  { id:"fwd_flex",     name:"Forward Flexion",         icon:"up", instruction:"Fingertip-to-floor distance from standing bend", flag:"Reduced lumbar flexibility — disc load risk in stooped postures", options:[{label:"Reaches floor",score:0},{label:"Within 10 cm",score:1},{label:"Mid-shin range",score:2},{label:"Knee level or above",score:3}] },
  { id:"ext",          name:"Lumbar Extension",        icon:"arc", instruction:"Extend backwards — observe range and pain response", flag:"Facet or foraminal compromise — monitor for stenotic changes", options:[{label:"Full, pain-free",score:0},{label:"Full, mild discomfort",score:1},{label:"Limited, moderate pain",score:2},{label:"Severe or leg pain reproduced",score:3}] },
  { id:"slr",          name:"Straight Leg Raise",      icon:"SLR", instruction:"Supine — raise each leg, record angle at pain onset", flag:"Positive SLR — potential nerve root compression", options:[{label:"No pain over 70 degrees bilateral",score:0},{label:"Hamstring only under 70 degrees",score:1},{label:"Radicular pain 40-70 degrees",score:2},{label:"Radicular pain under 40 degrees",score:3}] },
  { id:"core",         name:"Core Endurance McGill",   icon:"sec", instruction:"Prone plank hold — record maximum time", flag:"Poor core endurance — primary risk factor for occupational LBP", options:[{label:"Over 90 seconds",score:0},{label:"60-90 seconds",score:1},{label:"30-60 seconds",score:2},{label:"Under 30 seconds",score:3}] },
  { id:"cervical_rom", name:"Cervical ROM",            icon:"rot", instruction:"Rotation and lateral flexion — compare sides", flag:"Cervical dysfunction — ergonomic intervention required", options:[{label:"Full, symmetrical, pain-free",score:0},{label:"Mild asymmetry or end-range discomfort",score:1},{label:"Restricted over 20 percent with pain",score:2},{label:"Severely restricted or reproduces headache",score:3}] },
  { id:"shoulder_flex",name:"Shoulder Flexion",        icon:"arm", instruction:"Active overhead reach — note painful arc", flag:"Shoulder impingement — high risk with overhead drilling tasks", options:[{label:"Full 180 degrees, pain-free",score:0},{label:"Painful arc 60-120 degrees only",score:1},{label:"Under 150 degrees, positive impingement",score:2},{label:"Severely limited",score:3}] },
];

const RTW_EXTRA = [
  { id:"lift_test",  name:"Progressive Lift Test",  icon:"lft", instruction:"Floor to waist lift — start 5 kg, increase until safe max or pain 4/10", flag:"Lifting capacity below job demand — duty modification required", options:[{label:"Over 25 kg — meets demand",score:0},{label:"15-25 kg",score:1},{label:"5-15 kg",score:2},{label:"Under 5 kg or unable",score:3}] },
  { id:"carry_test", name:"Bilateral Carry Test",   icon:"car", instruction:"25m carry — record max safe load each hand", flag:"Carry capacity below job demand — load restriction required", options:[{label:"Over 12 kg each hand",score:0},{label:"8-12 kg each hand",score:1},{label:"4-8 kg each hand",score:2},{label:"Under 4 kg or unable",score:3}] },
  { id:"squat_test", name:"Weighted Squat",         icon:"sqt", instruction:"Squat to job-demand depth with load", flag:"Squat capacity below demand — crouching restriction required", options:[{label:"Full depth with load",score:0},{label:"Full depth bodyweight only",score:1},{label:"Partial depth only",score:2},{label:"Unable",score:3}] },
];

const RISK_PROGRAMS = {
  LOW:  { label:"Prevention and Maintenance", color:"#3AA88C", duration:"8 weeks", freq:"3 times per week", description:"Maintain spinal health and prevent MSK onset.",
    phases:[{ phase:"Phase 1", weeks:"Weeks 1-3", focus:"Foundation and Awareness", sessions:[
      { day:"Session A", exercises:[
        { name:"Cat-Camel", sets:"3", reps:"10 cycles", cue:"Smooth rhythm. No forcing.", category:"Mobility", freq:"Daily" },
        { name:"Dead Bug", sets:"3", reps:"8 each side", cue:"Lower back flat. Breathe out on extension.", category:"Core", freq:"Daily" },
        { name:"Glute Bridge", sets:"3", reps:"15", cue:"Drive through heels. Squeeze glutes at top.", category:"Strength", freq:"Daily" },
        { name:"Hip Flexor Stretch", sets:"2", reps:"45s each", cue:"Posterior pelvic tilt. No anterior lean.", category:"Mobility", freq:"Post-shift" },
      ]},
      { day:"Session B", exercises:[
        { name:"Bird-Dog", sets:"3", reps:"8 each side", cue:"Opposite arm and leg. No rotation.", category:"Core", freq:"Daily" },
        { name:"Wall Slides", sets:"3", reps:"12", cue:"Maintain wall contact throughout.", category:"Shoulder", freq:"Daily" },
        { name:"Thoracic Extension Foam Roller", sets:"2", reps:"60 seconds", cue:"Focus T6-T10. Breathe into extension.", category:"Mobility", freq:"Post-shift" },
        { name:"Diaphragmatic Breathing", sets:"3", reps:"10 breaths", cue:"Belly rises first. 4 seconds in 6 seconds out.", category:"Control", freq:"Pre-shift" },
      ]},
    ]},
    { phase:"Phase 2", weeks:"Weeks 4-6", focus:"Load Tolerance", sessions:[
      { day:"Session A", exercises:[
        { name:"Romanian Deadlift Bodyweight", sets:"3", reps:"12", cue:"Hip hinge. Neutral spine.", category:"Strength", freq:"3 per week" },
        { name:"Pallof Press", sets:"3", reps:"10 each", cue:"Resist rotation. Core braced.", category:"Core", freq:"3 per week" },
        { name:"Side-Lying Clamshell", sets:"3", reps:"15 each", cue:"Heels together. Rotate at hip only.", category:"Hip", freq:"Daily" },
        { name:"Prone Cobra", sets:"3", reps:"10 x 3 seconds", cue:"Thumbs up. Squeeze shoulder blades.", category:"Extension", freq:"Daily" },
      ]},
    ]},
    { phase:"Phase 3", weeks:"Weeks 7-8", focus:"Work Simulation", sessions:[
      { day:"Session A", exercises:[
        { name:"Loaded Carry Light Kettlebell", sets:"3", reps:"20m each hand", cue:"Tall posture. Do not lean to side.", category:"Functional", freq:"3 per week" },
        { name:"Squat to Overhead Reach", sets:"3", reps:"12", cue:"Simulate lifting from ground to rack.", category:"Functional", freq:"3 per week" },
        { name:"McGill Big 3 Circuit", sets:"2", reps:"Full circuit", cue:"Curl-up, Side Plank, Bird-Dog in sequence.", category:"Core", freq:"3 per week" },
      ]},
    ]},
  ]},
  MOD:  { label:"Active Intervention", color:"#E8A020", duration:"12 weeks", freq:"4 times per week", description:"Targeted intervention addressing identified deficits.",
    phases:[{ phase:"Phase 1", weeks:"Weeks 1-4", focus:"Pain Reduction and Motor Control", sessions:[
      { day:"Session A Lumbar", exercises:[
        { name:"McKenzie Press-Up", sets:"3", reps:"10", cue:"Hips stay down. Lumbar sags naturally.", category:"Lumbar", freq:"Pre-shift" },
        { name:"TA Activation Draw-In", sets:"3", reps:"10 x 10 seconds", cue:"Pull navel toward spine. Do not hold breath.", category:"Core", freq:"Daily" },
        { name:"Knee-to-Chest Stretch", sets:"3", reps:"30 seconds each", cue:"Gentle traction. No forcing.", category:"Lumbar", freq:"Morning" },
        { name:"Glute Bridge Single Leg", sets:"3", reps:"10 each", cue:"Pelvis level. Drive through heel.", category:"Strength", freq:"Daily" },
      ]},
      { day:"Session B Cervical", exercises:[
        { name:"Deep Cervical Flexor Chin Tuck", sets:"3", reps:"10 x 10 seconds", cue:"Nod only. No chin jutting.", category:"Cervical", freq:"Daily" },
        { name:"Cervical Rotation Stretch", sets:"2", reps:"30 seconds each", cue:"Slow. No overpressure.", category:"Cervical", freq:"Pre-shift" },
        { name:"Levator Scapulae Stretch", sets:"2", reps:"30 seconds each", cue:"Ear to shoulder plus rotation away.", category:"Cervical", freq:"Pre-shift" },
        { name:"Scapular Retraction", sets:"3", reps:"15", cue:"Squeeze blades back and down. 2 second hold.", category:"Shoulder", freq:"Every 2 hours" },
      ]},
    ]},
    { phase:"Phase 2", weeks:"Weeks 5-8", focus:"Progressive Strengthening", sessions:[
      { day:"Session A", exercises:[
        { name:"Deadbug with Band", sets:"3", reps:"8 each", cue:"Band at chest. Maintain tension.", category:"Core", freq:"4 per week" },
        { name:"Banded Clamshell", sets:"3", reps:"15 each", cue:"Light band. Full range.", category:"Hip", freq:"4 per week" },
        { name:"Cable Row Seated", sets:"3", reps:"12", cue:"Retract scapula first. Drive elbows back.", category:"Strength", freq:"3 per week" },
        { name:"Hip Hinge with Dowel", sets:"3", reps:"15", cue:"3 points of contact. Bar stays on spine.", category:"Lumbar", freq:"3 per week" },
      ]},
    ]},
    { phase:"Phase 3", weeks:"Weeks 9-12", focus:"Return to Full Duty", sessions:[
      { day:"Session A", exercises:[
        { name:"Romanian Deadlift Loaded", sets:"4", reps:"10", cue:"Progressive load. Neutral spine always.", category:"Strength", freq:"3 per week" },
        { name:"Farmers Carry", sets:"3", reps:"30 metres", cue:"Tall posture. Equal weight both sides.", category:"Functional", freq:"3 per week" },
        { name:"Work Simulation Shovelling", sets:"3", reps:"30 seconds", cue:"Rotate at hips. Load close to body.", category:"Functional", freq:"3 per week" },
      ]},
    ]},
  ]},
  HIGH: { label:"Clinical Rehabilitation", color:"#C9862A", duration:"16 weeks", freq:"5 times per week", description:"Supervised rehab. Duty modification concurrent. Monthly BK review.",
    phases:[{ phase:"Phase 1", weeks:"Weeks 1-4", focus:"Stabilisation and Pain Management", sessions:[
      { day:"Session A Acute", exercises:[
        { name:"TA Activation in Crook-Lying", sets:"5", reps:"10 x 10 seconds", cue:"Foundation. Master this first.", category:"Core", freq:"Daily" },
        { name:"Supine Knee Rocking", sets:"3", reps:"15 each", cue:"Gentle. Stay in pain-free range.", category:"Acute", freq:"Daily" },
        { name:"McKenzie Protocol", sets:"As tolerated", reps:"Clinician directed", cue:"Direction based on presentation.", category:"Lumbar", freq:"Daily" },
        { name:"Positional Relief Education", sets:"—", reps:"—", cue:"Teach positions of comfort for each task.", category:"Education", freq:"Each session" },
      ]},
    ]},
    { phase:"Phase 2", weeks:"Weeks 5-10", focus:"Sub-Acute Strengthening", sessions:[
      { day:"Session A", exercises:[
        { name:"McGill Big 3 Progressive", sets:"3", reps:"Progressive", cue:"Build endurance before adding load.", category:"Core", freq:"5 per week" },
        { name:"Glute Bridge Progressions", sets:"4", reps:"12-15", cue:"BW then Single leg then Banded then Loaded.", category:"Strength", freq:"5 per week" },
        { name:"Standing Cable Chop", sets:"3", reps:"10 each", cue:"Rotate at hips. Core braced.", category:"Functional", freq:"3 per week" },
        { name:"Prone Plank Progressions", sets:"3", reps:"Building to 90 seconds", cue:"Add time before instability.", category:"Core", freq:"5 per week" },
      ]},
    ]},
    { phase:"Phase 3", weeks:"Weeks 11-16", focus:"Work Hardening and FCE Prep", sessions:[
      { day:"Session A", exercises:[
        { name:"Loaded Deadlift Progressive", sets:"4", reps:"8-10", cue:"50 then 70 then 85 percent of job demand load.", category:"Strength", freq:"3 per week" },
        { name:"Sustained Stooped Posture", sets:"3", reps:"Build to 10 minutes", cue:"Simulate drill posture. Exit at pain 3 out of 10.", category:"Functional", freq:"3 per week" },
        { name:"Repeated Lift and Carry", sets:"3", reps:"5 minutes", cue:"Simulate shift demand. Monitor form.", category:"Functional", freq:"3 per week" },
      ]},
    ]},
  ]},
  CRIT: { label:"Immediate Duty Modification", color:"#D94F3B", duration:"Specialist-directed", freq:"Clinician only", description:"Light-duty required. Specialist referral. FCE before return to full duty.",
    phases:[{ phase:"Immediate", weeks:"Week 1", focus:"Safety and Stabilisation", sessions:[
      { day:"Clinician-Guided Only", exercises:[
        { name:"Pain Assessment and Monitoring", sets:"—", reps:"Each session", cue:"VAS before and after. Document carefully.", category:"Assessment", freq:"Each session" },
        { name:"Gentle Neural Mobilisation", sets:"1-2", reps:"5-8 slow reps", cue:"STOP if neurological symptoms increase.", category:"Nerve", freq:"Daily" },
        { name:"Supported Breathing", sets:"3", reps:"10 breaths", cue:"Reduce protective muscle guarding.", category:"Control", freq:"Daily" },
        { name:"Positional Relief Education", sets:"—", reps:"—", cue:"Positions of comfort for each task.", category:"Education", freq:"Each session" },
      ]},
    ]},
  ]},
};

const JOB_ROLES = ["Drill and Blast Operator","LHD Loader Driver","Stope Worker","Rock Drill Operator","Conveyor Surface Operator","Trackless Equipment Operator","Maintenance Technician","Winder Operator","Shaft Sinker","Ventilation Officer"];

function getQuestions(assessType, step) {
  if(assessType==="Pre-employment") {
    if(step==="jobdemands") return PE_JOB_DEMANDS;
    if(step==="history") return PE_HISTORY;
    if(step==="screen") return PE_SCREEN;
    if(step==="functional") return FUNC_TESTS;
  }
  if(assessType==="Annual Wellness") {
    if(step==="wellness") return AW_WELLNESS;
    if(step==="lifestyle") return AW_LIFESTYLE;
  }
  if(assessType==="Periodic Review") {
    if(step==="changes") return PR_CHANGES;
    if(step==="functional") return FUNC_TESTS;
  }
  if(assessType==="Post-injury / Return to Work") {
    if(step==="injury") return RTW_INJURY;
    if(step==="clinical") return FUNC_TESTS;
    if(step==="fce") return [...FUNC_TESTS,...RTW_EXTRA];
  }
  return [];
}

function calcRisk(scores, assessType) {
  const vals = Object.values(scores).filter(v=>typeof v==="number");
  if(!vals.length) return {tier:"LOW",pct:0,color:C.bio,label:"Low Risk",action:"",total:0,max:1};
  const total = vals.reduce((a,b)=>a+b,0);
  const max = vals.length*3;
  const pct = Math.round((total/max)*100);
  const th = assessType==="Post-injury / Return to Work" ? {L:15,M:35,H:60} : {L:25,M:50,H:70};
  const tier = pct<th.L?"LOW":pct<th.M?"MOD":pct<th.H?"HIGH":"CRIT";
  const cols = {LOW:C.bio,MOD:C.warn,HIGH:C.ore,CRIT:C.danger};
  const lbls = {LOW:"Low Risk",MOD:"Moderate Risk",HIGH:"High Risk",CRIT:"Critical Risk"};
  const acts = {
    "Pre-employment":{LOW:"Fit for role. Standard induction. Baseline wellness programme recommended.",MOD:"Fit with monitoring. MSK programme before start date. 3-month review.",HIGH:"Fit for modified duties only. Restrictions documented. Monthly review.",CRIT:"Not fit for role as specified. Specialist assessment required before clearance."},
    "Annual Wellness":{LOW:"Good MSK health. Continue current habits. Annual review.",MOD:"Early intervention recommended. Lifestyle and exercise programme. 6-month follow-up.",HIGH:"Significant MSK burden. Clinical intervention required. 3-month review.",CRIT:"High risk of injury. Immediate clinical referral. Duty review."},
    "Periodic Review":{LOW:"Maintaining or improving. Continue programme. Next review 6 months.",MOD:"Partial improvement. Programme adjustment required. 3-month review.",HIGH:"Insufficient progress. Escalate intervention. Monthly review.",CRIT:"Deterioration noted. Duty modification. Specialist referral."},
    "Post-injury / Return to Work":{LOW:"Safe to return to full duties. Continue home programme. 4-week follow-up.",MOD:"Safe to return with modified duties. Graduated return plan. 2-week review.",HIGH:"Not yet ready for full duties. Continue rehab. Formal FCE in 4 weeks.",CRIT:"Not fit to return. Specialist referral. Medical clearance required."},
  };
  return {tier,pct,color:cols[tier],label:lbls[tier],action:(acts[assessType]||acts["Annual Wellness"])[tier],total,max};
}

function buildRx(scores, assessType, risk) {
  const s=k=>scores[k]||0;
  const rx=[{category:"Core Stability",priority:"Primary",exercises:[
    {name:"Dead Bug",sets:"3",reps:"10 each side",cue:"Lower back flat. Breathe out on exertion.",freq:"Daily"},
    {name:"McGill Bird-Dog",sets:"3",reps:"8 each side",cue:"No lumbar rotation. Slow and controlled.",freq:"Daily"},
    {name:"Prone Plank",sets:"3",reps:s("core")>1?"20 seconds":"45 seconds",cue:"Neutral spine. Breathe normally.",freq:"Daily"},
  ]}];
  if(s("fwd_flex")>=2||s("aw_pain_freq")>=2||s("pe_current_pain")>=2) rx.push({category:"Lumbar Mobility",priority:"Primary",exercises:[
    {name:"Cat-Camel",sets:"3",reps:"10 cycles",cue:"Smooth rhythm. No end-range forcing.",freq:"Pre and post shift"},
    {name:"Knee-to-Chest Stretch",sets:"2",reps:"30 seconds each",cue:"Gentle traction. Breathe into stretch.",freq:"Morning"},
    {name:"Glute Bridge",sets:"3",reps:"12",cue:"Drive through heels. Squeeze glutes.",freq:"Daily"},
  ]});
  if(s("slr")>=2||s("rtw_neuro")>=1) rx.push({category:"Nerve Mobilisation",priority:"Priority — nerve signs present",exercises:[
    {name:"Sciatic Nerve Floss",sets:"2",reps:"10 slow each side",cue:"STOP if symptoms worsen.",freq:"Daily"},
    {name:"McKenzie Extension",sets:"3",reps:"10 press-ups",cue:"Allow lumbar to sag. Hips on surface.",freq:"Pre-shift"},
  ]});
  if(s("cervical_rom")>=2) rx.push({category:"Cervical Rehabilitation",priority:"Primary",exercises:[
    {name:"Deep Cervical Flexor",sets:"3",reps:"10 seconds x 10",cue:"Chin tuck only. Deep flexors.",freq:"Daily"},
    {name:"Cervical Rotation Stretch",sets:"2",reps:"30 seconds each",cue:"Slow. No overpressure.",freq:"Pre-shift"},
    {name:"Shoulder Blade Retraction",sets:"3",reps:"15",cue:"Squeeze blades. 2 second hold.",freq:"Every 2 hours"},
  ]});
  if(s("shoulder_flex")>=2||s("pe_overhead")>=2) rx.push({category:"Shoulder Rehabilitation",priority:"Primary",exercises:[
    {name:"Band External Rotation",sets:"3",reps:"15",cue:"Elbow 90 degrees. Controlled movement.",freq:"Daily"},
    {name:"Wall Slide",sets:"3",reps:"12",cue:"Maintain wall contact. No shrugging.",freq:"Daily"},
    {name:"Pendulum Swings",sets:"2",reps:"30 seconds each direction",cue:"Let gravity traction the joint.",freq:"Pre-shift"},
  ]});
  if(s("pe_vib")>=2||s("aw_exercise")>=2) rx.push({category:"WBV Countermeasures",priority:"Secondary",exercises:[
    {name:"Standing Hamstring Stretch",sets:"2",reps:"45 seconds each",cue:"Post-operation. Hip hinge not spinal flexion.",freq:"After each operating session"},
    {name:"Hip Flexor Stretch",sets:"2",reps:"45 seconds each",cue:"Posterior pelvic tilt.",freq:"Post-shift"},
    {name:"Thoracic Extension Foam Roller",sets:"2",reps:"60 seconds",cue:"Focus T6-T10. Gentle overpressure.",freq:"Post-shift"},
  ]});
  if(assessType==="Post-injury / Return to Work"||risk.pct>=50) rx.push({category:"Progressive Strengthening",priority:"Add when acute phase settles",exercises:[
    {name:"Romanian Deadlift progressive load",sets:"3",reps:"12",cue:"Hip hinge. Neutral spine. Progress load slowly.",freq:"3 per week"},
    {name:"Seated Cable Row",sets:"3",reps:"12",cue:"Retract scapulae first. Drive elbows back.",freq:"3 per week"},
    {name:"Loaded Carry",sets:"3",reps:"20m each hand",cue:"Tall posture. Equal load. Progress weight.",freq:"3 per week"},
  ]});
  return rx;
}

function getRTW(scores, risk) {
  const pain=scores["rtw_pain_act"]||0, neuro=scores["rtw_neuro"]||0;
  if(risk.tier==="LOW"&&pain<=1&&neuro===0) return {decision:"CLEARED — FULL DUTIES",color:C.bio,detail:"Worker is fit to return to full pre-injury duties. Graduated return over 2 weeks recommended. Follow-up at 4 weeks."};
  if(risk.tier==="MOD"||pain<=3) return {decision:"CLEARED — MODIFIED DUTIES",color:C.warn,detail:"Worker may return with temporary duty restrictions. Graduated return plan required. Review in 2 weeks."};
  if(risk.tier==="HIGH") return {decision:"NOT YET CLEARED",color:C.ore,detail:"Worker requires further rehabilitation. Estimated 4-8 weeks. Formal FCE recommended before clearance."};
  return {decision:"NOT CLEARED — SPECIALIST REFERRAL",color:C.danger,detail:"Worker is not fit to return. Specialist medical assessment and formal FCE required."};
}

// UI
const Pill=({text,color})=><span style={{background:color+"22",border:"1px solid "+color+"55",color,padding:"0.15rem 0.5rem",fontSize:"0.62rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{text}</span>;
const Ey=({c=C.ore,children})=><div style={{fontFamily:mono,fontSize:"0.6rem",letterSpacing:"0.22em",textTransform:"uppercase",color:c,marginBottom:"0.4rem"}}>{children}</div>;
const Card=({children,style,accent})=><div style={{background:C.dust,border:"1px solid "+C.slate,borderLeft:accent?"3px solid "+accent:undefined,padding:"1.2rem",borderRadius:"2px",...style}}>{children}</div>;
const Btn=({children,onClick,v="primary",size="md",disabled})=>{
  const sz={sm:"0.45rem 0.9rem",md:"0.6rem 1.3rem",lg:"0.75rem 1.8rem"}[size];
  const vs={primary:{background:C.bio,color:C.shaft,border:"none"},ghost:{background:"transparent",color:C.seam,border:"1px solid "+C.slate},ore:{background:C.ore,color:C.shaft,border:"none"},danger:{background:C.danger,color:"#fff",border:"none"},outline:{background:"transparent",color:C.bio,border:"1px solid "+C.bio}}[v];
  return <button onClick={disabled?undefined:onClick} style={{padding:sz,fontWeight:700,fontSize:"0.78rem",letterSpacing:"0.06em",textTransform:"uppercase",cursor:disabled?"not-allowed":"pointer",fontFamily:font,opacity:disabled?0.45:1,borderRadius:"2px",...vs}}>{children}</button>;
};
const MBar=({value,max,color})=><div style={{height:5,background:C.shaft,borderRadius:3,overflow:"hidden",flex:1}}><div style={{height:"100%",width:Math.min(100,(value/max)*100)+"%",background:color,borderRadius:3,transition:"width 0.6s ease"}}/></div>;
const Ring=({pct,color,size=52,stroke=5})=>{const r=(size-stroke)/2,circ=2*Math.PI*r,off=circ*(1-pct/100);return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.slate} strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/></svg>;};

const RadioOpt=({opt,selected,onChange})=>{
  const val=opt.value!==undefined?opt.value:opt.score;
  return <label style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.55rem 0.9rem",background:selected?C.bio+"15":C.shaft,border:"1px solid "+(selected?C.bio:C.slate),cursor:"pointer",transition:"all 0.15s",marginBottom:"0.25rem"}}>
    <div style={{width:15,height:15,borderRadius:"50%",border:"2px solid "+(selected?C.bio:C.slate),background:selected?C.bio:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {selected&&<div style={{width:5,height:5,borderRadius:"50%",background:C.shaft}}/>}
    </div>
    <input type="radio" style={{display:"none"}} checked={selected} onChange={()=>onChange(val)}/>
    <span style={{fontSize:"0.84rem",color:selected?C.day:C.seam}}>{opt.label}</span>
    {selected&&val>=2&&<span style={{marginLeft:"auto",fontSize:"0.6rem",color:val>=3?C.danger:C.ore}}>{val>=3?"FLAG":"WATCH"}</span>}
  </label>;
};

function QSet({questions,scores,setScores}) {
  const secs=[...new Set(questions.map(q=>q.section))];
  return <div>{secs.map(sec=>{
    const qs=questions.filter(q=>q.section===sec);
    return <Card key={sec} style={{marginBottom:"1rem"}}>
      <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.bio,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:"0.9rem",paddingBottom:"0.5rem",borderBottom:"1px solid "+C.slate}}>{sec}</div>
      {qs.map(q=><div key={q.id} style={{marginBottom:"1rem"}}>
        <div style={{fontSize:"0.9rem",fontWeight:600,color:C.day,marginBottom:"0.2rem"}}>{q.question}</div>
        {q.sub&&<div style={{fontSize:"0.76rem",color:C.seam,fontStyle:"italic",marginBottom:"0.5rem"}}>{q.sub}</div>}
        {q.options.map((opt,i)=>{
          const val=opt.value!==undefined?opt.value:opt.score;
          return <RadioOpt key={i} opt={opt} selected={scores[q.id]===val} onChange={v=>setScores({...scores,[q.id]:v})}/>;
        })}
        {scores[q.id]>=2&&q.flag&&<div style={{marginTop:"0.5rem",padding:"0.4rem 0.7rem",background:(scores[q.id]>=3?C.danger:C.ore)+"15",border:"1px solid "+(scores[q.id]>=3?C.danger:C.ore),fontSize:"0.78rem",color:scores[q.id]>=3?C.danger:C.ore}}>{scores[q.id]>=3?"WARNING: ":"NOTE: "}{q.flag}</div>}
      </div>)}
    </Card>;
  })}</div>;
}

function TabBar({tabs,active,onChange}) {
  return <div style={{display:"flex",borderBottom:"1px solid "+C.slate,marginBottom:"1.5rem",overflowX:"auto"}}>
    {tabs.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{padding:"0.65rem 1.1rem",fontWeight:active===t.id?700:400,fontSize:"0.8rem",background:"none",border:"none",cursor:"pointer",color:active===t.id?C.bio:C.seam,fontFamily:font,borderBottom:active===t.id?"2px solid "+C.bio:"2px solid transparent",marginBottom:"-1px",whiteSpace:"nowrap"}}>{t.label}</button>)}
  </div>;
}

function AssessFlow({onSave,savedId}) {
  const [idx,setIdx]=useState(0);
  const [intake,setIntake]=useState({name:"",empId:"",role:"",age:"",yearsInRole:"",assessType:"",notes:""});
  const [scores,setScores]=useState({});
  const ref=useRef(null);
  const scroll=()=>ref.current&&ref.current.scrollIntoView({behavior:"smooth"});

  const tc=intake.assessType?ASSESS_TYPES[intake.assessType]:null;
  const steps=tc?tc.stepIds:["intake"];
  const labels=tc?tc.steps:["Intake"];
  const cur=steps[idx];
  const tc_color=tc?tc.color:C.bio;
  const qs=cur?getQuestions(intake.assessType,cur):[];
  const allOk=qs.length===0||qs.every(q=>scores[q.id]!==undefined);
  const risk=calcRisk(scores,intake.assessType);
  const today=new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"});
  const next=()=>{setIdx(i=>Math.min(i+1,steps.length-1));scroll();};
  const back=()=>{setIdx(i=>Math.max(i-1,0));scroll();};

  const isResult=["clearance","risk","comparison","rtwdecision"].includes(cur);
  const isFinal=["rx","plan","dutyplan"].includes(cur);
  const isQ=cur&&cur!=="intake"&&!isResult&&!isFinal&&qs.length>0;

  return <div ref={ref}>
    {tc&&<div style={{background:tc_color+"18",border:"1px solid "+tc_color+"33",padding:"0.7rem 1rem",marginBottom:"1.2rem",display:"flex",alignItems:"center",gap:"0.8rem",flexWrap:"wrap"}}>
      <span style={{fontSize:"1.2rem"}}>{tc.icon}</span>
      <div><div style={{fontWeight:700,color:tc_color,fontSize:"0.88rem"}}>{intake.assessType}</div><div style={{fontSize:"0.76rem",color:C.seam}}>{tc.purpose}</div></div>
      <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:"0.6rem",color:tc_color,fontFamily:mono}}>OUTCOME</div><div style={{fontSize:"0.72rem",color:C.seam}}>{tc.outcome}</div></div>
    </div>}

    {tc&&<div style={{background:C.dust,borderBottom:"1px solid "+C.slate,padding:"0.7rem 0",marginBottom:"1.5rem"}}>
      <div style={{display:"flex",position:"relative"}}>
        {labels.map((label,i)=>{
          const done=i<idx,active=i===idx;
          return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",position:"relative"}}>
            {i>0&&<div style={{position:"absolute",top:10,right:"50%",left:"-50%",height:2,background:done?tc_color:C.slate,zIndex:0}}/>}
            <div style={{width:20,height:20,borderRadius:"50%",background:done?tc_color:active?tc_color+"88":C.dust,border:"2px solid "+(done?tc_color:active?tc_color:C.slate),display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:700,color:done||active?C.shaft:C.seam,position:"relative",zIndex:1}}>{done?"v":i+1}</div>
            <span style={{fontSize:"0.55rem",fontWeight:active?700:400,color:active?tc_color:done?tc_color+"99":C.seam,textTransform:"uppercase",whiteSpace:"nowrap",maxWidth:60,textAlign:"center",lineHeight:1.2}}>{label}</span>
          </div>;
        })}
      </div>
    </div>}

    {cur==="intake"&&<div>
      <Ey>Step 1 — Worker Intake</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"0.3rem",color:C.day}}>Worker details</h2>
      <p style={{color:C.seam,fontSize:"0.88rem",marginBottom:"1.5rem"}}>Complete worker information and select the assessment type before proceeding.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1.4rem"}}>
        {[["Full name","name","text"],["Employee ID","empId","text"],["Age","age","number"],["Years in role","yearsInRole","number"]].map(([lbl,key,type])=><div key={key} style={{marginBottom:"0.9rem"}}>
          <label style={{display:"block",fontSize:"0.75rem",color:C.seam,marginBottom:"0.25rem"}}>{lbl}</label>
          <input type={type} value={intake[key]} onChange={e=>setIntake({...intake,[key]:e.target.value})} style={{width:"100%",background:C.shaft,border:"1px solid "+C.slate,color:C.day,padding:"0.55rem 0.7rem",fontSize:"0.88rem",fontFamily:font,outline:"none"}}/>
        </div>)}
        {[["Job role","role",JOB_ROLES],["Assessment type","assessType",Object.keys(ASSESS_TYPES)]].map(([lbl,key,opts])=><div key={key} style={{marginBottom:"0.9rem"}}>
          <label style={{display:"block",fontSize:"0.75rem",color:C.seam,marginBottom:"0.25rem"}}>{lbl}</label>
          <select value={intake[key]} onChange={e=>setIntake({...intake,[key]:e.target.value})} style={{width:"100%",background:C.shaft,border:"1px solid "+C.slate,color:intake[key]?C.day:C.seam,padding:"0.55rem 0.7rem",fontSize:"0.88rem",fontFamily:font,outline:"none"}}>
            <option value="">Select...</option>{opts.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>)}
      </div>
      {intake.assessType&&tc&&<div style={{marginBottom:"1rem",padding:"0.9rem 1rem",background:tc_color+"12",border:"1px solid "+tc_color+"44",borderLeft:"3px solid "+tc_color}}>
        <div style={{fontWeight:700,color:tc_color,marginBottom:"0.4rem",fontSize:"0.88rem"}}>{tc.icon} {intake.assessType}</div>
        <div style={{fontSize:"0.82rem",color:C.seam,marginBottom:"0.4rem"}}>{tc.purpose}</div>
        <div style={{fontSize:"0.76rem",color:C.seam}}><strong style={{color:C.day}}>Focus: </strong>{tc.focusAreas.join(" · ")}</div>
      </div>}
      <div style={{marginBottom:"0.9rem"}}>
        <label style={{display:"block",fontSize:"0.75rem",color:C.seam,marginBottom:"0.25rem"}}>Presenting complaint / notes</label>
        <textarea value={intake.notes} onChange={e=>setIntake({...intake,notes:e.target.value})} rows={3} style={{width:"100%",background:C.shaft,border:"1px solid "+C.slate,color:C.day,padding:"0.55rem 0.7rem",fontSize:"0.85rem",fontFamily:font,resize:"vertical",outline:"none"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={next} disabled={!intake.name||!intake.empId||!intake.role||!intake.assessType}>Begin Assessment</Btn></div>
    </div>}

    {isQ&&<div>
      <Ey c={tc_color}>Step {idx+1} — {labels[idx]}</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"0.3rem",color:C.day}}>{labels[idx]}</h2>
      <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"1.2rem"}}>
        <Pill text={intake.name} color={tc_color}/><Pill text={intake.role} color={C.seam}/><Pill text={intake.assessType} color={tc_color}/>
      </div>
      <QSet questions={qs} scores={scores} setScores={setScores}/>
      <Card style={{background:C.shaft,borderColor:tc_color+"55",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><Ey c={tc_color}>Section Progress</Ey><div style={{fontSize:"1.4rem",fontWeight:900,color:C.ore,fontFamily:mono}}>{qs.filter(q=>scores[q.id]!==undefined).length} / {qs.length} answered</div></div>
          <div style={{fontSize:"0.8rem",color:C.seam}}>{allOk?"All answered — ready to continue.":"Please answer all questions."}</div>
        </div>
      </Card>
      <div style={{display:"flex",justifyContent:"space-between"}}><Btn onClick={back} v="ghost">Back</Btn><Btn onClick={next} disabled={!allOk}>Next</Btn></div>
    </div>}

    {cur==="clearance"&&<div>
      <Ey c={tc_color}>Pre-employment Clearance Decision</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"1rem",color:C.day}}>Fitness for duty — {intake.role}</h2>
      {(()=>{
        const decs={LOW:{label:"FIT FOR ROLE",color:C.bio,detail:intake.name+" demonstrates adequate physical capacity for the "+intake.role+" position. No restrictions required."},MOD:{label:"FIT WITH MONITORING",color:C.warn,detail:intake.name+" may commence with enhanced monitoring. MSK programme before start date. Review at 3 months."},HIGH:{label:"FIT — MODIFIED DUTIES ONLY",color:C.ore,detail:intake.name+" is fit for light or modified duties only. Full role restrictions documented. Monthly clinical review required."},CRIT:{label:"NOT FIT FOR ROLE",color:C.danger,detail:intake.name+" does not meet the physical requirements for the "+intake.role+" position. Specialist medical assessment required."}};
        const dec=decs[risk.tier];
        return <>
          <Card accent={dec.color} style={{marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"0.8rem"}}>
              <div style={{position:"relative"}}><Ring pct={risk.pct} color={dec.color} size={60} stroke={6}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:900,color:dec.color,fontFamily:mono}}>{risk.pct}%</div></div>
              <div><div style={{fontSize:"1.1rem",fontWeight:900,color:dec.color}}>{dec.label}</div><div style={{fontSize:"0.76rem",color:C.seam}}>{today}</div></div>
            </div>
            <div style={{fontSize:"0.85rem",color:C.day,lineHeight:1.7}}>{dec.detail}</div>
            <div style={{marginTop:"0.8rem",padding:"0.7rem",background:dec.color+"12",border:"1px solid "+dec.color+"44",fontSize:"0.82rem",color:C.day}}>{risk.action}</div>
          </Card>
          <div style={{display:"flex",justifyContent:"space-between",gap:"0.6rem",flexWrap:"wrap"}}>
            <Btn onClick={back} v="ghost">Back</Btn>
            <div style={{display:"flex",gap:"0.6rem"}}>
              {!savedId&&<Btn onClick={()=>onSave(intake,scores,risk)} v="ore" size="sm">Save to Registry</Btn>}
              {savedId&&<Pill text="Saved" color={C.bio}/>}
            </div>
          </div>
        </>;
      })()}
    </div>}

    {(cur==="risk"||cur==="comparison")&&<div>
      <Ey c={tc_color}>Step {idx+1} — {labels[idx]}</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"1rem",color:C.day}}>{cur==="comparison"?"Progress vs Baseline":"MSK Risk Score"}</h2>
      {(()=>{
        const circ=Math.PI*55,off=circ*(1-risk.pct/100);
        return <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
            <Card accent={risk.color}>
              <div style={{textAlign:"center",padding:"0.5rem 0"}}>
                <svg width={140} height={80} viewBox="0 0 140 80">
                  <path d="M 10 75 A 55 55 0 0 1 130 75" fill="none" stroke={C.slate} strokeWidth={10} strokeLinecap="round"/>
                  <path d="M 10 75 A 55 55 0 0 1 130 75" fill="none" stroke={risk.color} strokeWidth={10} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} style={{transition:"stroke-dashoffset 1s ease"}}/>
                  <text x={70} y={64} textAnchor="middle" fill={risk.color} fontSize={20} fontWeight={900} fontFamily={mono}>{risk.pct}%</text>
                  <text x={70} y={78} textAnchor="middle" fill={C.seam} fontSize={8} fontFamily={mono} letterSpacing={2}>RISK SCORE</text>
                </svg>
                <div style={{display:"inline-block",background:risk.color+"22",border:"1px solid "+risk.color,padding:"0.25rem 0.8rem",fontSize:"0.82rem",fontWeight:700,color:risk.color}}>{risk.label}</div>
              </div>
              <div style={{marginTop:"0.8rem",padding:"0.7rem",background:risk.color+"12",border:"1px solid "+risk.color+"44"}}>
                <div style={{fontSize:"0.65rem",color:risk.color,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.2rem"}}>RECOMMENDED ACTION</div>
                <div style={{fontSize:"0.82rem",color:C.day}}>{risk.action}</div>
              </div>
            </Card>
            <Card>
              <Ey c={C.bio}>Score Breakdown</Ey>
              <div style={{display:"flex",gap:"0.8rem",marginBottom:"1rem"}}>
                {[{l:"Questions",v:Object.keys(scores).length,m:Object.keys(scores).length},{l:"Flagged",v:Object.values(scores).filter(v=>v>=2).length,m:Object.keys(scores).length},{l:"Score",v:risk.total,m:risk.max}].map(b=><div key={b.l} style={{flex:1,textAlign:"center",background:C.shaft,padding:"0.6rem 0.3rem"}}>
                  <div style={{fontSize:"1.2rem",fontWeight:900,color:C.ore,fontFamily:mono}}>{b.v}<span style={{fontSize:"0.65rem",color:C.seam}}>/{b.m}</span></div>
                  <div style={{fontSize:"0.62rem",color:C.seam,textTransform:"uppercase"}}>{b.l}</div>
                </div>)}
              </div>
              {Object.entries(scores).filter(([k,v])=>v>=2).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.3rem"}}>
                <div style={{fontSize:"0.7rem",color:C.seam,width:110,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k}</div>
                <MBar value={v} max={3} color={v>=3?C.danger:C.ore}/><div style={{fontSize:"0.62rem",color:C.seam,fontFamily:mono,width:20,textAlign:"right"}}>{v}</div>
              </div>)}
            </Card>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}><Btn onClick={back} v="ghost">Back</Btn><Btn onClick={next} v="ore">Generate Recommendations</Btn></div>
        </>;
      })()}
    </div>}

    {(cur==="rx"||cur==="plan")&&<div>
      <Ey c={tc_color}>Step {idx+1} — {labels[idx]}</Ey>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.8rem",marginBottom:"1.2rem"}}>
        <div><h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"0.2rem",color:C.day}}>Personalised Recommendations</h2><p style={{color:C.seam,fontSize:"0.85rem"}}>{intake.assessType} · {today}</p></div>
        <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
          <Pill text={risk.label+" · "+risk.pct+"%"} color={risk.color}/>
          {!savedId&&<Btn onClick={()=>onSave(intake,scores,risk)} v="ore" size="sm">Save to Registry</Btn>}
          {savedId&&<Pill text="Saved" color={C.bio}/>}
        </div>
      </div>
      <Card style={{background:C.shaft,borderColor:C.bio+"44",marginBottom:"1rem"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.8rem"}}>
          {[{l:"Worker",v:intake.name},{l:"ID",v:intake.empId},{l:"Role",v:intake.role},{l:"Assessment",v:intake.assessType},{l:"Date",v:today},{l:"Next Review",v:risk.pct>=50?"4 weeks":risk.pct>=25?"8 weeks":"12 weeks"}].map(f=><div key={f.l}>
            <div style={{fontSize:"0.62rem",color:C.seam,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.15rem",fontFamily:mono}}>{f.l}</div>
            <div style={{fontSize:"0.88rem",color:C.day,fontWeight:500}}>{f.v||"—"}</div>
          </div>)}
        </div>
      </Card>
      {buildRx(scores,intake.assessType,risk).map((cat,ci)=><Card key={ci} style={{marginBottom:"0.8rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.8rem",paddingBottom:"0.6rem",borderBottom:"1px solid "+C.slate}}>
          <div style={{fontWeight:700,fontSize:"0.95rem",color:C.day}}>{cat.category}</div>
          <div style={{fontSize:"0.62rem",fontWeight:700,color:cat.priority.includes("Priority")?C.danger:cat.priority==="Primary"?C.bio:C.ore,background:(cat.priority.includes("Priority")?C.danger:cat.priority==="Primary"?C.bio:C.ore)+"18",padding:"0.2rem 0.5rem"}}>{cat.priority.toUpperCase()}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
          {cat.exercises.map((ex,ei)=><div key={ei} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.5rem 0.8rem",padding:"0.6rem 0.8rem",background:C.shaft,border:"1px solid "+C.slate,alignItems:"start"}}>
            <div><div style={{fontWeight:600,color:C.day,fontSize:"0.86rem",marginBottom:"0.2rem"}}>{ex.name}</div><div style={{fontSize:"0.76rem",color:C.seam,fontStyle:"italic"}}>{ex.cue}</div></div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.25rem",alignItems:"flex-end",flexShrink:0}}>
              <div style={{fontFamily:mono,fontSize:"0.72rem",color:C.ore}}>{ex.sets} x {ex.reps}</div>
              <div style={{fontSize:"0.6rem",color:C.bio,background:C.bio+"15",padding:"0.12rem 0.4rem",border:"1px solid "+C.bio+"44",whiteSpace:"nowrap"}}>{ex.freq}</div>
            </div>
          </div>)}
        </div>
      </Card>)}
      <div style={{padding:"0.8rem 1rem",background:C.dust,border:"1px solid "+C.slate,fontSize:"0.73rem",color:C.seam,lineHeight:1.6}}>
        <strong style={{color:C.day}}>Clinical disclaimer:</strong> Generated by SpineSync. Reviewed by attending Biokineticist (HPCSA registered). Cease immediately if radiating pain or neurological symptoms occur.
      </div>
    </div>}

    {cur==="rtwdecision"&&<div>
      <Ey c={C.danger}>Return to Work Decision</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"1rem",color:C.day}}>RTW Clearance — {intake.name}</h2>
      {(()=>{
        const dec=getRTW(scores,risk);
        return <>
          <Card accent={dec.color} style={{marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"0.8rem",flexWrap:"wrap"}}>
              <div style={{position:"relative"}}><Ring pct={risk.pct} color={dec.color} size={64} stroke={6}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:900,color:dec.color,fontFamily:mono}}>{risk.pct}%</div></div>
              <div style={{flex:1}}><div style={{fontSize:"1.1rem",fontWeight:900,color:dec.color,marginBottom:"0.3rem"}}>{dec.decision}</div><div style={{fontSize:"0.84rem",color:C.day,lineHeight:1.6}}>{dec.detail}</div></div>
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
            <Card><Ey>Worker Details</Ey>
              {[["Worker",intake.name],["Role",intake.role],["Assessment",intake.assessType],["Date",today]].map(([l,v])=><div key={l} style={{marginBottom:"0.5rem"}}><div style={{fontSize:"0.6rem",color:C.seam,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:mono}}>{l}</div><div style={{fontSize:"0.86rem",color:C.day,fontWeight:500}}>{v}</div></div>)}
            </Card>
            <Card><Ey>Flagged Risk Factors</Ey>
              {Object.entries(scores).filter(([k,v])=>v>=2).slice(0,5).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.4rem"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:v>=3?C.danger:C.ore,flexShrink:0}}/>
                <div style={{fontSize:"0.78rem",color:C.seam}}>{k.replace(/_/g," ")}</div>
                <div style={{marginLeft:"auto",fontSize:"0.7rem",fontWeight:700,color:v>=3?C.danger:C.ore}}>{v}/3</div>
              </div>)}
            </Card>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}><Btn onClick={back} v="ghost">Back</Btn><Btn onClick={next} v="ore">Generate Duty Plan</Btn></div>
        </>;
      })()}
    </div>}

    {cur==="dutyplan"&&<div>
      <Ey c={C.danger}>RTW Duty Modification Plan</Ey>
      <h2 style={{fontSize:"1.4rem",fontWeight:800,marginBottom:"1rem",color:C.day}}>Graduated Return to Work Plan</h2>
      {(()=>{
        const dec=getRTW(scores,risk);
        const weeks=[
          {week:"Weeks 1-2",hours:"4 hrs/day",duties:"Admin, light supervision, no manual handling",load:"No lifting over 5 kg"},
          {week:"Weeks 3-4",hours:"6 hrs/day",duties:"Light operational duties, modified task allocation",load:"Lifting up to 10 kg with good form"},
          {week:"Weeks 5-6",hours:"Full shift",duties:"Graduated return to standard duties",load:"50 percent of normal job demand"},
          {week:"Weeks 7-8",hours:"Full shift",duties:"Full duties subject to review",load:"Full job demands if pain-free and clinician cleared"},
        ];
        return <>
          <Card accent={dec.color} style={{marginBottom:"1rem"}}>
            <div style={{fontWeight:700,color:dec.color,marginBottom:"0.4rem"}}>{dec.decision}</div>
            <div style={{fontSize:"0.82rem",color:C.seam}}>{dec.detail}</div>
          </Card>
          {(dec.decision.includes("FULL")||dec.decision.includes("MODIFIED"))&&<>
            <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.ore,letterSpacing:"0.2em",marginBottom:"0.6rem"}}>GRADUATED RETURN SCHEDULE</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",marginBottom:"1.2rem"}}>
              {weeks.map((w,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"80px 80px 1fr 1fr",gap:"0.8rem",padding:"0.7rem 0.9rem",background:i===0?C.bio+"10":C.shaft,border:"1px solid "+(i===0?C.bio:C.slate)}}>
                <div style={{fontWeight:700,color:C.day,fontSize:"0.82rem"}}>{w.week}</div>
                <div style={{fontSize:"0.78rem",color:C.ore,fontFamily:mono}}>{w.hours}</div>
                <div style={{fontSize:"0.78rem",color:C.seam}}>{w.duties}</div>
                <div style={{fontSize:"0.78rem",color:C.seam}}>{w.load}</div>
              </div>)}
            </div>
          </>}
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontFamily:mono,fontSize:"0.62rem",color:C.bio,letterSpacing:"0.2em",marginBottom:"0.6rem"}}>REHABILITATION PROGRAMME</div>
            {buildRx(scores,intake.assessType,risk).slice(0,2).map((cat,ci)=><Card key={ci} style={{marginBottom:"0.6rem"}}>
              <div style={{fontWeight:700,fontSize:"0.88rem",color:C.day,marginBottom:"0.6rem"}}>{cat.category}</div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                {cat.exercises.map((ex,ei)=><div key={ei} style={{display:"flex",justifyContent:"space-between",padding:"0.5rem 0.7rem",background:C.shaft,border:"1px solid "+C.slate}}>
                  <div><div style={{fontWeight:600,color:C.day,fontSize:"0.83rem"}}>{ex.name}</div><div style={{fontSize:"0.72rem",color:C.seam,fontStyle:"italic"}}>{ex.cue}</div></div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:"0.5rem"}}><div style={{fontFamily:mono,fontSize:"0.7rem",color:C.ore}}>{ex.sets} x {ex.reps}</div><div style={{fontSize:"0.58rem",color:C.bio}}>{ex.freq}</div></div>
                </div>)}
              </div>
            </Card>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:"0.6rem",flexWrap:"wrap"}}>
            <Btn onClick={back} v="ghost">Back</Btn>
            <div style={{display:"flex",gap:"0.6rem"}}>
              {!savedId&&<Btn onClick={()=>onSave(intake,scores,risk)} v="ore" size="sm">Save to Registry</Btn>}
              {savedId&&<Pill text="Saved" color={C.bio}/>}
            </div>
          </div>
        </>;
      })()}
    </div>}
  </div>;
}

function ProfileOverview({worker,onUpdate}) {
  const prog=RISK_PROGRAMS[worker.risk],rc=prog?prog.color:C.seam;
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
    <Card accent={rc}>
      <Ey c={rc}>MSK Risk Status</Ey>
      {worker.risk?<>
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"0.8rem"}}>
          <div style={{position:"relative"}}><Ring pct={worker.riskPct||0} color={rc} size={60} stroke={6}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:900,color:rc,fontFamily:mono}}>{worker.riskPct||0}%</div></div>
          <div><div style={{fontSize:"1rem",fontWeight:800,color:rc}}>{prog.label}</div><div style={{fontSize:"0.76rem",color:C.seam}}>{prog.duration} — {prog.freq}</div></div>
        </div>
        <div style={{fontSize:"0.82rem",color:C.seam,lineHeight:1.6}}>{prog.description}</div>
      </>:<>
        <div style={{color:C.seam,fontSize:"0.85rem",marginBottom:"0.8rem"}}>No risk tier assigned.</div>
        <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>{Object.entries(RISK_PROGRAMS).map(([k])=><Btn key={k} size="sm" v="ghost" onClick={()=>onUpdate({...worker,risk:k,programStarted:false,weeksDone:0})}>{k}</Btn>)}</div>
      </>}
    </Card>
    <Card>
      <Ey>Worker Details</Ey>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
        {[["Name",worker.name],["ID",worker.empId],["Role",worker.role],["Age",worker.age],["Yrs in Role",worker.yearsInRole],["Assessment",worker.assessType]].map(([l,v])=><div key={l}>
          <div style={{fontSize:"0.6rem",color:C.seam,textTransform:"uppercase",letterSpacing:"0.12em",fontFamily:mono}}>{l}</div>
          <div style={{fontSize:"0.86rem",color:C.day,fontWeight:500}}>{v||"—"}</div>
        </div>)}
      </div>
    </Card>
    {worker.risk&&<Card style={{gridColumn:"1/-1"}}>
      <Ey>Program Status</Ey>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:worker.programStarted?"1rem":0}}>
        {[{l:"Program",v:prog.label,c:rc},{l:"Weeks Done",v:worker.weeksDone?worker.weeksDone+" of "+prog.duration.split(" ")[0]:"Not started",c:C.seam},{l:"Next Review",v:worker.riskPct>=60?"2 weeks":worker.riskPct>=35?"4 weeks":"8 weeks",c:C.ore}].map(s=><div key={s.l}>
          <div style={{fontSize:"0.6rem",color:C.seam,textTransform:"uppercase",letterSpacing:"0.12em",fontFamily:mono,marginBottom:"0.2rem"}}>{s.l}</div>
          <div style={{fontSize:"0.9rem",fontWeight:700,color:s.c}}>{s.v}</div>
        </div>)}
      </div>
      {worker.programStarted&&<><div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:C.seam,marginBottom:"0.3rem"}}><span>Progress</span><span>Week {worker.weeksDone||0}</span></div><div style={{height:7,background:C.shaft,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",background:rc,borderRadius:4,width:Math.min(100,((worker.weeksDone||0)/parseInt(prog.duration))*100)+"%",transition:"width 0.6s ease"}}/></div></>}
    </Card>}
    {worker.notes&&<Card style={{gridColumn:"1/-1"}} accent={C.bio}><Ey c={C.bio}>Presenting Complaint</Ey><div style={{fontSize:"0.85rem",color:C.seam,lineHeight:1.7}}>{worker.notes}</div></Card>}
  </div>;
}

function ProfileProgram({worker,onUpdate}) {
  const [ap,setAp]=useState(0);
  const [checked,setChecked]=useState(worker.exerciseChecked||{});
  const prog=RISK_PROGRAMS[worker.risk],rc=prog?prog.color:C.seam;
  if(!worker.risk||!prog) return <Card style={{textAlign:"center",padding:"3rem"}}><div style={{color:C.seam}}>Assign a risk tier in Overview to generate an MSK programme.</div></Card>;
  const phase=prog.phases[ap];
  const totalEx=prog.phases.reduce((a,ph)=>a+ph.sessions.reduce((b,s)=>b+s.exercises.length,0),0);
  const doneCount=Object.values(checked).filter(Boolean).length;
  const catC={Core:C.bio,Strength:C.ore,Mobility:C.warn,Lumbar:C.ore,Cervical:"#9B6FCF",Shoulder:"#4A9FCF",Functional:C.bio,Nerve:C.danger,Hip:C.warn,Extension:C.ore,Control:C.bio,Assessment:C.ore,Education:C.seam,Acute:C.danger};
  const tog=key=>{const u={...checked,[key]:!checked[key]};setChecked(u);onUpdate({...worker,exerciseChecked:u});};
  return <div>
    <Card accent={rc} style={{marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.8rem"}}>
        <div><div style={{fontWeight:800,fontSize:"1rem",color:C.day}}>{prog.label}</div><div style={{fontSize:"0.78rem",color:C.seam}}>{prog.duration} — {prog.freq}</div></div>
        <div style={{display:"flex",gap:"0.6rem",alignItems:"center"}}>
          {!worker.programStarted?<Btn size="sm" onClick={()=>onUpdate({...worker,programStarted:true})}>Start Program</Btn>:<Btn size="sm" v="outline" onClick={()=>onUpdate({...worker,weeksDone:Math.min((worker.weeksDone||0)+1,24)})}>Complete Week</Btn>}
          <div style={{position:"relative"}}><Ring pct={Math.round((doneCount/Math.max(1,totalEx))*100)} color={rc} size={42} stroke={4}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:700,color:rc}}>{Math.round((doneCount/Math.max(1,totalEx))*100)}%</div></div>
        </div>
      </div>
    </Card>
    <div style={{display:"flex",gap:"0.4rem",marginBottom:"1rem",flexWrap:"wrap"}}>
      {prog.phases.map((ph,i)=><button key={i} onClick={()=>setAp(i)} style={{padding:"0.45rem 0.9rem",fontWeight:i===ap?700:400,background:i===ap?rc+"22":C.dust,border:"1px solid "+(i===ap?rc:C.slate),color:i===ap?rc:C.seam,cursor:"pointer",fontFamily:font,fontSize:"0.78rem",borderRadius:"2px"}}>{ph.phase} — {ph.focus}</button>)}
    </div>
    <div style={{padding:"0.6rem 0.9rem",background:C.shaft,borderLeft:"3px solid "+rc,marginBottom:"0.9rem"}}>
      <div style={{fontFamily:mono,fontSize:"0.58rem",color:rc,letterSpacing:"0.18em",marginBottom:"0.1rem"}}>{phase.weeks}</div>
      <div style={{fontWeight:700,color:C.day}}>{phase.focus}</div>
    </div>
    {phase.sessions.map((session,si)=><div key={si} style={{marginBottom:"1rem"}}>
      <div style={{fontWeight:700,color:C.day,marginBottom:"0.6rem",fontSize:"0.88rem",paddingBottom:"0.35rem",borderBottom:"1px solid "+C.slate}}>{session.day}</div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {session.exercises.map((ex,ei)=>{
          const key=ap+"-"+si+"-"+ei,done=checked[key],cc=catC[ex.category]||C.seam;
          return <div key={ei} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",alignItems:"center",gap:"0.7rem",padding:"0.6rem 0.8rem",background:done?C.bio+"0C":C.shaft,border:"1px solid "+(done?C.bio+"44":C.slate),transition:"all 0.15s"}}>
            <div onClick={()=>tog(key)} style={{width:17,height:17,border:"2px solid "+(done?C.bio:C.slate),background:done?C.bio:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.68rem",color:C.shaft,flexShrink:0,borderRadius:"2px"}}>{done?"v":""}</div>
            <div><div style={{fontWeight:600,color:done?C.seam:C.day,fontSize:"0.86rem",textDecoration:done?"line-through":"none"}}>{ex.name}</div><div style={{fontSize:"0.72rem",color:C.seam,fontStyle:"italic"}}>{ex.cue}</div></div>
            <div style={{fontFamily:mono,fontSize:"0.7rem",color:C.ore,textAlign:"right",whiteSpace:"nowrap"}}>{ex.sets} x {ex.reps}</div>
            <div style={{fontSize:"0.58rem",color:cc,background:cc+"18",padding:"0.12rem 0.38rem",border:"1px solid "+cc+"33",whiteSpace:"nowrap"}}>{ex.category}</div>
          </div>;
        })}
      </div>
    </div>)}
  </div>;
}

function WorkerProfile({worker,onUpdate,onBack}) {
  const [tab,setTab]=useState("overview");
  const prog=RISK_PROGRAMS[worker.risk],rc=prog?prog.color:C.seam;
  const tc=ASSESS_TYPES[worker.assessType];
  const tabs=[{id:"overview",label:"Overview"},{id:"program",label:"MSK Program"},{id:"notes",label:"Clinical Notes"}];
  return <div>
    <div style={{display:"flex",alignItems:"flex-start",gap:"0.8rem",marginBottom:"1.2rem",flexWrap:"wrap"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.seam,cursor:"pointer",fontSize:"0.82rem",padding:0,fontFamily:font}}>Back to Registry</button>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.7rem",flexWrap:"wrap"}}>
          <h2 style={{fontSize:"1.35rem",fontWeight:800,color:C.day,margin:0}}>{worker.name}</h2>
          {worker.risk&&prog&&<Pill text={prog.label} color={rc}/>}
          {tc&&<Pill text={worker.assessType} color={tc.color}/>}
        </div>
        <div style={{fontSize:"0.78rem",color:C.seam,marginTop:"0.2rem"}}>{worker.empId} — {worker.role} — Age {worker.age}</div>
      </div>
    </div>
    <TabBar tabs={tabs} active={tab} onChange={setTab}/>
    {tab==="overview"&&<ProfileOverview worker={worker} onUpdate={onUpdate}/>}
    {tab==="program"&&<ProfileProgram worker={worker} onUpdate={onUpdate}/>}
    {tab==="notes"&&<ProfileNotes worker={worker} onUpdate={onUpdate}/>}
  </div>;
}

function Registry({workers,onSelect,onNew}) {
  const rc={LOW:0,MOD:0,HIGH:0,CRIT:0};
  workers.forEach(w=>{if(w.risk)rc[w.risk]=(rc[w.risk]||0)+1;});
  return <div>
    <Ey>Worker Registry</Ey>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.8rem",marginBottom:"1.5rem"}}>
      <h2 style={{fontSize:"1.6rem",fontWeight:800,color:C.day,margin:0}}>MSK Program Registry</h2>
      <Btn onClick={onNew} v="ore">+ New Assessment</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.7rem",marginBottom:"1.5rem"}}>
      {[{l:"Total Workers",v:workers.length,c:C.bio},{l:"High or Critical",v:(rc.HIGH||0)+(rc.CRIT||0),c:C.danger},{l:"Active Programs",v:workers.filter(w=>w.programStarted).length,c:C.ore},{l:"FCE Pending",v:workers.filter(w=>w.fcePending).length,c:C.warn}].map(s=><Card key={s.l} accent={s.c}><div style={{fontFamily:mono,fontSize:"0.6rem",color:C.seam,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"0.2rem"}}>{s.l}</div><div style={{fontSize:"1.8rem",fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div></Card>)}
    </div>
    <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"1rem"}}>
      {Object.entries(ASSESS_TYPES).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.3rem 0.6rem",background:v.color+"12",border:"1px solid "+v.color+"33",fontSize:"0.7rem",color:v.color}}>{v.icon} {k}</div>)}
    </div>
    {workers.length===0?<Card style={{textAlign:"center",padding:"3rem"}}><div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>👷</div><div style={{color:C.seam,marginBottom:"1rem"}}>No workers yet. Run a new assessment to get started.</div><Btn onClick={onNew} v="ore">Start First Assessment</Btn></Card>
    :<div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.8fr 1fr 0.5fr",gap:"0.8rem",padding:"0.4rem 0.9rem"}}>
        {["Worker","Assessment Type","Risk","Program",""].map(h=><div key={h} style={{fontSize:"0.62rem",color:C.seam,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:mono}}>{h}</div>)}
      </div>
      {workers.map(w=>{
        const p=RISK_PROGRAMS[w.risk],rc2=p?p.color:C.seam,tc=ASSESS_TYPES[w.assessType];
        return <div key={w.id} onClick={()=>onSelect(w)} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.8fr 1fr 0.5fr",gap:"0.8rem",alignItems:"center",padding:"0.8rem 0.9rem",background:C.dust,border:"1px solid "+C.slate,cursor:"pointer",transition:"border-color 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=rc2} onMouseLeave={e=>e.currentTarget.style.borderColor=C.slate}>
          <div><div style={{fontWeight:700,color:C.day,fontSize:"0.88rem"}}>{w.name}</div><div style={{fontSize:"0.7rem",color:C.seam}}>{w.empId} — {w.role&&w.role.split(" ").slice(0,2).join(" ")}</div></div>
          <div>{tc?<span style={{fontSize:"0.72rem",color:tc.color}}>{tc.icon} {w.assessType&&w.assessType.split(" ")[0]}</span>:<span style={{color:C.slate,fontSize:"0.7rem"}}>—</span>}</div>
          <div>{w.risk?<Pill text={w.risk} color={rc2}/>:<span style={{color:C.slate,fontSize:"0.7rem"}}>—</span>}</div>
          <div>{w.programStarted?<Pill text="Active" color={C.bio}/>:<span style={{color:C.slate,fontSize:"0.7rem"}}>Not started</span>}</div>
          <div style={{color:C.bio,fontSize:"0.8rem",textAlign:"right"}}>→</div>
        </div>;
      })}
    </div>}
  </div>;
}

function Analytics({workers}) {
  if(!workers.length) return <Card style={{textAlign:"center",padding:"3rem"}}><div style={{color:C.seam}}>No worker data yet. Complete assessments to see analytics.</div></Card>;
  const rc={LOW:0,MOD:0,HIGH:0,CRIT:0};
  workers.forEach(w=>{if(w.risk)rc[w.risk]=(rc[w.risk]||0)+1;});
  const byType={};
  workers.forEach(w=>{if(w.assessType)byType[w.assessType]=(byType[w.assessType]||0)+1;});
  const avgRisk=workers.reduce((a,w)=>a+(w.riskPct||0),0)/Math.max(workers.length,1);
  const tiers=[{k:"LOW",l:"Low Risk",c:C.bio},{k:"MOD",l:"Moderate",c:C.warn},{k:"HIGH",l:"High Risk",c:C.ore},{k:"CRIT",l:"Critical",c:C.danger}];
  return <div>
    <Ey>Site Analytics</Ey>
    <h2 style={{fontSize:"1.6rem",fontWeight:800,color:C.day,marginBottom:"1.5rem"}}>MSK Risk Dashboard</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.7rem",marginBottom:"1.5rem"}}>
      {[{l:"Avg Site Risk",v:Math.round(avgRisk)+"%",c:avgRisk>=60?C.danger:avgRisk>=35?C.ore:C.bio},{l:"Workers Assessed",v:workers.filter(w=>w.risk).length,c:C.bio},{l:"Active Programs",v:workers.filter(w=>w.programStarted).length,c:C.ore}].map(s=><Card key={s.l} accent={s.c}><div style={{fontFamily:mono,fontSize:"0.6rem",color:C.seam,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"0.3rem"}}>{s.l}</div><div style={{fontSize:"2rem",fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div></Card>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
      <Card>
        <Ey c={C.bio}>Risk Tier Distribution</Ey>
        <div style={{display:"flex",flexDirection:"column",gap:"0.7rem",marginTop:"0.5rem"}}>
          {tiers.map(t=><div key={t.k}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.2rem"}}><span style={{fontSize:"0.8rem",color:C.day}}>{t.l}</span><span style={{fontSize:"0.8rem",fontWeight:700,color:t.c,fontFamily:mono}}>{rc[t.k]||0}</span></div>
            <div style={{height:10,background:C.shaft,borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:((rc[t.k]||0)/Math.max(workers.length,1)*100)+"%",background:t.c,borderRadius:5,transition:"width 0.8s ease"}}/></div>
          </div>)}
        </div>
      </Card>
      <Card>
        <Ey c={C.ore}>Assessments by Type</Ey>
        <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginTop:"0.5rem"}}>
          {Object.entries(byType).map(([type,count])=>{
            const tc=ASSESS_TYPES[type];
            return <div key={type}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.2rem"}}><span style={{fontSize:"0.76rem",color:C.seam}}>{tc&&tc.icon} {type}</span><span style={{fontSize:"0.76rem",fontWeight:700,color:tc?tc.color:C.seam,fontFamily:mono}}>{count}</span></div>
              <div style={{height:8,background:C.shaft,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:(count/workers.length*100)+"%",background:tc?tc.color:C.seam,borderRadius:4,transition:"width 0.8s ease"}}/></div>
            </div>;
          })}
        </div>
      </Card>
    </div>
    <Card>
      <Ey>Individual Risk Overview</Ey>
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",marginTop:"0.5rem"}}>
        {workers.filter(w=>w.risk).sort((a,b)=>(b.riskPct||0)-(a.riskPct||0)).map(w=>{
          const p=RISK_PROGRAMS[w.risk],c=p?p.color:C.seam,tc=ASSESS_TYPES[w.assessType];
          return <div key={w.id} style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
            <div style={{width:120,flexShrink:0,fontSize:"0.78rem",color:C.day,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.name}</div>
            {tc&&<span style={{fontSize:"0.6rem",color:tc.color,flexShrink:0}}>{tc.icon}</span>}
            <MBar value={w.riskPct||0} max={100} color={c}/>
            <div style={{fontFamily:mono,fontSize:"0.7rem",color:c,width:36,textAlign:"right",fontWeight:700}}>{w.riskPct||0}%</div>
            <Pill text={w.risk} color={c}/>
          </div>;
        })}
      </div>
    </Card>
  </div>;
}


// ── ProfileNotes rewired for Supabase
function ProfileNotes({worker,onUpdate}) {
  const [note,setNote]=useState("");
  const [notes,setNotes]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    fetchNotes(worker.id).then(n=>{if(active){setNotes(n);setLoading(false);}});
    return ()=>{active=false;};
  },[worker.id]);
  const add=async()=>{
    if(!note.trim())return;
    await addNote(worker.id,note);
    setNotes(ns=>[{text:note,author:"Attending BK",date:new Date().toLocaleDateString("en-ZA")},...ns]);
    setNote("");
  };
  const Ey=({c=C.ore,children})=><div style={{fontFamily:mono,fontSize:"0.6rem",letterSpacing:"0.22em",textTransform:"uppercase",color:c,marginBottom:"0.4rem"}}>{children}</div>;
  const Card=({children,style,accent})=><div style={{background:C.dust,border:"1px solid "+C.slate,borderLeft:accent?"3px solid "+accent:undefined,padding:"1.2rem",borderRadius:"2px",...style}}>{children}</div>;
  const Btn=({children,onClick,v="primary",size="md",disabled})=>{
    const sz={sm:"0.45rem 0.9rem",md:"0.6rem 1.3rem"}[size];
    const vs={primary:{background:C.bio,color:C.shaft,border:"none"},ghost:{background:"transparent",color:C.seam,border:"1px solid "+C.slate}}[v];
    return <button onClick={disabled?undefined:onClick} style={{padding:sz,fontWeight:700,fontSize:"0.78rem",letterSpacing:"0.06em",textTransform:"uppercase",cursor:disabled?"not-allowed":"pointer",fontFamily:font,opacity:disabled?0.45:1,borderRadius:"2px",...vs}}>{children}</button>;
  };
  return <div>
    <Ey>Clinical Notes Log</Ey>
    <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a clinical note..." rows={4} style={{width:"100%",background:C.dust,border:"1px solid "+C.slate,color:C.day,padding:"0.65rem",fontSize:"0.86rem",fontFamily:font,resize:"vertical",outline:"none",borderRadius:"2px",marginBottom:"0.5rem"}}/>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"1.2rem"}}><Btn onClick={add} disabled={!note.trim()}>Add Note</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
      {loading?<div style={{color:C.seam,textAlign:"center",padding:"2rem"}}>Loading…</div>
        :notes.length===0?<div style={{color:C.seam,textAlign:"center",padding:"2rem"}}>No notes yet.</div>
        :notes.map((n,i)=><Card key={i} accent={C.bio}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.35rem"}}><span style={{fontSize:"0.68rem",color:C.bio,fontFamily:mono}}>{n.author}</span><span style={{fontSize:"0.68rem",color:C.seam}}>{n.date}</span></div><div style={{fontSize:"0.86rem",color:C.day,lineHeight:1.7}}>{n.text}</div></Card>)}
    </div>
  </div>;
}

// ── ROOT APP
export default function App() {
  const [authChecked,setAuthChecked]=useState(false);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [section,setSection]=useState("registry");
  const [workers,setWorkers]=useState([]);
  const [workersLoading,setWorkersLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [savedId,setSavedId]=useState(null);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const u=await getCurrentUser();
      if(!active)return;
      if(u){
        const {data:p}=await getProfile(u.id);
        setUser(u);setProfile(p);
      }
      setAuthChecked(true);
    })();
    const {data:listener}=supabase.auth.onAuthStateChange(async(_,session)=>{
      if(session?.user){
        const {data:p}=await getProfile(session.user.id);
        setUser(session.user);setProfile(p);
      } else {setUser(null);setProfile(null);}
    });
    return ()=>{active=false;listener?.subscription?.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!user||!profile?.approved||profile?.role==="mine_client")return;
    setWorkersLoading(true);
    fetchWorkers().then(ws=>{setWorkers(ws);setWorkersLoading(false);});
  },[user,profile]);

  const handleLogout=async()=>{await signOut();setUser(null);setProfile(null);};

  const updateWorker=async(w)=>{
    setSelected(w);
    setWorkers(ws=>ws.map(x=>x.id===w.id?w:x));
    const saved=await dbUpdateWorker(w);
    if(saved){setSelected(saved);setWorkers(ws=>ws.map(x=>x.id===saved.id?saved:x));}
  };

  const saveWorker=async(intake,scores,risk)=>{
    const newW={...intake,risk:risk.tier,riskPct:risk.pct,programStarted:false,weeksDone:0,
      fcePending:intake.assessType==="Post-injury / Return to Work"&&risk.tier!=="LOW",
      fceComplete:false,exerciseChecked:{},consentShared:false};
    const saved=await createWorker(newW);
    if(saved){setWorkers(ws=>[saved,...ws]);setSavedId(saved.id);
      await saveAssessmentRecord(saved.id,intake.assessType,scores,risk);}
  };

  const startNew=()=>{setSavedId(null);setSection("assessment");};

  // Loading
  if(!authChecked) return <div style={{minHeight:"100vh",background:C.shaft,display:"flex",alignItems:"center",justifyContent:"center",color:C.seam,fontFamily:font}}>Loading…</div>;

  // Not logged in
  if(!user) return <Login onLoggedIn={u=>setUser(u)}/>;

  // Pending approval
  if(!profile?.approved) return (
    <div style={{minHeight:"100vh",background:C.shaft,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font,padding:"1.5rem"}}>
      <div style={{maxWidth:420,textAlign:"center"}}>
        <div style={{fontWeight:900,fontSize:"1.6rem",marginBottom:"1rem",color:C.day}}>Spine<span style={{color:C.bio}}>Sync</span></div>
        <div style={{background:C.dust,border:`1px solid ${C.ore}`,padding:"1.5rem",borderRadius:"2px"}}>
          <div style={{fontWeight:700,color:C.ore,marginBottom:"0.6rem"}}>Account Pending Approval</div>
          <div style={{color:C.seam,fontSize:"0.88rem",lineHeight:1.6,marginBottom:"1rem"}}>Your account has been created but is awaiting administrator approval. Contact your SpineSync admin.</div>
          <button onClick={handleLogout} style={{background:"none",border:`1px solid ${C.slate}`,color:C.seam,padding:"0.5rem 1rem",cursor:"pointer",fontFamily:font,borderRadius:"2px"}}>Sign Out</button>
        </div>
      </div>
    </div>
  );

  // Mine client portal
  if(profile?.role==="mine_client") return <MineClient user={user} profile={profile} onLogout={handleLogout}/>;

  // Biokineticist app
  const nav=[{id:"registry",label:"Registry",icon:"👷"},{id:"assessment",label:"New Assessment",icon:"🩺"},{id:"analytics",label:"Analytics",icon:"📊"}];

  return <div style={{minHeight:"100vh",background:C.shaft,color:C.day,fontFamily:font,fontSize:"14px",display:"flex",flexDirection:"column"}}>
    <nav style={{background:"rgba(26,28,30,0.97)",borderBottom:"1px solid "+C.dust,padding:"0 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,height:48}}>
      <div style={{display:"flex",alignItems:"center",gap:"1.5rem"}}>
        <div style={{fontWeight:900,fontSize:"1.1rem",letterSpacing:"0.04em"}}>Spine<span style={{color:C.bio}}>Sync</span></div>
        <div style={{display:"flex",gap:0}}>
          {nav.map(n=><button key={n.id} onClick={()=>{if(n.id==="assessment")startNew();else{setSection(n.id);setSelected(null);}}} style={{padding:"0 1.1rem",height:48,fontWeight:section===n.id?700:400,fontSize:"0.8rem",background:"none",border:"none",cursor:"pointer",color:section===n.id?C.bio:C.seam,fontFamily:font,borderBottom:section===n.id?"2px solid "+C.bio:"2px solid transparent",whiteSpace:"nowrap"}}>{n.icon} {n.label}</button>)}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
        <span style={{fontSize:"0.75rem",color:C.seam,fontFamily:mono}}>{profile?.full_name||user.email}</span>
        <span style={{background:C.bio+"22",border:`1px solid ${C.bio}55`,color:C.bio,padding:"0.15rem 0.5rem",fontSize:"0.62rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>BK Active</span>
        <button onClick={handleLogout} style={{background:"none",border:`1px solid ${C.slate}`,color:C.seam,padding:"0.3rem 0.7rem",fontSize:"0.7rem",cursor:"pointer",fontFamily:font,borderRadius:"2px"}}>Sign Out</button>
      </div>
    </nav>
    <div style={{flex:1,maxWidth:960,margin:"0 auto",width:"100%",padding:"1.8rem 1.5rem"}}>
      {section==="registry"&&!selected&&(workersLoading?<div style={{textAlign:"center",padding:"3rem",color:C.seam}}>Loading workers…</div>:<Registry workers={workers} onSelect={w=>{setSelected(w);setSection("profile");}} onNew={startNew}/>)}
      {(section==="registry"&&selected||section==="profile"&&selected)&&<WorkerProfile worker={selected} onUpdate={updateWorker} onBack={()=>{setSection("registry");setSelected(null);}}/>}
      {section==="assessment"&&<AssessFlow onSave={saveWorker} savedId={savedId}/>}
      {section==="analytics"&&<Analytics workers={workers}/>}
    </div>
    <style>{`*{box-sizing:border-box;}body{margin:0;}input:focus,select:focus,textarea:focus{border-color:${C.bio}!important;outline:none;}`}</style>
  </div>;
}
