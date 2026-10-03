const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'starting1k_secret_2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// ============================================
//                البيانات
// ============================================
const users = {};
const bots = {};

// 10 أكواد بريميوم — واحد مدى الحياة
const premiumCodes = {
  'Starting_life':  { isLifetime: true,  usedBy: null },
  'Starting_pro_1': { isLifetime: false, usedBy: null },
  'Starting_pro_2': { isLifetime: false, usedBy: null },
  'Starting_pro_3': { isLifetime: false, usedBy: null },
  'Starting_pro_4': { isLifetime: false, usedBy: null },
  'Starting_pro_5': { isLifetime: false, usedBy: null },
  'Starting_pro_6': { isLifetime: false, usedBy: null },
  'Starting_pro_7': { isLifetime: false, usedBy: null },
  'Starting_pro_8': { isLifetime: false, usedBy: null },
  'Starting_pro_9': { isLifetime: false, usedBy: null }
};

const FREE_LIMIT = 2;
const PREMIUM_LIMIT = 10;
const LIFETIME_LIMIT = 100;

const CHANNEL_MSG = 'اشتركو في قناتنا ● https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4';

// ============================================
//    إنشاء حساب البريميوم مدى الحياة تلقائياً
// ============================================
(async () => {
  const hash = await bcrypt.hash('Starting-1k', 10);
  users['zyathamza3'] = {
    email: 'zyathamza3@gmail.com',
    passwordHash: hash,
    isPremium: true,
    isLifetime: true,
    maxBots: LIFETIME_LIMIT
  };
  premiumCodes['Starting_life'].usedBy = 'zyathamza3';
  console.log('✅ تم إنشاء حساب البريميوم مدى الحياة');
})();

// ============================================
//                Middleware
// ============================================
function requireAuth(req, res, next) {
  if (!req.session.username) return res.status(401).json({ error: 'غير مسجل دخول' });
  next();
}

// ============================================
//                تسجيل
// ============================================
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'املأ كل الحقول' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
  if (users[username]) return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
  if (Object.values(users).some(u => u.email === email)) return res.status(400).json({ error: 'الإيميل مستخدم مسبقاً' });

  const hash = await bcrypt.hash(password, 10);
  users[username] = { email, passwordHash: hash, isPremium: false, isLifetime: false, maxBots: FREE_LIMIT };
  res.json({ success: true });
});

// ============================================
//                دخول
// ============================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const entry = Object.entries(users).find(([_, u]) => u.email === email);
  if (!entry) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  const [username, user] = entry;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });

  req.session.username = username;
  res.json({ success: true, username, isPremium: user.isPremium });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ============================================
//                معلومات المستخدم
// ============================================
app.get('/api/me', requireAuth, (req, res) => {
  const user = users[req.session.username];
  const count = (bots[req.session.username] || []).length;

  let limit = FREE_LIMIT;
  if (user.isLifetime) limit = LIFETIME_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  res.json({
    username: req.session.username,
    isPremium: user.isPremium,
    isLifetime: !!user.isLifetime,
    botCount: count,
    limit: limit
  });
});

// ============================================
//                تفعيل كود بريميوم
// ============================================
app.post('/api/redeem', requireAuth, (req, res) => {
  const { code } = req.body;
  const entry = premiumCodes[code];
  if (!entry) return res.status(400).json({ error: 'الكود غير صحيح' });
  if (entry.usedBy && entry.usedBy !== req.session.username) {
    return res.status(400).json({ error: 'هذا الكود مستخدم من شخص آخر' });
  }

  entry.usedBy = req.session.username;
  const user = users[req.session.username];
  user.isPremium = true;

  if (entry.isLifetime) {
    user.isLifetime = true;
    user.maxBots = LIFETIME_LIMIT;
  }

  res.json({
    success: true,
    message: entry.isLifetime
      ? '🎉 تم تفعيل البريميوم مدى الحياة! (100 بوت)'
      : '✅ تم تفعيل البريميوم! (10 بوتات)'
  });
});

