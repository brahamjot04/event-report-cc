import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const faviconSvg = path.join(__dirname, 'src', 'assets', 'cc.svg');

// Generate 1280x720 Desktop Dark Mode Dashboard Screenshot
const createDesktopSvg = () => `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f1115"/>
      <stop offset="100%" stop-color="#15181e"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e222b"/>
      <stop offset="100%" stop-color="#181b22"/>
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0d6efd"/>
      <stop offset="100%" stop-color="#0b5ed7"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff007f"/>
      <stop offset="100%" stop-color="#7928ca"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- App Background -->
  <rect width="1280" height="720" fill="url(#bgGrad)"/>

  <!-- SIDEBAR (Left 250px) -->
  <rect x="0" y="0" width="250" height="720" fill="#14171d" stroke="#232731" stroke-width="1"/>
  
  <!-- Sidebar Brand Header -->
  <g transform="translate(24, 28)">
    <rect x="0" y="0" width="38" height="38" rx="8" fill="#000001"/>
    <!-- Placeholder for composited CC Emblem -->
    <text x="48" y="19" fill="#ffffff" font-size="16" font-weight="700">CC GNDEC</text>
    <text x="48" y="34" fill="#8b949e" font-size="11">Cultural Committee</text>
  </g>

  <!-- Navigation Items -->
  <g transform="translate(16, 95)">
    <!-- Active Item: Dashboard -->
    <rect x="0" y="0" width="218" height="42" rx="8" fill="#3c1e28"/>
    <rect x="0" y="0" width="4" height="42" rx="2" fill="#ff80ab"/>
    <text x="44" y="26" fill="#ff80ab" font-size="14" font-weight="600">Dashboard</text>
    <circle cx="26" cy="21" r="5" fill="#ff80ab"/>

    <!-- Nav Item: Users -->
    <text x="44" y="68" fill="#a0aec0" font-size="14" font-weight="500">Users &amp; Permissions</text>
    <circle cx="26" cy="63" r="4" fill="#718096"/>

    <!-- Nav Item: Core Team -->
    <text x="44" y="110" fill="#a0aec0" font-size="14" font-weight="500">Core Team</text>
    <circle cx="26" cy="105" r="4" fill="#718096"/>

    <!-- Section: MANAGEMENT -->
    <text x="12" y="150" fill="#4a5568" font-size="11" font-weight="700" letter-spacing="1">MANAGEMENT</text>

    <!-- Nav Item: Email -->
    <text x="44" y="186" fill="#a0aec0" font-size="14" font-weight="500">Broadcast Email</text>
    <circle cx="26" cy="181" r="4" fill="#718096"/>

    <!-- Nav Item: Calendar -->
    <text x="44" y="228" fill="#a0aec0" font-size="14" font-weight="500">Event Calendar</text>
    <circle cx="26" cy="223" r="4" fill="#718096"/>

    <!-- Nav Item: Activity Logs -->
    <text x="44" y="270" fill="#a0aec0" font-size="14" font-weight="500">Activity Logs</text>
    <circle cx="26" cy="265" r="4" fill="#718096"/>

    <!-- Sidebar Install Button -->
    <rect x="0" y="320" width="218" height="44" rx="8" fill="rgba(13, 110, 253, 0.1)" stroke="#0d6efd" stroke-dasharray="4 4" stroke-width="1.2"/>
    <text x="56" y="347" fill="#388bfd" font-size="13" font-weight="600">Install PWA App</text>
    <path d="M 32 340 L 38 346 L 44 340 M 38 332 L 38 346 M 30 350 L 46 350" stroke="#388bfd" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>

  <!-- TOP HEADER (Right of sidebar) -->
  <g transform="translate(280, 24)">
    <!-- Search Bar -->
    <rect x="0" y="0" width="340" height="42" rx="21" fill="#1b1f27" stroke="#2d333f" stroke-width="1"/>
    <circle cx="22" cy="21" r="6" fill="none" stroke="#718096" stroke-width="1.8"/>
    <line x1="26" y1="25" x2="31" y2="30" stroke="#718096" stroke-width="1.8" stroke-linecap="round"/>
    <text x="42" y="26" fill="#718096" font-size="13">Search anything... (Ctrl + K)</text>
    <rect x="275" y="10" width="50" height="22" rx="4" fill="#282e3a"/>
    <text x="284" y="25" fill="#a0aec0" font-size="10" font-weight="600">Ctrl K</text>

    <!-- Header Actions -->
    <g transform="translate(730, 0)">
      <!-- Notification Bell -->
      <circle cx="21" cy="21" r="20" fill="#1b1f27" stroke="#2d333f" stroke-width="1"/>
      <path d="M 16 23 L 26 23 C 26 23 25 21 25 18 C 25 15 23 14 21 14 C 19 14 17 15 17 18 C 17 21 16 23 16 23 Z" fill="none" stroke="#cbd5e0" stroke-width="1.5"/>
      <circle cx="28" cy="11" r="7" fill="#dc3545"/>
      <text x="28" y="15" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">3</text>

      <!-- User Profile Pill -->
      <g transform="translate(60, 0)">
        <rect x="0" y="0" width="170" height="42" rx="21" fill="#1b1f27" stroke="#2d333f" stroke-width="1"/>
        <circle cx="21" cy="21" r="14" fill="#0d6efd"/>
        <text x="21" y="26" fill="#ffffff" font-size="14" font-weight="700" text-anchor="middle">B</text>
        <text x="45" y="25" fill="#f0f6fc" font-size="13" font-weight="600">Brahamjot Singh</text>
      </g>
    </g>
  </g>

  <!-- MAIN DASHBOARD CONTENT -->
  <g transform="translate(280, 95)">
    <!-- Page Title Banner -->
    <text x="0" y="26" fill="#ffffff" font-size="24" font-weight="800">Event Management Portal</text>
    <text x="0" y="48" fill="#8b949e" font-size="13">Cultural Committee · Guru Nanak Dev Engineering College, Ludhiana</text>

    <!-- 4 METRIC CARDS ROW -->
    <g transform="translate(0, 70)">
      <!-- Card 1: Total Events -->
      <g transform="translate(0, 0)" filter="url(#cardShadow)">
        <rect width="220" height="92" rx="12" fill="url(#cardGrad)" stroke="#282e3d" stroke-width="1"/>
        <text x="18" y="28" fill="#8b949e" font-size="11" font-weight="700" letter-spacing="0.5">TOTAL EVENTS</text>
        <text x="18" y="64" fill="#ffffff" font-size="30" font-weight="800">24</text>
        <circle cx="185" cy="46" r="18" fill="rgba(13, 202, 240, 0.15)"/>
        <circle cx="185" cy="46" r="8" fill="#0dcaf0"/>
      </g>

      <!-- Card 2: Active Volunteers -->
      <g transform="translate(245, 0)" filter="url(#cardShadow)">
        <rect width="220" height="92" rx="12" fill="url(#cardGrad)" stroke="#282e3d" stroke-width="1"/>
        <text x="18" y="28" fill="#8b949e" font-size="11" font-weight="700" letter-spacing="0.5">COMMITTEE MEMBERS</text>
        <text x="18" y="64" fill="#ffffff" font-size="30" font-weight="800">52</text>
        <circle cx="185" cy="46" r="18" fill="rgba(25, 135, 84, 0.15)"/>
        <circle cx="185" cy="46" r="8" fill="#198754"/>
      </g>

      <!-- Card 3: Youth Festival Status -->
      <g transform="translate(490, 0)" filter="url(#cardShadow)">
        <rect width="220" height="92" rx="12" fill="url(#cardGrad)" stroke="#282e3d" stroke-width="1"/>
        <text x="18" y="28" fill="#8b949e" font-size="11" font-weight="700" letter-spacing="0.5">YOUTH FESTIVAL</text>
        <text x="18" y="64" fill="#ffc107" font-size="24" font-weight="800">Live Desk</text>
        <circle cx="185" cy="46" r="18" fill="rgba(255, 193, 7, 0.15)"/>
        <circle cx="185" cy="46" r="8" fill="#ffc107"/>
      </g>

      <!-- Card 4: Colleges Arrived -->
      <g transform="translate(735, 0)" filter="url(#cardShadow)">
        <rect width="225" height="92" rx="12" fill="url(#cardGrad)" stroke="#282e3d" stroke-width="1"/>
        <text x="18" y="28" fill="#8b949e" font-size="11" font-weight="700" letter-spacing="0.5">COLLEGES CHECKED IN</text>
        <text x="18" y="64" fill="#388bfd" font-size="28" font-weight="800">18 / 22</text>
        <circle cx="190" cy="46" r="18" fill="rgba(13, 110, 253, 0.15)"/>
        <circle cx="190" cy="46" r="8" fill="#388bfd"/>
      </g>
    </g>

    <!-- SECTION 2: LIVE MODULES & EVENTS -->
    <g transform="translate(0, 185)">
      <text x="0" y="24" fill="#e6edf3" font-size="16" font-weight="700">Active Festivals &amp; Operations</text>

      <!-- Event Card 1: Youth Festival Host Operations -->
      <g transform="translate(0, 40)" filter="url(#cardShadow)">
        <rect width="470" height="210" rx="14" fill="url(#cardGrad)" stroke="#2d333f" stroke-width="1.2"/>
        <!-- Card Header Strip -->
        <g transform="translate(24, 26)">
          <rect x="0" y="0" width="105" height="24" rx="12" fill="rgba(255, 193, 7, 0.2)"/>
          <text x="52" y="16" fill="#ffc107" font-size="11" font-weight="700" text-anchor="middle">YOUTH FESTIVAL</text>

          <rect x="115" y="0" width="85" height="24" rx="12" fill="rgba(13, 110, 253, 0.2)"/>
          <text x="157" y="16" fill="#58a6ff" font-size="11" font-weight="700" text-anchor="middle">HOST GNDEC</text>

          <text x="0" y="52" fill="#ffffff" font-size="18" font-weight="700">IKGPTU Inter-Zonal Youth Festival</text>
          <text x="0" y="74" fill="#8b949e" font-size="12">Main Auditorium, Open Air Theatre &amp; Seminar Halls</text>

          <g transform="translate(0, 95)">
            <rect width="422" height="34" rx="6" fill="#14171d"/>
            <text x="12" y="22" fill="#3fb950" font-size="12" font-weight="600">✓ Desk Check-In Active</text>
            <text x="260" y="22" fill="#8b949e" font-size="12">452 Participants</text>
          </g>
        </g>
      </g>

      <!-- Event Card 2: Annual Cultural Fest -->
      <g transform="translate(490, 40)" filter="url(#cardShadow)">
        <rect width="470" height="210" rx="14" fill="url(#cardGrad)" stroke="#2d333f" stroke-width="1.2"/>
        <g transform="translate(24, 26)">
          <rect x="0" y="0" width="85" height="24" rx="12" fill="rgba(25, 135, 84, 0.2)"/>
          <text x="42" y="16" fill="#3fb950" font-size="11" font-weight="700" text-anchor="middle">UPCOMING</text>

          <rect x="95" y="0" width="95" height="24" rx="12" fill="rgba(214, 51, 132, 0.2)"/>
          <text x="142" y="16" fill="#f778ba" font-size="11" font-weight="700" text-anchor="middle">STAGE NIGHT</text>

          <text x="0" y="52" fill="#ffffff" font-size="18" font-weight="700">Anand Utsav &amp; Star Night 2026</text>
          <text x="0" y="74" fill="#8b949e" font-size="12">October 28, 2026 · Main Sports Complex Grounds</text>

          <g transform="translate(0, 95)">
            <rect width="422" height="34" rx="6" fill="#14171d"/>
            <text x="12" y="22" fill="#58a6ff" font-size="12" font-weight="600">Schedule Finalized</text>
            <text x="260" y="22" fill="#8b949e" font-size="12">32 Sub-Committees</text>
          </g>
        </g>
      </g>
    </g>
  </g>
</svg>
`;

