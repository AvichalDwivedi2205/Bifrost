// ── MISSIONS PAGES: Create + Live + History ───────────────

const { useState, useEffect, useRef } = React;

// ─── CREATE MISSION PAGE ──────────────────────────────────
function CreateMissionPage({ onNavigate }) {
  const [template, setTemplate]   = useState('trump');
  const [urgency,  setUrgency]    = useState('high');
  const [execMode, setExecMode]   = useState('guarded');
  const [verMode,  setVerMode]    = useState('hybrid');
  const [budget,   setBudget]     = useState('25.00');
  const [maxCall,  setMaxCall]    = useState('2.00');
  const [step,     setStep]       = useState(1); // 1=config, 2=review, 3=signing

  const templates = [
    { id:'trump',     label:'Trump Polymarket Demo', emoji:'🎯' },
    { id:'event',     label:'Event Trade Research',  emoji:'📅' },
    { id:'signal',    label:'Signal Hunt',           emoji:'📡' },
    { id:'monitor',   label:'Monitoring',            emoji:'👁' },
    { id:'custom',    label:'Custom',                emoji:'⚙️' },
  ];

  const agentTeam = [
    { emoji:'📰', role:'News',      name:'NewsAgent',      trust:96, color:'var(--purple)' },
    { emoji:'📈', role:'Market',    name:'MarketAgent',    trust:94, color:'var(--amber)'  },
    { emoji:'🔍', role:'Skeptic',   name:'SkepticAgent',   trust:92, color:'var(--red)'    },
    { emoji:'⚡', role:'Execution', name:'ExecutionAgent', trust:97, color:'var(--green)'  },
    { emoji:'✅', role:'Verifier',  name:'VerifierAgent',  trust:99, color:'var(--cyan)'   },
  ];

  const execModes = [
    { id:'manual',   label:'Manual Assist',    desc:'Operator approves every action' },
    { id:'guarded',  label:'Guarded Autonomy', desc:'Approve spend gates only' },
    { id:'full',     label:'Full Autonomy',    desc:'Agents run without interruption' },
  ];

  const verModes = [
    { id:'human',  label:'Human',  emoji:'👤' },
    { id:'hybrid', label:'Hybrid', emoji:'⚖️' },
    { id:'proof',  label:'Proof',  emoji:'🔐' },
    { id:'agent',  label:'Agent',  emoji:'🤖' },
  ];

  function handleLaunch() {
    setStep(3);
    setTimeout(() => onNavigate('live'), 1800);
  }

  return (
    <div className="fade-in" style={{maxWidth:900,margin:'0 auto'}}>
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {['Configure','Review Policy','Sign & Deploy'].map((s,i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2" style={{opacity: step > i ? 1 : step === i+1 ? 1 : 0.4}}>
              <div style={{
                width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,fontWeight:700,fontFamily:'var(--mono)',
                background: step > i+1 ? 'var(--green)' : step === i+1 ? 'var(--cyan)' : 'var(--bg4)',
                color: step >= i+1 ? '#000' : 'var(--text3)',
                border: step === i+1 ? '2px solid var(--cyan)' : '1px solid var(--border)',
              }}>{step > i+1 ? '✓' : i+1}</div>
              <span style={{fontSize:12,fontWeight:500,color: step === i+1 ? 'var(--text)' : 'var(--text3)'}}>{s}</span>
            </div>
            {i < 2 && <div style={{flex:1,height:1,background:'var(--border)'}}></div>}
          </React.Fragment>
        ))}
      </div>

      {step === 3 ? (
        <div className="card" style={{textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:20}}>🔐</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Signing Authorization…</div>
          <div style={{color:'var(--text3)',fontFamily:'var(--mono)',fontSize:12,marginBottom:24}}>
            Awaiting Phantom wallet signature
          </div>
          <div style={{width:200,margin:'0 auto'}}>
            <ProgressBar pct={85} color="var(--cyan)" height={3} />
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20}}>
          {/* Main form */}
          <div className="flex-col gap-4">
            {/* Template selector */}
            <div className="card">
              <div className="section-label mb-3">Mission Template</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {templates.map(t => (
                  <div key={t.id}
                    onClick={() => setTemplate(t.id)}
                    style={{
                      padding:'12px 8px',textAlign:'center',borderRadius:'var(--radius)',
                      border:`1px solid ${template===t.id ? 'var(--cyan)' : 'var(--border)'}`,
                      background: template===t.id ? 'var(--cyan-glow)' : 'var(--bg3)',
                      cursor:'pointer',transition:'all 0.15s',
                    }}>
                    <div style={{fontSize:20,marginBottom:6}}>{t.emoji}</div>
                    <div style={{fontSize:10,fontWeight:500,color: template===t.id ? 'var(--cyan)' : 'var(--text3)',lineHeight:1.3}}>{t.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Objective */}
            <div className="card">
              <div className="form-group">
                <label className="form-label">Mission Objective</label>
                <textarea className="form-input form-textarea"
                  defaultValue="Analyze Trump-linked Polymarket prediction markets for tradeable alpha signals. Cross-reference recent news events with on-chain orderflow to identify edge." />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Success Criteria</label>
                <textarea className="form-input form-textarea" style={{minHeight:60}}
                  defaultValue="Final verdict with confidence ≥ 0.7 and at least 3 verified market signals." />
              </div>
            </div>

            {/* Execution settings */}
            <div className="card">
              <div className="grid-2" style={{gap:16}}>
                <div>
                  <div className="section-label mb-3">Urgency</div>
                  <div className="seg-control">
                    {['critical','high','medium','low'].map(u => (
                      <div key={u} className={`seg-option${urgency===u?' active':''}`}
                        onClick={() => setUrgency(u)}>
                        {u.charAt(0).toUpperCase()+u.slice(1)}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="section-label mb-3">Verification Mode</div>
                  <div className="seg-control">
                    {verModes.map(v => (
                      <div key={v.id} className={`seg-option${verMode===v.id?' active':''}`}
                        onClick={() => setVerMode(v.id)}
                        style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
                        <span style={{fontSize:12}}>{v.emoji}</span> {v.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="section-label mb-3">Execution Mode</div>
              <div className="flex-col gap-2">
                {execModes.map(m => (
                  <div key={m.id}
                    onClick={() => setExecMode(m.id)}
                    style={{
                      display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                      borderRadius:'var(--radius)',cursor:'pointer',transition:'all 0.15s',
                      border:`1px solid ${execMode===m.id ? 'var(--cyan)' : 'var(--border)'}`,
                      background: execMode===m.id ? 'var(--cyan-glow)' : 'var(--bg3)',
                    }}>
                    <div style={{
                      width:16,height:16,borderRadius:'50%',flexShrink:0,
                      border:`2px solid ${execMode===m.id ? 'var(--cyan)' : 'var(--border2)'}`,
                      background: execMode===m.id ? 'var(--cyan)' : 'transparent',
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>
                      {execMode===m.id && <div style={{width:5,height:5,borderRadius:'50%',background:'#000'}}></div>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color: execMode===m.id ? 'var(--cyan)' : 'var(--text)'}}>{m.label}</div>
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="divider" />

              <div className="section-label mb-3">Budget Controls</div>
              <div className="grid-3" style={{gap:12}}>
                {[
                  {label:'Total Budget (USDC)',    val:budget,  setter:setBudget,  prefix:'$'},
                  {label:'Max Per Call (USDC)',     val:maxCall, setter:setMaxCall, prefix:'$'},
                  {label:'Approval Trigger (USDC)', val:'0.00',  setter:()=>{},     prefix:'$', locked:true},
                ].map(f => (
                  <div key={f.label}>
                    <label className="form-label">{f.label}</label>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:13}}>{f.prefix}</span>
                      <input
                        className="form-input"
                        style={{paddingLeft:22,fontFamily:'var(--mono)',opacity: f.locked ? 0.5 : 1}}
                        value={f.val}
                        readOnly={f.locked}
                        onChange={e => f.setter(e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: policy summary + agent team */}
          <div className="flex-col gap-4">
            {/* Agent team */}
            <div className="card">
              <div className="section-label mb-3">Curated Agent Team</div>
              <div className="flex-col gap-2">
                {agentTeam.map(ag => (
                  <div key={ag.role} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'var(--bg3)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                    <AgentAvatar emoji={ag.emoji} size={30} fontSize={14}
                      bg="var(--bg4)" border={`${ag.color.replace(')','/0.3)')}`} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{ag.name}</div>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>{ag.role.toUpperCase()}</div>
                    </div>
                    <div style={{fontFamily:'var(--mono)',fontSize:11,color:ag.color}}>{ag.trust}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Policy summary */}
            <div className="card card-glow-cyan">
              <div className="section-label mb-3">Policy Summary</div>
              {[
                {k:'Authority Wallet', v:'7xKp…3mFQ'},
                {k:'Template',         v: templates.find(t=>t.id===template)?.label || '—'},
                {k:'Budget Locked',    v:`$${budget} USDC`},
                {k:'Exec Mode',        v: execModes.find(e=>e.id===execMode)?.label || '—'},
                {k:'Verification',     v: verModes.find(v=>v.id===verMode)?.label || '—'},
                {k:'Challenge Window', v:'24h'},
                {k:'Human Approval',   v:'Every spend gate'},
              ].map(row => (
                <div key={row.k} className="chain-row">
                  <span className="chain-key">{row.k}</span>
                  <span className="chain-val">{row.v}</span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary"
              style={{justifyContent:'center',padding:'12px'}}
              onClick={() => step === 1 ? setStep(2) : handleLaunch()}>
              {step === 1 ? 'Review Policy →' : '🔐 Sign & Deploy Mission'}
            </button>
            {step === 2 && (
              <button className="btn btn-ghost btn-sm" style={{justifyContent:'center'}}
                onClick={() => setStep(1)}>← Back to Configure</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIVE EXECUTION PAGE ──────────────────────────────────
function LiveMissionPage({ onNavigate }) {
  const [approvalOpen, setApprovalOpen] = useState(true);
  const [spendPending, setSpendPending] = useState(true);
  const [elapsed, setElapsed]           = useState(144);
  const [activeTab, setActiveTab]       = useState('agents');

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const agents = [
    { emoji:'📰', name:'NewsAgent',    role:'News',      status:'settled',  action:'Synthesizing headline signals',  trust:96, spent:3.20, phases:['plan timeline','gather headlines','synthesize signal'], phaseDone:[0,1,2] },
    { emoji:'📈', name:'MarketAgent',  role:'Market',    status:'running',  action:'Scanning Polymarket orderflow',  trust:94, spent:1.80, phases:['map contracts','scan orderflow','rank markets'],      phaseDone:[0,1]   },
    { emoji:'🔍', name:'SkepticAgent', role:'Skeptic',   status:'pending',  action:'Awaiting market output',         trust:92, spent:0.00, phases:['replay timing','challenge thesis','score suspicion'], phaseDone:[]      },
    { emoji:'⚡', name:'ExecAgent',    role:'Execution', status:'pending',  action:'Queued',                         trust:97, spent:0.00, phases:['draft verdict','package artifact'],                  phaseDone:[]      },
    { emoji:'✅', name:'Verifier',     role:'Verify',    status:'pending',  action:'Queued',                         trust:99, spent:0.00, phases:['audit approvals','check artifacts','settle onchain'], phaseDone:[]      },
  ];

  const timeline = [
    { icon:'🔐', label:'Mission created',          detail:'Authority wallet signed',                  ts:'00:00', done:true  },
    { icon:'👥', label:'Agent lineup proposed',    detail:'5 agents curated from registry',           ts:'00:08', done:true  },
    { icon:'✔️', label:'Selection approved',       detail:'Operator approved via wallet sig',         ts:'00:42', done:true  },
    { icon:'📰', label:'NewsAgent: task started',  detail:'plan timeline → gather headlines',         ts:'01:15', done:true  },
    { icon:'💰', label:'Spend approved: $1.20',    detail:'Perplexity API · news scan',               ts:'01:30', done:true  },
    { icon:'📈', label:'MarketAgent: task started',detail:'map contracts → scan orderflow',           ts:'02:04', done:true  },
    { icon:'⏳', label:'Spend gate pending',        detail:'Polymarket API call · $0.80',             ts:'02:22', done:false },
  ];

  const tasks = [
    { id:'task-plan',    label:'Plan',      status:'settled', emoji:'📋' },
    { id:'task-news',    label:'News',      status:'settled', emoji:'📰' },
    { id:'task-market',  label:'Market',    status:'running', emoji:'📈' },
    { id:'task-skeptic', label:'Skeptic',   status:'pending', emoji:'🔍' },
    { id:'task-execute', label:'Execute',   status:'pending', emoji:'⚡' },
    { id:'task-verify',  label:'Verify',    status:'pending', emoji:'✅' },
  ];

  const taskColors = { settled:'var(--green)', running:'var(--cyan)', pending:'var(--text3)', failed:'var(--red)' };

  return (
    <div className="fade-in">
      {/* Mission header */}
      <div className="card mb-4" style={{padding:'16px 20px'}}>
        <div className="flex items-center gap-4">
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',marginBottom:4}}>msn_x7k2p · guarded autonomy · hybrid verify</div>
            <div style={{fontSize:18,fontWeight:700,letterSpacing:'-0.5px'}}>Trump Polymarket Alpha</div>
          </div>
          <Pill status="running" />
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--cyan)',letterSpacing:'-1px'}}>{fmt(elapsed)}</div>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>ELAPSED</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--amber)',letterSpacing:'-1px'}}>$20.00</div>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>REMAINING</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm">⏸ Pause</button>
            <button className="btn btn-danger btn-sm">■ Stop</button>
          </div>
        </div>
      </div>

      {/* Spend approval alert */}
      {spendPending && (
        <div className="card mb-4" style={{border:'1px solid oklch(0.80 0.155 55 / 0.5)',background:'var(--amber-glow)',padding:'16px 20px'}}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span style={{fontSize:16}}>⚠️</span>
              <span style={{fontWeight:700,color:'var(--amber)'}}>Spend Gate — Awaiting Approval</span>
            </div>
            <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>Fresh wallet sig required</span>
          </div>
          <div className="approval-card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span style={{fontWeight:600,color:'var(--text)'}}>Polymarket API</span>
                <span style={{marginLeft:8,fontFamily:'var(--mono)',fontSize:12,color:'var(--amber)'}}>$0.80 USDC</span>
              </div>
              <Pill status="pending" />
            </div>
            <div style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>
              MarketAgent requires access to scan active prediction market contracts and retrieve real-time orderflow data for Trump-linked events.
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => setSpendPending(false)}>✔ Approve</button>
              <button className="btn btn-danger btn-sm">✕ Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
        <div className="flex-col gap-4">
          {/* Tab nav */}
          <div style={{display:'flex',gap:2,background:'var(--bg3)',padding:3,borderRadius:'var(--radius)',border:'1px solid var(--border)',width:'fit-content'}}>
            {[{id:'agents',label:'Agents'},  {id:'tasks',label:'Task Graph'}, {id:'timeline',label:'Timeline'}].map(tab => (
              <div key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding:'6px 16px',borderRadius:6,fontSize:12,fontWeight:500,cursor:'pointer',
                  background: activeTab===tab.id ? 'var(--bg)' : 'transparent',
                  color: activeTab===tab.id ? 'var(--cyan)' : 'var(--text3)',
                  transition:'all 0.15s',
                }}>
                {tab.label}
              </div>
            ))}
          </div>

          {/* Agents tab */}
          {activeTab === 'agents' && (
            <div className="flex-col gap-3">
              {agents.map(ag => {
                const statusColor = {settled:'var(--green)',running:'var(--cyan)',pending:'var(--text3)'}[ag.status];
                return (
                  <div key={ag.name} className="card card-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <AgentAvatar emoji={ag.emoji} size={38} fontSize={18}
                        bg="var(--bg3)" border={statusColor}
                        ring={ag.status==='running' ? statusColor : undefined} />
                      <div style={{flex:1,minWidth:0}}>
                        <div className="flex items-center gap-2">
                          <span style={{fontWeight:700,fontSize:13}}>{ag.name}</span>
                          <Pill status={ag.status} />
                        </div>
                        <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:2}}>{ag.action}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--amber)'}}>
                          ${ag.spent.toFixed(2)}
                        </div>
                        <div style={{fontSize:10,color:'var(--text3)'}}>spent</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--cyan)'}}>{ag.trust}%</div>
                        <div style={{fontSize:10,color:'var(--text3)'}}>trust</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {ag.phases.map((ph,i) => (
                        <span key={ph} className={`phase-tag${ag.phaseDone.includes(i) ? ' done' : ag.phaseDone.length === i && ag.status==='running' ? ' running' : ''}`}>
                          {ag.phaseDone.includes(i) ? '✓ ' : ag.status==='running' && ag.phaseDone.length === i ? '● ' : ''}{ph}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tasks tab */}
          {activeTab === 'tasks' && (
            <div className="card">
              <div style={{display:'flex',alignItems:'center',gap:0,padding:'8px 0'}}>
                {tasks.map((task, i) => (
                  <React.Fragment key={task.id}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flex:1}}>
                      <div style={{
                        width:52,height:52,borderRadius:12,
                        border:`2px solid ${taskColors[task.status]}`,
                        background: task.status==='running' ? 'var(--cyan-glow)' : task.status==='settled' ? 'var(--green-glow)' : 'var(--bg3)',
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,
                        boxShadow: task.status==='running' ? '0 0 20px var(--cyan-glow)' : 'none',
                        position:'relative',
                      }}>
                        {task.emoji}
                        {task.status === 'running' && (
                          <div style={{position:'absolute',inset:-4,borderRadius:16,border:`1px solid var(--cyan)`,opacity:0.4,animation:'pulse-badge 1.5s ease-in-out infinite'}}></div>
                        )}
                        {task.status === 'settled' && (
                          <div style={{position:'absolute',top:-6,right:-6,width:16,height:16,borderRadius:'50%',background:'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#000'}}>✓</div>
                        )}
                      </div>
                      <div style={{fontSize:11,fontWeight:500,color:taskColors[task.status],fontFamily:'var(--mono)'}}>{task.label}</div>
                    </div>
                    {i < tasks.length - 1 && (
                      <div style={{
                        height:2,flex:'0 0 24px',
                        background: tasks[i].status==='settled' ? 'var(--green)' : 'var(--border)',
                        marginBottom:20,
                        boxShadow: tasks[i].status==='settled' ? '0 0 6px var(--green)' : 'none',
                      }}></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div className="card">
              {timeline.map((ev, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot${!ev.done ? ' active' : ''}`} style={{
                    background: ev.done ? 'var(--bg3)' : 'var(--cyan-glow)',
                    borderColor: ev.done ? 'var(--border)' : 'var(--cyan)',
                    fontSize:13,
                  }}>{ev.icon}</div>
                  <div className="timeline-body">
                    <div style={{fontSize:13,fontWeight:600,color: ev.done ? 'var(--text)' : 'var(--cyan)'}}>{ev.label}</div>
                    <div className="timeline-text">{ev.detail}</div>
                    <div className="timeline-ts">{ev.ts}</div>
                  </div>
                  {!ev.done && <Pill status="pending" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex-col gap-4">
          {/* Budget dashboard */}
          <div className="card">
            <div className="section-label mb-3">Budget</div>
            {agents.map(ag => (
              <div key={ag.name} style={{marginBottom:10}}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{fontSize:11,color:'var(--text2)'}}>{ag.emoji} {ag.name}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)'}}>
                    ${ag.spent.toFixed(2)} / $5.00
                  </span>
                </div>
                <ProgressBar pct={ag.spent/5*100} color="var(--amber)" height={3} />
              </div>
            ))}
            <div className="divider" />
            {[
              {label:'Total Spent',     val:'$5.00',  color:'var(--amber)'},
              {label:'Reserved',        val:'$5.00',  color:'var(--purple)'},
              {label:'Remaining',       val:'$20.00', color:'var(--green)'},
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between" style={{padding:'5px 0'}}>
                <span style={{fontSize:12,color:'var(--text3)'}}>{r.label}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:12,color:r.color}}>{r.val}</span>
              </div>
            ))}
            <div style={{marginTop:10}}>
              <ProgressBar pct={16.7} color="var(--amber)" height={6} />
            </div>
          </div>

          {/* Chain status */}
          <div className="card">
            <div className="section-label mb-3">Chain & RPC</div>
            {[
              {k:'Provider',   v:'RPC Fast'},
              {k:'Network',    v:'Devnet'},
              {k:'Streaming',  v:'✓ Enabled'},
              {k:'Program',    v:'BiFr…9mKz'},
              {k:'Mission PDA',v:'7xKp…3mFQ'},
            ].map(r => (
              <div key={r.k} className="chain-row">
                <span className="chain-key">{r.k}</span>
                <span className="chain-val" style={{color: r.k==='Streaming' ? 'var(--green)' : undefined}}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Latest receipt */}
          <div className="card">
            <div className="section-label mb-3">Latest Receipt</div>
            {[
              {k:'Mission',   v:'msn_x7k2p'},
              {k:'Agent',     v:'NewsAgent'},
              {k:'Service',   v:'Perplexity'},
              {k:'Amount',    v:'$1.20 USDC'},
              {k:'Purpose',   v:'News scan'},
              {k:'Tx',        v:'A1b2…F9kL'},
            ].map(r => (
              <div key={r.k} className="chain-row">
                <span className="chain-key">{r.k}</span>
                <span className="chain-val">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────
function HistoryPage({ onNavigate }) {
  const missions = [
    { id:'msn_x7k2p', title:'Trump Polymarket Alpha',   type:'Polymarket Demo', agents:5, spent:14.20, duration:'4m 12s', outcome:'BUY · 0.78 conf', status:'settled', tx:'Tz8qWp9s2nBV' },
    { id:'msn_m9j4r', title:'Event Trade Research',     type:'Event Research',  agents:3, spent:8.60,  duration:'3m 40s', outcome:'HOLD · 0.62 conf',status:'settled', tx:'Kj5rA1b2M3nQ' },
    { id:'msn_p3n8q', title:'Signal Hunt — Macro Pairs',type:'Signal Hunt',     agents:4, spent:11.40, duration:'5m 08s', outcome:'SELL · 0.71 conf',status:'settled', tx:'Wp9sF9kLPq7Z' },
    { id:'msn_f6t1w', title:'On-chain Monitoring Loop', type:'Monitoring',      agents:2, spent:3.80,  duration:'2m 22s', outcome:'ALERT issued',     status:'settled', tx:'Mx3pKj5rXt8V' },
    { id:'msn_d2v7k', title:'Polymarket Liquidity Scan',type:'Polymarket Demo', agents:2, spent:2.10,  duration:'0m 58s', outcome:'Verification fail', status:'failed',  tx:'F9kLTz8qRn4B' },
    { id:'msn_r8s5t', title:'Macro Signal Hunter v2',   type:'Signal Hunt',     agents:5, spent:18.90, duration:'6m 34s', outcome:'BUY · 0.85 conf',  status:'settled', tx:'Zn4BKj5rQp7T' },
  ];

  return (
    <div className="fade-in">
      <div className="kpi-grid mb-6" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <KpiCard label="Total Missions"     value="148"    accent="var(--cyan)"   />
        <KpiCard label="Settled"            value="139"    accent="var(--green)"  />
        <KpiCard label="Total Settled Value" value="$24.8K" accent="var(--amber)"  />
        <KpiCard label="Avg Budget Used"    value="68%"    accent="var(--purple)" />
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <SectionHeader title="Mission History" />
          <button className="btn btn-ghost btn-sm">↓ Export CSV</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Type</th>
              <th>Agents</th>
              <th>Spent</th>
              <th>Duration</th>
              <th>Outcome</th>
              <th>Status</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {missions.map(m => (
              <tr key={m.id} onClick={() => onNavigate('live')} style={{cursor:'pointer'}}>
                <td>
                  <div style={{fontWeight:600,color:'var(--text)',fontSize:13}}>{m.title}</div>
                  <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:2}}>{m.id}</div>
                </td>
                <td><span style={{fontSize:12,color:'var(--text2)'}}>{m.type}</span></td>
                <td><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text2)'}}>{m.agents}</span></td>
                <td><span className="text-amber mono">${m.spent.toFixed(2)}</span></td>
                <td><span className="text-dim mono">{m.duration}</span></td>
                <td><span style={{fontSize:12,color: m.status==='failed' ? 'var(--red)' : 'var(--green)'}}>{m.outcome}</span></td>
                <td><Pill status={m.status} /></td>
                <td><TxHash hash={m.tx} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { CreateMissionPage, LiveMissionPage, HistoryPage });
