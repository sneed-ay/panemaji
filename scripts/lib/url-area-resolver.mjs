/**
 * URL → v5b area slug マッピング (URL ベースのフォールバック解決)
 *
 * pickArea() の 第3段 として使う。日本語キーワード照合 (第1〜2段) で
 * マッチしない shop を URL の機械可読シグナルから救済する。
 *
 * 対応している URL ソース:
 *   1. cityheaven.net  /<pref>/A<5digit>/A<6digit>/...  → A-code から
 *   2. esthe-zukan.com /<region>/<pref-city>/<id>      → city slug から
 *
 * MECE: pref-scoped で運用するため別 pref とは衝突しない。
 *
 * 出典: 2026-05-04 時点の DB 分析 (active shops の URL から逆引き)
 */

// cityheaven A-code → v5b slug
export const CITYHEAVEN_AREA_CODES = {
  hokkaido: { A0101: 'sapporo-susukino', A0102: 'asahikawa', A0103: 'hakodate', A0104: 'sapporo-susukino', A0105: 'tomakomai-chitose', A0107: 'kushiro-nemuro', A0108: 'obihiro-tokachi', A0109: 'kushiro-nemuro', A0113: 'tomakomai-chitose' },
  aomori: { A0201: 'aomori-city', A0202: 'hachinohe' },
  iwate: { A0302: 'morioka', A0303: 'kitakami-hanamaki', A0304: 'ichinoseki' },
  miyagi: { A0401: 'sendai-kokubuncho', A0402: 'sendai-kokubuncho', A0403: 'furukawa-osaki', A0404: 'ishinomaki' },
  akita: { A0503: 'akita-city' },
  yamagata: { A0601: 'yamagata-city', A0602: 'yonezawa', A0603: 'tsuruoka-sakata' },
  fukushima: { A0701: 'fukushima-city', A0702: 'koriyama', A0703: 'sukagawa-shirakawa', A0704: 'iwaki', A0705: 'aizu-wakamatsu', A0708: 'fukushima-city' },
  ibaraki: { A0801: 'mito', A0802: 'tsukuba-tsuchiura', A0803: 'koga-joso', A0804: 'kashima-kamisu', A0805: 'hitachinaka-hitachi', A0806: 'koga-joso' },
  tochigi: { A0901: 'utsunomiya', A0902: 'oyama-tochigi', A0904: 'ashikaga-sano', A0905: 'nasu-shiobara' },
  gunma: { A1001: 'takasaki', A1002: 'ota-isesaki', A1003: 'maebashi', A1004: 'shibukawa-numata' },
  saitama: { A1101: 'omiya', A1102: 'kawaguchi-nishikawaguchi', A1103: 'kawagoe', A1104: 'kasukabe-koshigaya', A1105: 'kumagaya-gyoda', A1106: 'tokorozawa-iruma', A1115: 'kasukabe-koshigaya', A1116: 'honjo-fukaya', A1117: 'kasukabe-koshigaya', A1123: 'kuki-satte' },
  chiba: { A1201: 'chiba-city', A1202: 'funabashi-ichikawa', A1203: 'matsudo-kashiwa', A1204: 'narita-sakura', A1205: 'mobara-togane', A1206: 'kisarazu-kimitsu', A1208: 'tsudanuma-makuhari', A1210: 'matsudo-kashiwa', A1211: 'kisarazu-kimitsu' },
  tokyo: { A1301: 'shinbashi-ginza', A1302: 'shinbashi-ginza', A1303: 'shibuya-ebisu', A1304: 'shinjuku', A1305: 'ikebukuro', A1307: 'roppongi-akasaka', A1310: 'akihabara-kanda', A1311: 'ueno-uguisudani', A1312: 'ueno-uguisudani', A1313: 'kinshicho-kameido', A1315: 'shinagawa-tamachi', A1316: 'kamata-omori-oimachi', A1317: 'gotanda-meguro', A1319: 'kichijoji-mitaka', A1321: 'kichijoji-mitaka', A1324: 'otsuka-sugamo-akabane', A1326: 'kichijoji-mitaka', A1330: 'tachikawa-hachioji-machida', A1331: 'tachikawa-hachioji-machida' },
  kanagawa: { A1401: 'kannai-isezaki', A1402: 'fujisawa-shonan', A1403: 'kawasaki', A1404: 'yokosuka-miura', A1405: 'atsugi-ebina', A1406: 'atsugi-ebina', A1407: 'odawara-hakone' },
  niigata: { A1501: 'niigata-city', A1505: 'nagaoka', A1506: 'joetsu-myoko' },
  toyama: { A1601: 'toyama-city', A1602: 'toyama-city', A1604: 'takaoka' },
  ishikawa: { A1701: 'kanazawa', A1702: 'kanazawa', A1703: 'kanazawa' },
  fukui: { A1801: 'fukui-city', A1802: 'echizen-takefu' },
  yamanashi: { A1901: 'kofu' },
  nagano: { A2001: 'nagano-city', A2002: 'matsumoto', A2003: 'saku-karuizawa', A2004: 'suwa-chino', A2006: 'iida-ina' },
  gifu: { A2101: 'gifu-city', A2102: 'ogaki-seino', A2103: 'gifu-city', A2104: 'tajimi-tono', A2105: 'gifu-city' },
  shizuoka: { A2201: 'shizuoka-city', A2202: 'hamamatsu', A2203: 'numazu' },
  aichi: { A2301: 'nagoya-sakae', A2302: 'ichinomiya-owari', A2303: 'ichinomiya-owari', A2304: 'handa-chita', A2305: 'okazaki-kariya-anjo', A2306: 'toyohashi-gamagori' },
  mie: { A2401: 'matsusaka', A2402: 'yokkaichi', A2403: 'ise-shima', A2404: 'nabari-iga' },
  shiga: { A2501: 'otsu-kusatsu', A2502: 'otsu-kusatsu', A2503: 'hikone-omi' },
  kyoto: { A2601: 'kiyamachi-kawaramachi', A2603: 'kyoto-other' },
  osaka: { A2701: 'umeda-kitashinchi', A2702: 'namba-shinsaibashi', A2703: 'kyobashi-tenma', A2704: 'tennoji-abeno', A2705: 'sakai', A2706: 'kishiwada-izumisano', A2707: 'yao-higashiosaka', A2708: 'hirakata-neyagawa', A2709: 'takatsuki-ibaraki', A2710: 'tondabayashi-habikino' },
  hyogo: { A2801: 'sannomiya-kobe', A2802: 'sannomiya-kobe', A2803: 'amagasaki', A2804: 'himeji', A2805: 'toyooka-tajima' },
  nara: { A2901: 'nara-city', A2902: 'nara-city' },
  wakayama: { A3001: 'wakayama-city', A3004: 'tanabe-shirahama', A3005: 'shingu-nachi' },
  okayama: { A3301: 'okayama-city', A3302: 'kurashiki', A3304: 'tsuyama-mimasaka' },
  hiroshima: { A3401: 'hiroshima-city', A3403: 'fukuyama', A3404: 'kure-higashihiroshima' },
  yamaguchi: { A3501: 'yamaguchi-city', A3502: 'shimonoseki', A3503: 'yamaguchi-city', A3504: 'ube-onoda', A3505: 'shunan-tokuyama', A3506: 'iwakuni-yanai' },
  tokushima: { A3601: 'tokushima-city' },
  kagawa: { A3701: 'takamatsu', A3702: 'marugame-zentsuji' },
  ehime: { A3801: 'matsuyama', A3802: 'niihama-saijo', A3803: 'ozu-uchiko', A3804: 'uwajima-nanyo' },
  kochi: { A3901: 'kochi-city' },
  fukuoka: { A4001: 'fukuoka-tenjin-hakata', A4003: 'kitakyushu-kokura', A4004: 'kurume', A4007: 'iizuka-tagawa' },
  saga: { A4101: 'saga-city', A4102: 'saga-city', A4103: 'saga-city' },
  nagasaki: { A4201: 'nagasaki-city', A4202: 'sasebo' },
  kumamoto: { A4301: 'kumamoto-city', A4304: 'yatsushiro', A4306: 'yamaga-kikuchi' },
  oita: { A4401: 'oita-city', A4403: 'beppu', A4404: 'oita-city' },
  miyazaki: { A4501: 'miyazaki-city', A4502: 'miyazaki-city', A4503: 'miyazaki-city' },
  kagoshima: { A4601: 'kagoshima-city', A4604: 'kagoshima-city', A4605: 'kirishima-kokubu', A4606: 'kagoshima-city', A4607: 'kagoshima-city' },
  okinawa: { A4701: 'naha', A4702: 'nago-onna', A4703: 'okinawa-koza', A4705: 'okinawa-other' },
};

