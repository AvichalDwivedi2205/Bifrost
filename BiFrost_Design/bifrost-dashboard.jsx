// ── DASHBOARD PAGE ────────────────────────────────────────
// Hero with live agent network canvas + KPIs + recent missions

const { useState, useEffect, useRef, useCallback } = React;

// ── AGENT NETWORK CANVAS ─────────────────────────────────
function AgentNetworkCanvas({ width, height }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const AGENTS = [
      { id: 0, role: 'Coordinator', emoji: '🎯', color: '#22d3ee', x: 0, y: 0, vx: 0.28, vy: 0.18, pulsePhase: 0,   r: 26, tasks: 0 },
      { id: 1, role: 'News',        emoji: '📰', color: '#a78bfa', x: 0, y: 0, vx:-0.22, vy: 0.25, pulsePhase: 1.2, r: 22, tasks: 0 },
      { id: 2, role: 'Market',      emoji: '📈', color: '#fbbf24', x: 0, y: 0, vx: 0.30, vy:-0.20, pulsePhase: 2.1, r: 22, tasks: 0 },
      { id: 3, role: 'Skeptic',     emoji: '🔍', color: '#f472b6', x: 0, y: 0, vx:-0.18, vy:-0.28, pulsePhase: 0.7, r: 22, tasks: 0 },
      { id: 4, role: 'Execution',   emoji: '⚡', color: '#34d399', x: 0, y: 0, vx: 0.24, vy: 0.22, pulsePhase: 3.0, r: 22, tasks: 0 },
      { id: 5, role: 'Verifier',    emoji: '✅', color: '#22d3ee', x: 0, y: 0, vx:-0.25, vy: 0.18, pulsePhase: 1.8, r: 22, tasks: 0 },
      { id: 6, role: 'OpenClaw',    emoji: '🦀', color: '#fb923c', x: 0, y: 0, vx: 0.15, vy:-0.30, pulsePhase: 2.5, r: 20, tasks: 0 },
      { id: 7, role: 'Solana RPC',  emoji: '⛓',  color: '#818cf8', x: 0, y: 0, vx:-0.20, vy:-0.15, pulsePhase: 0.3, r: 20, tasks: 0 },
    ];

    // Spread initial positions
    AGENTS.forEach((a, i) => {
      const ang = (i / AGENTS.length) * Math.PI * 2;
      const rx  = width  * 0.28;
      const ry  = height * 0.30;
      a.x = width  / 2 + Math.cos(ang) * rx + (Math.random() - 0.5) * 60;
      a.y = height / 2 + Math.sin(ang) * ry + (Math.random() - 0.5) * 30;
    });

    // Data packets flying between nodes
    const packets = [];
    let pktId = 0;

    function spawnPacket(from, to) {
      packets.push({
        id: pktId++, from, to,
        t: 0, speed: 0.008 + Math.random() * 0.006,
        color: AGENTS[from].color,
      });
    }

    // Mission completion bursts
    const bursts = [];
    function spawnBurst(x, y, color) {
      bursts.push({ x, y, color, t: 0, r: 0 });
    }

    stateRef.current = { agents: AGENTS, packets, bursts };

    let frame = 0;
    let raf;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, width, height);

      const t = frame * 0.01;
      const agents = stateRef.current.agents;

      // ── background grid ───────────────────────────────
      ctx.save();
      ctx.strokeStyle = 'oklch(0.22 0.030 250 / 0.3)';
      ctx.lineWidth = 0.5;
      const gSize = 48;
      for (let x = 0; x < width; x += gSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.restore();

      // Occasionally spawn packets
      if (frame % 55 === 0) {
        const from = Math.floor(Math.random() * agents.length);
        let to = Math.floor(Math.random() * agents.length);
        if (to === from) to = (to + 1) % agents.length;
        spawnPacket(from, to);
      }

      // Occasionally spawn burst at random agent
      if (frame % 180 === 0) {
        const a = agents[Math.floor(Math.random() * agents.length)];
        spawnBurst(a.x, a.y, a.color);
        a.tasks++;
      }

      // ── draw edges ────────────────────────────────────
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const a = agents[i], b = agents[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 260) {
            const alpha = (1 - dist / 260) * 0.22;
            ctx.save();
            ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 8]);
            ctx.lineDashOffset = -frame * 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // ── draw packets ─────────────────────────────────
      const deadPkts = [];
      packets.forEach((pkt, idx) => {
        pkt.t += pkt.speed;
        if (pkt.t >= 1) { deadPkts.push(idx); return; }
        const a = agents[pkt.from], b = agents[pkt.to];
        const x = a.x + (b.x - a.x) * pkt.t;
        const y = a.y + (b.y - a.y) * pkt.t;
        ctx.save();
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = pkt.color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // trail
        ctx.save();
        ctx.strokeStyle = pkt.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        const trailT = Math.max(0, pkt.t - 0.08);
        ctx.moveTo(a.x + (b.x - a.x) * trailT, a.y + (b.y - a.y) * trailT);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      });
      deadPkts.reverse().forEach(i => packets.splice(i, 1));

      // ── draw agents ───────────────────────────────────
      agents.forEach(ag => {
        // Move
        ag.x += ag.vx; ag.y += ag.vy;
        if (ag.x < ag.r + 20) { ag.x = ag.r + 20; ag.vx *= -1; }
        if (ag.x > width  - ag.r - 20) { ag.x = width  - ag.r - 20; ag.vx *= -1; }
        if (ag.y < ag.r + 20) { ag.y = ag.r + 20; ag.vy *= -1; }
        if (ag.y > height - ag.r - 20) { ag.y = height - ag.r - 20; ag.vy *= -1; }

        const pulse = Math.sin(t * 2 + ag.pulsePhase) * 0.5 + 0.5;

        // Outer glow ring
        const grad = ctx.createRadialGradient(ag.x, ag.y, ag.r - 2, ag.x, ag.y, ag.r + 14 + pulse * 6);
        grad.addColorStop(0, ag.color + '40');
        grad.addColorStop(1, 'transparent');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ag.x, ag.y, ag.r + 14 + pulse * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Spinning orbit ring
        ctx.save();
        ctx.translate(ag.x, ag.y);
        ctx.rotate(t * 0.8 + ag.pulsePhase);
        ctx.strokeStyle = ag.color;
        ctx.globalAlpha = 0.35 + pulse * 0.15;
        ctx.lineWidth   = 1.2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, ag.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Node body
        ctx.save();
        ctx.shadowColor = ag.color;
        ctx.shadowBlur  = 12 + pulse * 8;
        ctx.fillStyle   = 'oklch(0.10 0.018 250)';
        ctx.strokeStyle = ag.color;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(ag.x - ag.r, ag.y - ag.r, ag.r * 2, ag.r * 2, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Emoji
        ctx.save();
        ctx.font      = `${ag.r}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ag.emoji, ag.x, ag.y + 1);
        ctx.restore();

        // Role label
        ctx.save();
        ctx.font      = '500 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ag.color;
        ctx.globalAlpha = 0.85;
        ctx.fillText(ag.role.toUpperCase(), ag.x, ag.y + ag.r + 12);
        ctx.restore();

        // Task counter
        if (ag.tasks > 0) {
          ctx.save();
          ctx.fillStyle = ag.color;
          ctx.shadowColor = ag.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(ag.x + ag.r - 4, ag.y - ag.r + 4, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ag.tasks, ag.x + ag.r - 4, ag.y - ag.r + 4);
          ctx.restore();
        }
      });

      // ── draw bursts ───────────────────────────────────
      const deadBursts = [];
      bursts.forEach((b, idx) => {
        b.t += 0.025; b.r += 3;
        if (b.t >= 1) { deadBursts.push(idx); return; }
        ctx.save();
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 1 - b.t;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      deadBursts.reverse().forEach(i => bursts.splice(i, 1));

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="hero-canvas" />;
}

// ── MISSION ROW ───────────────────────────────────────────
function MissionRow({ mission, onNavigate }) {
  return (
    <tr onClick={() => onNavigate('live')}>
      <td>
        <div style={{fontWeight:600,color:'var(--text)',fontSize:13}}>{mission.title}</div>
        <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:2}}>{mission.id}</div>
      </td>
      <td><Pill status={mission.status} /></td>
      <td>
        <div className="flex gap-2">
          {mission.agents.map((a,i) => (
            <AgentAvatar key={i} emoji={a.emoji} bg={a.bg} border={a.border} size={28} fontSize={12} />
          ))}
        </div>
      </td>
      <td><span className="text-amber mono">${mission.spent}</span></td>
      <td><span className="text-dim mono">{mission.duration}</span></td>
      <td><TxHash hash={mission.tx} /></td>
    </tr>
  );
}

// ── ON-CHAIN ACTIVITY ─────────────────────────────────────
function OnChainActivity() {
  const items = [
    { icon:'⚡', action:'spend_executed',       amount:'+$0.42', color:'var(--green)',  ts:'2s ago',  tx:'A1b2…F9kL' },
    { icon:'✅', action:'verification_approved', amount:null,     color:'var(--cyan)',   ts:'18s ago', tx:'Mx3p…7wQZ' },
    { icon:'🔐', action:'mission_created',       amount:null,     color:'var(--purple)', ts:'1m ago',  tx:'Tz8q…2nBV' },
    { icon:'💰', action:'allocation_settled',    amount:'+$12.80',color:'var(--green)',  ts:'3m ago',  tx:'Kj5r…0cYX' },
    { icon:'📋', action:'spend_approved',        amount:'$1.20',  color:'var(--amber)',  ts:'5m ago',  tx:'Wp9s…4mTR' },
  ];

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="activity-row">
          <div className="activity-icon">{item.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)'}}>{item.action}</div>
            <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{item.ts}</div>
          </div>
          {item.amount && <div style={{fontFamily:'var(--mono)',fontSize:11,color:item.color}}>{item.amount}</div>}
          <TxHash hash={item.tx} />
        </div>
      ))}
    </div>
  );
}

// ── DASHBOARD PAGE ────────────────────────────────────────
function DashboardPage({ onNavigate }) {
  const heroRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 320 });

  useEffect(() => {
    if (!heroRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      setDims({ w: e.contentRect.width, h: 320 });
    });
    ro.observe(heroRef.current);
    return () => ro.disconnect();
  }, []);

  const missions = [
    { id: 'msn_x7k2p', title: 'Trump Polymarket Alpha',      status: 'settled',           agents:[{emoji:'📰',bg:'oklch(0.12 0.02 290)',border:'oklch(0.72 0.175 290 / 0.4)'},{emoji:'📈',bg:'oklch(0.12 0.02 55)',border:'oklch(0.80 0.155 55 / 0.4)'},{emoji:'🔍',bg:'oklch(0.12 0.02 340)',border:'oklch(0.72 0.175 340 / 0.4)'},{emoji:'⚡',bg:'oklch(0.12 0.02 155)',border:'oklch(0.73 0.160 155 / 0.4)'}], spent:'14.20', duration:'4m 12s', tx:'Tz8qWp9s' },
    { id: 'msn_m9j4r', title: 'Event Trade Research',        status: 'running',            agents:[{emoji:'📰',bg:'oklch(0.12 0.02 290)',border:'oklch(0.72 0.175 290 / 0.4)'},{emoji:'📈',bg:'oklch(0.12 0.02 55)',border:'oklch(0.80 0.155 55 / 0.4)'}],                                                                                                                                                                                                                                                                                                                                                   spent:'3.80',  duration:'1m 44s', tx:'Kj5rA1b2' },
    { id: 'msn_p3n8q', title: 'Signal Hunt — Macro Pairs',   status: 'selection_pending',  agents:[{emoji:'🎯',bg:'oklch(0.12 0.02 195)',border:'oklch(0.76 0.175 195 / 0.4)'}],                                                                                                                                                                                                                                                                                                                                                                                                                              spent:'0.00',  duration:'—',       tx: null },
    { id: 'msn_f6t1w', title: 'On-chain Monitoring Loop',    status: 'settled',            agents:[{emoji:'✅',bg:'oklch(0.12 0.02 195)',border:'oklch(0.76 0.175 195 / 0.4)'},{emoji:'🔍',bg:'oklch(0.12 0.02 340)',border:'oklch(0.72 0.175 340 / 0.4)'}],                                                                                                                                                                                                                                                                                                                                                  spent:'8.60',  duration:'6m 05s', tx:'Mx3pWp9s' },
    { id: 'msn_d2v7k', title: 'Polymarket Liquidity Scan',   status: 'failed',             agents:[{emoji:'📈',bg:'oklch(0.12 0.02 55)',border:'oklch(0.80 0.155 55 / 0.4)'},{emoji:'🔍',bg:'oklch(0.12 0.02 340)',border:'oklch(0.72 0.175 340 / 0.4)'}],                                                                                                                                                                                                                                                                                                                                                   spent:'2.10',  duration:'0m 58s', tx:'F9kLKj5r' },
  ];

  return (
    <div className="fade-in">
      {/* ── Hero ── */}
      <div className="hero-section" ref={heroRef}>
        <AgentNetworkCanvas width={dims.w} height={dims.h} />
        <div className="scanlines" />
        <div className="hero-overlay">
          <div className="hero-eyebrow">Autonomous Mission OS</div>
          <h1 className="hero-h1">
            Deploy agents.<br />
            <em>Close missions.</em><br />
            Settle on-chain.
          </h1>
          <p className="hero-sub">
            Governed multi-agent workflows with wallet-signed approvals,
            human-in-the-loop gates, and verifiable on-chain settlement.
          </p>
          <div className="flex gap-3">
            <button className="btn btn-primary" onClick={() => onNavigate('create')}>
              {NavIcons.plus} Launch Mission
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('live')}>
              View Live ›
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid mb-6">
        <KpiCard label="Missions Complete"  value="148"      delta="12 this week"   accent="var(--cyan)"   />
        <KpiCard label="Agent Tasks Run"    value="1,842"    delta="204 today"      accent="var(--purple)" />
        <KpiCard label="Total Value Settled" value="$24.8K"  delta="$1.2K today"   accent="var(--amber)"  />
        <KpiCard label="Verification Pass"  value="97.3%"   delta="0.4% vs last wk" deltaDir="up" accent="var(--green)" />
      </div>

      {/* ── Bottom row ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16}}>
        {/* Recent Missions */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'18px 20px 14px', borderBottom:'1px solid var(--border)'}}>
            <SectionHeader title="Recent Missions"
              action={() => onNavigate('history')} actionLabel="All History →" />
          </div>
          <table className="data-table" style={{width:'100%'}}>
            <thead>
              <tr>
                <th>Mission</th>
                <th>Status</th>
                <th>Agents</th>
                <th>Spent</th>
                <th>Duration</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {missions.map(m => (
                <MissionRow key={m.id} mission={m} onNavigate={onNavigate} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex-col gap-4">
          {/* On-chain activity */}
          <div className="card" style={{flex:'0 0 auto'}}>
            <SectionHeader title="On-Chain Activity" />
            <OnChainActivity />
          </div>

          {/* Mission snapshot */}
          <div className="card card-glow-amber" style={{flex:'0 0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div className="section-title">Active Mission</div>
              <Pill status="running" />
            </div>
            <div style={{fontWeight:600,color:'var(--text)',marginBottom:12}}>Trump Polymarket Alpha</div>
            {[
              {label:'Budget Remaining', val:'$11.20', color:'var(--amber)'},
              {label:'Verifications',    val:'6 / 8',  color:'var(--cyan)'},
              {label:'Receipts',         val:'14',     color:'var(--green)'},
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between" style={{padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:12,color:'var(--text3)'}}>{row.label}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:12,color:row.color}}>{row.val}</span>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" style={{width:'100%',marginTop:14,justifyContent:'center'}}
              onClick={() => onNavigate('live')}>
              Open Live View →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
