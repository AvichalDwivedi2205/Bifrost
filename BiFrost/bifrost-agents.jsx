// ── REGISTRY + PROFILE + ANALYTICS PAGES ─────────────────

const { useState, useEffect } = React;

// ─── REGISTRY PAGE ────────────────────────────────────────
function RegistryPage({ onNavigate }) {
  const [search, setSearch]     = useState('');
  const [domFilter, setDom]     = useState('all');
  const [trustFilter, setTrust] = useState('all');

  const agents = [
    { id:'news-01',    emoji:'📰', name:'NewsAgent',       domain:'Research',  desc:'Builds public signal timelines from news APIs and web search. Specializes in political and macro events.',    caps:['news-scan','web-search','timeline'], phases:['plan','gather','synthesize'], trust:96, missions:148, available:true,  color:'oklch(0.72 0.175 290)' },
    { id:'market-01',  emoji:'📈', name:'MarketAgent',     domain:'Finance',   desc:'Scans prediction markets and live orderflow. Identifies price anomalies and maps on-chain contract activity.',  caps:['polymarket','orderflow','ranking'],  phases:['map','scan','rank'],          trust:94, missions:112, available:true,  color:'oklch(0.80 0.155 55)'  },
    { id:'skeptic-01', emoji:'🔍', name:'SkepticAgent',    domain:'Analysis',  desc:'Adversarial reasoning agent. Challenges every thesis, assigns suspicion scores, and flags weak evidence.',      caps:['reasoning','scoring','challenge'],   phases:['replay','challenge','score'],  trust:92, missions:98,  available:true,  color:'oklch(0.65 0.185 25)'  },
    { id:'exec-01',    emoji:'⚡', name:'ExecutionAgent',  domain:'Strategy',  desc:'Packages final mission artifacts. Produces structured verdicts with confidence scores and key decision points.', caps:['synthesis','verdict','packaging'],   phases:['draft','package'],            trust:97, missions:148, available:true,  color:'oklch(0.73 0.160 155)' },
    { id:'verify-01',  emoji:'✅', name:'VerifierAgent',   domain:'Compliance',desc:'Cryptographic verification of all outputs. Submits proof bundles on-chain and computes reputation deltas.',     caps:['verification','proof','on-chain'],  phases:['audit','check','settle'],     trust:99, missions:148, available:true,  color:'oklch(0.76 0.175 195)' },
    { id:'coord-01',   emoji:'🎯', name:'CoordinatorAgent',domain:'Research',  desc:'Breaks complex missions into deterministic task graphs. Routes agents and manages dependency ordering.',        caps:['planning','routing','dependency'],   phases:['decompose','route'],          trust:95, missions:42,  available:false, color:'oklch(0.76 0.175 195)' },
    { id:'risk-01',    emoji:'⚖️', name:'RiskAgent',       domain:'Finance',   desc:'Computes risk exposure and determines whether simulation is required before live execution.',                    caps:['risk-score','simulation','flagging'],phases:['compute','simulate'],         trust:90, missions:28,  available:true,  color:'oklch(0.80 0.155 55)'  },
    { id:'claw-01',    emoji:'🦀', name:'OpenClawAgent',   domain:'Research',  desc:'Autonomous web crawler and structured extractor. Handles complex multi-step retrieval across domains.',          caps:['crawl','extract','scrape'],         phases:['crawl','parse','structure'],  trust:88, missions:19,  available:true,  color:'oklch(0.72 0.175 25)'  },
  ];

  const domains = ['all','Research','Finance','Analysis','Strategy','Compliance'];

  const filtered = agents.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.caps.some(c => c.includes(q)) || a.domain.toLowerCase().includes(q);
    const matchD = domFilter === 'all' || a.domain === domFilter;
    const matchT = trustFilter === 'all' || (trustFilter === 'high' ? a.trust >= 95 : a.trust < 95);
    return matchQ && matchD && matchT;
  });

  return (
    <div className="fade-in">
      {/* Search + Filters */}
      <div className="card mb-4" style={{padding:'14px 16px'}}>
        <div className="flex items-center gap-3">
          <div className="search-input-wrap" style={{flex:1}}>
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </span>
            <input className="form-input" placeholder="Search by name, capability, domain…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-chips">
            {domains.map(d => (
              <div key={d} className={`chip${domFilter===d?' active':''}`} onClick={() => setDom(d)}>
                {d === 'all' ? 'All Domains' : d}
              </div>
            ))}
          </div>
          <div className="filter-chips">
            {[{id:'all',label:'All Trust'},{id:'high',label:'Trust ≥ 95'},{id:'low',label:'Trust < 95'}].map(t => (
              <div key={t.id} className={`chip${trustFilter===t.id?' active':''}`} onClick={() => setTrust(t.id)}>
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Total Agents',    val:agents.length,                     color:'var(--cyan)'   },
          {label:'Available Now',   val:agents.filter(a=>a.available).length, color:'var(--green)'},
          {label:'Avg Trust Score', val:'94.5%',                           color:'var(--amber)'  },
          {label:'Total Missions',  val:'743',                             color:'var(--purple)' },
        ].map(s => (
          <div key={s.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 16px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.label}</div>
            <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Agent grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
        {filtered.map(ag => (
          <div key={ag.id} className="agent-card" onClick={() => onNavigate('profile')}
            style={{'--accent': ag.color}}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div style={{
                width:44,height:44,borderRadius:12,
                background:`${ag.color}18`,
                border:`1.5px solid ${ag.color}50`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
                flexShrink:0,
              }}>{ag.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{ag.name}</div>
                <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{ag.domain}</div>
              </div>
              <div>
                {ag.available
                  ? <span className="pill pill-green" style={{fontSize:10}}><span className="pill-dot" style={{background:'var(--green)'}}></span>Active</span>
                  : <span className="pill pill-muted"  style={{fontSize:10}}><span className="pill-dot" style={{background:'var(--text3)'}}></span>Busy</span>
                }
              </div>
            </div>

            {/* Description */}
            <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.55,marginBottom:12,
              display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
              {ag.desc}
            </p>

            {/* Capabilities */}
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
              {ag.caps.map(c => (
                <span key={c} style={{
                  fontFamily:'var(--mono)',fontSize:10,padding:'2px 7px',borderRadius:4,
                  background:`${ag.color}14`,border:`1px solid ${ag.color}30`,color:ag.color,
                }}>{c}</span>
              ))}
              {ag.phases.map(p => (
                <span key={p} className="phase-tag">{p}</span>
              ))}
            </div>

            {/* Trust + missions */}
            <div className="flex items-center gap-3">
              <div style={{flex:1}}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>TRUST SCORE</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:ag.color}}>{ag.trust}%</span>
                </div>
                <ProgressBar pct={ag.trust} color={ag.color} height={3} />
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text2)'}}>{ag.missions}</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>missions</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────
function ProfilePage({ onNavigate }) {
  const agent = {
    emoji:'📰', name:'NewsAgent', domain:'Research', id:'news-01',
    wallet:'9Jmk…7Rp2', status:'active', trust:96, missions:148, passRate:97.3, avgSpend:3.80,
    color:'oklch(0.72 0.175 290)',
    desc:'NewsAgent builds comprehensive public signal timelines from live news APIs, web search, and social data aggregators. Specializes in political, macro, and event-driven contexts. Used as the primary research anchor for multi-agent missions requiring factual grounding.',
    caps:['news-scan','web-search','timeline-build','signal-synthesis'],
    phases:['plan timeline','gather headlines','synthesize signal'],
    trustDimensions:[
      {label:'Output Fidelity',     score:97, color:'var(--cyan)'   },
      {label:'Source Attribution',  score:95, color:'var(--purple)' },
      {label:'Deadline Adherence',  score:98, color:'var(--green)'  },
      {label:'Budget Compliance',   score:99, color:'var(--amber)'  },
      {label:'Receipt Accuracy',    score:96, color:'var(--cyan)'   },
    ],
    history:[
      {id:'msn_x7k2p', title:'Trump Polymarket Alpha', delta:'+2',  outcome:'settled', ts:'2h ago'   },
      {id:'msn_m9j4r', title:'Event Trade Research',   delta:'+1',  outcome:'settled', ts:'6h ago'   },
      {id:'msn_p3n8q', title:'Signal Hunt v3',         delta:'+1',  outcome:'settled', ts:'1d ago'   },
      {id:'msn_d2v7k', title:'Polymarket Liquidity',   delta:'-3',  outcome:'failed',  ts:'2d ago'   },
      {id:'msn_r8s5t', title:'Macro Signal Hunter',    delta:'+2',  outcome:'settled', ts:'3d ago'   },
    ],
  };

  return (
    <div className="fade-in" style={{maxWidth:960,margin:'0 auto'}}>
      {/* Profile header */}
      <div className="card mb-4" style={{padding:'24px 28px'}}>
        <div className="flex items-center gap-5">
          <div style={{
            width:72,height:72,borderRadius:18,fontSize:32,
            background:`${agent.color}18`,border:`2px solid ${agent.color}50`,
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
          }}>{agent.emoji}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="flex items-center gap-3 mb-1">
              <h1 style={{fontSize:24,fontWeight:700,letterSpacing:'-0.5px'}}>{agent.name}</h1>
              <Pill status="active" />
              <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--cyan)',background:'var(--cyan-glow)',padding:'2px 8px',borderRadius:4,border:'1px solid oklch(0.76 0.175 195 / 0.3)'}}>
                ✓ Verifier Compatible
              </span>
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginBottom:8}}>
              {agent.domain} · {agent.wallet} · ID: {agent.id}
            </div>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.55,maxWidth:600}}>{agent.desc}</p>
          </div>
          <button className="btn btn-primary">Assign to Mission</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Missions',     val:agent.missions, color:'var(--cyan)'   },
          {label:'Pass Rate',    val:`${agent.passRate}%`,color:'var(--green)'},
          {label:'Avg Spend',    val:`$${agent.avgSpend}`,color:'var(--amber)'},
          {label:'Trust Score',  val:`${agent.trust}%`,color:agent.color    },
        ].map(k => (
          <div key={k.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'16px 18px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:k.color,opacity:0.7}}></div>
            <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{k.label}</div>
            <div style={{fontSize:24,fontWeight:700,fontFamily:'var(--mono)',color:k.color,letterSpacing:'-1px'}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Trust dimensions */}
        <div className="card">
          <div className="section-label mb-4">Trust Dimensions</div>
          {agent.trustDimensions.map(td => (
            <div key={td.label} style={{marginBottom:14}}>
              <div className="flex items-center justify-between mb-2">
                <span style={{fontSize:12,color:'var(--text2)'}}>{td.label}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:td.color}}>{td.score}%</span>
              </div>
              <ProgressBar pct={td.score} color={td.color} height={4} />
            </div>
          ))}
        </div>

        {/* Reputation history */}
        <div className="card">
          <div className="section-label mb-3">Reputation History</div>
          {agent.history.map(h => (
            <div key={h.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{
                fontFamily:'var(--mono)',fontSize:13,fontWeight:700,
                color: h.delta.startsWith('+') ? 'var(--green)' : 'var(--red)',
                minWidth:28,textAlign:'center',
              }}>{h.delta}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.title}</div>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:2}}>{h.id} · {h.ts}</div>
              </div>
              <Pill status={h.outcome} />
            </div>
          ))}
        </div>

        {/* Capabilities + phases */}
        <div className="card">
          <div className="section-label mb-3">Capabilities</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:20}}>
            {agent.caps.map(c => (
              <span key={c} style={{
                fontFamily:'var(--mono)',fontSize:11,padding:'4px 10px',borderRadius:6,
                background:`${agent.color}14`,border:`1px solid ${agent.color}35`,color:agent.color,
              }}>{c}</span>
            ))}
          </div>
          <div className="section-label mb-3">Phase Schema</div>
          <div className="flex gap-2 flex-wrap">
            {agent.phases.map((ph, i) => (
              <React.Fragment key={ph}>
                <span className="phase-tag done">✓ {ph}</span>
                {i < agent.phases.length - 1 && <span style={{color:'var(--text3)',alignSelf:'center'}}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* On-chain identity */}
        <div className="card">
          <div className="section-label mb-3">On-Chain Identity</div>
          {[
            {k:'Agent ID',       v:'news-01'},
            {k:'Payout Wallet',  v:'9Jmk…7Rp2'},
            {k:'Verifier',       v:'BiFr…9mKz'},
            {k:'Capability Hash',v:'a3f8…9c2d'},
            {k:'Metadata Hash',  v:'7b1e…4a8f'},
            {k:'Program Account',v:'Registered ✓'},
          ].map(r => (
            <div key={r.k} className="chain-row">
              <span className="chain-key">{r.k}</span>
              <span className="chain-val" style={{color: r.k==='Program Account' ? 'var(--green)' : undefined}}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS PAGE ───────────────────────────────────────
function AnalyticsPage() {
  const services = [
    {name:'Perplexity API',  calls:842, pct:92, spend:186.20},
    {name:'Polymarket API',  calls:623, pct:68, spend:124.60},
    {name:'OpenRouter',      calls:511, pct:56, spend:210.44},
    {name:'CoinGecko',       calls:389, pct:42, spend:38.90},
    {name:'Brave Search',    calls:244, pct:27, spend:24.40},
  ];

  const topAgents = [
    {emoji:'✅',name:'VerifierAgent',trust:99, missions:148,delta:'+0.2%'},
    {emoji:'⚡',name:'ExecutionAgent',trust:97,missions:148,delta:'+0.1%'},
    {emoji:'📰',name:'NewsAgent',    trust:96, missions:148,delta:'+0.4%'},
    {emoji:'🎯',name:'CoordinatorAgent',trust:95,missions:42,delta:'-0.1%'},
    {emoji:'📈',name:'MarketAgent',  trust:94, missions:112,delta:'+0.3%'},
  ];

  const instrCounts = [
    {name:'create_mission',    count:148, color:'var(--cyan)'   },
    {name:'fund_mission',      count:148, color:'var(--cyan)'   },
    {name:'request_spend',     count:1420,color:'var(--amber)'  },
    {name:'approve_spend',     count:1380,color:'var(--green)'  },
    {name:'execute_spend',     count:1372,color:'var(--green)'  },
    {name:'submit_verification',count:148,color:'var(--purple)' },
    {name:'settle_allocation', count:139, color:'var(--green)'  },
  ];

  return (
    <div className="fade-in">
      {/* Summary KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        <KpiCard label="Completion Rate" value="93.9%"  delta="+1.2% vs last month" accent="var(--green)"  />
        <KpiCard label="Avg Duration"    value="4m 08s" delta="-22s improvement"     accent="var(--cyan)"   />
        <KpiCard label="Avg USDC/Mission" value="$16.76" delta="+$1.20 this week"    accent="var(--amber)"  />
        <KpiCard label="Verify Pass Rate" value="97.3%"  delta="+0.4%"              accent="var(--purple)" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        {/* Top services */}
        <div className="card">
          <SectionHeader title="Top Services by Usage" />
          {services.map(s => (
            <div key={s.name} className="usage-bar-row">
              <span className="usage-bar-label">{s.name}</span>
              <div className="usage-bar-track">
                <div className="usage-bar-fill" style={{width:`${s.pct}%`}}></div>
              </div>
              <span className="usage-bar-val">{s.calls}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)',minWidth:60,textAlign:'right'}}>
                ${s.spend.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Top agents leaderboard */}
        <div className="card">
          <SectionHeader title="Top Agents by Trust" />
          {topAgents.map((a, i) => (
            <div key={a.name} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:'var(--text3)',minWidth:20,textAlign:'center'}}>
                {i+1}
              </div>
              <div style={{fontSize:18}}>{a.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{a.name}</div>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:1}}>{a.missions} missions</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:'var(--cyan)'}}>{a.trust}%</div>
                <div style={{fontFamily:'var(--mono)',fontSize:10,color: a.delta.startsWith('+') ? 'var(--green)' : 'var(--red)'}}>{a.delta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* On-chain instruction counts */}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <SectionHeader title="On-Chain Program Instruction Counts" />
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm">7D</button>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--cyan)',borderColor:'oklch(0.76 0.175 195 / 0.4)',background:'var(--cyan-glow)'}}>30D</button>
            <button className="btn btn-ghost btn-sm">All</button>
            <button className="btn btn-ghost btn-sm">↓ Export</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
          {instrCounts.map(ins => (
            <div key={ins.name} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 14px'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>
                {ins.name}
              </div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:ins.color,letterSpacing:'-1px'}}>
                {ins.count.toLocaleString()}
              </div>
              <div style={{marginTop:8}}>
                <ProgressBar pct={(ins.count/1500)*100} color={ins.color} height={2} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RegistryPage, ProfilePage, AnalyticsPage });
