/**
 * 独自MECEエリア定義 v5b — 唯一の正
 *
 * - 47都道府県 / **325 slug** / docs/area-definition.md と同期
 * - 過不足ゼロ。新規追加は docs と同時1コミット必須
 * - 各エリアは name=日本語, slug=英小文字+ハイフン, order=サブエリア順, keywords=店舗名/URL/旧area名から拾う照合語
 *
 * 原則:
 *   1. ME (Mutually Exclusive) — 同一店舗は1エリアにのみ属する
 *   2. CE (Collectively Exhaustive) — 必要な pref のみ {pref}-other 設置 (order:99)
 *   3. キーワードは長いものを優先 (pickArea が score = kw.length * 2 で比較)
 *   4. 同pref内のキーワード重複禁止 (両エリアにマッチすると最初listed勝ち)
 *   5. slug は 英小文字+ハイフン のみ。末尾 -other は日本語名「○○その他」
 *
 * 履歴:
 *   v4 → v5b (2026-05-04): 159 → 325, 各都道府県のサブエリア細分化 (SEO long-tail)
 */

export const UNIFIED_AREAS = {
  // ============== 北海道・東北 ==============
  hokkaido: [
    { name: '札幌・すすきの', slug: 'sapporo-susukino', order: 1, keywords: ['すすきの', '薄野', '札幌中央区', '札幌大通', '札幌駅前', '札幌駅', '大通公園', '狸小路', '中島公園'] },
    { name: '札幌・北区/東区', slug: 'sapporo-kitahigashi', order: 2, keywords: ['札幌北区', '北24条', '麻生', '新琴似', '屯田', '札幌東区', '環状通', '苗穂', '東苗穂', '元町'] },
    { name: '札幌・西区/手稲', slug: 'sapporo-nishi-teine', order: 3, keywords: ['札幌西区', '手稲', '琴似', '二十四軒', '宮の沢'] },
    { name: '札幌・南区/豊平', slug: 'sapporo-minami-toyohira', order: 4, keywords: ['札幌南区', '真駒内', '豊平', '月寒', '平岸', '美園'] },
    { name: '札幌・厚別/白石', slug: 'sapporo-atsubetsu-shiroishi', order: 5, keywords: ['厚別', '新札幌', '白石', '南郷'] },
    { name: '函館', slug: 'hakodate', order: 6, keywords: ['函館'] },
    { name: '旭川', slug: 'asahikawa', order: 7, keywords: ['旭川'] },
    { name: '帯広・十勝', slug: 'obihiro-tokachi', order: 8, keywords: ['帯広', '十勝', '音更'] },
    { name: '釧路・根室', slug: 'kushiro-nemuro', order: 9, keywords: ['釧路', '根室', '厚岸'] },
    { name: '苫小牧・千歳', slug: 'tomakomai-chitose', order: 10, keywords: ['苫小牧', '千歳', '室蘭', '登別', '伊達', '恵庭', '北広島', '江別'] },
    { name: '小樽・北見・稚内', slug: 'otaru-kitami-wakkanai', order: 11, keywords: ['小樽', '北見', '稚内', '網走', '紋別'] },
    { name: '北海道その他', slug: 'hokkaido-other', order: 99, keywords: ['北海道その他', '富良野', 'ニセコ', '道東', '道北', '道南', '日高', '夕張', '岩見沢', '滝川', '深川'] },
  ],
  aomori: [
    { name: '青森市', slug: 'aomori-city', order: 1, keywords: ['青森市', '青森駅', '浅虫', '新青森'] },
    { name: '八戸', slug: 'hachinohe', order: 2, keywords: ['八戸'] },
    { name: '弘前', slug: 'hirosaki', order: 3, keywords: ['弘前'] },
    { name: 'むつ・下北', slug: 'mutsu-shimokita', order: 4, keywords: ['むつ', '下北', '大間', '東通'] },
    { name: '青森その他', slug: 'aomori-other', order: 99, keywords: ['青森その他', '五所川原', '十和田', '三沢', '黒石', '平川', '北津軽'] },
  ],
  iwate: [
    { name: '盛岡', slug: 'morioka', order: 1, keywords: ['盛岡'] },
    { name: '一関', slug: 'ichinoseki', order: 2, keywords: ['一関', '平泉'] },
    { name: '北上・花巻', slug: 'kitakami-hanamaki', order: 3, keywords: ['北上', '花巻'] },
    { name: '釜石・大船渡', slug: 'kamaishi-ofunato', order: 4, keywords: ['釜石', '大船渡', '陸前高田', '久慈', '宮古'] },
    { name: '岩手その他', slug: 'iwate-other', order: 99, keywords: ['岩手その他', '奥州', '水沢', '紫波', '雫石', '滝沢', '二戸'] },
  ],
  miyagi: [
    { name: '仙台・国分町', slug: 'sendai-kokubuncho', order: 1, keywords: ['仙台', '国分町', '一番町', 'クリスロード'] },
    { name: '仙台・青葉区', slug: 'sendai-aoba', order: 2, keywords: ['青葉区', '北仙台', '八幡', '旭ヶ丘', '東照宮'] },
    { name: '仙台・若林区/太白区', slug: 'sendai-wakabayashi-taihaku', order: 3, keywords: ['若林区', '太白区', '長町', '荒井'] },
    { name: '仙台・宮城野区/泉区', slug: 'sendai-miyagino-izumi', order: 4, keywords: ['宮城野区', '泉区', '榴岡', '苦竹', '福室', '泉中央'] },
    { name: '石巻', slug: 'ishinomaki', order: 5, keywords: ['石巻', '東松島', '女川'] },
    { name: '古川・大崎', slug: 'furukawa-osaki', order: 6, keywords: ['古川', '大崎', '鳴子'] },
    { name: '宮城その他', slug: 'miyagi-other', order: 99, keywords: ['宮城その他', '白石', '名取', '多賀城', '塩竈', '気仙沼', '岩沼', '富谷', '利府', '山元'] },
  ],
  akita: [
    { name: '秋田市', slug: 'akita-city', order: 1, keywords: ['秋田市', '秋田駅', '川反', '川端'] },
    { name: '横手', slug: 'yokote', order: 2, keywords: ['横手'] },
    { name: '大館・北秋田', slug: 'odate-kitaakita', order: 3, keywords: ['大館', '北秋田', '鹿角'] },
    { name: '由利本荘・能代', slug: 'yuri-noshiro', order: 4, keywords: ['由利本荘', '能代', 'にかほ'] },
    { name: '秋田その他', slug: 'akita-other', order: 99, keywords: ['秋田その他', '大仙', '仙北', '湯沢', '男鹿', '潟上'] },
  ],
  yamagata: [
    { name: '山形市', slug: 'yamagata-city', order: 1, keywords: ['山形市', '山形駅', '七日町'] },
    { name: '米沢', slug: 'yonezawa', order: 2, keywords: ['米沢'] },
    { name: '鶴岡・酒田', slug: 'tsuruoka-sakata', order: 3, keywords: ['鶴岡', '酒田'] },
    { name: '新庄', slug: 'shinjo-mogami', order: 4, keywords: ['新庄', '最上'] },
    { name: '天童・東根', slug: 'tendo-higashine', order: 5, keywords: ['天童', '東根', '寒河江', '村山'] },
    { name: '山形その他', slug: 'yamagata-other', order: 99, keywords: ['山形その他', '上山', '南陽', '長井', '尾花沢'] },
  ],
  fukushima: [
    { name: '福島市', slug: 'fukushima-city', order: 1, keywords: ['福島駅', '福島市', '福島県福島'] },
    { name: '郡山', slug: 'koriyama', order: 2, keywords: ['郡山'] },
    { name: 'いわき', slug: 'iwaki', order: 3, keywords: ['いわき', '小名浜', '湯本', '内郷'] },
    { name: '会津若松', slug: 'aizu-wakamatsu', order: 4, keywords: ['会津若松', '会津'] },
    { name: '須賀川・白河', slug: 'sukagawa-shirakawa', order: 5, keywords: ['須賀川', '白河'] },
    { name: '二本松・本宮', slug: 'nihonmatsu-motomiya', order: 6, keywords: ['二本松', '本宮', '安達'] },
    { name: '福島その他', slug: 'fukushima-other', order: 99, keywords: ['福島その他', '喜多方', '相馬', '南相馬', '田村', '大熊', '浪江'] },
  ],
  // ============== 関東 ==============
  ibaraki: [
    { name: '水戸', slug: 'mito', order: 1, keywords: ['水戸'] },
    { name: 'つくば・土浦', slug: 'tsukuba-tsuchiura', order: 2, keywords: ['つくば', '土浦', '牛久', '龍ヶ崎', '龍ケ崎'] },
    { name: 'ひたちなか・日立', slug: 'hitachinaka-hitachi', order: 3, keywords: ['ひたちなか', '日立', '那珂', '高萩', '北茨城', 'ひたち海浜'] },
    { name: '古河・常総', slug: 'koga-joso', order: 4, keywords: ['古河', '常総', '守谷', '取手', '下妻'] },
    { name: '鹿嶋・神栖', slug: 'kashima-kamisu', order: 5, keywords: ['鹿嶋', '神栖', '鉾田', '大洗'] },
    { name: '笠間・石岡', slug: 'kasama-ishioka', order: 6, keywords: ['笠間', '石岡', '桜川', '結城', '筑西'] },
    { name: '茨城その他', slug: 'ibaraki-other', order: 99, keywords: ['茨城その他', '稲敷', '小美玉', '行方', '潮来'] },
  ],
  tochigi: [
    { name: '宇都宮', slug: 'utsunomiya', order: 1, keywords: ['宇都宮'] },
    { name: '小山・栃木', slug: 'oyama-tochigi', order: 2, keywords: ['小山', '栃木市', '下野'] },
    { name: '足利・佐野', slug: 'ashikaga-sano', order: 3, keywords: ['足利', '佐野'] },
    { name: '鹿沼・日光', slug: 'kanuma-nikko', order: 4, keywords: ['鹿沼', '日光', '今市'] },
    { name: '那須塩原', slug: 'nasu-shiobara', order: 5, keywords: ['那須塩原', '那須', '大田原', '西那須野', '黒磯'] },
    { name: '栃木その他', slug: 'tochigi-other', order: 99, keywords: ['栃木その他', '真岡', '益子', '茂木', '烏山', '矢板', '喜連川'] },
  ],
  gunma: [
    { name: '高崎', slug: 'takasaki', order: 1, keywords: ['高崎'] },
    { name: '前橋', slug: 'maebashi', order: 2, keywords: ['前橋'] },
    { name: '太田・伊勢崎', slug: 'ota-isesaki', order: 3, keywords: ['太田', '伊勢崎', '桐生', 'みどり'] },
    { name: '渋川・沼田', slug: 'shibukawa-numata', order: 4, keywords: ['渋川', '沼田', '利根', '草津温泉', '伊香保', '水上', '老神'] },
    { name: '館林', slug: 'tatebayashi', order: 5, keywords: ['館林', '邑楽'] },
    { name: '群馬その他', slug: 'gunma-other', order: 99, keywords: ['群馬その他', '富岡', '安中', '藤岡', '玉村', '吉岡'] },
  ],
  saitama: [
    { name: '大宮・さいたま', slug: 'omiya', order: 1, keywords: ['大宮', 'さいたま', '北与野', '日進'] },
    { name: '浦和', slug: 'urawa', order: 2, keywords: ['浦和', '与野', '南浦和', '北浦和', '武蔵浦和', '中浦和'] },
    { name: '川口・西川口・蕨', slug: 'kawaguchi-nishikawaguchi', order: 3, keywords: ['川口', '蕨', '戸田', '西川口'] },
    { name: '川越', slug: 'kawagoe', order: 4, keywords: ['川越'] },
    { name: '所沢・入間', slug: 'tokorozawa-iruma', order: 5, keywords: ['所沢', '入間', '飯能', '狭山'] },
    { name: '春日部・越谷', slug: 'kasukabe-koshigaya', order: 6, keywords: ['春日部', '越谷', '草加', '八潮', '三郷'] },
    { name: '上尾・桶川', slug: 'ageo-okegawa', order: 7, keywords: ['上尾', '桶川', '北本', '朝霞', '志木', '和光', '新座'] },
    { name: '熊谷・行田', slug: 'kumagaya-gyoda', order: 8, keywords: ['熊谷', '行田', '鴻巣'] },
    { name: '本庄・深谷', slug: 'honjo-fukaya', order: 9, keywords: ['本庄', '深谷', '寄居'] },
    { name: '久喜・幸手', slug: 'kuki-satte', order: 10, keywords: ['久喜', '幸手', '蓮田', '白岡', '杉戸', '宮代'] },
    { name: 'ふじみ野・坂戸', slug: 'fujimino-sakado', order: 11, keywords: ['ふじみ野', '富士見', '坂戸', '鶴ヶ島', '東松山', '比企'] },
    { name: '埼玉その他', slug: 'saitama-other', order: 99, keywords: ['埼玉その他', '秩父', '長瀞', '羽生', '加須'] },
  ],
  chiba: [
    { name: '千葉市', slug: 'chiba-city', order: 1, keywords: ['千葉駅', '千葉市', '千葉中央', '蘇我', '稲毛'] },
    { name: '船橋・市川', slug: 'funabashi-ichikawa', order: 2, keywords: ['船橋', '市川', '浦安', '行徳', '本八幡'] },
    { name: '松戸・柏', slug: 'matsudo-kashiwa', order: 3, keywords: ['松戸', '柏', '流山', '我孫子', '鎌ヶ谷'] },
    { name: '津田沼・幕張', slug: 'tsudanuma-makuhari', order: 4, keywords: ['津田沼', '幕張', '習志野'] },
    { name: '木更津・君津', slug: 'kisarazu-kimitsu', order: 5, keywords: ['木更津', '君津', '富津', '袖ヶ浦'] },
    { name: '成田・佐倉', slug: 'narita-sakura', order: 6, keywords: ['成田', '佐倉', '八街', '富里'] },
    { name: '茂原・東金', slug: 'mobara-togane', order: 7, keywords: ['茂原', '東金', '大網', '山武', '一宮'] },
    { name: '銚子・旭', slug: 'choshi-asahi', order: 8, keywords: ['銚子', '旭', '八日市場', '匝瑳', '香取'] },
    { name: '館山・南房総', slug: 'tateyama-minami-boso', order: 9, keywords: ['館山', '南房総', '鴨川', '勝浦'] },
    { name: '八千代・四街道', slug: 'yachiyo-yotsukaido', order: 10, keywords: ['八千代', '四街道', '印西', '白井'] },
    { name: '市原・五井', slug: 'ichihara-goi', order: 11, keywords: ['市原', '五井', '八幡宿', '姉ヶ崎'] },
    { name: '千葉その他', slug: 'chiba-other', order: 99, keywords: ['千葉その他', '野田', '関宿'] },
  ],
  tokyo: [
    { name: '新宿・歌舞伎町', slug: 'shinjuku', order: 1, keywords: ['新宿', '歌舞伎町', '西新宿', '東新宿'] },
    { name: '大久保・高田馬場', slug: 'okubo-takadanobaba', order: 2, keywords: ['大久保', '新大久保', '高田馬場'] },
    { name: '池袋', slug: 'ikebukuro', order: 3, keywords: ['池袋'] },
    { name: '渋谷・恵比寿', slug: 'shibuya-ebisu', order: 4, keywords: ['渋谷', '恵比寿', '代官山', '原宿', '表参道', '神宮前', '道玄坂'] },
    { name: '五反田・目黒', slug: 'gotanda-meguro', order: 5, keywords: ['五反田', '目黒', '白金', '大崎', '不動前'] },
    { name: '品川・田町・浜松町', slug: 'shinagawa-tamachi', order: 6, keywords: ['品川', '田町', '三田', '浜松町'] },
    { name: '蒲田・大森・大井町', slug: 'kamata-omori-oimachi', order: 7, keywords: ['蒲田', '大井町', '大森', '西大井', '平和島'] },
    { name: '上野・鶯谷・浅草・吉原', slug: 'ueno-uguisudani', order: 8, keywords: ['上野', '鶯谷', '浅草', '吉原', '日暮里', '西日暮里', '入谷', '御徒町'] },
    { name: '錦糸町・亀戸', slug: 'kinshicho-kameido', order: 9, keywords: ['錦糸町', '亀戸', '両国', '押上', '業平', '住吉', '木場'] },
    { name: '小岩・新小岩・葛西', slug: 'koiwa-kasai', order: 10, keywords: ['小岩', '新小岩', '葛飾', '金町', '葛西', '江戸川', '一之江', '平井'] },
    { name: '新橋・銀座・日本橋', slug: 'shinbashi-ginza', order: 11, keywords: ['新橋', '銀座', '汐留', '有楽町', '日本橋', '八重洲', '京橋', '東京駅'] },
    { name: '秋葉原・神田・御茶ノ水', slug: 'akihabara-kanda', order: 12, keywords: ['秋葉原', '神田', '御茶ノ水', '水道橋', '後楽園'] },
    { name: '六本木・赤坂・麻布', slug: 'roppongi-akasaka', order: 13, keywords: ['六本木', '赤坂', '麻布', '西麻布', '広尾', '溜池'] },
    { name: '飯田橋・市ヶ谷・四ツ谷', slug: 'iidabashi-ichigaya', order: 14, keywords: ['飯田橋', '神楽坂', '市ヶ谷', '四ツ谷', '麹町'] },
    { name: '大塚・巣鴨・赤羽', slug: 'otsuka-sugamo-akabane', order: 15, keywords: ['大塚', '巣鴨', '駒込', '赤羽', '板橋', '十条', '王子'] },
    { name: '中野・高円寺・荻窪', slug: 'nakano-koenji', order: 16, keywords: ['中野', '高円寺', '荻窪', '阿佐ヶ谷', '杉並', '西荻窪'] },
    { name: '北千住・足立', slug: 'kitasenju-adachi', order: 17, keywords: ['北千住', '綾瀬', '足立', '竹ノ塚'] },
    { name: '吉祥寺・三鷹・府中', slug: 'kichijoji-mitaka', order: 18, keywords: ['吉祥寺', '三鷹', '府中', '調布', '国分寺', '武蔵野', '武蔵境'] },
    { name: '立川・八王子・町田', slug: 'tachikawa-hachioji-machida', order: 19, keywords: ['立川', '八王子', '町田', '青梅', '昭島', '福生', '多摩', '拝島', '多摩センター', '日野'] },
    { name: '東京その他', slug: 'tokyo-other', order: 99, keywords: ['東京その他', '23区外', '練馬', '世田谷', '下北沢', '自由が丘', '二子玉川', '三軒茶屋', '中目黒', '学芸大学', '都立大学', '成城'] },
  ],
  kanagawa: [
    { name: '横浜駅・西口', slug: 'yokohama-station', order: 1, keywords: ['横浜駅', '横浜西口', 'みなとみらい', '桜木町', '新横浜', '横浜東口'] },
    { name: '関内・伊勢佐木・福富町', slug: 'kannai-isezaki', order: 2, keywords: ['関内', '日ノ出町', '福富町', '曙町', '野毛', '宮川町', '伊勢佐木', '馬車道'] },
    { name: '横浜南部', slug: 'yokohama-south', order: 3, keywords: ['戸塚', '上大岡', '港南', '磯子', '金沢文庫', '杉田', '八景'] },
    { name: '横浜北部', slug: 'yokohama-north', order: 4, keywords: ['鶴見', '港北', '日吉', '綱島', '北山田', 'センター北', 'センター南', '青葉区'] },
    { name: '川崎', slug: 'kawasaki', order: 5, keywords: ['川崎', '武蔵小杉', '溝の口', '鹿島田', '新川崎'] },
    { name: '横須賀・三浦', slug: 'yokosuka-miura', order: 6, keywords: ['横須賀', '三浦', '逗子', '葉山', '久里浜', '衣笠'] },
    { name: '藤沢・湘南', slug: 'fujisawa-shonan', order: 7, keywords: ['藤沢', '鎌倉', '湘南', '茅ヶ崎', '平塚', '大船', '辻堂'] },
    { name: '厚木・海老名・大和', slug: 'atsugi-ebina', order: 8, keywords: ['厚木', '海老名', '大和', '本厚木', '座間', '伊勢原', '秦野'] },
    { name: '相模原・橋本', slug: 'sagamihara-hashimoto', order: 9, keywords: ['相模原', '橋本', '相模大野', '古淵'] },
    { name: '小田原・箱根', slug: 'odawara-hakone', order: 10, keywords: ['小田原', '箱根', '南足柄', '湯河原'] },
    { name: '川崎北部・新百合', slug: 'kawasaki-north', order: 11, keywords: ['新百合ヶ丘', '登戸', '向ヶ丘', '麻生区', '宮前区', '高津区'] },
    { name: '神奈川その他', slug: 'kanagawa-other', order: 99, keywords: ['神奈川その他', '中井', '大井', '開成', '松田'] },
  ],
  // ============== 中部 ==============
  niigata: [
    { name: '新潟市', slug: 'niigata-city', order: 1, keywords: ['新潟駅', '古町', '万代', '弁天'] },
    { name: '長岡', slug: 'nagaoka', order: 2, keywords: ['長岡'] },
    { name: '上越・妙高', slug: 'joetsu-myoko', order: 3, keywords: ['上越', '妙高', '高田'] },
    { name: '三条・燕', slug: 'sanjo-tsubame', order: 4, keywords: ['三条', '燕', '加茂'] },
    { name: '柏崎・魚沼', slug: 'kashiwazaki-uonuma', order: 5, keywords: ['柏崎', '魚沼', '小千谷', '十日町'] },
    { name: '新潟その他', slug: 'niigata-other', order: 99, keywords: ['新潟その他', '新発田', '村上', '五泉', '阿賀野', '佐渡'] },
  ],
  toyama: [
    { name: '富山市', slug: 'toyama-city', order: 1, keywords: ['富山市', '富山駅', '桜町'] },
    { name: '高岡', slug: 'takaoka', order: 2, keywords: ['高岡', '射水', '氷見'] },
    { name: '魚津・黒部', slug: 'uozu-kurobe', order: 3, keywords: ['魚津', '黒部', '入善', '朝日'] },
    { name: '富山その他', slug: 'toyama-other', order: 99, keywords: ['富山その他', '砺波', '南砺', '滑川', '立山'] },
  ],
  ishikawa: [
    { name: '金沢', slug: 'kanazawa', order: 1, keywords: ['金沢', '片町', '香林坊'] },
    { name: '小松', slug: 'komatsu', order: 2, keywords: ['小松', '加賀'] },
    { name: '白山・能美', slug: 'hakusan-nomi', order: 3, keywords: ['白山', '能美', '野々市', '鶴来'] },
    { name: '七尾・能登', slug: 'nanao-noto', order: 4, keywords: ['七尾', '能登', '輪島', '珠洲', '羽咋', '中能登'] },
    { name: '石川その他', slug: 'ishikawa-other', order: 99, keywords: ['石川その他', '加賀温泉', '山中温泉', '山代温泉'] },
  ],
  fukui: [
    { name: '福井市', slug: 'fukui-city', order: 1, keywords: ['福井市', '福井駅'] },
    { name: '越前・武生', slug: 'echizen-takefu', order: 2, keywords: ['越前', '武生', '鯖江'] },
    { name: '敦賀・小浜', slug: 'tsuruga-obama', order: 3, keywords: ['敦賀', '若狭', '小浜', '美浜'] },
    { name: '福井その他', slug: 'fukui-other', order: 99, keywords: ['福井その他', '芦原', '永平寺', '坂井', '三国', 'あわら'] },
  ],
  yamanashi: [
    { name: '甲府', slug: 'kofu', order: 1, keywords: ['甲府', '石和', '春日町'] },
    { name: '富士吉田・河口湖', slug: 'fujiyoshida-kawaguchiko', order: 2, keywords: ['富士吉田', '河口湖', '山中湖', '富士河口湖', '都留', '大月'] },
    { name: '韮崎・南アルプス', slug: 'nirasaki-minamialps', order: 3, keywords: ['韮崎', '南アルプス', '北杜', '中央市', '山梨市', '笛吹', '甲斐'] },
    { name: '山梨その他', slug: 'yamanashi-other', order: 99, keywords: ['山梨その他', '早川', '身延', '道志', '鳴沢'] },
  ],
  nagano: [
    { name: '長野市', slug: 'nagano-city', order: 1, keywords: ['長野市', '長野駅', '権堂'] },
    { name: '松本', slug: 'matsumoto', order: 2, keywords: ['松本', '安曇野'] },
    { name: '上田・東御', slug: 'ueda-tomi', order: 3, keywords: ['上田', '東御', '千曲', '坂城'] },
    { name: '諏訪・茅野', slug: 'suwa-chino', order: 4, keywords: ['諏訪', '茅野', '岡谷', '下諏訪'] },
    { name: '飯田・伊那', slug: 'iida-ina', order: 5, keywords: ['飯田', '伊那', '駒ヶ根'] },
    { name: '佐久・軽井沢', slug: 'saku-karuizawa', order: 6, keywords: ['佐久', '軽井沢', '小諸', '御代田', '立科'] },
    { name: '大町・白馬', slug: 'omachi-hakuba', order: 7, keywords: ['大町', '白馬', '安曇', '池田', '木曽'] },
    { name: '長野その他', slug: 'nagano-other', order: 99, keywords: ['長野その他', '須坂', '中野市', '飯山'] },
  ],
  gifu: [
    { name: '岐阜・金津園', slug: 'gifu-city', order: 1, keywords: ['岐阜駅', '金津園', '柳ヶ瀬', '岐阜市', '岐阜県岐阜'] },
    { name: '大垣・西濃', slug: 'ogaki-seino', order: 2, keywords: ['大垣', '西濃', '海津', '養老', '揖斐'] },
    { name: '各務原・羽島', slug: 'kakamigahara-hashima', order: 3, keywords: ['各務原', '羽島', '笠松', '岐南'] },
    { name: '多治見・東濃', slug: 'tajimi-tono', order: 4, keywords: ['多治見', '恵那', '中津川', '東濃', '瑞浪', '土岐'] },
    { name: '高山・飛騨', slug: 'takayama-hida', order: 5, keywords: ['高山', '飛騨', '下呂', '白川', '郡上'] },
    { name: '岐阜その他', slug: 'gifu-other', order: 99, keywords: ['岐阜その他', '美濃加茂', '中濃', '関市', '美濃市'] },
  ],
  shizuoka: [
    { name: '静岡市', slug: 'shizuoka-city', order: 1, keywords: ['静岡駅', '静岡市', '葵区', '駿河区', '清水'] },
    { name: '浜松', slug: 'hamamatsu', order: 2, keywords: ['浜松'] },
    { name: '沼津', slug: 'numazu', order: 3, keywords: ['沼津'] },
    { name: '富士・富士宮', slug: 'fuji-fujinomiya', order: 4, keywords: ['富士市', '富士宮', '富士川'] },
    { name: '三島・伊豆', slug: 'mishima-izu', order: 5, keywords: ['三島', '伊豆', '修善寺', '熱海', '伊東', '函南'] },
    { name: '焼津・藤枝', slug: 'yaizu-fujieda', order: 6, keywords: ['焼津', '藤枝', '島田'] },
    { name: '掛川・磐田', slug: 'kakegawa-iwata', order: 7, keywords: ['掛川', '磐田', '袋井', '御前崎', '牧之原'] },
    { name: '静岡その他', slug: 'shizuoka-other', order: 99, keywords: ['静岡その他', '御殿場', '裾野', '小山', '伊豆の国'] },
  ],
  aichi: [
    { name: '名古屋・栄錦', slug: 'nagoya-sakae', order: 1, keywords: ['栄', '名古屋駅', '名駅', '錦', '伏見', '丸の内', '中区'] },
    { name: '名古屋・金山大須', slug: 'nagoya-kanayama-osu', order: 2, keywords: ['金山', '大須', '上前津', '鶴舞'] },
    { name: '名古屋・千種今池東山', slug: 'nagoya-chikusa-imaike', order: 3, keywords: ['千種', '今池', '池下', '東山', '覚王山', '本山', '星ヶ丘', '八事'] },
    { name: '名古屋・名東天白', slug: 'nagoya-meito-tempaku', order: 4, keywords: ['名東', '天白', '平針', '植田', '一社'] },
    { name: '名古屋・大曽根矢田', slug: 'nagoya-ozone-yada', order: 5, keywords: ['大曽根', '矢田', '名古屋東区', '名古屋北区', '砂田橋'] },
    { name: '名古屋・港南緑', slug: 'nagoya-minato-minami-midori', order: 6, keywords: ['港区', '名古屋南区', '緑区', '鳴海', '有松'] },
    { name: '名古屋・中村西', slug: 'nagoya-nakamura-nishi', order: 7, keywords: ['中村', '太閤', '名駅西', '西区'] },
    { name: '豊橋・蒲郡', slug: 'toyohashi-gamagori', order: 8, keywords: ['豊橋', '蒲郡', '豊川', '田原', '新城'] },
    { name: '岡崎・刈谷・安城', slug: 'okazaki-kariya-anjo', order: 9, keywords: ['岡崎', '刈谷', '安城', '知立', '西尾', '碧南', '高浜'] },
    { name: '一宮・尾張', slug: 'ichinomiya-owari', order: 10, keywords: ['一宮', '尾張', '春日井', '小牧', '犬山', '江南', '稲沢'] },
    { name: '半田・知多', slug: 'handa-chita', order: 11, keywords: ['半田', '知多', '常滑', '武豊', '大府', '東海'] },
    { name: '愛知その他', slug: 'aichi-other', order: 99, keywords: ['愛知その他', '弥富', '蟹江', '飛島', 'あま', '北名古屋'] },
  ],
  mie: [
    { name: '四日市', slug: 'yokkaichi', order: 1, keywords: ['四日市', '桑名', '鈴鹿'] },
    { name: '津', slug: 'tsu', order: 2, keywords: ['津市', '津駅', '久居'] },
    { name: '松阪', slug: 'matsusaka', order: 3, keywords: ['松阪', '多気', '明和'] },
    { name: '伊勢・志摩', slug: 'ise-shima', order: 4, keywords: ['伊勢', '志摩', '鳥羽', '二見'] },
    { name: '名張・伊賀', slug: 'nabari-iga', order: 5, keywords: ['名張', '伊賀', '上野市'] },
    { name: '三重その他', slug: 'mie-other', order: 99, keywords: ['三重その他', '熊野', '尾鷲', '紀宝', '紀北', '御浜'] },
  ],
  // ============== 近畿 ==============
  shiga: [
    { name: '大津・草津', slug: 'otsu-kusatsu', order: 1, keywords: ['大津', '草津', '守山', '栗東'] },
    { name: '彦根・近江', slug: 'hikone-omi', order: 2, keywords: ['彦根', '近江', '東近江', '湖東'] },
    { name: '長浜・米原', slug: 'nagahama-maibara', order: 3, keywords: ['長浜', '米原', '湖北'] },
    { name: '甲賀・湖南', slug: 'koka-konan', order: 4, keywords: ['甲賀', '湖南', '水口', '信楽'] },
    { name: '滋賀その他', slug: 'shiga-other', order: 99, keywords: ['滋賀その他', '高島', '朽木'] },
  ],
  kyoto: [
    { name: '木屋町・河原町', slug: 'kiyamachi-kawaramachi', order: 1, keywords: ['木屋町', '河原町', '三条', '四条'] },
    { name: '烏丸・四条', slug: 'karasuma-shijo', order: 2, keywords: ['烏丸', '室町', '御池'] },
    { name: '京都駅・東山', slug: 'kyoto-station-higashiyama', order: 3, keywords: ['京都駅', '八条', '七条', '東山', '祇園', '清水'] },
    { name: '西院・西大路', slug: 'saiin-nishioji', order: 4, keywords: ['西院', '西大路', '二条', '二条城', '円町', '太秦'] },
    { name: '伏見・桃山', slug: 'fushimi-momoyama', order: 5, keywords: ['伏見', '桃山', '中書島', '丹波橋'] },
    { name: '北山・北大路', slug: 'kitayama-kitaoji', order: 6, keywords: ['北山', '北大路', '修学院', '一乗寺', '出町柳', '北野'] },
    { name: '宇治・城陽', slug: 'uji-joyo', order: 7, keywords: ['宇治', '城陽', '久御山', '八幡市', '京田辺', '木津'] },
    { name: '京都その他', slug: 'kyoto-other', order: 99, keywords: ['京都その他', '福知山', '舞鶴', '綾部', '亀岡', '長岡京', '向日', '宮津', '京丹後'] },
  ],
  osaka: [
    { name: '梅田・北新地', slug: 'umeda-kitashinchi', order: 1, keywords: ['梅田', '北新地', '大阪駅', '茶屋町', '中崎町', 'キタ', '中之島'] },
    { name: '難波・心斎橋', slug: 'namba-shinsaibashi', order: 2, keywords: ['難波', '心斎橋', '道頓堀', 'ミナミ', '千日前', '日本橋', '長堀', '西心斎橋'] },
    { name: '天王寺・阿倍野', slug: 'tennoji-abeno', order: 3, keywords: ['天王寺', '阿倍野', '寺田町', '上本町', '桃谷', '谷町九丁目'] },
    { name: '京橋・天満', slug: 'kyobashi-tenma', order: 4, keywords: ['京橋', '天満', '桜ノ宮', '都島'] },
    { name: '新大阪・西中島', slug: 'shinosaka-nishinakajima', order: 5, keywords: ['新大阪', '西中島', '江坂', '東三国'] },
    { name: '谷町・本町', slug: 'tanimachi-honmachi', order: 6, keywords: ['谷町四丁目', '谷町六丁目', '本町', '堺筋本町', '玉造'] },
    { name: '福島・野田', slug: 'fukushima-noda', order: 7, keywords: ['福島区', '野田阪神', '海老江', '西九条'] },
    { name: '鶴橋・今里', slug: 'tsuruhashi-imazato', order: 8, keywords: ['鶴橋', '今里', '布施'] },
    { name: '十三・西成', slug: 'juso-nishinari', order: 9, keywords: ['十三', '塚本', '西成', '飛田', '動物園前', '萩之茶屋', '新今宮'] },
    { name: '堺', slug: 'sakai', order: 10, keywords: ['堺市', '堺東', '中百舌鳥', '鳳', '浜寺', '北野田', '南大阪', '堺店'] },
    { name: '岸和田・泉佐野', slug: 'kishiwada-izumisano', order: 11, keywords: ['岸和田', '泉佐野', '関空', '関西空港', '高石', '泉大津', '貝塚', '熊取', '阪南', '泉州', '和泉市'] },
    { name: '枚方・寝屋川', slug: 'hirakata-neyagawa', order: 12, keywords: ['枚方', '寝屋川', '守口', '門真', '大東', '四條畷', '北河内'] },
    { name: '高槻・茨木・北摂', slug: 'takatsuki-ibaraki', order: 13, keywords: ['高槻', '茨木', '摂津', '吹田', '千里', '豊中', '池田', '箕面', '豊能', '能勢', '北摂'] },
    { name: '八尾・東大阪', slug: 'yao-higashiosaka', order: 14, keywords: ['八尾', '東大阪', '柏原', '河内'] },
    { name: '富田林・羽曳野', slug: 'tondabayashi-habikino', order: 15, keywords: ['富田林', '羽曳野', '藤井寺', '松原', '河内長野', '南河内'] },
    { name: '大阪その他', slug: 'osaka-other', order: 99, keywords: ['大阪その他', '千早赤阪', '太子'] },
  ],
  hyogo: [
    { name: '三宮・神戸', slug: 'sannomiya-kobe', order: 1, keywords: ['三宮', '神戸駅', '元町', '旧居留地', '北野', '新神戸', '福原'] },
    { name: '姫路', slug: 'himeji', order: 2, keywords: ['姫路'] },
    { name: '西宮・芦屋', slug: 'nishinomiya-ashiya', order: 3, keywords: ['西宮', '芦屋', '夙川', '苦楽園'] },
    { name: '尼崎', slug: 'amagasaki', order: 4, keywords: ['尼崎', '立花', '武庫之荘', '塚口'] },
    { name: '加古川・明石', slug: 'kakogawa-akashi', order: 5, keywords: ['加古川', '明石', '二見'] },
    { name: '宝塚・伊丹・川西', slug: 'takarazuka-itami', order: 6, keywords: ['宝塚', '伊丹', '川西'] },
    { name: '三田・三木', slug: 'sanda-miki', order: 7, keywords: ['三田市', '三木', '神戸三田', '篠山', '丹波'] },
    { name: '須磨・垂水', slug: 'suma-tarumi', order: 8, keywords: ['須磨', '垂水', '舞子'] },
    { name: '豊岡・但馬', slug: 'toyooka-tajima', order: 9, keywords: ['豊岡', '但馬', '城崎', '朝来', '養父'] },
    { name: '兵庫その他', slug: 'hyogo-other', order: 99, keywords: ['兵庫その他', '加西', '加東', '高砂', '小野', '西脇', '多可', '赤穂', '上郡', '相生'] },
  ],
  nara: [
    { name: '奈良市', slug: 'nara-city', order: 1, keywords: ['奈良市', '奈良駅', '平城', '西大寺', '大和西大寺', '学園前'] },
    { name: '生駒・大和郡山', slug: 'ikoma-yamatokoriyama', order: 2, keywords: ['生駒', '大和郡山', '平群', '三郷'] },
    { name: '橿原・桜井', slug: 'kashihara-sakurai', order: 3, keywords: ['橿原', '桜井', '御所', '飛鳥', '天理', '香芝', '大和高田'] },
    { name: '五條・吉野', slug: 'gojo-yoshino', order: 4, keywords: ['五條', '吉野', '大淀', '下市'] },
    { name: '奈良その他', slug: 'nara-other', order: 99, keywords: ['奈良その他', '宇陀', '曽爾', '川上', '上北山', '十津川'] },
  ],
  wakayama: [
    { name: '和歌山市', slug: 'wakayama-city', order: 1, keywords: ['和歌山市', '和歌山駅', '七番丁', 'ぶらくり丁'] },
    { name: '田辺・白浜', slug: 'tanabe-shirahama', order: 2, keywords: ['田辺', '白浜', '上富田'] },
    { name: '海南・有田', slug: 'kainan-arida', order: 3, keywords: ['海南', '有田', '紀の川', '紀美野'] },
    { name: '新宮・那智', slug: 'shingu-nachi', order: 4, keywords: ['新宮', '那智', '串本', '太地'] },
    { name: '和歌山その他', slug: 'wakayama-other', order: 99, keywords: ['和歌山その他', '高野', '橋本', '伊都', '御坊', '美浜'] },
  ],
  // ============== 中国 ==============
  tottori: [
    { name: '鳥取市', slug: 'tottori-city', order: 1, keywords: ['鳥取駅', '鳥取市', '若桜', '八頭'] },
    { name: '米子', slug: 'yonago', order: 2, keywords: ['米子', '境港', '境'] },
    { name: '倉吉', slug: 'kurayoshi', order: 3, keywords: ['倉吉', '三朝', '湯梨浜', '北栄'] },
    { name: '鳥取その他', slug: 'tottori-other', order: 99, keywords: ['鳥取その他', '智頭', '大山', '日吉津'] },
  ],
  shimane: [
    { name: '松江', slug: 'matsue', order: 1, keywords: ['松江', '玉造温泉'] },
    { name: '出雲', slug: 'izumo', order: 2, keywords: ['出雲'] },
    { name: '浜田・益田', slug: 'hamada-masuda', order: 3, keywords: ['浜田', '益田', '大田', '江津', '雲南'] },
    { name: '島根その他', slug: 'shimane-other', order: 99, keywords: ['島根その他', '安来', '隠岐', '邑南', '川本', '美郷'] },
  ],
  okayama: [
    { name: '岡山市', slug: 'okayama-city', order: 1, keywords: ['岡山駅', '岡山市', '表町', '田町', '中央町'] },
    { name: '倉敷', slug: 'kurashiki', order: 2, keywords: ['倉敷', '児島', '玉島', '水島'] },
    { name: '津山・美作', slug: 'tsuyama-mimasaka', order: 3, keywords: ['津山', '美作', '真庭'] },
    { name: '笠岡・井原', slug: 'kasaoka-ibara', order: 4, keywords: ['笠岡', '井原', '浅口', '矢掛'] },
    { name: '岡山その他', slug: 'okayama-other', order: 99, keywords: ['岡山その他', '玉野', '備前', '赤磐', '瀬戸内', '高梁'] },
  ],
  hiroshima: [
    { name: '広島市・流川', slug: 'hiroshima-city', order: 1, keywords: ['広島駅', '流川', '紙屋町', '八丁堀', '中区広島', '銀山町', '並木通り'] },
    { name: '福山', slug: 'fukuyama', order: 2, keywords: ['福山', '鞆の浦'] },
    { name: '呉・東広島', slug: 'kure-higashihiroshima', order: 3, keywords: ['呉市', '東広島', '西条'] },
    { name: '尾道・三原', slug: 'onomichi-mihara', order: 4, keywords: ['尾道', '三原', '因島', '向島'] },
    { name: '廿日市・宮島', slug: 'hatsukaichi-miyajima', order: 5, keywords: ['廿日市', '宮島', '大野'] },
    { name: '三次・庄原', slug: 'miyoshi-shobara', order: 6, keywords: ['三次', '庄原'] },
    { name: '広島その他', slug: 'hiroshima-other', order: 99, keywords: ['広島その他', '安芸', '江田島', '海田', '熊野', '北広島', '安芸高田'] },
  ],
  yamaguchi: [
    { name: '下関', slug: 'shimonoseki', order: 1, keywords: ['下関', '唐戸', '長府'] },
    { name: '山口市', slug: 'yamaguchi-city', order: 2, keywords: ['山口市', '山口駅', '湯田温泉', '湯田'] },
    { name: '周南・徳山', slug: 'shunan-tokuyama', order: 3, keywords: ['周南', '徳山', '下松', '光市'] },
    { name: '宇部・小野田', slug: 'ube-onoda', order: 4, keywords: ['宇部', '小野田', '山陽', '美祢'] },
    { name: '岩国・柳井', slug: 'iwakuni-yanai', order: 5, keywords: ['岩国', '柳井', '周防大島'] },
    { name: '山口その他', slug: 'yamaguchi-other', order: 99, keywords: ['山口その他', '萩市', '長門', '山口萩'] },
  ],
  // ============== 四国 ==============
  tokushima: [
    { name: '徳島市', slug: 'tokushima-city', order: 1, keywords: ['徳島駅', '徳島市', '秋田町', '富田町'] },
    { name: '鳴門・板野', slug: 'naruto-itano', order: 2, keywords: ['鳴門', '板野', '松茂', '北島'] },
    { name: '阿南・小松島', slug: 'anan-komatsushima', order: 3, keywords: ['阿南', '小松島', '那賀', '海部'] },
    { name: '徳島その他', slug: 'tokushima-other', order: 99, keywords: ['徳島その他', '吉野川', '阿波', '美馬', '三好'] },
  ],
  kagawa: [
    { name: '高松', slug: 'takamatsu', order: 1, keywords: ['高松', '古馬場', '瓦町'] },
    { name: '丸亀・善通寺', slug: 'marugame-zentsuji', order: 2, keywords: ['丸亀', '善通寺', '琴平', '多度津'] },
    { name: '坂出', slug: 'sakaide', order: 3, keywords: ['坂出', '宇多津'] },
    { name: '観音寺・三豊', slug: 'kanonji-mitoyo', order: 4, keywords: ['観音寺', '三豊'] },
    { name: '香川その他', slug: 'kagawa-other', order: 99, keywords: ['香川その他', 'さぬき', '東かがわ', '綾川', '小豆島'] },
  ],
  ehime: [
    { name: '松山', slug: 'matsuyama', order: 1, keywords: ['松山', '道後', '大街道', '伊予', '松前'] },
    { name: '今治', slug: 'imabari', order: 2, keywords: ['今治', 'しまなみ'] },
    { name: '新居浜・西条', slug: 'niihama-saijo', order: 3, keywords: ['新居浜', '西条', '四国中央', '川之江', '伊予三島', '東予'] },
    { name: '大洲・内子', slug: 'ozu-uchiko', order: 4, keywords: ['大洲', '内子', '中予'] },
    { name: '宇和島・南予', slug: 'uwajima-nanyo', order: 5, keywords: ['宇和島', '八幡浜', '愛南', '南予'] },
    { name: '愛媛その他', slug: 'ehime-other', order: 99, keywords: ['愛媛その他', '砥部', '東温', '久万'] },
  ],
  kochi: [
    { name: '高知市', slug: 'kochi-city', order: 1, keywords: ['高知駅', '高知市', '帯屋町', 'はりまや'] },
    { name: '南国・香南', slug: 'nankoku-konan', order: 2, keywords: ['南国', '香南', '香美', '物部'] },
    { name: '須崎・四万十', slug: 'susaki-shimanto', order: 3, keywords: ['須崎', '四万十', '黒潮', '土佐', '安芸市'] },
    { name: '高知その他', slug: 'kochi-other', order: 99, keywords: ['高知その他', '嶺北', '本山', '大豊', '越知'] },
  ],
  // ============== 九州・沖縄 ==============
  fukuoka: [
    { name: '中州・天神・博多', slug: 'fukuoka-tenjin-hakata', order: 1, keywords: ['中州', '中洲', '天神', '博多', '福岡市', '福岡駅'] },
    { name: '北九州・小倉', slug: 'kitakyushu-kokura', order: 2, keywords: ['小倉', '北九州', '八幡', '戸畑', '若松', '門司'] },
    { name: '久留米', slug: 'kurume', order: 3, keywords: ['久留米', 'うきは'] },
    { name: '福岡西区・東区', slug: 'fukuoka-nishihigashi', order: 4, keywords: ['福岡西区', '福岡東区', '香椎', '千早'] },
    { name: '大牟田・柳川', slug: 'omuta-yanagawa', order: 5, keywords: ['大牟田', '柳川', '大川', 'みやま'] },
    { name: '飯塚・田川', slug: 'iizuka-tagawa', order: 6, keywords: ['飯塚', '田川', '嘉麻', '直方'] },
    { name: '春日・大野城', slug: 'kasuga-onojo', order: 7, keywords: ['春日', '大野城', '太宰府', '那珂川', '筑紫野', '福岡市南区'] },
    { name: '糟屋・粕屋', slug: 'kasuya', order: 8, keywords: ['糟屋', '粕屋', '古賀', '福津', '宗像', '新宮'] },
    { name: '行橋・苅田', slug: 'yukuhashi-kanda', order: 9, keywords: ['行橋', '苅田', '京都郡', '築上'] },
    { name: '福岡その他', slug: 'fukuoka-other', order: 99, keywords: ['福岡その他', '朝倉', '八女', '筑後'] },
  ],
  saga: [
    { name: '佐賀市', slug: 'saga-city', order: 1, keywords: ['佐賀駅', '佐賀市', '呉服元'] },
    { name: '鳥栖・基山', slug: 'tosu-kiyama', order: 2, keywords: ['鳥栖', '基山', 'みやき', '神埼', '上峰', '吉野ヶ里'] },
    { name: '唐津', slug: 'karatsu', order: 3, keywords: ['唐津'] },
    { name: '武雄・嬉野', slug: 'takeo-ureshino', order: 4, keywords: ['武雄', '嬉野'] },
    { name: '佐賀その他', slug: 'saga-other', order: 99, keywords: ['佐賀その他', '伊万里', '有田', '鹿島', '多久', '小城'] },
  ],
  nagasaki: [
    { name: '長崎市', slug: 'nagasaki-city', order: 1, keywords: ['長崎駅', '長崎市', '銅座', '思案橋'] },
    { name: '佐世保', slug: 'sasebo', order: 2, keywords: ['佐世保', '平戸', '松浦'] },
    { name: '諫早・大村', slug: 'isahaya-omura', order: 3, keywords: ['諫早', '大村'] },
    { name: '島原・五島', slug: 'shimabara-goto', order: 4, keywords: ['島原', '五島', '雲仙', '南島原', '壱岐', '対馬'] },
    { name: '長崎その他', slug: 'nagasaki-other', order: 99, keywords: ['長崎その他', '西海', '時津', '長与'] },
  ],
  kumamoto: [
    { name: '熊本市', slug: 'kumamoto-city', order: 1, keywords: ['熊本駅', '熊本市', '下通', '上通', '銀座通', '中央区熊本'] },
    { name: '八代', slug: 'yatsushiro', order: 2, keywords: ['八代'] },
    { name: '玉名・荒尾', slug: 'tamana-arao', order: 3, keywords: ['玉名', '荒尾', '長洲'] },
    { name: '山鹿・菊池', slug: 'yamaga-kikuchi', order: 4, keywords: ['山鹿', '菊池', '大津', '菊陽', '合志'] },
    { name: '天草・宇土・宇城', slug: 'amakusa-uto', order: 5, keywords: ['天草', '宇土', '宇城'] },
    { name: '熊本その他', slug: 'kumamoto-other', order: 99, keywords: ['熊本その他', '人吉', '球磨', '阿蘇', '南阿蘇', '水俣', '葦北'] },
  ],
  oita: [
    { name: '大分市', slug: 'oita-city', order: 1, keywords: ['大分駅', '大分市', '都町'] },
    { name: '別府', slug: 'beppu', order: 2, keywords: ['別府'] },
    { name: '中津・宇佐', slug: 'nakatsu-usa', order: 3, keywords: ['中津', '宇佐', '豊後高田'] },
    { name: '日田・湯布院', slug: 'hita-yufuin', order: 4, keywords: ['日田', '湯布院', '由布'] },
    { name: '大分その他', slug: 'oita-other', order: 99, keywords: ['大分その他', '佐伯', '臼杵', '津久見', '竹田', '豊後大野'] },
  ],
  miyazaki: [
    { name: '宮崎市', slug: 'miyazaki-city', order: 1, keywords: ['宮崎駅', '宮崎市', 'ニシタチ'] },
    { name: '都城・小林', slug: 'miyakonojo-kobayashi', order: 2, keywords: ['都城', '小林', 'えびの', '高原'] },
    { name: '延岡・日向', slug: 'nobeoka-hyuga', order: 3, keywords: ['延岡', '日向', '日之影', '高千穂'] },
    { name: '宮崎その他', slug: 'miyazaki-other', order: 99, keywords: ['宮崎その他', '西都', '日南', '串間', '三股'] },
  ],
  kagoshima: [
    { name: '鹿児島市', slug: 'kagoshima-city', order: 1, keywords: ['鹿児島駅', '鹿児島市', '天文館', '中央町鹿児島'] },
    { name: '霧島・国分', slug: 'kirishima-kokubu', order: 2, keywords: ['霧島', '国分', '隼人', '姶良'] },
    { name: '薩摩川内・出水', slug: 'satsuma-sendai-izumi', order: 3, keywords: ['薩摩川内', '出水', '阿久根', '伊佐'] },
    { name: '指宿・枕崎', slug: 'ibusuki-makurazaki', order: 4, keywords: ['指宿', '枕崎', '南九州', '加世田'] },
    { name: '鹿屋・大隅', slug: 'kanoya-osumi', order: 5, keywords: ['鹿屋', '大隅', '志布志', '曽於', '垂水'] },
    { name: '鹿児島その他', slug: 'kagoshima-other', order: 99, keywords: ['鹿児島その他', '種子島', '屋久島', '奄美'] },
  ],
  okinawa: [
    { name: '那覇', slug: 'naha', order: 1, keywords: ['那覇', '国際通り', '松山町', '久茂地'] },
    { name: '沖縄市・コザ', slug: 'okinawa-koza', order: 2, keywords: ['沖縄市', 'コザ', '北谷', '嘉手納', '読谷', '北中城', '中城', '美浜'] },
    { name: '宜野湾・浦添', slug: 'ginowan-urasoe', order: 3, keywords: ['宜野湾', '浦添'] },
    { name: '名護・恩納', slug: 'nago-onna', order: 4, keywords: ['名護', '恩納', '国頭', '本部', '今帰仁'] },
    { name: '沖縄その他', slug: 'okinawa-other', order: 99, keywords: ['沖縄その他', '石垣', '宮古島', '久米島', '与那国', '八重山', '糸満', '豊見城', '南城'] },
  ],
};

