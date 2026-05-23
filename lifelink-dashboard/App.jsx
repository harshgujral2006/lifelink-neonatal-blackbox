import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  BatteryCharging,
  BellOff,
  Cpu,
  Gauge,
  Hand,
  HeartPulse,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  BellRing,
  Waves,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MAX_POINTS = 24;
const DEFAULT_ESP32_WS_URL = 'ws://10.214.151.6:81';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randomBetween = (min, max) => min + Math.random() * (max - min);
const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const displayGesture = (gesture) => {
  if (!gesture || gesture === 'none' || gesture === 'default') return 'Waiting';
  return gesture;
};

const displayAlertTitle = (alert) => {
  if (alert === 'APDS9960 default light') return 'APDS9960 estimated light';
  return alert;
};

const initialPoint = (index) => {
  const pressure = randomBetween(1008, 1018);
  const vibration = randomBetween(0.16, 0.78);
  const light = randomBetween(80, 320);
  const pressureScore = clamp(100 - Math.abs(pressure - 1013) * 7.8, 0, 100);
  const vibrationScore = clamp(100 - vibration * 65, 0, 100);
  const lightScore = clamp(100 - light / 7, 0, 100);
  const score = Math.round(vibrationScore * 0.5 + pressureScore * 0.3 + lightScore * 0.2);

  return {
    time: `${index}s`,
    clock: formatTime(),
    pressure: Number(pressure.toFixed(1)),
    pressureBaseline: 1013,
    vibration: Number(vibration.toFixed(2)),
    accelerationMagnitude: Number((1 + vibration).toFixed(2)),
    accelX: Number(randomBetween(-0.06, 0.06).toFixed(2)),
    accelY: Number(randomBetween(-0.06, 0.06).toFixed(2)),
    accelZ: Number(randomBetween(0.96, 1.04).toFixed(2)),
    light: Math.round(light),
    score,
    stress: Math.round(100 - score + vibration * 8),
    status: score < 58 ? 'Critical' : score < 76 ? 'Watch' : 'Stable',
    alert: 'None',
    gesture: 'none',
    buzzer: false,
    bmpReady: true,
    mpuReady: true,
    apdsReady: true,
    oledReady: true,
    apdsInterrupt: false,
    esp32: 'simulated',
    battery: 87,
  };
};

const statusFor = (point) => {
  if (point.status) return point.status;
  if (point.vibration > 1.45 || point.pressure < 996 || point.light > 760 || point.score < 58) return 'Critical';
  if (point.vibration > 0.95 || point.pressure < 1002 || point.light > 520 || point.score < 76) return 'Watch';
  return 'Stable';
};

const badgeClasses = {
  Stable: 'bg-emerald-400/15 text-emerald-600 border-emerald-400/30 dark:text-emerald-300',
  Watch: 'bg-amber-400/15 text-amber-600 border-amber-400/30 dark:text-amber-300',
  Critical: 'bg-rose-500/15 text-rose-600 border-rose-400/30 dark:text-rose-300',
};

function buildNextPoint(previous, tick, emergency) {
  const vibrationBurst = emergency || Math.random() > 0.82 ? randomBetween(0.5, 1.2) : 0;
  const pressureDrop = emergency || Math.random() > 0.88 ? randomBetween(4, 12) : 0;
  const lightBurst = emergency || Math.random() > 0.86 ? randomBetween(220, 540) : 0;

  const pressure = clamp(previous.pressure + randomBetween(-2.3, 2.2) - pressureDrop * 0.22, 990, 1022);
  const vibration = clamp(previous.vibration * 0.58 + randomBetween(0.05, 0.62) + vibrationBurst, 0.04, 2.45);
  const light = clamp(previous.light * 0.62 + randomBetween(45, 260) + lightBurst, 20, 980);

  const pressureScore = clamp(100 - Math.abs(pressure - 1013) * 7.8, 0, 100);
  const vibrationScore = clamp(100 - vibration * 65, 0, 100);
  const lightScore = clamp(100 - light / 7, 0, 100);
  const score = Math.round(vibrationScore * 0.5 + pressureScore * 0.3 + lightScore * 0.2);

  return {
    time: `${tick}s`,
    clock: formatTime(),
    pressure: Number(pressure.toFixed(1)),
    pressureBaseline: 1013,
    vibration: Number(vibration.toFixed(2)),
    accelerationMagnitude: Number((1 + vibration).toFixed(2)),
    accelX: Number(randomBetween(-0.12, 0.12).toFixed(2)),
    accelY: Number(randomBetween(-0.12, 0.12).toFixed(2)),
    accelZ: Number((1 + randomBetween(-0.06, 0.08) + vibration * 0.08).toFixed(2)),
    light: Math.round(light),
    score,
    stress: Math.round(clamp(100 - score + vibration * 9 + Math.max(0, light - 450) / 18, 0, 100)),
    status: score < 58 ? 'Critical' : score < 76 ? 'Watch' : 'Stable',
    alert: 'None',
    gesture: 'none',
    buzzer: score < 76,
    bmpReady: true,
    mpuReady: true,
    apdsReady: true,
    oledReady: true,
    apdsInterrupt: false,
    esp32: 'simulated',
    battery: 87,
  };
}