// Generate 540x720 Mobile Dark Mode Dashboard Screenshot
const createMobileSvg = () => `
<svg width="540" height="720" viewBox="0 0 540 720" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bgGradM" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f1115"/>
      <stop offset="100%" stop-color="#15181e"/>
    </linearGradient>
    <linearGradient id="cardGradM" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e222b"/>
      <stop offset="100%" stop-color="#181b22"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="540" height="720" fill="url(#bgGradM)"/>

  <!-- Top Mobile Header -->
  <g transform="translate(20, 24)">
    <!-- Hamburger Icon -->
    <line x1="0" y1="8" x2="20" y2="8" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="0" y1="15" x2="20" y2="15" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="0" y1="22" x2="20" y2="22" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>

    <!-- App Title with Logo placeholder -->
    <text x="68" y="22" fill="#ffffff" font-size="16" font-weight="700">CC GNDEC</text>

    <!-- Right: Bell & Profile -->
    <g transform="translate(420, 0)">
      <circle cx="16" cy="16" r="16" fill="#1e222b"/>
      <circle cx="24" cy="8" r="5" fill="#dc3545"/>
      <circle cx="56" cy="16" r="16" fill="#0d6efd"/>
      <text x="56" y="21" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">B</text>
    </g>
  </g>

  <!-- Search Bar -->
  <g transform="translate(20, 75)">
    <rect width="500" height="42" rx="21" fill="#1b1f27" stroke="#2d333f" stroke-width="1"/>
    <circle cx="24" cy="21" r="6" fill="none" stroke="#718096" stroke-width="1.8"/>
    <line x1="28" y1="25" x2="33" y2="30" stroke="#718096" stroke-width="1.8" stroke-linecap="round"/>
    <text x="46" y="26" fill="#718096" font-size="13">Search events, colleges, desk...</text>
  </g>

  <!-- Title -->
  <g transform="translate(20, 140)">
    <text x="0" y="20" fill="#ffffff" font-size="20" font-weight="800">Event Management Portal</text>
    <text x="0" y="38" fill="#8b949e" font-size="12">Guru Nanak Dev Engineering College</text>
  </g>

  <!-- 2x2 Metric Grid -->
  <g transform="translate(20, 200)">
    <!-- Card 1: Total Events -->
    <g transform="translate(0, 0)">
      <rect width="240" height="78" rx="10" fill="url(#cardGradM)" stroke="#282e3d" stroke-width="1"/>
      <text x="16" y="24" fill="#8b949e" font-size="10" font-weight="700">TOTAL EVENTS</text>
      <text x="16" y="55" fill="#ffffff" font-size="24" font-weight="800">24</text>
      <circle cx="205" cy="39" r="14" fill="rgba(13, 202, 240, 0.15)"/>
      <circle cx="205" cy="39" r="6" fill="#0dcaf0"/>
    </g>

    <!-- Card 2: Volunteers -->
    <g transform="translate(260, 0)">
      <rect width="240" height="78" rx="10" fill="url(#cardGradM)" stroke="#282e3d" stroke-width="1"/>
      <text x="16" y="24" fill="#8b949e" font-size="10" font-weight="700">VOLUNTEERS</text>
      <text x="16" y="55" fill="#ffffff" font-size="24" font-weight="800">52</text>
      <circle cx="205" cy="39" r="14" fill="rgba(25, 135, 84, 0.15)"/>
      <circle cx="205" cy="39" r="6" fill="#198754"/>
    </g>

    <!-- Card 3: Youth Festival -->
    <g transform="translate(0, 92)">
      <rect width="240" height="78" rx="10" fill="url(#cardGradM)" stroke="#282e3d" stroke-width="1"/>
      <text x="16" y="24" fill="#8b949e" font-size="10" font-weight="700">YOUTH FESTIVAL</text>
      <text x="16" y="55" fill="#ffc107" font-size="20" font-weight="800">Live Desk</text>
      <circle cx="205" cy="39" r="14" fill="rgba(255, 193, 7, 0.15)"/>
      <circle cx="205" cy="39" r="6" fill="#ffc107"/>
    </g>

    <!-- Card 4: Checked In -->
    <g transform="translate(260, 92)">
      <rect width="240" height="78" rx="10" fill="url(#cardGradM)" stroke="#282e3d" stroke-width="1"/>
      <text x="16" y="24" fill="#8b949e" font-size="10" font-weight="700">CHECK-IN</text>
      <text x="16" y="55" fill="#388bfd" font-size="22" font-weight="800">18 / 22</text>
      <circle cx="205" cy="39" r="14" fill="rgba(13, 110, 253, 0.15)"/>
      <circle cx="205" cy="39" r="6" fill="#388bfd"/>
    </g>
  </g>

  <!-- Mobile Event Card -->
  <g transform="translate(20, 400)">
    <rect width="500" height="150" rx="12" fill="url(#cardGradM)" stroke="#2d333f" stroke-width="1"/>
    <g transform="translate(18, 20)">
      <rect x="0" y="0" width="95" height="22" rx="11" fill="rgba(255, 193, 7, 0.2)"/>
      <text x="47" y="15" fill="#ffc107" font-size="10" font-weight="700" text-anchor="middle">YOUTH FEST</text>

      <rect x="105" y="0" width="80" height="22" rx="11" fill="rgba(13, 110, 253, 0.2)"/>
      <text x="145" y="15" fill="#58a6ff" font-size="10" font-weight="700" text-anchor="middle">HOST GNDEC</text>

      <text x="0" y="48" fill="#ffffff" font-size="16" font-weight="700">IKGPTU Inter-Zonal Youth Festival</text>
      <text x="0" y="68" fill="#8b949e" font-size="12">Main Stage · 18 Colleges Arrived</text>

      <rect x="0" y="85" width="464" height="32" rx="6" fill="#0d6efd"/>
      <text x="232" y="106" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle">Open Desk Check-In &amp; Arrivals</text>
    </g>
  </g>

  <!-- Bottom Mobile Nav Bar -->
  <g transform="translate(0, 656)">
    <rect width="540" height="64" fill="#14171d" stroke="#232731" stroke-width="1"/>
    <text x="67" y="38" fill="#ff80ab" font-size="11" font-weight="600" text-anchor="middle">Dashboard</text>
    <text x="202" y="38" fill="#718096" font-size="11" font-weight="500" text-anchor="middle">Calendar</text>
    <text x="337" y="38" fill="#718096" font-size="11" font-weight="500" text-anchor="middle">Check-In</text>
    <text x="472" y="38" fill="#718096" font-size="11" font-weight="500" text-anchor="middle">Profile</text>
  </g>
</svg>
`;