// esthe-zukan.com 第3パスセグメント → v5b slug
// パスは esthe-zukan.com/<region>/<pref-city>/<id> 形式
export const ESTHE_ZUKAN_PATHS = {
  hokkaido: {
    hokkaidosapporo: 'sapporo-susukino',
    hokkaidoasahikawa: 'asahikawa',
  },
  miyagi: { tohokumiyagi: 'sendai-kokubuncho' },
  aomori: { tohokuaomori: 'aomori-city' },
  fukui: { tohokufukui: 'fukui-city' },
  fukushima: { tohokufukushima: 'fukushima-city' },
  ishikawa: { tohokuishikawa: 'kanazawa' },
  toyama: { tohokutoyama: 'toyama-city' },
  yamanashi: { kantoyamanashi: 'kofu' },
  ibaraki: { kantoibaraki: 'mito' },
  tochigi: { kantotochigi: 'utsunomiya' },
  gunma: { kantogunma: 'takasaki' },
  chiba: { kantochiba: 'chiba-city' },
  saitama: { tokyosaitama: 'omiya' },
  mie: { nagoyamie: 'yokkaichi' },
  shizuoka: { nagoyashizuoka: 'shizuoka-city' },
  gifu: { nagoyagifu: 'gifu-city' },
  tokyo: {
    tokyoshinjuku: 'shinjuku',
    tokyotakadababa: 'okubo-takadanobaba',
    tokyoshibuya: 'shibuya-ebisu',
    tokyoaoyama: 'shibuya-ebisu',
    tokyomeguro: 'gotanda-meguro',
    tokyoshinagawa: 'shinagawa-tamachi',
    tokyoikebukuro: 'ikebukuro',
    tokyoroppongi: 'roppongi-akasaka',
    tokyoginza: 'shinbashi-ginza',
    tokyomarunouchi: 'shinbashi-ginza',
    tokyokanda: 'akihabara-kanda',
    tokyoueno: 'ueno-uguisudani',
    tokyokinshicho: 'kinshicho-kameido',
    tokyokichijoji: 'kichijoji-mitaka',
    tokyochofu: 'kichijoji-mitaka',
    tokyonishitokyo: 'tachikawa-hachioji-machida',
    tokyotachikawa: 'tachikawa-hachioji-machida',
    tokyomachida: 'tachikawa-hachioji-machida',
    tokyofussa: 'tachikawa-hachioji-machida',
    tokyonakano: 'nakano-koenji',
    tokyootsuka: 'otsuka-sugamo-akabane',
    tokyoakabane: 'otsuka-sugamo-akabane',
    tokyokitasenju: 'kitasenju-adachi',
    tokyoyotsuya: 'iidabashi-ichigaya',
    tokyoseijo: 'tokyo-other',
    tokyosangenchaya: 'tokyo-other',
    tokyohoka: 'tokyo-other',
  },
  kanagawa: {
    yokohamayokohamashi: 'kannai-isezaki',
    yokohamakawasakishi: 'kawasaki',
    yokohamasonota: 'kanagawa-other',
  },
  aichi: {
    nagoyanagoyashi: 'nagoya-sakae',
    nagoyaichinomiya: 'ichinomiya-owari',
    nagoyaokazaki: 'okazaki-kariya-anjo',
    nagoyatoyokawa: 'toyohashi-gamagori',
    nagoyaaichi: 'aichi-other',
    nagoyahoka: 'aichi-other',
  },
  shiga: { kansaishiga: 'otsu-kusatsu' },
  nara: { kansainara: 'nara-city' },
  wakayama: { kansaiwakayama: 'wakayama-city' },
  kyoto: {
    kyotokawaramachi: 'kiyamachi-kawaramachi',
    kyotoshijo: 'karasuma-shijo',
    kyotokyotoeki: 'kyoto-station-higashiyama',
    kyotonijo: 'saiin-nishioji',
    kyotofushimi: 'fushimi-momoyama',
    kyotohoka: 'kyoto-other',
  },
  osaka: {
    osakaumeda: 'umeda-kitashinchi',
    osakananba: 'namba-shinsaibashi',
    osakasinsaibashi: 'namba-shinsaibashi',
    osakanihonbashi: 'namba-shinsaibashi',
    osakahorie: 'namba-shinsaibashi',
    osakahonmachi: 'tanimachi-honmachi',
    osakatanimachi: 'tanimachi-honmachi',
    osakakitahama: 'tanimachi-honmachi',
    osakatennoji: 'tennoji-abeno',
    osakatsuruhashi: 'tsuruhashi-imazato',
    osakajuso: 'juso-nishinari',
    osakasakai: 'sakai',
    osakakyobashi: 'kyobashi-tenma',
    osakatenma: 'kyobashi-tenma',
    osakatenroku: 'kyobashi-tenma',
    osakaibaraki: 'takatsuki-ibaraki',
    osakataisho: 'fukushima-noda',
    osakahirano: 'osaka-other',
    osakahoka: 'osaka-other',
  },
  hyogo: {
    kobesannomiya: 'sannomiya-kobe',
    kobehimeji: 'himeji',
    kobenishinomiya: 'nishinomiya-ashiya',
    kobeashiya: 'nishinomiya-ashiya',
    kobeamagasaki: 'amagasaki',
    kobeakashi: 'kakogawa-akashi',
    kobehyogo: 'hyogo-other',
    kobehoka: 'hyogo-other',
  },
  hiroshima: { chugokuhiroshima: 'hiroshima-city' },
  okayama: { chugokuokayama: 'okayama-city' },
  yamaguchi: { chugokuyamaguchi: 'yamaguchi-city' },
  tokushima: { chugokutokushima: 'tokushima-city' },
  kagawa: { chugokukagawa: 'takamatsu' },
  ehime: { chugokuehime: 'matsuyama' },
  kochi: { chugokukochi: 'kochi-city' },
  fukuoka: {
    fukuokahakata: 'fukuoka-tenjin-hakata',
    fukuokakitakyusyu: 'kitakyushu-kokura',
    fukuokahoka: 'fukuoka-other',
  },
  saga: { fukuokasaga: 'saga-city' },
  nagasaki: { fukuokanagasaki: 'nagasaki-city' },
  kumamoto: { fukuokakumamoto: 'kumamoto-city' },
  oita: { fukuokaoita: 'oita-city' },
  miyazaki: { fukuokamiyazaki: 'miyazaki-city' },
  kagoshima: { fukuokakagoshima: 'kagoshima-city' },
  okinawa: { fukuokaokinawa: 'naha' },
};

/**
 * URL から v5b slug を推定 (cityheaven A-code または esthe-zukan path)
 * @param {string} pref - prefecture key (e.g., 'tokyo')
 * @param {string} url - shop source URL
 * @returns {string|null} v5b slug or null if no match
 */
export function pickAreaByUrl(pref, url) {
  if (!pref || !url) return null;

  // cityheaven A-code
  if (url.includes('cityheaven.net')) {
    const map = CITYHEAVEN_AREA_CODES[pref];
    if (map) {
      const m = url.match(/\/A\d{4}\//);
      if (m) {
        const slug = map[m[0].slice(1, -1)];
        if (slug) return slug;
      }
    }
  }

  // esthe-zukan path
  if (url.includes('esthe-zukan.com')) {
    const map = ESTHE_ZUKAN_PATHS[pref];
    if (map) {
      const m = url.match(/esthe-zukan\.com\/[a-z]+\/([a-z]+)\//);
      if (m) {
        const slug = map[m[1]];
        if (slug) return slug;
      }
    }
  }

  return null;
}

// Backward-compat alias (cityheaven 限定の旧名)
export function pickByCityheavenCode(pref, url) {
  return pickAreaByUrl(pref, url);
}