function alertsFor(point) {
  if (point.alert === 'APDS9960 default light' || point.alert === 'APDS9960 estimated light') {
    return [
      {
        title: 'No active emergency alerts',
        detail: 'ESP32 telemetry inside neonatal safety range',
        severity: 'Nominal',
        priority: 'OK',
        timestamp: formatTime(),
      },
    ];
  }

  if (point.alert && point.alert !== 'None') {
    const severity = point.status === 'Critical' ? 'Critical' : point.status === 'Watch' ? 'High' : 'Medium';
    return [
      {
        title: displayAlertTitle(point.alert),
        detail: `Hardware telemetry reported ${point.status || 'Watch'} at ${formatTime()}`,
        severity,
        priority: severity === 'Critical' ? 'P1' : 'P2',
        timestamp: formatTime(),
      },
    ];
  }

  const alerts = [];
  if (point.vibration > 1.35) {
    alerts.push({
      title: 'High vibration trauma detected',
      detail: `${point.vibration.toFixed(2)}g exceeds incubator stability band`,
      severity: 'Critical',
      priority: 'P1',
    });
  }
  if (point.pressure < 1002) {
    alerts.push({
      title: 'Pressure drop warning',
      detail: `${point.pressure.toFixed(1)} hPa cabin pressure trend falling`,
      severity: 'High',
      priority: 'P2',
    });
  }
  if (point.light > 560) {
    alerts.push({
      title: 'Excessive light exposure',
      detail: `${point.light} lux may disturb premature infant regulation`,
      severity: 'Medium',
      priority: 'P3',
    });
  }
  if (point.score < 58) {
    alerts.push({
      title: 'Emergency transport instability',
      detail: `Safety engine dropped to ${point.score}%`,
      severity: 'Critical',
      priority: 'P1',
    });
  }
  return alerts.length
    ? alerts.map((alert) => ({ ...alert, timestamp: formatTime() }))
    : [
        {
          title: 'No active emergency alerts',
          detail: 'ESP32 telemetry inside neonatal safety range',
          severity: 'Nominal',
          priority: 'OK',
          timestamp: formatTime(),
        },
      ];
}

