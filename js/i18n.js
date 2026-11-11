// BLUE HAVEN — 5-language strings (th / en / ko / zh / hi)
export const LANGS = [
  { code: 'th', label: 'ไทย' }, { code: 'en', label: 'English' }, { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' }, { code: 'hi', label: 'हिन्दी' },
];
const S = {
  subtitle: { th: 'สวนใต้ทะเลลึกของฉัน', en: 'My own garden in the deep sea', ko: '나만의 심해 정원', zh: '我的深海花园', hi: 'गहरे समुद्र में मेरा अपना बगीचा' },
  intro: { th: 'ดำดิ่งสู่ทะเลลึกที่เงียบสงบ ที่ซึ่งสิ่งมีชีวิตเรืองแสงเบาๆ เล่นมินิเกมสบายๆ เก็บไข่มุก แล้วเชิญเพื่อนใหม่มาอยู่ในทะเลของคุณ ไม่มีการแข่ง ไม่ต้องรีบ', en: 'Sink into the quiet deep, where gentle creatures glow softly in the dark. Play calm little games, gather pearls, and invite new friends into your own sea. No rush, no pressure.', ko: '은은하게 빛나는 생물들이 사는 고요한 심해로 내려가요. 잔잔한 미니게임으로 진주를 모아 새 친구들을 나만의 바다에 초대해요. 서두를 것도, 경쟁할 것도 없어요.', zh: '沉入静谧的深海，温柔的生物在黑暗中轻轻发光。玩轻松的小游戏，收集珍珠，邀请新朋友来到你的海洋。不必着急，没有压力。', hi: 'शांत गहरे समुद्र में उतरें, जहाँ कोमल जीव अँधेरे में हल्के-हल्के चमकते हैं। हल्के खेल खेलें, मोती इकट्ठा करें और अपने समुद्र में नए दोस्त बुलाएँ। कोई जल्दी नहीं, कोई दबाव नहीं।' },
  start: { th: 'ดำดิ่งลงไป', en: 'Descend', ko: '심해로 내려가기', zh: '潜入深海', hi: 'नीचे उतरें' },
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
  mg1: { th: 'ลูกแก้วแสงลอยขึ้น', en: 'Rising Light Orbs', ko: '떠오르는 빛 구슬', zh: '上升的光珠', hi: 'उठते प्रकाश गोले' },
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
  newDecor: { th: 'ทะเลลึกของคุณสว่างขึ้นอีกแล้ว!', en: 'Your deep sea just got a little brighter!', ko: '심해가 한층 더 환해졌어요!', zh: '你的深海又亮了一些！', hi: 'आपका गहरा समुद्र थोड़ा और रोशन हो गया!' },
  moreFish: { th: 'ฝูงปลาใหญ่ขึ้นแล้ว!', en: 'Your school just grew!', ko: '무리가 더 커졌어요!', zh: '鱼群变大了！', hi: 'आपका झुंड बड़ा हो गया!' },
  timeUp: { th: 'หมดเวลา', en: 'Time’s up', ko: '시간 종료', zh: '时间到', hi: 'समय समाप्त' },
  endEarly: { th: 'จบเกม', en: 'Finish', ko: '끝내기', zh: '结束', hi: 'समाप्त' },
  growsNote: { th: 'ยิ่งเล่น ทะเลลึกยิ่งสว่างไสว', en: 'The more you play, the more your deep sea glows', ko: '놀수록 심해가 점점 더 환하게 빛나요', zh: '玩得越多，深海越加闪亮', hi: 'जितना खेलेंगे, आपका गहरा समुद्र उतना ही चमकेगा' },
  sp_jelly: { th: 'แมงกะพรุนมงกุฎเรืองแสง', en: 'Glow Crown Jelly', ko: '빛 왕관 해파리', zh: '发光冠水母', hi: 'चमकता मुकुट जेलीफ़िश' },
  sp_whale: { th: 'วาฬสเปิร์ม', en: 'Sperm Whale', ko: '향유고래', zh: '抹香鲸', hi: 'स्पर्म व्हेल' },
  dc_arch: { th: 'ซุ้มหินแสงจันทร์', en: 'Moonlit Stone Arch', ko: '달빛 바위 아치', zh: '月光石拱门', hi: 'चाँदनी पत्थर मेहराब' },
  dc_clam: { th: 'หอยมุกเรืองแสง', en: 'Pearl Clam', ko: '빛나는 진주조개', zh: '发光珍珠贝', hi: 'चमकता मोती सीप' },
  dc_anem: { th: 'ทุ่งดอกไม้ทะเลเรืองแสง', en: 'Glowing Anemone Field', ko: '빛나는 말미잘 밭', zh: '发光海葵田', hi: 'चमकते एनीमोन का मैदान' },
  sp_lantern: { th: 'ปลาตะเกียง', en: 'Lanternfish', ko: '샛비늘치(랜턴피시)', zh: '灯笼鱼', hi: 'लालटेन मछली' },
  sp_hatchet: { th: 'ปลาขวานเงิน', en: 'Silver Hatchetfish', ko: '은빛 손도끼고기', zh: '银斧鱼', hi: 'चाँदी हैचेटफ़िश' },
  sp_angler: { th: 'ปลาตกเบ็ดตัวน้อย', en: 'Little Anglerfish', ko: '꼬마 아귀', zh: '小鮟鱇', hi: 'नन्ही एंगलरफ़िश' },
  sp_comb: { th: 'แมงกะพรุนหวีสายรุ้ง', en: 'Rainbow Comb Jelly', ko: '무지개 빗해파리', zh: '彩虹栉水母', hi: 'इंद्रधनुषी कॉम्ब जेली' },
  sp_dumbo: { th: 'ปลาหมึกดัมโบ้', en: 'Dumbo Octopus', ko: '덤보 문어', zh: '小飞象章鱼', hi: 'डंबो ऑक्टोपस' },
  sp_eel: { th: 'ปลาไหลริบบิ้นเรืองแสง', en: 'Glowline Ribbon Eel', ko: '빛줄기 리본장어', zh: '荧光缎带鳗', hi: 'चमकती रिबन ईल' },
  sp_manta: { th: 'กระเบนแมนต้าทะเลลึก', en: 'Deep Manta Ray', ko: '심해 만타가오리', zh: '深海蝠鲼', hi: 'गहरे समुद्र की मंटा रे' },
  sp_squid: { th: 'หมึกยักษ์ใจดี', en: 'Gentle Giant Squid', ko: '다정한 대왕오징어', zh: '温柔的大王乌贼', hi: 'शांत विशाल स्क्विड' },
  dc_coral: { th: 'สวนปะการังเรืองแสง', en: 'Bioluminescent Coral Garden', ko: '발광 산호 정원', zh: '发光珊瑚花园', hi: 'चमकता मूंगा बगीचा' },
  dc_vent: { th: 'ปล่องน้ำพุร้อน', en: 'Hydrothermal Vent', ko: '열수 분출구', zh: '深海热泉', hi: 'हाइड्रोथर्मल वेंट' },
  dc_sponge: { th: 'ป่าฟองน้ำแก้ว', en: 'Glass Sponge Grove', ko: '유리해면 숲', zh: '玻璃海绵林', hi: 'काँच स्पंज उपवन' },
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
