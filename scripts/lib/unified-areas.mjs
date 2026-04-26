/**
 * 独自MECE エリア定義 (docs/area-definition.md の機械可読版)
 *
 * 原則:
 *   1. ME (Mutually Exclusive) — 同一エリアは1スロットのみ
 *   2. CE (Collectively Exhaustive) — 全都道府県に {pref}-other (display_order=99) フォールバック
 *   3. 0店舗エリアは作らない / 残さない
 *   4. slug は すべて 英小文字+ハイフンのみ (日英混在禁止: `fukuiその他` ❌ → `fukui-other` ✅)
 */

export const UNIFIED_AREAS = {
  // ─── 関東 ─────────────────────────────────
  tokyo: [
    { slug: 'shinjuku',   name: '新宿・歌舞伎町',     order: 1, keywords: ['新宿','歌舞伎町','高田馬場','大久保','西新宿'] },
    { slug: 'ikebukuro',  name: '池袋',                order: 2, keywords: ['池袋'] },
    { slug: 'shibuya',    name: '渋谷・恵比寿',        order: 3, keywords: ['渋谷','恵比寿','代官山','原宿','青山','表参道','道玄坂'] },
    { slug: 'gotanda',    name: '五反田・目黒',        order: 4, keywords: ['五反田','目黒','白金'] },
    { slug: 'shinagawa',  name: '品川・田町',          order: 5, keywords: ['品川','田町','三田','浜松町'] },
    { slug: 'kamata',     name: '蒲田・大井町',        order: 6, keywords: ['蒲田','大井町','大森'] },
    { slug: 'ueno',       name: '上野・鶯谷・浅草',    order: 7, keywords: ['上野','鶯谷','浅草','吉原','日暮里','入谷','御徒町'] },
    { slug: 'kinshicho',  name: '錦糸町・亀戸・小岩',  order: 8, keywords: ['錦糸町','亀戸','小岩','新小岩','葛飾','金町','葛西','西葛西','行徳','浦安'] },
    { slug: 'shinbashi',  name: '新橋・銀座',          order: 9, keywords: ['新橋','銀座','汐留','有楽町','日本橋','東京駅'] },
    { slug: 'akihabara',  name: '秋葉原・神田',        order: 10, keywords: ['秋葉原','神田','御茶ノ水','水道橋'] },
    { slug: 'roppongi',   name: '六本木・赤坂',        order: 11, keywords: ['六本木','赤坂','麻布','西麻布','広尾'] },
    { slug: 'iidabashi',  name: '飯田橋・市ヶ谷',      order: 12, keywords: ['飯田橋','神楽坂','市ヶ谷','四ツ谷','四谷'] },
    { slug: 'otsuka',     name: '大塚・巣鴨・赤羽',    order: 13, keywords: ['大塚','巣鴨','赤羽','板橋','十条','駒込'] },
    { slug: 'nakano',     name: '中野・高円寺・荻窪',  order: 14, keywords: ['中野','高円寺','荻窪','西荻窪','阿佐ヶ谷','阿佐谷','杉並','練馬','大泉学園'] },
    { slug: 'kitasenju',  name: '北千住・足立',        order: 15, keywords: ['北千住','綾瀬','足立','竹ノ塚'] },
    { slug: 'kichijoji',  name: '吉祥寺・三鷹・府中',  order: 16, keywords: ['吉祥寺','三鷹','府中','調布','国分寺','武蔵野','多摩','国立','小金井'] },
    { slug: 'tachikawa',  name: '立川・八王子・町田',  order: 17, keywords: ['立川','八王子','町田','青梅','昭島','福生'] },
    { slug: 'tokyo-other',name: '東京その他',          order: 99, keywords: ['世田谷','下北沢','自由が丘','二子玉川','三軒茶屋','東急','京王','小田急','西武','東武','伊豆諸島','小笠原','築地','お台場','湾岸'] },
  ],
  kanagawa: [
    { slug: 'yokohama',     name: '横浜・関内',         order: 1, keywords: ['横浜','関内','野毛','宮川町','曙町','福富町','桜木町'] },
    { slug: 'kawasaki',     name: '川崎',                order: 2, keywords: ['川崎','堀之内','南町'] },
    { slug: 'yokosuka',     name: '横須賀・三浦',        order: 3, keywords: ['横須賀','三浦'] },
    { slug: 'fujisawa',     name: '藤沢・湘南',          order: 4, keywords: ['藤沢','湘南','平塚','茅ヶ崎','茅ケ崎'] },
    { slug: 'atsugi',       name: '厚木・海老名・大和',  order: 5, keywords: ['厚木','海老名','大和','本厚木'] },
    { slug: 'sagamihara',   name: '相模原・橋本',        order: 6, keywords: ['相模原','橋本'] },
    { slug: 'odawara',      name: '小田原・箱根',        order: 7, keywords: ['小田原','箱根'] },
    { slug: 'kanagawa-other',name:'神奈川その他',        order: 99, keywords: [] },
  ],
  saitama: [
    { slug: 'omiya',         name: '大宮・さいたま',     order: 1, keywords: ['大宮','さいたま','浦和','与野'] },
    { slug: 'nishikawaguchi',name: '西川口・蕨・川口',   order: 2, keywords: ['西川口','蕨','川口'] },
    { slug: 'kawagoe',       name: '川越',                order: 3, keywords: ['川越'] },
    { slug: 'tokorozawa',    name: '所沢・入間',          order: 4, keywords: ['所沢','入間','狭山'] },
    { slug: 'koshigaya',     name: '越谷・草加・春日部',  order: 5, keywords: ['越谷','草加','春日部'] },
    { slug: 'kumagaya',      name: '熊谷・深谷・本庄',    order: 6, keywords: ['熊谷','深谷','本庄'] },
    { slug: 'kuki',          name: '久喜・蓮田',          order: 7, keywords: ['久喜','蓮田'] },
    { slug: 'saitama-other', name: '埼玉その他',          order: 99, keywords: [] },
  ],
  chiba: [
    { slug: 'chiba-city',    name: '千葉・栄町',          order: 1, keywords: ['千葉駅','栄町','千葉市'] },
    { slug: 'funabashi',     name: '船橋・西船橋・津田沼',order: 2, keywords: ['船橋','西船橋','津田沼','本八幡'] },
    { slug: 'kashiwa',       name: '柏・松戸',            order: 3, keywords: ['柏','松戸'] },
    { slug: 'ichikawa',      name: '市川・浦安',          order: 4, keywords: ['市川','浦安'] },
    { slug: 'narita',        name: '成田・印西',          order: 5, keywords: ['成田','印西'] },
    { slug: 'togane',        name: '東金・茂原',          order: 6, keywords: ['東金','茂原'] },
    { slug: 'kisarazu',      name: '木更津・市原',        order: 7, keywords: ['木更津','市原','袖ヶ浦','五井'] },
    { slug: 'chiba-other',   name: '千葉その他',          order: 99, keywords: [] },
  ],
  ibaraki: [
    { slug: 'mito',          name: '水戸',                 order: 1, keywords: ['水戸'] },
    { slug: 'tsuchiura',     name: '土浦・つくば',         order: 2, keywords: ['土浦','つくば','牛久','取手','龍ケ崎'] },
    { slug: 'kashima',       name: '神栖・鹿嶋',           order: 3, keywords: ['神栖','鹿嶋','鹿島'] },
    { slug: 'ibaraki-other', name: '茨城その他',           order: 99, keywords: [] },
  ],
  tochigi: [
    { slug: 'utsunomiya',    name: '宇都宮',               order: 1, keywords: ['宇都宮'] },
    { slug: 'oyama',         name: '小山・栃木・佐野',     order: 2, keywords: ['小山','栃木','佐野','足利'] },
    { slug: 'nasu',          name: '那須塩原・日光',       order: 3, keywords: ['那須','塩原','日光','黒磯'] },
    { slug: 'tochigi-other', name: '栃木その他',           order: 99, keywords: [] },
  ],
  gunma: [
    { slug: 'takasaki',      name: '高崎・前橋',           order: 1, keywords: ['高崎','前橋'] },
    { slug: 'ota',           name: '太田・伊勢崎・桐生',   order: 2, keywords: ['太田','伊勢崎','桐生'] },
    { slug: 'gunma-other',   name: '群馬その他',           order: 99, keywords: [] },
  ],
  // ─── 東北 ─────────────────────────────────
  miyagi: [
    { slug: 'sendai',        name: '仙台',                 order: 1, keywords: ['仙台','国分町'] },
    { slug: 'ishinomaki',    name: '石巻・塩釜・松島',     order: 2, keywords: ['石巻','塩釜','松島'] },
    { slug: 'osaki',         name: '大崎・古川',           order: 3, keywords: ['大崎','古川'] },
    { slug: 'miyagi-other',  name: '宮城その他',           order: 99, keywords: [] },
  ],
  fukushima: [
    { slug: 'fukushima-city',name: '福島・二本松',         order: 1, keywords: ['福島市','二本松'] },
    { slug: 'koriyama',      name: '郡山',                 order: 2, keywords: ['郡山'] },
    { slug: 'iwaki',         name: 'いわき・小名浜',       order: 3, keywords: ['いわき','小名浜'] },
    { slug: 'aizu',          name: '会津若松',             order: 4, keywords: ['会津','若松'] },
    { slug: 'shirakawa',     name: '白河',                 order: 5, keywords: ['白河'] },
    { slug: 'fukushima-other',name:'福島その他',           order: 99, keywords: [] },
  ],
  yamagata: [
    { slug: 'yamagata-city', name: '山形・天童',           order: 1, keywords: ['山形市','天童','上山'] },
    { slug: 'sakata',        name: '酒田・鶴岡・庄内',     order: 2, keywords: ['酒田','鶴岡','庄内'] },
    { slug: 'yonezawa',      name: '米沢',                 order: 3, keywords: ['米沢','南陽','長井'] },
    { slug: 'shinjo',        name: '新庄・最上',           order: 4, keywords: ['新庄','最上','尾花沢'] },
    { slug: 'yamagata-other',name: '山形その他',           order: 99, keywords: [] },
  ],
  iwate: [
    { slug: 'morioka',       name: '盛岡',                 order: 1, keywords: ['盛岡'] },
    { slug: 'kitakami',      name: '北上・花巻・一関',     order: 2, keywords: ['北上','花巻','一関','奥州'] },
    { slug: 'iwate-other',   name: '岩手その他',           order: 99, keywords: [] },
  ],
  akita: [
    { slug: 'akita-city',    name: '秋田市・能代・男鹿',   order: 1, keywords: ['秋田市','能代','男鹿','大館','鹿角','横手','大曲'] },
    { slug: 'akita-other',   name: '秋田その他',           order: 99, keywords: [] },
  ],
  aomori: [
    { slug: 'aomori-city',   name: '青森・弘前',           order: 1, keywords: ['青森市','弘前','津軽'] },
    { slug: 'hachinohe',     name: '八戸・三沢',           order: 2, keywords: ['八戸','三沢','十和田'] },
    { slug: 'aomori-other',  name: '青森その他',           order: 99, keywords: [] },
  ],
  // ─── 北海道 ───────────────────────────────
  hokkaido: [
    { slug: 'sapporo',       name: '札幌・すすきの',       order: 1, keywords: ['札幌','すすきの','薄野','大通'] },
    { slug: 'asahikawa',     name: '旭川',                 order: 2, keywords: ['旭川','富良野','士別'] },
    { slug: 'hakodate',      name: '函館',                 order: 3, keywords: ['函館','松前'] },
    { slug: 'obihiro',       name: '帯広・十勝',           order: 4, keywords: ['帯広','十勝'] },
    { slug: 'kushiro',       name: '釧路・北見・網走',     order: 5, keywords: ['釧路','北見','網走','中標津'] },
    { slug: 'tomakomai',     name: '苫小牧・室蘭・千歳',   order: 6, keywords: ['苫小牧','室蘭','千歳'] },
    { slug: 'hokkaido-other',name: '北海道その他',         order: 99, keywords: [] },
  ],
  // ─── 中部 ─────────────────────────────────
  niigata: [
    { slug: 'niigata-city',  name: '新潟市',               order: 1, keywords: ['新潟市'] },
    { slug: 'nagaoka',       name: '長岡・三条',           order: 2, keywords: ['長岡','三条'] },
    { slug: 'joetsu',        name: '上越',                 order: 3, keywords: ['上越','直江津'] },
    { slug: 'niigata-other', name: '新潟その他',           order: 99, keywords: [] },
  ],
  nagano: [
    { slug: 'nagano-city',   name: '長野市・千曲',         order: 1, keywords: ['長野市','千曲'] },
    { slug: 'ueda',          name: '上田・佐久・軽井沢',   order: 2, keywords: ['上田','佐久','軽井沢'] },
    { slug: 'matsumoto',     name: '松本・安曇野',         order: 3, keywords: ['松本','安曇野'] },
    { slug: 'suwa',          name: '諏訪・伊那・飯田',     order: 4, keywords: ['諏訪','伊那','飯田'] },
    { slug: 'nagano-other',  name: '長野その他',           order: 99, keywords: [] },
  ],
  shizuoka: [
    { slug: 'shizuoka-city', name: '静岡・焼津',           order: 1, keywords: ['静岡市','焼津'] },
    { slug: 'hamamatsu',     name: '浜松・磐田',           order: 2, keywords: ['浜松','磐田'] },
    { slug: 'numazu',        name: '沼津・富士・伊豆',     order: 3, keywords: ['沼津','富士','伊豆','三島','熱海'] },
    { slug: 'shizuoka-other',name: '静岡その他',           order: 99, keywords: [] },
  ],
  aichi: [
    { slug: 'nagoya',        name: '名古屋',               order: 1, keywords: ['名古屋','栄','錦','丸の内','名駅','納屋橋','今池','池下','金山','大曽根','柴田','春日井'] },
    { slug: 'ichinomiya',    name: '一宮・稲沢',           order: 2, keywords: ['一宮','稲沢'] },
    { slug: 'toyota',        name: '豊田・岡崎・刈谷',     order: 3, keywords: ['豊田','岡崎','刈谷','安城'] },
    { slug: 'toyohashi',     name: '豊橋・豊川',           order: 4, keywords: ['豊橋','豊川'] },
    { slug: 'aichi-other',   name: '愛知その他',           order: 99, keywords: ['小牧','犬山'] },
  ],
  gifu: [
    { slug: 'gifu-city',     name: '岐阜・金津園',         order: 1, keywords: ['岐阜','金津園'] },
    { slug: 'gifu-other',    name: '岐阜その他',           order: 99, keywords: ['大垣','多治見','可児'] },
  ],
  ishikawa: [
    { slug: 'kanazawa',      name: '金沢',                 order: 1, keywords: ['金沢','片町'] },
    { slug: 'ishikawa-other',name: '石川その他',           order: 99, keywords: ['小松','加賀','七尾'] },
  ],
  toyama: [
    { slug: 'toyama-city',   name: '富山市',               order: 1, keywords: ['富山市','富山駅','滑川'] },
    { slug: 'takaoka',       name: '高岡・射水',           order: 2, keywords: ['高岡','射水','新湊','氷見'] },
    { slug: 'toyama-other',  name: '富山その他',           order: 99, keywords: ['魚津','砺波','黒部'] },
  ],
  fukui: [
    { slug: 'fukui',         name: '福井',                 order: 1, keywords: ['福井'] },
    { slug: 'fukui-other',   name: '福井その他',           order: 99, keywords: [] },
  ],
  yamanashi: [
    { slug: 'yamanashi',     name: '山梨',                 order: 1, keywords: ['甲府','山梨','富士吉田','石和'] },
    { slug: 'yamanashi-other',name:'山梨その他',           order: 99, keywords: [] },
  ],
  // ─── 近畿 ─────────────────────────────────
  osaka: [
    { slug: 'namba',         name: '難波・日本橋・天王寺', order: 1, keywords: ['難波','なんば','日本橋','天王寺','心斎橋','道頓堀','阿倍野'] },
    { slug: 'umeda',         name: '梅田・キタ・京橋',     order: 2, keywords: ['梅田','キタ','北新地','京橋','十三','塚本','新大阪','西中島'] },
    { slug: 'sakai',         name: '堺・南大阪',           order: 3, keywords: ['堺','南大阪','岸和田','泉佐野'] },
    { slug: 'osaka-other',   name: '大阪その他',           order: 99, keywords: ['東大阪','北摂','枚方','茨木','吹田','豊中','箕面'] },
  ],
  hyogo: [
    { slug: 'kobe',          name: '神戸・阪神',           order: 1, keywords: ['神戸','三宮','阪神','西宮','尼崎','芦屋','福原'] },
    { slug: 'himeji',        name: '姫路・加古川・明石',   order: 2, keywords: ['姫路','加古川','明石'] },
    { slug: 'hyogo-other',   name: '兵庫その他',           order: 99, keywords: ['豊岡','丹波'] },
  ],
  kyoto: [
    { slug: 'kyoto',         name: '京都',                 order: 1, keywords: ['京都','祇園','河原町','烏丸'] },
    { slug: 'kyoto-other',   name: '京都その他',           order: 99, keywords: [] },
  ],
  mie: [
    { slug: 'yokkaichi',     name: '四日市・桑名・鈴鹿',   order: 1, keywords: ['四日市','桑名','鈴鹿'] },
    { slug: 'tsu',           name: '津・松阪',             order: 2, keywords: ['津','松阪','伊勢'] },
    { slug: 'mie-other',     name: '三重その他',           order: 99, keywords: [] },
  ],
  shiga: [
    { slug: 'shiga',         name: '滋賀',                 order: 1, keywords: ['大津','草津','彦根','雄琴','長浜'] },
    { slug: 'shiga-other',   name: '滋賀その他',           order: 99, keywords: [] },
  ],
  nara: [
    { slug: 'nara',          name: '奈良',                 order: 1, keywords: ['奈良','橿原'] },
    { slug: 'nara-other',    name: '奈良その他',           order: 99, keywords: [] },
  ],
  wakayama: [
    { slug: 'wakayama',      name: '和歌山',               order: 1, keywords: ['和歌山','田辺','新宮'] },
    { slug: 'wakayama-other',name: '和歌山その他',         order: 99, keywords: [] },
  ],
  // ─── 中国 ─────────────────────────────────
  hiroshima: [
    { slug: 'hiroshima-city',name: '広島市',               order: 1, keywords: ['広島市','流川','八丁堀'] },
    { slug: 'fukuyama',      name: '福山・尾道',           order: 2, keywords: ['福山','尾道','三原'] },
    { slug: 'hiroshima-other',name:'広島その他',           order: 99, keywords: [] },
  ],
  okayama: [
    { slug: 'okayama-city',  name: '岡山市',               order: 1, keywords: ['岡山市','岡山駅'] },
    { slug: 'kurashiki',     name: '倉敷',                 order: 2, keywords: ['倉敷'] },
    { slug: 'okayama-other', name: '岡山その他',           order: 99, keywords: [] },
  ],
  yamaguchi: [
    { slug: 'yamaguchi-city',name: '山口・防府・周南',     order: 1, keywords: ['山口市','防府','周南','徳山'] },
    { slug: 'ube',           name: '宇部・小野田',         order: 2, keywords: ['宇部','小野田'] },
    { slug: 'yamaguchi-other',name:'山口その他',           order: 99, keywords: ['萩','下関','岩国'] },
  ],
  tottori: [
    { slug: 'tottori',       name: '鳥取',                 order: 1, keywords: ['鳥取','米子','倉吉'] },
    { slug: 'tottori-other', name: '鳥取その他',           order: 99, keywords: [] },
  ],
  shimane: [
    { slug: 'shimane',       name: '島根',                 order: 1, keywords: ['松江','出雲','浜田'] },
    { slug: 'shimane-other', name: '島根その他',           order: 99, keywords: [] },
  ],
  // ─── 四国 ─────────────────────────────────
  tokushima: [
    { slug: 'tokushima',     name: '徳島',                 order: 1, keywords: ['徳島'] },
    { slug: 'tokushima-other',name:'徳島その他',           order: 99, keywords: [] },
  ],
  kagawa: [
    { slug: 'takamatsu',     name: '高松',                 order: 1, keywords: ['高松'] },
    { slug: 'kagawa-other',  name: '香川その他',           order: 99, keywords: ['丸亀','坂出'] },
  ],
  ehime: [
    { slug: 'matsuyama',     name: '松山',                 order: 1, keywords: ['松山','道後'] },
    { slug: 'ehime-other',   name: '愛媛その他',           order: 99, keywords: ['今治','西条'] },
  ],
  kochi: [
    { slug: 'kochi',         name: '高知',                 order: 1, keywords: ['高知'] },
    { slug: 'kochi-other',   name: '高知その他',           order: 99, keywords: [] },
  ],
  // ─── 九州・沖縄 ──────────────────────────
  fukuoka: [
    { slug: 'fukuoka-city',  name: '福岡・中洲',           order: 1, keywords: ['福岡市','博多','中洲','天神'] },
    { slug: 'kitakyushu',    name: '北九州・筑豊',         order: 2, keywords: ['北九州','小倉','筑豊','黒崎'] },
    { slug: 'kurume',        name: '久留米・筑後',         order: 3, keywords: ['久留米','筑後'] },
    { slug: 'shimonoseki',   name: '下関',                 order: 4, keywords: ['下関'] },
    { slug: 'fukuoka-other', name: '福岡その他',           order: 99, keywords: ['大牟田','飯塚'] },
  ],
  saga: [
    { slug: 'saga',          name: '佐賀',                 order: 1, keywords: ['佐賀','嬉野','武雄'] },
    { slug: 'saga-other',    name: '佐賀その他',           order: 99, keywords: [] },
  ],
  nagasaki: [
    { slug: 'nagasaki',      name: '長崎',                 order: 1, keywords: ['長崎'] },
    { slug: 'sasebo',        name: '佐世保',               order: 2, keywords: ['佐世保'] },
    { slug: 'nagasaki-other',name: '長崎その他',           order: 99, keywords: [] },
  ],
  kumamoto: [
    { slug: 'kumamoto-city', name: '熊本市',               order: 1, keywords: ['熊本市','熊本駅'] },
    { slug: 'kumamoto-other',name: '熊本その他',           order: 99, keywords: ['八代','人吉'] },
  ],
  oita: [
    { slug: 'oita-city',     name: '大分市',               order: 1, keywords: ['大分市','大分駅'] },
    { slug: 'oita-other',    name: '大分その他',           order: 99, keywords: ['別府','由布院','中津'] },
  ],
  miyazaki: [
    { slug: 'miyazaki',      name: '宮崎',                 order: 1, keywords: ['宮崎','延岡','都城','霧島'] },
    { slug: 'miyazaki-other',name: '宮崎その他',           order: 99, keywords: [] },
  ],
  kagoshima: [
    { slug: 'kagoshima-city',name: '鹿児島市',             order: 1, keywords: ['鹿児島市','天文館'] },
    { slug: 'kagoshima-other',name:'鹿児島その他',         order: 99, keywords: [] },
  ],
  okinawa: [
    { slug: 'naha',          name: '那覇',                 order: 1, keywords: ['那覇','国際通り'] },
    { slug: 'okinawa-other', name: '沖縄その他',           order: 99, keywords: ['沖縄市','宜野湾','北谷','うるま'] },
  ],
};

