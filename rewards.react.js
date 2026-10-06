/* Minimal React rewards widget (UMD) — no build required.
   Adds tilt + fade effects and a simple confetti emoji burst on redeem.
*/
(function () {
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.warn('React or ReactDOM not found — rewards widget will not mount');
    return;
  }

  const e = React.createElement;

  const STORAGE_KEYS = {
    points: 'wastewise_points',
    history: 'wastewise_history',
    streak: 'wastewise_streak',
    lastDay: 'wastewise_last_day',
  };

  function loadStateLocal() {
    return {
      points: Number(localStorage.getItem(STORAGE_KEYS.points) || 0),
    };
  }

  function savePointsLocal(points) {
    localStorage.setItem(STORAGE_KEYS.points, String(points));
  }

  async function fetchRewards() {
    try {
      const resp = await fetch('/api/rewards');
      if (resp.ok) return await resp.json();
    } catch (e) {}
    return [
      { id: 'sticker_pack', title: 'Sticker Pack', cost: 30, description: 'A set of WasteWise neon stickers.' },
      { id: 'reusable_bottle', title: 'Reusable Bottle', cost: 120, description: 'Branded 500ml reusable bottle.' },
      { id: 'donation_5', title: 'Donate $5', cost: 200, description: 'Donate $5 to local cleanup initiatives.' },
    ];
  }

  function confettiBurst(container) {
    const emojis = ['🌿','✨','🎉','🌎','💚'];
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('span');
      span.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      span.style.position = 'absolute';
      span.style.left = (50 + (Math.random()-0.5)*120) + '%';
      span.style.top = '50%';
      span.style.fontSize = (14 + Math.random()*18) + 'px';
      span.style.opacity = '0.95';
      span.style.transform = `translateY(0) rotate(${Math.random()*60-30}deg)`;
      span.style.transition = 'transform 900ms cubic-bezier(.2,.9,.2,1), opacity 900ms ease';
      container.appendChild(span);
      requestAnimationFrame(() => {
        span.style.transform = `translateY(${ -120 - Math.random()*80 }px) translateX(${ (Math.random()-0.5)*160 }px) rotate(${Math.random()*360}deg)`;
        span.style.opacity = '0';
      });
      setTimeout(() => span.remove(), 1100 + Math.random()*400);
    }
  }

  function RewardCard({ reward, canRedeem, onRedeem }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(.2,.9,.2,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    }, []);

    function onMove(e) {
      const el = ref.current;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width/2)) / r.width;
      const dy = (e.clientY - (r.top + r.height/2)) / r.height;
      el.style.transform = `perspective(600px) rotateX(${ -dy*6 }deg) rotateY(${ dx*8 }deg) translateZ(0)`;
    }
    function onLeave() {
      const el = ref.current;
      el.style.transform = '';
    }

    return e('div', { className: 'reward-card', ref, onMouseMove: onMove, onMouseLeave: onLeave, style: { position: 'relative', overflow: 'hidden' } },
      e('h4', null, reward.title),
      e('p', { className: 'reward-meta' }, reward.description),
      e('div', { className: 'reward-actions' },
        e('strong', { style: { marginLeft: 'auto' } }, `${reward.cost} pts`),
        e('button', { className: 'btn btn-primary btn-sm', onClick: () => onRedeem(reward), disabled: !canRedeem }, 'Redeem')
      )
    );
  }

  function RewardsApp() {
    const [rewards, setRewards] = React.useState([]);
    const [points, setPoints] = React.useState(loadStateLocal().points);
    const [message, setMessage] = React.useState('');

    React.useEffect(() => {
      let mounted = true;
      fetchRewards().then((r) => { if (mounted) setRewards(r); });
      return () => { mounted = false; };
    }, []);

    async function redeem(reward) {
      setMessage('Processing redeem...');
      try {
        const res = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ rewardId: reward.id }) });
        if (!res.ok) throw new Error('redeem-failed');
        const json = await res.json();
        const remaining = Math.max(0, loadStateLocal().points - json.reward.cost);
        savePointsLocal(remaining);
        setPoints(remaining);
        setMessage(`Redeemed: ${json.reward.title} (cost ${json.reward.cost} pts)`);
        const grid = document.getElementById('rewardsGrid');
        if (grid) confettiBurst(grid);
        // notify global header refresh by calling refreshHeader if available
        if (typeof window.refreshHeader === 'function') window.refreshHeader();
      } catch (err) {
        setMessage('Redeem failed.');
      }
      setTimeout(() => setMessage(''), 2800);
    }

    return e('div', null,
      e('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' } },
        e('div', null, e('strong', null, 'Your points: '), e('span', null, points)),
        message ? e('div', { style: { marginLeft: '12px', color: 'var(--primary)' } }, message) : null
      ),
      e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' } },
        rewards.map((r) => e(RewardCard, { key: r.id, reward: r, canRedeem: points >= r.cost, onRedeem: redeem }))
      )
    );
  }

  function mount() {
    const mountPoint = document.getElementById('rewardsGrid');
    if (!mountPoint) return;
    window.__REACT_REWARDS_MOUNTED = true;
    ReactDOM.createRoot(mountPoint).render(e(RewardsApp));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else mount();

})();
