const https = require('https');
const fs = require('fs');
const path = require('path');

const LAT = 30.5928, LON = 114.3055;
const API_HOST = 'api.open-meteo.com';
const R = '\x1b[0m', BD = '\x1b[1m', DM = '\x1b[2m';
const RED = '\x1b[31m', GRN = '\x1b[32m', YLW = '\x1b[33m';
const BLU = '\x1b[34m', CYN = '\x1b[36m', WHT = '\x1b[37m';
const BGB = '\x1b[44m', BGK = '\x1b[40m';
const BBLU = '\x1b[94m', BSL = '\x1b[90m';

const WMO = {
  0: '☀  晴天', 1: '🌤  少云', 2: '⛅  多云', 3: '☁  阴天',
  45:'🌫  雾', 48:'🌫  雾凇', 51:'🌦  小毛毛雨', 53:'🌦  毛毛雨', 55:'🌧  大毛毛雨',
  61:'🌦  小雨', 63:'🌧  中雨', 65:'🌧  大雨',
  71:'❄  小雪', 73:'❄  中雪', 75:'❄  大雪', 77:'🌨  雪粒',
  80:'🌦  阵雨', 81:'🌧  中阵雨', 82:'⛈  大暴雨',
  85:'🌨  小阵雪', 86:'🌨  大阵雪',
  95:'⛈  雷暴', 96:'⛈  雷暴+冰雹', 99:'⛈  强雷暴+冰雹'
};