// ============================================
//                قائمة البوتات
// ============================================
app.get('/api/bots', requireAuth, (req, res) => {
  const list = bots[req.session.username] || [];
  res.json(list.map(b => ({
    id: b.id,
    ip: b.config.host,
    port: b.config.port,
    username: b.config.username,
    online: !!b.online,
    health: b.bot?.health ?? 0,
    food: b.bot?.food ?? 0,
    gameMode: b.bot?.game?.gameMode ?? 'unknown',
    repeatEnabled: !!b.repeatEnabled
  })));
});

// ============================================
//                إضافة بوت
// ============================================
app.post('/api/bots/add', requireAuth, (req, res) => {
  const { ip, port, username, useAuthme, authPassword } = req.body;
  if (!ip || !port || !username) return res.status(400).json({ error: 'املأ الحقول' });

  const user = users[req.session.username];
  let limit = FREE_LIMIT;
  if (user.isLifetime) limit = LIFETIME_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  const list = bots[req.session.username] || [];
  if (list.length >= limit) {
    return res.status(403).json({
      error: `وصلت للحد الأقصى (${limit} بوت). ${user.isPremium ? '' : 'اشترك بالبريميوم للترقية.'}`
    });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const config = { host: ip, port: parseInt(port), username, useAuthme, authPassword };
  const entry = { id, config, bot: null, online: false, repeatEnabled: false, repeatInterval: null };
  entry.bot = createBot(entry, req.session.username);

  if (!bots[req.session.username]) bots[req.session.username] = [];
  bots[req.session.username].push(entry);

  res.json({ success: true, id });
});

// ============================================
//                إيقاف بوت
// ============================================
app.post('/api/bots/:id/stop', requireAuth, (req, res) => {
  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });

  target.stopped = true;
  if (target.repeatInterval) { clearInterval(target.repeatInterval); target.repeatInterval = null; }
  if (target._antiAfk) { clearInterval(target._antiAfk); target._antiAfk = null; }
  try { target.bot?.quit(); } catch (e) {}
  target.online = false;

  bots[req.session.username] = list.filter(b => b.id !== req.params.id);
  res.json({ success: true });
});

// ============================================
//                Repeat Message
// ============================================
app.post('/api/bots/:id/repeat', requireAuth, (req, res) => {
  const user = users[req.session.username];
  if (!user.isPremium) return res.status(403).json({ error: 'هذه الميزة للبريميوم فقط' });

  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });

  target.repeatEnabled = !target.repeatEnabled;

  if (target.repeatEnabled) {
    target.repeatInterval = setInterval(() => {
      try { target.bot?.chat(CHANNEL_MSG); } catch (e) {}
    }, 30 * 60 * 1000);
  } else if (target.repeatInterval) {
    clearInterval(target.repeatInterval);
    target.repeatInterval = null;
  }

  res.json({ success: true, enabled: target.repeatEnabled });
});

// ============================================
//                إنشاء بوت Mineflayer
// ============================================
function createBot(entry, ownerUsername) {
  const bot = mineflayer.createBot({
    host: entry.config.host,
    port: entry.config.port,
    username: entry.config.username,
    auth: 'offline',
    version: false
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    entry.online = true;
    console.log(`[${entry.config.username}] دخل السيرفر`);

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    if (entry.config.useAuthme && entry.config.authPassword) {
      setTimeout(() => { try { bot.chat(`/login ${entry.config.authPassword}`); } catch (e) {} }, 3000);
      setTimeout(() => { try { bot.chat(`/register ${entry.config.authPassword} ${entry.config.authPassword}`); } catch (e) {} }, 5000);
    }

    const antiAfk = setInterval(() => {
      if (!entry.online || !bot.entity) return;
      const r = Math.random();
      try {
        if (r < 0.33) {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 300);
        } else if (r < 0.66) {
          bot.setControlState('sneak', true);
          setTimeout(() => bot.setControlState('sneak', false), 500);
        } else {
          bot.setControlState('forward', true);
          setTimeout(() => bot.setControlState('forward', false), 400);
        }
        bot.look(Math.random() * Math.PI * 2, 0, true);
      } catch (e) {}
    }, 12000 + Math.random() * 8000);

    entry._antiAfk = antiAfk;
  });

  bot.on('end', () => {
    entry.online = false;
    if (entry._antiAfk) { clearInterval(entry._antiAfk); entry._antiAfk = null; }
    if (entry.stopped) return;
    console.log(`[${entry.config.username}] انقطع، إعادة اتصال بعد 10 ثواني...`);
    setTimeout(() => {
      if (!entry.stopped) entry.bot = createBot(entry, ownerUsername);
    }, 10000);
  });

  bot.on('error', (err) => {
    console.log(`[${entry.config.username}] خطأ:`, err.message);
  });

  return bot;
}

