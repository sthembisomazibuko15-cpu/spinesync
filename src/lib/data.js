import { supabase } from './supabase';

// ── AUTH
export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (!error && data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id, full_name: fullName, approved: false, role: 'biokineticist'
    });
  }
  return { data, error };
}
export async function signOut() { return await supabase.auth.signOut(); }
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
export async function getProfile(userId) {
  return await supabase.from('profiles').select('*').eq('id', userId).single();
}

// ── WORKERS
export async function fetchWorkers() {
  const { data, error } = await supabase.from('workers').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToWorker);
}
export async function createWorker(worker) {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('workers').insert(workerToRow(worker, user?.id)).select().single();
  if (error) { console.error(error); return null; }
  return rowToWorker(data);
}
export async function updateWorker(worker) {
  const row = workerToRow(worker);
  delete row.created_by;
  const { data, error } = await supabase.from('workers').update(row).eq('id', worker.id).select().single();
  if (error) { console.error(error); return null; }
  return rowToWorker(data);
}

function rowToWorker(r) {
  return {
    id: r.id, name: r.name, empId: r.emp_id, role: r.role, age: r.age,
    yearsInRole: r.years_in_role, assessType: r.assess_type, notes: r.notes,
    risk: r.risk, riskPct: r.risk_pct, programStarted: r.program_started,
    weeksDone: r.weeks_done, fcePending: r.fce_pending, fceComplete: r.fce_complete,
    fceResults: r.fce_results || {}, exerciseChecked: r.exercise_checked || {},
    assessedDate: r.assessed_date, consentShared: r.consent_shared || false,
    siteId: r.site_id,
  };
}
function workerToRow(w, createdBy) {
  const r = {
    name: w.name, emp_id: w.empId, role: w.role, age: w.age,
    years_in_role: w.yearsInRole, assess_type: w.assessType, notes: w.notes,
    risk: w.risk, risk_pct: w.riskPct, program_started: w.programStarted,
    weeks_done: w.weeksDone, fce_pending: w.fcePending, fce_complete: w.fceComplete,
    fce_results: w.fceResults || {}, exercise_checked: w.exerciseChecked || {},
    assessed_date: w.assessedDate, consent_shared: w.consentShared || false,
    site_id: w.siteId || null,
  };
  if (createdBy) r.created_by = createdBy;
  return r;
}

// ── ASSESSMENTS
export async function saveAssessmentRecord(workerId, assessType, scores, risk) {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('assessments').insert({
    worker_id: workerId, created_by: user?.id,
    assess_type: assessType, scores,
    risk_tier: risk.tier, risk_pct: risk.pct, risk_action: risk.action,
  }).select().single();
  if (error) console.error(error);
  return data;
}

// ── NOTES
export async function fetchNotes(workerId) {
  const { data, error } = await supabase.from('clinical_notes')
    .select('*').eq('worker_id', workerId).order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(n => ({
    text: n.text, author: n.author,
    date: new Date(n.created_at).toLocaleDateString('en-ZA'),
  }));
}
export async function addNote(workerId, text, author = 'Attending BK') {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('clinical_notes')
    .insert({ worker_id: workerId, created_by: user?.id, text, author }).select().single();
  if (error) console.error(error);
  return data;
}

// ── CONSENT TOGGLE (Biokineticist only)
export async function toggleConsent(workerId, value) {
  const { data, error } = await supabase.from('workers')
    .update({ consent_shared: value }).eq('id', workerId).select().single();
  if (error) { console.error(error); return null; }
  return rowToWorker(data);
}

// ── SITE REPORT (Mine client view — anonymised unless consented)
export async function fetchSiteReport(siteId) {
  const { data, error } = await supabase.from('workers')
    .select('id, name, emp_id, role, risk, risk_pct, program_started, weeks_done, fce_pending, fce_complete, assessed_date, consent_shared')
    .eq('site_id', siteId);
  if (error) { console.error(error); return []; }
  return (data || []).map((w, i) => ({
    id: w.id,
    displayName: w.consent_shared ? w.name : `Worker ${i + 1}`,
    displayId: w.consent_shared ? w.emp_id : '—',
    role: w.role,
    risk: w.risk,
    riskPct: w.risk_pct,
    programStarted: w.program_started,
    weeksDone: w.weeks_done,
    fcePending: w.fce_pending,
    fceComplete: w.fce_complete,
    assessedDate: w.assessed_date,
    consentShared: w.consent_shared,
  }));
}