/**
 * shop名 + source_url + oldAreaName から正規エリアを推定
 *
 * v5b 改:
 * - 第1段: shopName + sourceUrl のみで照合 (一番確実な手がかり)
 * - 第2段: 第1段で 0 score なら oldAreaName を含めて再照合 (URL がローマ字のみ等のケース)
 * - 最後の砦: {pref}-other (なければ pref メインエリア = order: 1)
 *
 * これにより v4 から v5b の移行で「v4 で誤分類された shop が old_area_name バイアスで
 * 同じ間違ったエリアに固定されてしまう」問題を回避する。
 */
function _pickByText(list, text) {
  let best = null;
  let bestScore = 0;
  for (const a of list) {
    if (a.order === 99) continue;
    for (const kw of a.keywords) {
      let score = 0;
      if (text.includes(kw)) score = kw.length * 2;
      if (score > bestScore) { bestScore = score; best = a; }
    }
  }
  return best;
}

export function pickArea(pref, shopName, sourceUrl, oldAreaName) {
  const list = UNIFIED_AREAS[pref];
  if (!list) return null;

  // 第1段: shop名 + URL のみ
  const primary = [shopName || '', sourceUrl || ''].join(' ').replace(/\s+/g, '');
  let best = _pickByText(list, primary);

  // 第2段: 第1段でマッチ無しなら old_area_name を含めて再照合
  if (!best && oldAreaName) {
    const secondary = [shopName || '', sourceUrl || '', oldAreaName].join(' ').replace(/\s+/g, '');
    best = _pickByText(list, secondary);
  }

  if (best) return best;
  // fallback: -other があればそれ、 なければ pref の order:1
  return list.find((a) => a.order === 99) || list.find((a) => a.order === 1);
}

export function getAllAreas() {
  const out = [];
  for (const [pref, list] of Object.entries(UNIFIED_AREAS)) {
    for (const a of list) out.push({ prefecture: pref, ...a });
  }
  return out;
}