function StatCard({ icon: Icon, title, subtitle, value, unit, progress, status, color, details = [] }) {
  const isCritical = status === 'Critical';

  return (
    <motion.article
      whileHover={{ y: -5, scale: 1.01 }}
      className={`glass rounded-3xl border p-5 shadow-xl transition ${
        isCritical
          ? 'warning-flash border-rose-400/40 bg-rose-50/70 dark:bg-rose-950/30'
          : 'border-white/60 bg-white/75 dark:border-white/10 dark:bg-white/8'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses[status]}`}>
          {status}
        </span>
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <div className="mt-4 flex items-end gap-2">
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-slate-950 dark:text-white"
          >
            {value}
          </motion.span>
          <span className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          className={`h-full rounded-full ${
            isCritical ? 'bg-rose-500' : status === 'Watch' ? 'bg-amber-400' : 'bg-cyan-400'
          }`}
        />
      </div>
      {details.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {details.map((detail) => (
            <div key={detail.label} className="rounded-2xl bg-slate-100/80 px-3 py-2 dark:bg-white/8">
              <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">{detail.label}</p>
              <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{detail.value}</p>
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-xl glass dark:border-white/10 dark:bg-white/8"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-300">{title}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Live Trend</h3>
        </div>
        <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-600 dark:text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="h-64 min-h-64">{children}</div>
    </motion.section>
  );
}

function NeonatalTransportIllustration() {
  return (
    <div className="relative mx-auto aspect-[1.25] w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/60 bg-sky-50/80 p-5 shadow-2xl glass dark:border-white/10 dark:bg-slate-900/70">
      <div className="scanline absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/0 via-cyan-300/25 to-cyan-300/0" />
      <svg viewBox="0 0 640 510" className="h-full w-full" role="img" aria-label="Neonatal transport incubator monitoring illustration">
        <defs>
          <linearGradient id="pod" x1="0" x2="1">
            <stop offset="0%" stopColor="#dff7ff" />
            <stop offset="100%" stopColor="#94e6ff" />
          </linearGradient>
          <linearGradient id="body" x1="0" x2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
        <rect x="70" y="304" width="500" height="88" rx="28" fill="url(#body)" />
        <path d="M145 305 C175 120 465 120 495 305 Z" fill="url(#pod)" opacity="0.88" />
        <path d="M175 294 C205 165 435 165 465 294" fill="none" stroke="#e0fbff" strokeWidth="18" strokeLinecap="round" opacity="0.8" />
        <rect x="218" y="250" width="204" height="52" rx="26" fill="#f8fafc" />
        <circle cx="291" cy="276" r="12" fill="#fda4af" opacity="0.9" />
        <path d="M304 280 C335 302 371 299 392 276" fill="none" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" />
        <circle cx="170" cy="407" r="38" fill="#0f172a" />
        <circle cx="470" cy="407" r="38" fill="#0f172a" />
        <circle cx="170" cy="407" r="17" fill="#67e8f9" />
        <circle cx="470" cy="407" r="17" fill="#67e8f9" />
        <rect x="76" y="210" width="106" height="76" rx="20" fill="#ffffff" opacity="0.94" />
        <path d="M95 250 H113 L123 225 L141 269 L153 245 H166" fill="none" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="460" y="196" width="96" height="112" rx="22" fill="#ffffff" opacity="0.94" />
        <rect x="484" y="222" width="48" height="12" rx="6" fill="#22c55e" />
        <rect x="484" y="250" width="34" height="12" rx="6" fill="#06b6d4" />
        <rect x="484" y="278" width="58" height="12" rx="6" fill="#f59e0b" />
        <path d="M320 80 C335 110 363 111 378 86" fill="none" stroke="#06b6d4" strokeWidth="8" strokeLinecap="round" />
        <path d="M289 86 C320 145 390 145 421 86" fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  );
}

function pointFromHardwarePayload(payload, tick) {
  const pressure = Number(payload.pressure ?? 0);
  const pressureBaseline = Number(payload.pressureBaseline ?? pressure);
  const vibration = Number(payload.vibration ?? 0);
  const accelerationMagnitude = Number(payload.accelerationMagnitude ?? 0);
  const accelX = Number(payload.accelX ?? 0);
  const accelY = Number(payload.accelY ?? 0);
  const accelZ = Number(payload.accelZ ?? 0);
  const light = Number(payload.light ?? 0);
  const score = Number(payload.safetyScore ?? payload.score ?? 0);
  const status = payload.status || (score < 58 ? 'Critical' : score < 76 ? 'Watch' : 'Stable');

  return {
    time: `${tick}s`,
    clock: formatTime(),
    pressure,
    pressureBaseline,
    vibration,
    accelerationMagnitude,
    accelX,
    accelY,
    accelZ,
    light,
    score,
    stress: Math.round(clamp(100 - score + vibration * 9 + Math.max(0, light - 450) / 18, 0, 100)),
    status,
    alert: payload.alert || 'None',
    gesture: payload.gesture || 'none',
    buzzer: Boolean(payload.buzzer),
    bmpReady: Boolean(payload.bmpReady),
    mpuReady: Boolean(payload.mpuReady),
    apdsReady: Boolean(payload.apdsReady),
    oledReady: Boolean(payload.oledReady),
    apdsInterrupt: Boolean(payload.apdsInterrupt),
    esp32: payload.esp32 || 'connected',
    battery: Number(payload.battery ?? 87),
  };
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [tick, setTick] = useState(24);
  const [data, setData] = useState(() => Array.from({ length: MAX_POINTS }, (_, index) => initialPoint(index)));
  const [wsUrl, setWsUrl] = useState(() => {
    const savedUrl = localStorage.getItem('lifelink-ws-url');
    return savedUrl && savedUrl.trim() ? savedUrl : DEFAULT_ESP32_WS_URL;
  });
  const [connection, setConnection] = useState(wsUrl ? 'Connecting' : 'Simulation');

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (wsUrl.trim()) return undefined;

    const interval = window.setInterval(() => {
      setData((current) => {
        const next = buildNextPoint(current[current.length - 1], tick, emergency);
        return [...current.slice(1), next];
      });
      setTick((value) => value + 1);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [tick, emergency, wsUrl]);

  useEffect(() => {
    const endpoint = wsUrl.trim();
    localStorage.setItem('lifelink-ws-url', endpoint);

    if (!endpoint) {
      setConnection('Simulation');
      return undefined;
    }

    let active = true;
    const socket = new WebSocket(endpoint);
    setConnection('Connecting');

    socket.onopen = () => active && setConnection('Hardware Live');
    socket.onerror = () => active && setConnection('Connection Error');
    socket.onclose = () => active && setConnection('Disconnected');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setData((current) => {
          const next = pointFromHardwarePayload(payload, Math.floor(Date.now() / 1000));
          return [...current.slice(1), next];
        });
        setTick((value) => value + 1);
      } catch {
        setConnection('Invalid Packet');
      }
    };

    return () => {
      active = false;
      socket.close();
    };
  }, [wsUrl]);

  const latest = data[data.length - 1];
  const systemStatus = statusFor(latest);
  const alerts = useMemo(() => alertsFor(latest), [latest]);
  const journey = useMemo(() => [...data].slice(-9).reverse(), [data]);

  const sensorCards = [
    {
      icon: Gauge,
      title: 'BMP180 Pressure Sensor',
      subtitle: 'Cabin pressure',
      value: latest.pressure.toFixed(1),
      unit: 'hPa',
      progress: clamp(100 - Math.abs(latest.pressure - latest.pressureBaseline) * 10, 0, 100),
      status: latest.bmpReady ? statusFor(latest) : 'Critical',
      color: 'bg-sky-400/15 text-sky-600 dark:text-sky-300',
    },
    {
      icon: Waves,
      title: 'MPU6050 Vibration Sensor',
      subtitle: 'Transport G-force',
      value: latest.vibration.toFixed(2),
      unit: 'g',
      progress: clamp(latest.vibration * 42, 0, 100),
      status: latest.mpuReady ? (latest.vibration > 1.35 ? 'Critical' : latest.vibration > 0.9 ? 'Watch' : 'Stable') : 'Critical',
      color: 'bg-rose-400/15 text-rose-600 dark:text-rose-300',
      details: [
        { label: 'X Axis', value: `${latest.accelX.toFixed(2)}g` },
        { label: 'Y Axis', value: `${latest.accelY.toFixed(2)}g` },
        { label: 'Z Axis', value: `${latest.accelZ.toFixed(2)}g` },
      ],
    },
    {
      icon: Sun,
      title: 'APDS9960 Light Sensor',
      subtitle: latest.apdsReady ? 'Infant light exposure' : 'Infant light exposure estimate',
      value: latest.light,
      unit: 'lux',
      progress: clamp(latest.light / 9.8, 0, 100),
      status: latest.light > 560 ? 'Critical' : latest.light > 390 ? 'Watch' : 'Stable',
      color: 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
    },
  ];

  return (
    <div className={dark ? 'dark' : ''}>
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950 text-white"
          >
            <div className="text-center">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl border border-cyan-300/30 bg-cyan-300/10">
                <HeartPulse className="h-10 w-10 text-cyan-300 soft-pulse" />
              </div>
              <h1 className="text-3xl font-bold">LifeLink</h1>
              <p className="mt-2 text-sm text-cyan-100">Synchronizing neonatal transport telemetry</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#d9fbff,transparent_34%),linear-gradient(135deg,#f7fdff,#eef8ff_45%,#f7fbfb)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,#0e7490_0,transparent_30%),linear-gradient(135deg,#07111f,#0e1729_48%,#10251f)] dark:text-white">
        <nav className="sticky top-0 z-40 border-b border-white/50 bg-white/70 px-4 py-3 glass dark:border-white/10 dark:bg-slate-950/55 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/25">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-bold">LifeLink</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Neonatal Transport Black Box</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmergency((value) => !value)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold shadow-lg transition ${
                  emergency ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-rose-600 dark:bg-white/10 dark:text-rose-200'
                }`}
              >
                <span className="hidden sm:inline">Emergency Mode</span>
                <Zap className="h-5 w-5 sm:hidden" />
              </button>
              <button
                type="button"
                onClick={() => setDark((value) => !value)}
                className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg transition hover:scale-105 dark:bg-white dark:text-slate-950"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </nav>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-200">
              <Radio className="h-4 w-4" />
              {connection === 'Hardware Live' ? 'ESP32 hardware telemetry stream active' : `${connection} mode`}
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
              LifeLink
            </h1>
            <p className="mt-4 text-2xl font-semibold text-cyan-700 dark:text-cyan-200">
              AI-Powered Neonatal Transport Monitoring
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Protect premature infants during ambulance and air transfers with a real-time black box that watches
              pressure, vibration, light exposure, and environmental stress before transport risk escalates.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ['Transport', systemStatus, Ambulance],
                ['Gesture', displayGesture(latest.gesture), Hand],
                ['Buzzer', latest.buzzer ? 'Alarm Active' : 'Silent', BellRing],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg glass dark:border-white/10 dark:bg-white/8">
                  <Icon className="mb-3 h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-1 font-bold text-slate-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
            <NeonatalTransportIllustration />
            <div className="mt-5 rounded-3xl border border-white/60 bg-white/75 p-5 shadow-xl glass dark:border-white/10 dark:bg-white/8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase text-cyan-600 dark:text-cyan-300">Live Safety Score</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">50% vibration, 30% pressure, 20% light</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="mt-5 flex items-end gap-3">
                <motion.span
                  key={latest.score}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-7xl font-black ${latest.score < 60 ? 'text-rose-500' : latest.score < 78 ? 'text-amber-500' : 'text-emerald-500'}`}
                >
                  {latest.score}
                </motion.span>
                <span className="mb-3 text-2xl font-bold text-slate-500 dark:text-slate-300">%</span>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div
                  animate={{ width: `${latest.score}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
                />
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-cyan-600 dark:text-cyan-300">Live Sensor Dashboard</p>
              <h2 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Transport Telemetry</h2>
            </div>
            <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-300 sm:inline-flex">
              Receiving 2.4GHz IoT packets
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {sensorCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase text-cyan-600 dark:text-cyan-300">Real-Time Alert System</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Clinical Risk Alerts</h2>
            <div className="mt-5 grid gap-4">
              {alerts.map((alert) => (
                <motion.div
                  key={`${alert.title}-${alert.timestamp}`}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-3xl border p-5 shadow-xl glass ${
                    alert.severity === 'Critical'
                      ? 'warning-flash border-rose-400/40 bg-rose-50/80 dark:bg-rose-950/30'
                      : alert.severity === 'High'
                        ? 'border-orange-400/40 bg-orange-50/80 dark:bg-orange-950/25'
                        : alert.severity === 'Medium'
                          ? 'border-amber-400/40 bg-amber-50/80 dark:bg-amber-950/25'
                          : 'border-emerald-400/30 bg-emerald-50/80 dark:bg-emerald-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <AlertTriangle className={`mt-1 h-6 w-6 ${alert.severity === 'Nominal' ? 'text-emerald-500' : 'text-rose-500'}`} />
                      <div>
                        <h3 className="font-bold text-slate-950 dark:text-white">{alert.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{alert.detail}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                      {alert.priority}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">{alert.timestamp}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Pressure vs Time" icon={Gauge}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="pressureFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Area dataKey="pressure" stroke="#0ea5e9" fill="url(#pressureFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Vibration vs Time" icon={Waves}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 2.5]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="vibration" stroke="#f43f5e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="MPU6050 X/Y/Z Axis" icon={Waves}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[-1.5, 1.5]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="accelX" name="X axis" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="accelY" name="Y axis" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="accelZ" name="Z axis" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Safety Score Trend" icon={ShieldCheck}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Area dataKey="score" stroke="#10b981" fill="url(#scoreFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Environmental Stress Graph" icon={Activity}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="stress" stroke="#f59e0b" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="light" stroke="#06b6d4" strokeWidth={2} dot={false} opacity={0.35} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-xl glass dark:border-white/10 dark:bg-white/8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-cyan-600 dark:text-cyan-300">Journey Log Table</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Transport History</h2>
              </div>
              <Ambulance className="h-7 w-7 text-cyan-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Time</th>
                    <th className="py-3 pr-4">Pressure</th>
                    <th className="py-3 pr-4">G-force</th>
                    <th className="py-3 pr-4">X</th>
                    <th className="py-3 pr-4">Y</th>
                    <th className="py-3 pr-4">Z</th>
                    <th className="py-3 pr-4">Light</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Alert generated</th>
                  </tr>
                </thead>
                <tbody>
                  {journey.map((row) => {
                    const rowStatus = statusFor(row);
                    return (
                      <tr key={`${row.clock}-${row.time}`} className="border-t border-slate-200/70 dark:border-white/10">
                        <td className="py-4 pr-4 font-semibold">{row.clock}</td>
                        <td className="py-4 pr-4">{row.pressure.toFixed(1)} hPa</td>
                        <td className="py-4 pr-4">{row.vibration.toFixed(2)}g</td>
                        <td className="py-4 pr-4">{row.accelX.toFixed(2)}g</td>
                        <td className="py-4 pr-4">{row.accelY.toFixed(2)}g</td>
                        <td className="py-4 pr-4">{row.accelZ.toFixed(2)}g</td>
                        <td className="py-4 pr-4">{row.light} lux</td>
                        <td className="py-4 pr-4">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClasses[rowStatus]}`}>{rowStatus}</span>
                        </td>
                        <td className="py-4">{rowStatus === 'Stable' ? 'None' : rowStatus === 'Watch' ? 'Preventive warning' : 'Emergency escalation'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl glass dark:border-white/10 dark:bg-white/8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-violet-400/15 p-3 text-violet-600 dark:text-violet-300">
                  <Hand className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase text-violet-600 dark:text-violet-300">Touchless Gesture Control</p>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">Sterile Interaction</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {['Sterile gesture-based interaction', 'Alarm silencing using hand gestures', 'Infection prevention for NICU transport teams'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-100/80 p-3 dark:bg-white/8">
                    <BellOff className="h-5 w-5 text-violet-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl glass dark:border-white/10 dark:bg-white/8">
              <p className="text-sm font-bold uppercase text-cyan-600 dark:text-cyan-300">Connectivity Panel</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">System Links</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  [Wifi, 'Wi-Fi', connection],
                  [Cpu, 'ESP32', latest.esp32 === 'connected' ? 'Connected' : latest.esp32],
                  [BatteryCharging, 'Battery', `${latest.battery}%`],
                  [Activity, 'OLED', latest.oledReady ? 'Ready' : 'Not detected'],
                  [Radio, 'APDS INT', latest.apdsInterrupt ? 'Active' : 'Idle'],
                  [BellRing, 'Buzzer', latest.buzzer ? 'Alerting' : 'Silent'],
                ].map(([Icon, label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-100/80 p-4 dark:bg-white/8">
                    <Icon className="mb-3 h-5 w-5 text-cyan-500" />
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-bold text-slate-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
