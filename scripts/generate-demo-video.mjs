import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("/tmp/ontime_demo", { recursive: true });

// 1. Create Title Card Slide
const titleHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    width: 1280px;
    height: 720px;
    background: #09090b;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .mark {
    width: 80px;
    height: 80px;
    margin-bottom: 24px;
  }
  h1 {
    font-size: 56px;
    font-weight: 700;
    margin: 0 0 12px 0;
    letter-spacing: -0.03em;
  }
  .tagline {
    font-size: 24px;
    color: #a1a1aa;
    margin: 0 0 40px 0;
    font-weight: 400;
  }
  .pills {
    display: flex;
    gap: 16px;
  }
  .pill {
    background: #18181b;
    border: 1px solid #27272a;
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 14px;
    color: #d4d4d8;
  }
</style>
</head>
<body>
  <svg class="mark" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#18181b" stroke="#27272a" stroke-width="1"></rect>
    <circle cx="16" cy="16" r="10.5" fill="none" stroke="#3f3f46" stroke-width="1"></circle>
    <circle cx="16" cy="16" r="9" fill="none" stroke="#ffffff" stroke-width="1.25"></circle>
    <line x1="16" y1="8" x2="16" y2="9.5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"></line>
    <line x1="24" y1="16" x2="22.5" y2="16" stroke="#ffffff" stroke-width="1" stroke-linecap="round"></line>
    <line x1="16" y1="24" x2="16" y2="22.5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"></line>
    <line x1="8" y1="16" x2="9.5" y2="16" stroke="#ffffff" stroke-width="1" stroke-linecap="round"></line>
    <circle cx="16" cy="16" r="1.2" fill="#ffffff"></circle>
    <line x1="16" y1="16" x2="12" y2="11.5" stroke="#ffffff" stroke-width="1.25" stroke-linecap="round"></line>
    <line x1="16" y1="16" x2="21" y2="10.5" stroke="#ffffff" stroke-width="1.25" stroke-linecap="round"></line>
  </svg>
  <h1>On-Time</h1>
  <p class="tagline">On Time all the time</p>
  <div class="pills">
    <span class="pill">PostgreSQL 18 mTLS</span>
    <span class="pill">Row-Level Security</span>
    <span class="pill">Google Calendar OAuth</span>
    <span class="pill">Stripe Payments</span>
    <span class="pill">Always Free ARM64</span>
  </div>
</body>
</html>
`;
writeFileSync("/tmp/ontime_demo/slide1.html", titleHtml);

// 2. Create Architecture Highlights Slide
const archHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    width: 1280px;
    height: 720px;
    background: #09090b;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 60px;
  }
  h2 {
    font-size: 38px;
    font-weight: 700;
    margin: 0 0 10px 0;
    letter-spacing: -0.02em;
  }
  p.sub {
    font-size: 18px;
    color: #a1a1aa;
    margin: 0 0 40px 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    width: 100%;
    max-width: 1100px;
  }
  .card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 12px;
    padding: 24px;
  }
  .card h3 {
    font-size: 18px;
    margin: 0 0 8px 0;
    color: #ffffff;
  }
  .card p {
    font-size: 14px;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <h2>Audited Production Topology</h2>
  <p class="sub">Engineered for security, tenant separation, and zero operational downtime.</p>
  <div class="grid">
    <div class="card">
      <h3>🛡️ Row-Level Security</h3>
      <p>Kernel-enforced PostgreSQL 18 RLS policies guarantee multi-tenant segregation via HMAC signed session tokens.</p>
    </div>
    <div class="card">
      <h3>🔒 Authenticated Proxy</h3>
      <p>Zero-trust ingress via Caddy with Let's Encrypt TLS and cryptographic proxy secret validation.</p>
    </div>
    <div class="card">
      <h3>⚡ Dedicated Worker</h3>
      <p>Continuous outbox processing polling every 5s for Google Calendar sync, Stripe webhooks, and SMTP emails.</p>
    </div>
    <div class="card">
      <h3>🔑 Role Separation</h3>
      <p>5 segregated database credentials with explicit limits: owner, app, worker, migration, and monitor.</p>
    </div>
    <div class="card">
      <h3>📦 Read-Only Container</h3>
      <p>Hardened Next.js standalone container running as unprivileged user with read-only rootfs and tmpfs scratch.</p>
    </div>
    <div class="card">
      <h3>🚀 Always Free Tier</h3>
      <p>Deploys seamlessly on Oracle Cloud Always Free Ampere A1 ARM64 infrastructure with $0/mo cost.</p>
    </div>
  </div>
</body>
</html>
`;
writeFileSync("/tmp/ontime_demo/slide2.html", archHtml);

console.log("Rendering slides...");
execSync("brave-browser --headless --disable-gpu --window-size=1280,720 --screenshot=/tmp/ontime_demo/frame_01.png file:///tmp/ontime_demo/slide1.html");
execSync("brave-browser --headless --disable-gpu --window-size=1280,720 --screenshot=/tmp/ontime_demo/frame_02.png https://ontime.alloyce.duckdns.org/book/strategy-call");
execSync("brave-browser --headless --disable-gpu --window-size=1280,720 --screenshot=/tmp/ontime_demo/frame_03.png file:///tmp/ontime_demo/slide2.html");
execSync("brave-browser --headless --disable-gpu --window-size=1280,720 --screenshot=/tmp/ontime_demo/frame_04.png https://ontime.alloyce.duckdns.org/dashboard");

console.log("Creating video with ffmpeg...");
// Each frame shown for 3.5 seconds
const ffmpegInput = `
file '/tmp/ontime_demo/frame_01.png'
duration 3.5
file '/tmp/ontime_demo/frame_02.png'
duration 4.0
file '/tmp/ontime_demo/frame_03.png'
duration 4.0
file '/tmp/ontime_demo/frame_04.png'
duration 4.5
file '/tmp/ontime_demo/frame_04.png'
`;
writeFileSync("/tmp/ontime_demo/concat.txt", ffmpegInput);

execSync("ffmpeg -y -f concat -safe 0 -i /tmp/ontime_demo/concat.txt -vsync vfr -pix_fmt yuv420p -vf 'scale=1280:720' docs/assets/on-time-demo.mp4");
console.log("Created docs/assets/on-time-demo.mp4");

console.log("Creating animated GIF with ffmpeg...");
execSync("ffmpeg -y -i docs/assets/on-time-demo.mp4 -vf 'fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse' docs/assets/on-time-demo.gif");
console.log("Created docs/assets/on-time-demo.gif");