async function generateScreenshots() {
  try {
    // Render 1280x720 Desktop Screenshot
    const desktopSvg = createDesktopSvg();
    const emblemBuffer = await sharp(faviconSvg)
      .resize(38, 38, { fit: 'contain', background: { r: 0, g: 0, b: 1, alpha: 1 } })
      .png()
      .toBuffer();

    const mobileEmblemBuffer = await sharp(faviconSvg)
      .resize(26, 26, { fit: 'contain', background: { r: 0, g: 0, b: 1, alpha: 1 } })
      .png()
      .toBuffer();

    await sharp(Buffer.from(desktopSvg))
      .composite([
        { input: emblemBuffer, top: 28, left: 24 }
      ])
      .png()
      .toFile(path.join(publicDir, 'screenshot-1280x720.png'));
    console.log('✓ Created screenshot-1280x720.png with dark dashboard & CC emblem');

    // Render 540x720 Mobile Screenshot
    const mobileSvg = createMobileSvg();
    await sharp(Buffer.from(mobileSvg))
      .composite([
        { input: mobileEmblemBuffer, top: 29, left: 55 }
      ])
      .png()
      .toFile(path.join(publicDir, 'screenshot-540x720.png'));
    console.log('✓ Created screenshot-540x720.png with dark mobile dashboard & CC emblem');

    console.log('\n✅ All PWA screenshots generated successfully!');
  } catch (error) {
    console.error('Error generating screenshots:', error);
    process.exit(1);
  }
}

generateScreenshots();