function fetchWeather() {
  const path = '/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,pressure_msl,visibility' +
    '&hourly=temperature_2m,weather_code,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&timezone=Asia%2FShanghai&forecast_days=5';
  return new Promise((resolve, reject) => {
    https.get({ hostname: API_HOST, path, headers: { 'User-Agent': 'wuhan-weather-cli/2' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function windDir(deg) { const d=['北','东北','东','东南','南','西南','西','西北']; return d[Math.round(deg/45)%8]+' '+deg+'°'; }
function bar(n,m,w){ w=w||10; const l=Math.round(n/m*w); return BLU+'█'.repeat(l)+BSL+'░'.repeat(w-l)+R; }
function strip(s){ return s.replace(/\x1b\[[0-9;]*m/g,''); }
function pad(s,w){ return s+' '.repeat(Math.max(0,w-strip(s).length)); }

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h')||args.includes('--help')) {
    console.log('');
    console.log('  '+BD+CYN+'武汉天气 CLI'+R+'  v2 — Fira-inspired design');
    console.log('');
    console.log('  node weather-cli.js [选项]');
    console.log('  -h, --help    帮助');
    console.log('  -s, --simple  简洁模式');
    console.log('  -f, --full    完整模式（默认）
  --no-cache    跳过缓存，强制联网获取');
    console.log('');
    return;
  }
  const simple = args.includes('-s')||args.includes('--simple');
  const noCache = args.includes('--no-cache');

  console.log('');
  console.log(DM+'  ⏳ 正在获取武汉实时天气...'+R);

  let data;
  const cacheFile = path.join(__dirname, '.weather-cache.json');
  try {
    data = await fetchWeather();
    try { fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), data: data }), 'utf-8'); } catch (_) {}
  } catch(e) {
    if (!noCache) {
      try {
        const raw = fs.readFileSync(cacheFile, 'utf-8');
        const cached = JSON.parse(raw);
        const age = Date.now() - cached.ts;
        if (age < 30 * 60 * 1000) {
          data = cached.data;
          console.log(YLW+'  ⚠ 网络不可用，显示缓存数据（'+Math.round(age/60000)+'分钟前）'+R);
        } else {
          console.log(RED+'  ✕ 缓存已过期，请检查网络后重试'+R);
          return;
        }
      } catch (_) {
        console.log(RED+'  ✕ 获取失败: '+e.message+R);
        console.log(BSL+'  提示：请检查网络连接后重试'+R);
        return;
      }
    } else {
      console.log(RED+'  ✕ 获取失败: '+e.message+R);
      return;
    }
  }

  const c = data.current, d = data.daily, isDay = c.is_day;
  const t = new Date(c.time);
  const info = WMO[c.weather_code]||'🌈  未知';

  // Header
  console.log('');
  console.log('  '+BGB+WHT+BD+'  武汉实时天气  '+(isDay?'☀':'☾')+'  '+R);
  console.log(BSL+'  ── '+t.toLocaleString('zh-CN')+' ──'+R);
  console.log('');

  // Current
  const w = 42;
  console.log('  '+BD+'┌'+'─'.repeat(w-2)+'┐'+R);
  console.log('  '+BD+'│'+R+'  '+info+pad('',w-4-strip(info).length)+BD+'│'+R);
  console.log('  '+BD+'│'+R+'  '+YLW+'●'+R+' 温度: '+BD+Math.round(c.temperature_2m)+'°C'+R+'  体感: '+Math.round(c.apparent_temperature)+'°C'+pad('',w-28)+BD+'│'+R);
  console.log('  '+BD+'│'+R+'  '+BLU+'●'+R+' 湿度: '+c.relative_humidity_2m+'%  '+bar(c.relative_humidity_2m,100,12)+'  '+BD+'│'+R);
  console.log('  '+BD+'│'+R+'  '+CYN+'●'+R+' 风速: '+c.wind_speed_10m+' km/h   风向: '+windDir(c.wind_direction_10m)+pad('',w-29)+BD+'│'+R);
  console.log('  '+BD+'│'+R+'  '+BSL+'●'+R+' 气压: '+c.pressure_msl+' hPa   能见度: '+(c.visibility/1000).toFixed(1)+' km'+pad('',w-32)+BD+'│'+R);
  console.log('  '+BD+'└'+'─'.repeat(w-2)+'┘'+R);

  if (simple) { console.log(''); return; }

  // Hourly (next 12)
  const h = data.hourly, now = new Date();
  console.log('');
  console.log('  '+BD+CYN+'逐小时预报'+R);
  console.log('  '+BSL+'─'.repeat(w)+R);
  let shown = 0;
  for (let i = 0; i < h.time.length && shown < 12; i++) {
    const ht = new Date(h.time[i]);
    if (ht < now - 3600000) continue;
    shown++;
    const hi = WMO[h.weather_code[i]]||'🌈  未知';
    const temp = Math.round(h.temperature_2m[i]);
    const pp = h.precipitation_probability[i];
    const isNow = Math.abs(ht - now) < 3600000;
    const marker = isNow ? YLW+'▶'+R : ' ';
    const color = temp > 0 ? GRN : BLU;
    console.log('  '+marker+' '+pad(String(ht.getHours()).padStart(2,'0')+':00',6)+
      ' '+hi+'  '+color+String(temp).padStart(2,' ')+'°'+R+
      '  '+(temp>=0?GRN:BLU)+bar(Math.abs(temp)+5,45,8)+R+
      (pp>20?'  '+CYN+'▴'+pp+'%'+R:''));
  }
  console.log('  '+BSL+'─'.repeat(w)+R);

  // Daily forecast
  console.log('');
  console.log('  '+BD+CYN+'未来预报'+R);
  console.log('  '+BSL+'─'.repeat(w)+R);
  const wd=['周日','周一','周二','周三','周四','周五','周六'];
  const td=new Date().getDay();
  for(let i=0;i<d.time.length;i++){
    const dt=new Date(d.time[i]);
    const name=i===0?'今天':wd[(td+i)%7];
    const di=WMO[d.weather_code[i]]||'🌈  未知';
    const hi=Math.round(d.temperature_2m_max[i]);
    const lo=Math.round(d.temperature_2m_min[i]);
    const pp=d.precipitation_probability_max[i];
    console.log('   '+pad(name,4)+' '+(dt.getMonth()+1)+'/'+String(dt.getDate()).padStart(2,'0')+
      '  '+pad(di,13)+
      '  '+RED+'↑'+hi+'°'+R+'  '+BLU+'↓'+lo+'°'+R+
      (pp>20?'  '+CYN+'💧'+pp+'%'+R:''));
  }
  console.log('  '+BSL+'─'.repeat(w)+R);
  console.log('');
}

main().catch(e=>{console.error(RED+'错误: '+e.message+R);process.exit(1);});
