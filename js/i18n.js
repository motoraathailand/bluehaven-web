// BLUE HAVEN — 5-language strings (th / en / ko / zh / hi)
export const LANGS = [
  { code: 'th', label: 'ไทย' }, { code: 'en', label: 'English' }, { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' }, { code: 'hi', label: 'हिन्दी' },
];
const S = {
  subtitle: { th: 'สวนใต้ทะเลของฉัน', en: 'My own garden under the sea', ko: '나만의 바닷속 정원', zh: '我的海底花园', hi: 'समुद्र के नीचे मेरा अपना बगीचा' },
  intro: {
    th: 'เล่นมินิเกมสบายๆ เก็บไข่มุก แล้วเชิญปลาและปะการังใหม่มาอยู่ในทะเลของคุณ ไม่มีการแข่ง ไม่ต้องรีบ',
    en: 'Play gentle little games, gather pearls, and invite new fish and corals into your own sea. No rush, no pressure.',
    ko: '잔잔한 미니게임으로 진주를 모아 새 물고기와 산호를 나만의 바다에 초대해요. 서두를 것도, 경쟁할 것도 없어요.',
    zh: '玩轻松的小游戏，收集珍珠，邀请新的鱼儿和珊瑚来到你自己的海洋。不必着急，没有压力。',
    hi: 'हल्के-फुल्के छोटे खेल खेलें, मोती इकट्ठा करें, और अपने समुद्र में नई मछलियाँ और मूंगे बुलाएँ। कोई जल्दी नहीं, कोई दबाव नहीं।',
  },
  start: { th: 'ดำลงไป', en: 'Dive in', ko: '바다로 들어가기', zh: '潜入海中', hi: 'गोता लगाएँ' },
  sample: { th: 'ตัวอย่างแรก', en: 'First sample', ko: '첫 샘플', zh: '首个试玩版', hi: 'पहला नमूना' },
  mute: { th: 'ปิดเสียง', en: 'Mute', ko: '소리 끄기', zh: '静音', hi: 'आवाज़ बंद' },
  unmute: { th: 'เปิดเสียง', en: 'Sound on', ko: '소리 켜기', zh: '开启声音', hi: 'आवाज़ चालू' },
  language: { th: 'ภาษา', en: 'Language', ko: '언어', zh: '语言', hi: 'भाषा' },
  provider: { th: 'ผู้ให้บริการ: MOTOR AA', en: 'Provided by MOTOR AA', ko: '제공: MOTOR AA', zh: '提供方：MOTOR AA', hi: 'प्रदाता: MOTOR AA' },
  musicNote: { th: 'ดนตรีสร้างขึ้นสดๆ ด้วยโค้ดของโปรเจกต์', en: 'Music is generated live by the project’s own code', ko: '음악은 프로젝트 코드로 실시간 생성돼요', zh: '音乐由项目代码实时生成', hi: 'संगीत प्रोजेक्ट के अपने कोड से लाइव बनता है' },
  games: { th: 'มินิเกม', en: 'Games', ko: '미니게임', zh: '小游戏', hi: 'खेल' },
  grow: { th: 'แต่งทะเล', en: 'My Sea', ko: '바다 꾸미기', zh: '布置海洋', hi: 'मेरा समुद्र' },
  close: { th: 'ปิด', en: 'Close', ko: '닫기', zh: '关闭', hi: 'बंद करें' },
  pearls: { th: 'ไข่มุก', en: 'Pearls', ko: '진주', zh: '珍珠', hi: 'मोती' },
  hintTouch: { th: 'ลากเพื่อหมุนมอง · ถ่างสองนิ้วเพื่อซูม · แตะปลาเพื่อว่ายตาม', en: 'Drag to look around · Pinch to zoom · Tap a fish to follow it', ko: '드래그로 둘러보기 · 두 손가락으로 확대 · 물고기를 탭하면 따라가요', zh: '拖动环顾 · 双指缩放 · 点击鱼儿跟随它', hi: 'घुमाने के लिए खींचें · ज़ूम के लिए पिंच करें · मछली पर टैप करके उसके साथ चलें' },
  hintKeys: { th: 'ลากเมาส์เพื่อหมุนมอง · ล้อเมาส์เพื่อซูม · คลิกปลาเพื่อว่ายตาม · G มินิเกม · B แต่งทะเล', en: 'Drag to look around · Wheel to zoom · Click a fish to follow · G games · B my sea', ko: '드래그로 둘러보기 · 휠로 확대 · 물고기 클릭으로 따라가기 · G 미니게임 · B 바다 꾸미기', zh: '拖动环顾 · 滚轮缩放 · 点击鱼儿跟随 · G 小游戏 · B 布置海洋', hi: 'घुमाने के लिए खींचें · ज़ूम के लिए व्हील · मछली पर क्लिक करके साथ चलें · G खेल · B मेरा समुद्र' },
  following: { th: 'กำลังว่ายตาม', en: 'Following', ko: '따라가는 중', zh: '正在跟随', hi: 'साथ तैर रहे हैं' },
  stopFollow: { th: 'เลิกตาม', en: 'Stop', ko: '그만 따라가기', zh: '停止跟随', hi: 'रोकें' },
  // minigames
  mg1: { th: 'ไข่มุกลอยฟ่อง', en: 'Drifting Pearls', ko: '떠오르는 진주', zh: '漂浮的珍珠', hi: 'तैरते मोती' },
  mg1d: { th: 'แตะไข่มุกที่ลอยขึ้นมา 40 วินาที ไข่มุกสีทองได้ 3 เม็ด', en: 'Tap the pearls drifting up for 40 seconds. Golden ones are worth 3.', ko: '40초 동안 떠오르는 진주를 톡톡 눌러요. 금빛 진주는 3개!', zh: '40 秒内点击上浮的珍珠，金色珍珠值 3 颗。', hi: '40 सेकंड तक ऊपर तैरते मोतियों पर टैप करें। सुनहरे मोती 3 के बराबर हैं।' },
  mg2: { th: 'เวลาให้อาหาร', en: 'Feeding Time', ko: '먹이 주기', zh: '喂食时间', hi: 'खाना खिलाने का समय' },
  mg2d: { th: 'แตะในน้ำเพื่อโปรยอาหาร ปลากินหนึ่งคำได้ไข่มุก 1 เม็ด (35 วินาที)', en: 'Tap the water to sprinkle food. Each bite a fish takes gives 1 pearl (35 s).', ko: '물속을 탭해 먹이를 뿌려요. 물고기가 한 입 먹을 때마다 진주 1개 (35초)', zh: '点击水中撒下鱼食，鱼儿每吃一口得 1 颗珍珠（35 秒）。', hi: 'खाना डालने के लिए पानी पर टैप करें। मछली के हर कौर पर 1 मोती (35 सेकंड)।' },
  play: { th: 'เล่น', en: 'Play', ko: '시작', zh: '开始', hi: 'खेलें' },
  resultTitle: { th: 'เยี่ยมมาก!', en: 'Lovely!', ko: '잘했어요!', zh: '太棒了！', hi: 'बहुत बढ़िया!' },
  earned: { th: 'ได้ไข่มุก', en: 'Pearls earned', ko: '얻은 진주', zh: '获得珍珠', hi: 'मिले मोती' },
  collect: { th: 'เก็บไข่มุก', en: 'Collect', ko: '받기', zh: '收下', hi: 'ले लें' },
  toGrow: { th: 'ไปแต่งทะเล', en: 'Decorate my sea', ko: '바다 꾸미러 가기', zh: '去布置海洋', hi: 'समुद्र सजाएँ' },
  // shop
  tabLife: { th: 'สัตว์ทะเล', en: 'Sea life', ko: '바다 생물', zh: '海洋生物', hi: 'समुद्री जीव' },
  tabDecor: { th: 'ของตกแต่ง', en: 'Decor', ko: '장식', zh: '装饰', hi: 'सजावट' },
  unlock: { th: 'เชิญมา', en: 'Invite', ko: '초대하기', zh: '邀请', hi: 'बुलाएँ' },
  place: { th: 'วางเลย', en: 'Place', ko: '놓기', zh: '放置', hi: 'रखें' },
  addMore: { th: 'เพิ่มอีก', en: 'Add more', ko: '더 늘리기', zh: '再添加', hi: 'और जोड़ें' },
  full: { th: 'เต็มแล้ว', en: 'Full', ko: '가득 찼어요', zh: '已满', hi: 'भर गया' },
  owned: { th: 'อยู่ในทะเลแล้ว', en: 'In your sea', ko: '바다에 있어요', zh: '已在海中', hi: 'आपके समुद्र में' },
  large: { th: 'สัตว์ใหญ่', en: 'Large', ko: '대형', zh: '大型', hi: 'बड़ा' },
  needMore: { th: 'ไข่มุกยังไม่พอ ลองเล่นมินิเกมดูนะ', en: 'Not enough pearls yet — try a minigame!', ko: '진주가 조금 모자라요. 미니게임을 해 볼까요?', zh: '珍珠还不够——玩个小游戏吧！', hi: 'अभी मोती कम हैं — एक छोटा खेल खेलें!' },
  joined: { th: 'มาอยู่ในทะเลของคุณแล้ว!', en: 'joined your sea!', ko: '바다에 찾아왔어요!', zh: '来到了你的海洋！', hi: 'आपके समुद्र में आ गया!' },
  newFriend: { th: 'เพื่อนใหม่มาอยู่ในทะเลของคุณแล้ว!', en: 'A new friend joined your sea!', ko: '새 친구가 바다에 찾아왔어요!', zh: '新朋友来到了你的海洋！', hi: 'एक नया दोस्त आपके समुद्र में आया!' },
  newDecor: { th: 'ทะเลของคุณสวยขึ้นอีกแล้ว!', en: 'Your sea just grew more beautiful!', ko: '바다가 한층 더 아름다워졌어요!', zh: '你的海洋变得更美了！', hi: 'आपका समुद्र और भी सुंदर हो गया!' },
  moreFish: { th: 'ฝูงปลาใหญ่ขึ้นแล้ว!', en: 'Your school just grew!', ko: '무리가 더 커졌어요!', zh: '鱼群变大了！', hi: 'आपका झुंड बड़ा हो गया!' },
  timeUp: { th: 'หมดเวลา', en: 'Time’s up', ko: '시간 종료', zh: '时间到', hi: 'समय समाप्त' },
  endEarly: { th: 'จบเกม', en: 'Finish', ko: '끝내기', zh: '结束', hi: 'समाप्त' },
  growsNote: { th: 'ยิ่งเล่น ทะเลยิ่งมีชีวิตชีวา', en: 'The more you play, the more alive your sea becomes', ko: '놀수록 바다가 점점 풍성해져요', zh: '玩得越多，海洋越有生机', hi: 'जितना खेलेंगे, समुद्र उतना ही जीवंत होगा' },
  // species
  sp_minnow: { th: 'ปลาแก้วฝูงเงิน', en: 'Glass Minnows', ko: '은빛 유리 송사리', zh: '银色玻璃小鱼', hi: 'चाँदी जैसी छोटी मछलियाँ' },
  sp_clown: { th: 'ปลาส้มลายขาว', en: 'Ember Clownfish', ko: '불씨 흰동가리', zh: '余烬小丑鱼', hi: 'अंगारा क्लाउनफ़िश' },
  sp_angel: { th: 'ปลาเทวดาแสงตะวัน', en: 'Sunrise Angelfish', ko: '해돋이 엔젤피시', zh: '朝阳神仙鱼', hi: 'सूर्योदय एंजेलफ़िश' },
  sp_tang: { th: 'ปลาฟ้าครามน้อย', en: 'Azure Tangs', ko: '하늘빛 탱', zh: '天蓝刺尾鱼', hi: 'नीलम टैंग' },
  sp_jelly: { th: 'แมงกะพรุนแสงจันทร์', en: 'Moonlight Jellies', ko: '달빛 해파리', zh: '月光水母', hi: 'चाँदनी जेलीफ़िश' },
  sp_turtle: { th: 'เต่าทะเลใจดี', en: 'Gentle Sea Turtle', ko: '느긋한 바다거북', zh: '温柔的海龟', hi: 'शांत समुद्री कछुआ' },
  sp_manta: { th: 'กระเบนราหู', en: 'Manta Ray', ko: '만타가오리', zh: '蝠鲼', hi: 'मंटा रे' },
  sp_whale: { th: 'ฉลามวาฬ', en: 'Whale Shark', ko: '고래상어', zh: '鲸鲨', hi: 'व्हेल शार्क' },
  // decor
  dc_coral: { th: 'สวนปะการัง', en: 'Coral Garden', ko: '산호 정원', zh: '珊瑚花园', hi: 'मूंगा बगीचा' },
  dc_kelp: { th: 'ป่าสาหร่ายเคลป์', en: 'Kelp Forest', ko: '켈프 숲', zh: '海藻森林', hi: 'केल्प वन' },
  dc_arch: { th: 'ซุ้มหินโบราณ', en: 'Stone Arch', ko: '바위 아치', zh: '石拱门', hi: 'पत्थर का मेहराब' },
  dc_clam: { th: 'หอยมือเสือยักษ์', en: 'Giant Clam', ko: '대왕조개', zh: '巨型砗磲', hi: 'विशाल सीप' },
  dc_anem: { th: 'ดอกไม้ทะเล', en: 'Sea Anemones', ko: '말미잘 밭', zh: '海葵丛', hi: 'समुद्री एनीमोन' },
};
const KEY = 'bluehaven.lang';
export function detectLang() {
  try { const s = localStorage.getItem(KEY); if (s && LANGS.some(l => l.code === s)) return s; } catch (e) {}
  const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  for (const raw of list) { const p = String(raw).toLowerCase().split(/[-_]/)[0]; if (LANGS.some(l => l.code === p)) return p; }
  return 'en';
}
let current = 'en';
export function setLang(code, save = true) {
  current = LANGS.some(l => l.code === code) ? code : 'en';
  if (save) { try { localStorage.setItem(KEY, current); } catch (e) {} }
  document.documentElement.lang = current;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
export function getLang() { return current; }
export function t(key) { const e = S[key]; if (!e) return key; return e[current] || e.en; }