// ============================================
//                الصفحة
// ============================================
app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starting1k</title>
<script src="https://cdn.tailwindcss.com"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<style>
  body { background: linear-gradient(135deg, #1a0033 0%, #0d0d1a 100%); }
  .purple-btn { background: linear-gradient(135deg, #a855f7, #7c3aed); transition: all .2s; }
  .purple-btn:hover { background: linear-gradient(135deg, #9333ea, #6d28d9); transform: translateY(-1px); }
  .card { background: rgba(30, 20, 50, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(168, 85, 247, 0.2); }
  .eye-btn { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; user-select: none; font-size: 18px; opacity: 0.6; transition: opacity .2s; }
  .eye-btn:hover { opacity: 1; }
  [x-cloak] { display: none !important; }
</style>
</head>
<body class="min-h-screen text-white" x-data="app()" x-init="init()">

<div class="max-w-3xl mx-auto p-4">

  <h1 class="text-4xl font-bold text-center my-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Starting1k</h1>

  <!-- ============== غير مسجل ============== -->
  <div x-show="!loggedIn" x-cloak>
    <div class="flex gap-3 mb-6">
      <button @click="tab='login'" class="flex-1 py-3 rounded-xl font-bold transition"
        :class="tab==='login' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">تسجيل دخول</button>
      <button @click="tab='register'" class="flex-1 py-3 rounded-xl font-bold transition"
        :class="tab==='register' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">حساب جديد</button>
    </div>

    <!-- Login -->
    <div x-show="tab==='login'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="loginEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <div class="relative">
        <input x-model="loginPassword" :type="showLoginPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showLoginPass = !showLoginPass" x-text="showLoginPass ? '🙈' : '👁️'"></span>
      </div>
      <button @click="doLogin()" class="w-full purple-btn py-3 rounded-xl font-bold">دخول</button>
      <p class="text-red-400 text-sm text-center" x-text="error"></p>
    </div>

    <!-- Register -->
    <div x-show="tab==='register'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="regUsername" placeholder="اسم المستخدم" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <input x-model="regEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <div class="relative">
        <input x-model="regPassword" :type="showRegPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showRegPass = !showRegPass" x-text="showRegPass ? '🙈' : '👁️'"></span>
      </div>
      <div class="relative">
        <input x-model="regConfirm" :type="showRegConfirm ? 'text' : 'password'" placeholder="تأكيد الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showRegConfirm = !showRegConfirm" x-text="showRegConfirm ? '🙈' : '👁️'"></span>
      </div>
      <button @click="doRegister()" class="w-full purple-btn py-3 rounded-xl font-bold">إنشاء حساب</button>
      <p class="text-red-400 text-sm text-center" x-text="error"></p>
    </div>
  </div>

  <!-- ============== مسجل دخول ============== -->
  <div x-show="loggedIn" x-cloak>

    <!-- الهيدر -->
    <div class="card rounded-2xl p-4 mb-4 flex justify-between items-center">
      <div>
        <span class="text-gray-400">مرحباً، </span>
        <span class="text-purple-400 font-bold" x-text="me.username"></span>
        <span x-show="me.isLifetime" class="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">👑 مدى الحياة</span>
        <span x-show="me.isPremium && !me.isLifetime" class="ml-2 text-xs bg-purple-600 px-2 py-1 rounded-full">⭐ بريميوم</span>
      </div>
      <button @click="logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition">
        🚪 خروج
      </button>
    </div>

    <div class="card rounded-2xl p-4 mb-4 text-center text-sm">
      البوتات: <span x-text="me.botCount"></span> / <span x-text="me.limit"></span>
    </div>

    <!-- تنبيه بريميوم -->
    <div x-show="!me.isPremium" class="card rounded-2xl p-4 mb-4 text-center border-yellow-500/30">
      <p class="text-yellow-400 mb-2">💎 اشترك بالبريميوم لتحصل على 10 بوتات + ميزة Repeat Message</p>
      <div class="flex gap-2">
        <input x-model="redeemCode" placeholder="ادخل كود البريميوم" class="flex-1 p-2 rounded-lg bg-gray-900/70 border border-yellow-500/30 outline-none text-sm">
        <button @click="redeem()" class="purple-btn px-4 py-2 rounded-lg text-sm font-bold">تفعيل</button>
      </div>
      <p class="text-red-400 text-xs mt-2" x-text="redeemMsg"></p>
    </div>

    <!-- إضافة بوت -->
    <div class="card rounded-2xl p-5 mb-4 space-y-3">
      <h3 class="font-bold text-purple-400 text-lg mb-2">➕ إضافة بوت</h3>
      <input x-model="newIp" placeholder="IP السيرفر" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <input x-model="newPort" placeholder="Port (افتراضي 25565)" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <input x-model="newUsername" placeholder="اسم البوت في اللعبة" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" x-model="useAuthme" class="w-5 h-5 accent-purple-600">
        <span class="text-sm">السيرفر يستخدم Register/Login (AuthMe)</span>
      </label>
      <div x-show="useAuthme" class="relative">
        <input x-model="authPassword" :type="showAuthPass ? 'text' : 'password'" placeholder="باسورد AuthMe" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
        <span class="eye-btn" @click="showAuthPass = !showAuthPass" x-text="showAuthPass ? '🙈' : '👁️'"></span>
      </div>
      <button @click="addBot()" class="w-full purple-btn py-3 rounded-xl font-bold">إضافة البوت</button>
      <p class="text-red-400 text-sm text-center" x-text="botMsg"></p>
    </div>

    <!-- قائمة البوتات -->
    <div class="space-y-3">
      <template x-for="b in botList" :key="b.id">
        <div class="card rounded-2xl p-4">
          <div class="flex justify-between items-center mb-3">
            <div>
              <div class="font-mono text-purple-400" x-text="b.ip + ':' + b.port"></div>
              <div class="text-xs text-gray-400" x-text="'اسم البوت: ' + b.username"></div>
            </div>
            <span class="text-xs px-3 py-1 rounded-full" :class="b.online ? 'bg-green-600' : 'bg-red-600'">
              <span x-text="b.online ? 'متصل' : 'منقطع'"></span>
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-sm mb-3 text-center">
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">❤️ الصحة</div>
              <div x-text="Math.round(b.health)"></div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">🍗 الجوع</div>
              <div x-text="Math.round(b.food)"></div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">🎮 الوضع</div>
              <div class="text-xs" x-text="b.gameMode"></div>
            </div>
          </div>

          <div class="flex gap-2">
            <button @click="stopBot(b.id)" class="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm font-bold transition">إيقاف</button>
            <button @click="toggleRepeat(b.id)" class="flex-1 py-2 rounded-lg text-sm font-bold transition"
              :class="b.repeatEnabled ? 'bg-green-600' : 'purple-btn'">
              <span x-text="b.repeatEnabled ? 'إيقاف التكرار' : 'تكرار الرسالة'"></span>
            </button>
          </div>
        </div>
      </template>

      <div x-show="botList.length === 0" class="text-center text-gray-500 py-8">
        ما عندك بوتات بعد. أضف واحد فوق 👆
      </div>
    </div>
  </div>
</div>

<script>
function app() {
  return {
    loggedIn: false,
    tab: 'login',
    error: '',
    redeemMsg: '',
    botMsg: '',
    me: { username: '', isPremium: false, isLifetime: false, botCount: 0, limit: 2 },

    // إظهار/إخفاء الباسورد
    showLoginPass: false,
    showRegPass: false,
    showRegConfirm: false,
    showAuthPass: false,

    // Login
    loginEmail: '', loginPassword: '',
    // Register
    regUsername: '', regEmail: '', regPassword: '', regConfirm: '',
    // إضافة بوت
    newIp: '', newPort: '', newUsername: '', useAuthme: false, authPassword: '',
    // بريميوم
    redeemCode: '',
    // القائمة
    botList: [],
    refreshTimer: null,
    premiumTimer: null,

    async init() {
      try {
        const r = await fetch('/api/me');
        if (r.ok) {
          this.me = await r.json();
          this.loggedIn = true;
          this.loadBots();
          this.startTimers();
        }
      } catch (e) {}
    },

    startTimers() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (this.premiumTimer) clearInterval(this.premiumTimer);

      this.refreshTimer = setInterval(() => this.loadBots(), 5000);
      this.premiumTimer = setInterval(() => {
        if (this.loggedIn && !this.me.isPremium) {
          alert('💎 اشترك بالبريميوم للحصول على 10 بوتات + Repeat Message!');
        }
      }, 5 * 60 * 1000);
    },

    async doLogin() {
      this.error = '';
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.loginEmail, password: this.loginPassword })
      });
      const d = await r.json();
      if (d.success) {
        this.loggedIn = true;
        await this.loadMe();
        this.loadBots();
        this.startTimers();
      } else this.error = d.error;
    },

    async doRegister() {
      this.error = '';
      const r = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.regUsername, email: this.regEmail,
          password: this.regPassword, confirmPassword: this.regConfirm
        })
      });
      const d = await r.json();
      if (d.success) { this.tab = 'login'; this.error = ''; alert('تم التسجيل! سجل دخولك الآن'); }
      else this.error = d.error;
    },

    async loadMe() {
      const r = await fetch('/api/me');
      if (r.ok) this.me = await r.json();
    },

    async loadBots() {
      const r = await fetch('/api/bots');
      if (r.ok) this.botList = await r.json();
      await this.loadMe();
    },

    async addBot() {
      this.botMsg = '';
      const r = await fetch('/api/bots/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: this.newIp, port: this.newPort, username: this.newUsername,
          useAuthme: this.useAuthme, authPassword: this.authPassword
        })
      });
      const d = await r.json();
      if (d.success) {
        this.newIp = ''; this.newPort = ''; this.newUsername = ''; this.authPassword = '';
        this.loadBots();
      } else this.botMsg = d.error;
    },

    async stopBot(id) {
      if (!confirm('تريد إيقاف البوت وحذفه؟')) return;
      await fetch('/api/bots/' + id + '/stop', { method: 'POST' });
      this.loadBots();
    },

    async toggleRepeat(id) {
      const r = await fetch('/api/bots/' + id + '/repeat', { method: 'POST' });
      const d = await r.json();
      if (!d.success) alert(d.error || 'فشل');
      this.loadBots();
    },

    async redeem() {
      this.redeemMsg = '';
      const r = await fetch('/api/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this.redeemCode })
      });
      const d = await r.json();
      if (d.success) {
        alert(d.message);
        this.redeemCode = '';
        await this.loadMe();
      } else this.redeemMsg = d.error;
    },

    async logout() {
      if (!confirm('تريد تسجيل الخروج؟')) return;
      await fetch('/api/logout', { method: 'POST' });
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (this.premiumTimer) clearInterval(this.premiumTimer);
      location.reload();
    }
  }
}
</script>
</body>
</html>`;

// ============================================
//                تشغيل السيرفر
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Starting1k يعمل على المنفذ ' + PORT);
});