/**
 * shop名 + source_url + 既存 area名 から 適切な独自スラグを推定
 *
 * @param {string} pref panemaji の都道府県 slug
 * @param {string} shopName cleanShopName後の店名
 * @param {string} sourceUrl 取込元URL
 * @param {string} oldAreaName 旧 area name (キーワード抽出に使用可)
 * @returns {{slug: string, name: string, order: number}|null}
 */
export function pickArea(pref, shopName, sourceUrl, oldAreaName) {
  const list = UNIFIED_AREAS[pref];
  if (!list) return null;
  const text = [shopName || '', sourceUrl || '', oldAreaName || ''].join(' ');
  // 1) keyword一致 (-other 以外)
  for (const a of list) {
    if (a.order === 99) continue; // skip fallback
    for (const k of a.keywords) {
      if (k && text.includes(k)) return { slug: a.slug, name: a.name, order: a.order };
    }
  }
  // 2) fallback {pref}-other
  const fallback = list.find((a) => a.order === 99);
  return fallback ? { slug: fallback.slug, name: fallback.name, order: fallback.order } : null;
}

export function getAllAreas() {
  const all = [];
  for (const [pref, list] of Object.entries(UNIFIED_AREAS)) {
    for (const a of list) all.push({ prefecture: pref, ...a });
  }
  return all;
}
