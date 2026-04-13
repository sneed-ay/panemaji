#!/usr/bin/env node
/**
 * エリア統一マイグレーション v4 - MECE設計
 * 
 * 原則:
 * 1. ME (Mutually Exclusive): 各旧エリアは1つの統一エリアにのみマップ
 * 2. CE (Collectively Exhaustive): 全県に「その他」枠があり漏れなし
 * 3. 0店舗の統一エリアは作成しない（マイグレーション後に削除）
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF');

// ============================================================
// パネマジ統一エリア定義（MECEベース）
// keywords: 旧エリア名からの一致判定用（長いキーワードが優先）
// order 99 = 「その他」枠（CE保証）
// ============================================================
const UNIFIED_AREAS = {
  tokyo: [
    { name: '新宿・歌舞伎町', slug: 'shinjuku', order: 1, keywords: ['新宿', '歌舞伎町', '高田馬場', '大久保', '新大久保'] },
    { name: '池袋', slug: 'ikebukuro', order: 2, keywords: ['池袋'] },
    { name: '渋谷・恵比寿', slug: 'shibuya', order: 3, keywords: ['渋谷', '恵比寿', '代官山', '原宿', '青山'] },
    { name: '五反田・目黒', slug: 'gotanda', order: 4, keywords: ['五反田', '目黒', '白金'] },
    { name: '品川・田町', slug: 'shinagawa', order: 5, keywords: ['品川', '田町', '三田'] },
    { name: '蒲田・大井町', slug: 'kamata', order: 6, keywords: ['蒲田', '大井町', '大森'] },
    { name: '上野・鶯谷・浅草', slug: 'ueno', order: 7, keywords: ['上野', '鶯谷', '浅草', '吉原', '日暮里', '西日暮里', '入谷', '御徒町'] },
    { name: '錦糸町・亀戸・小岩', slug: 'kinshicho', order: 8, keywords: ['錦糸町', '亀戸', '小岩', '新小岩', '葛飾', '金町', '葛西'] },
    { name: '新橋・銀座', slug: 'shinbashi', order: 9, keywords: ['新橋', '銀座', '汐留', '有楽町', '日本橋', '東京'] },
    { name: '秋葉原・神田', slug: 'akihabara', order: 10, keywords: ['秋葉原', '神田', '御茶ノ水', '水道橋'] },
    { name: '六本木・赤坂', slug: 'roppongi', order: 11, keywords: ['六本木', '赤坂', '麻布', '西麻布', '広尾'] },
    { name: '飯田橋・市ヶ谷', slug: 'iidabashi', order: 12, keywords: ['飯田橋', '神楽坂', '市ヶ谷', '四ツ谷'] },
    { name: '大塚・巣鴨・赤羽', slug: 'otsuka', order: 13, keywords: ['大塚', '巣鴨', '赤羽', '板橋', '十条'] },
    { name: '中野・高円寺・荻窪', slug: 'nakano', order: 14, keywords: ['中野', '高円寺', '荻窪', '阿佐ヶ谷', '杉並'] },
    { name: '北千住・足立', slug: 'kitasenju', order: 15, keywords: ['北千住', '綾瀬', '足立', '竹ノ塚'] },
    { name: '吉祥寺・三鷹・府中', slug: 'kichijoji', order: 16, keywords: ['吉祥寺', '三鷹', '府中', '調布', '国分寺', '武蔵野', '多摩'] },
    { name: '立川・八王子・町田', slug: 'tachikawa', order: 17, keywords: ['立川', '八王子', '町田', '青梅', '昭島', '福生'] },
    { name: '東京その他', slug: 'tokyo-other', order: 99, keywords: ['東京その他', '23区外', '練馬', '世田谷', '下北沢', '自由が丘', '二子玉川', '三軒茶屋'] },
  ],
  kanagawa: [
    { name: '横浜・関内', slug: 'yokohama', order: 1, keywords: ['横浜', '関内', '日ノ出町', '福富町', '曙町', '桜木町', '野毛', '宮川町', '伊勢佐木', '横浜西口', '横浜駅', '新横浜', '鶴見', '港北', '戸塚', '上大岡', '磯子'] },
    { name: '川崎', slug: 'kawasaki', order: 2, keywords: ['川崎', '武蔵小杉', '溝の口'] },
    { name: '横須賀・三浦', slug: 'yokosuka', order: 3, keywords: ['横須賀', '三浦', '逗子', '葉山', '久里浜'] },
    { name: '藤沢・湘南', slug: 'fujisawa', order: 4, keywords: ['藤沢', '鎌倉', '湘南', '茅ヶ崎', '平塚', '大船', '辻堂'] },
    { name: '厚木・海老名・大和', slug: 'atsugi', order: 5, keywords: ['厚木', '海老名', '大和', '本厚木', '座間', '伊勢原', '秦野'] },
    { name: '相模原・橋本', slug: 'sagamihara', order: 6, keywords: ['相模原', '橋本', '相模大野'] },
    { name: '小田原・箱根', slug: 'odawara', order: 7, keywords: ['小田原', '箱根', '南足柄'] },
    { name: '神奈川その他', slug: 'kanagawa-other', order: 99, keywords: ['神奈川その他'] },
  ],
  saitama: [
    { name: '大宮・さいたま', slug: 'omiya', order: 1, keywords: ['大宮', 'さいたま', '浦和', '与野', '南浦和', '北浦和', '武蔵浦和'] },
    { name: '西川口・蕨・川口', slug: 'kawaguchi', order: 2, keywords: ['川口', '蕨', '戸田', '西川口'] },
    { name: '川越', slug: 'kawagoe', order: 3, keywords: ['川越', 'ふじみ野', '富士見', '坂戸', '鶴ヶ島', '東松山'] },
    { name: '所沢・入間', slug: 'tokorozawa', order: 4, keywords: ['所沢', '入間', '飯能', '狭山'] },
    { name: '越谷・草加・春日部', slug: 'koshigaya', order: 5, keywords: ['越谷', '草加', '春日部', '三郷', '八潮', '南越谷'] },
    { name: '熊谷・深谷・本庄', slug: 'kumagaya', order: 6, keywords: ['熊谷', '深谷', '本庄', '行田', '秩父', '加須', '羽生', '鴻巣', '児玉'] },
    { name: '久喜・蓮田', slug: 'kuki', order: 7, keywords: ['久喜', '蓮田', '上尾', '桶川', '北本', '幸手', '白岡', '北葛飾'] },
    { name: '埼玉その他', slug: 'saitama-other', order: 99, keywords: ['埼玉その他'] },
  ],
  chiba: [
    { name: '千葉・栄町', slug: 'chiba-city', order: 1, keywords: ['千葉', '栄町', '稲毛', '幕張'] },
    { name: '船橋・西船橋・津田沼', slug: 'funabashi', order: 2, keywords: ['船橋', '西船橋', '津田沼', '八千代'] },
    { name: '柏・松戸', slug: 'kashiwa', order: 3, keywords: ['柏', '松戸', '新松戸', '我孫子', '流山', '野田', '鎌ヶ谷'] },
    { name: '市川・浦安', slug: 'ichikawa', order: 4, keywords: ['市川', '浦安', '本八幡', '行徳'] },
    { name: '成田・印西', slug: 'narita', order: 5, keywords: ['成田', '酒々井', '富里', '佐倉', '四街道', '印西', '白井'] },
    { name: '東金・茂原', slug: 'togane', order: 6, keywords: ['東金', '九十九里', '茂原', '大網'] },
    { name: '木更津・市原', slug: 'kisarazu', order: 7, keywords: ['木更津', '君津', '市原', '袖ケ浦', '富津'] },
    { name: '千葉その他', slug: 'chiba-other', order: 99, keywords: ['千葉その他', '館山', '南房総', '勝浦', '鴨川', '銚子', '旭', '香取'] },
  ],
  hokkaido: [
    { name: '札幌・すすきの', slug: 'sapporo', order: 1, keywords: ['札幌', 'すすきの', '札幌近郊'] },
    { name: '旭川', slug: 'asahikawa', order: 2, keywords: ['旭川', '富良野', '士別'] },
    { name: '函館', slug: 'hakodate', order: 3, keywords: ['函館', '松前', '檜山'] },
    { name: '帯広・十勝', slug: 'obihiro', order: 4, keywords: ['帯広', '十勝'] },
    { name: '釧路・北見・網走', slug: 'kushiro', order: 5, keywords: ['釧路', '北見', '網走', '中標津', '阿寒', '摩周'] },
    { name: '苫小牧・室蘭・千歳', slug: 'tomakomai', order: 6, keywords: ['苫小牧', '室蘭', '千歳', '恵庭', '登別'] },
    { name: '北海道その他', slug: 'hokkaido-other', order: 99, keywords: ['北海道その他', '小樽', 'ニセコ', '稚内', '留萌', '岩見沢', '滝川', '深川'] },
  ],
  osaka: [
    { name: '難波・日本橋・天王寺', slug: 'namba', order: 1, keywords: ['難波', '日本橋', 'ミナミ', '心斎橋', '道頓堀', '千日前', '天王寺', '阿倍野', '新世界', '動物園前', '谷九', '谷町'] },
    { name: '梅田・キタ・京橋', slug: 'umeda', order: 2, keywords: ['梅田', 'キタ', '北区', '中崎町', '天神橋', '扇町', '兎我野', '京橋', '新大阪', '十三', '北東部'] },
    { name: '堺・南大阪', slug: 'sakai', order: 3, keywords: ['堺', '泉州', '岸和田', '泉大津', '和泉', '南大阪', '南河内', '松原', '富田林', '河内長野'] },
    { name: '東大阪・北摂・その他', slug: 'osaka-other', order: 99, keywords: ['東大阪', '八尾', '布施', '枚方', '守口', '門真', '寝屋川', '北河内', '豊中', '吹田', '北摂', '箕面', '茨木', '高槻', '大阪その他'] },
  ],
  aichi: [
    { name: '名古屋', slug: 'nagoya', order: 1, keywords: ['名古屋', '栄', '今池', '金山', '大須', '名駅'] },
    { name: '一宮・稲沢', slug: 'ichinomiya', order: 2, keywords: ['一宮', '稲沢', '北名古屋', '津島', '清須'] },
    { name: '豊田・岡崎・刈谷', slug: 'toyota', order: 3, keywords: ['豊田', '岡崎', '刈谷', '安城', '西尾', '知立'] },
    { name: '豊橋・豊川', slug: 'toyohashi', order: 4, keywords: ['豊橋', '豊川', '蒲郡', '新城', '田原'] },
    { name: '愛知その他', slug: 'aichi-other', order: 99, keywords: ['小牧', '春日井', '瀬戸', '大府', '知多', '常滑', '東海', '半田', '犬山', '江南', '尾張旭'] },
  ],
  miyagi: [
    { name: '仙台', slug: 'sendai', order: 1, keywords: ['仙台', '国分町'] },
    { name: '石巻・塩釜・松島', slug: 'ishinomaki', order: 2, keywords: ['石巻', '松島', '塩釜', '塩竈', '東松島'] },
    { name: '大崎・古川', slug: 'osaki', order: 3, keywords: ['大崎', '古川', '栗原', '登米'] },
    { name: '宮城その他', slug: 'miyagi-other', order: 99, keywords: ['宮城その他', '仙南', '名取', '岩沼', '白石', '気仙沼', '多賀城', '角田'] },
  ],
  fukuoka: [
    { name: '福岡・中洲', slug: 'fukuoka-city', order: 1, keywords: ['福岡', '中洲', '博多', '天神', '春日', '大野城', '太宰府', '筑紫野'] },
    { name: '北九州・筑豊', slug: 'kitakyushu', order: 2, keywords: ['北九州', '小倉', '筑豊', '飯塚', '直方', '田川'] },
    { name: '久留米・筑後', slug: 'kurume', order: 3, keywords: ['久留米', '筑後', '大牟田', '柳川', '八女'] },
    { name: '下関', slug: 'shimonoseki', order: 4, keywords: ['下関'] },
    { name: '福岡その他', slug: 'fukuoka-other', order: 99, keywords: ['福岡その他', '古賀', '福津', '宗像', '糸島'] },
  ],
  fukushima: [
    { name: '福島・二本松', slug: 'fukushima-city', order: 1, keywords: ['福島', '二本松', '伊達'] },
    { name: '郡山', slug: 'koriyama', order: 2, keywords: ['郡山', '須賀川', '田村', '三春'] },
    { name: 'いわき・小名浜', slug: 'iwaki', order: 3, keywords: ['いわき', '小名浜', '湯本', '勿来', '泉'] },
    { name: '会津若松', slug: 'aizu', order: 4, keywords: ['会津', '喜多方'] },
    { name: '白河', slug: 'shirakawa', order: 5, keywords: ['白河', '矢吹'] },
    { name: '福島その他', slug: 'fukushima-other', order: 99, keywords: ['福島その他', '相馬', '南相馬'] },
  ],
  tochigi: [
    { name: '宇都宮', slug: 'utsunomiya', order: 1, keywords: ['宇都宮', '鹿沼'] },
    { name: '小山・栃木・佐野', slug: 'oyama', order: 2, keywords: ['小山', '栃木', '佐野', '足利', '真岡', '下野'] },
    { name: '那須塩原・日光', slug: 'nasu', order: 3, keywords: ['那須', '日光', '矢板', '大田原', '那須塩原'] },
    { name: '栃木その他', slug: 'tochigi-other', order: 99, keywords: ['栃木その他'] },
  ],
  gunma: [
    { name: '高崎・前橋', slug: 'takasaki', order: 1, keywords: ['高崎', '前橋', '安中', '渋川', '藤岡', '伊香保', '草津', '吾妻', '観音'] },
    { name: '太田・伊勢崎・桐生', slug: 'ota', order: 2, keywords: ['太田', '伊勢崎', '桐生', '館林', 'みどり', '邑楽'] },
    { name: '群馬その他', slug: 'gunma-other', order: 99, keywords: ['群馬その他', '沼田', '富岡'] },
  ],
  ibaraki: [
    { name: '水戸', slug: 'mito', order: 1, keywords: ['水戸', 'ひたちなか', '天王町', '那珂', '笠間'] },
    { name: '土浦・つくば', slug: 'tsuchiura', order: 2, keywords: ['土浦', 'つくば', '牛久', '龍ケ崎', '稲敷', '取手'] },
    { name: '神栖・鹿嶋', slug: 'kashima', order: 3, keywords: ['鹿嶋', '神栖', '潮来', '鹿島'] },
    { name: '茨城その他', slug: 'ibaraki-other', order: 99, keywords: ['茨城その他', '日立', '北茨城', '高萩', '古河', '下妻', '結城', '坂東', '常陸'] },
  ],
  niigata: [
    { name: '新潟市', slug: 'niigata-city', order: 1, keywords: ['新潟', '下越'] },
    { name: '長岡・三条', slug: 'nagaoka', order: 2, keywords: ['長岡', '三条', '燕', '柏崎', '中越', '魚沼'] },
    { name: '上越', slug: 'joetsu', order: 3, keywords: ['上越', '妙高', '糸魚川', '直江津'] },
    { name: '新潟その他', slug: 'niigata-other', order: 99, keywords: ['新潟その他', '佐渡', '村上'] },
  ],
  yamagata: [
    { name: '山形・天童', slug: 'yamagata-city', order: 1, keywords: ['山形', '天童', '上山', '寒河江', '村山', '東根'] },
    { name: '酒田・鶴岡・庄内', slug: 'sakata', order: 2, keywords: ['酒田', '鶴岡', '庄内', '出羽', '鳥海'] },
    { name: '米沢', slug: 'yonezawa', order: 3, keywords: ['米沢', '置賜', '南陽', '長井', '白布'] },
    { name: '新庄・最上', slug: 'shinjo', order: 4, keywords: ['新庄', '最上'] },
    { name: '山形その他', slug: 'yamagata-other', order: 99, keywords: ['山形その他'] },
  ],
  shizuoka: [
    { name: '静岡・焼津', slug: 'shizuoka-city', order: 1, keywords: ['静岡', '焼津', '藤枝', '清水', '島田'] },
    { name: '浜松・磐田', slug: 'hamamatsu', order: 2, keywords: ['浜松', '湖西', '磐田', '袋井', '掛川'] },
    { name: '沼津・富士・伊豆', slug: 'numazu', order: 3, keywords: ['沼津', '三島', '富士', '御殿場', '裾野', '伊豆', '熱海', '下田'] },
  ],
  hyogo: [
    { name: '神戸・阪神', slug: 'kobe', order: 1, keywords: ['神戸', '三宮', '元町', '兵庫', '灘', '東灘', '長田', '須磨', '西宮', '芦屋', '尼崎', '伊丹', '宝塚', '阪神', '淡路'] },
    { name: '姫路・加古川・明石', slug: 'himeji', order: 2, keywords: ['姫路', '加古川', '明石', '高砂', '赤穂'] },
    { name: '兵庫その他', slug: 'hyogo-other', order: 99, keywords: ['兵庫その他', '豊岡', '但馬', '北部', '丹波', '三田'] },
  ],
  mie: [
    { name: '四日市・桑名・鈴鹿', slug: 'yokkaichi', order: 1, keywords: ['四日市', '桑名', '鈴鹿', '亀山', 'いなべ'] },
    { name: '津・松阪', slug: 'tsu', order: 2, keywords: ['津', '松阪', '多気', '明和'] },
    { name: '三重その他', slug: 'mie-other', order: 99, keywords: ['三重その他', '伊勢', '鳥羽', '志摩', '伊賀', '名張', '尾鷲', '熊野', '紀北'] },
  ],
  toyama: [
    { name: '富山市', slug: 'toyama-city', order: 1, keywords: ['富山'] },
    { name: '高岡・射水', slug: 'takaoka', order: 2, keywords: ['高岡', '射水', '砺波', '氷見', '新湊'] },
    { name: '富山その他', slug: 'toyama-other', order: 99, keywords: ['富山その他', '魚津', '黒部', '滑川', '入善'] },
  ],
  tokushima: [
    { name: '徳島', slug: 'tokushima-city', order: 1, keywords: ['徳島', '鳴門'] },
    { name: '徳島その他', slug: 'tokushima-other', order: 99, keywords: ['徳島その他', '阿南', '小松島', '吉野川', '阿波', '美馬', '三好'] },
  ],
  iwate: [
    { name: '盛岡', slug: 'morioka', order: 1, keywords: ['盛岡'] },
    { name: '北上・花巻・一関', slug: 'kitakami', order: 2, keywords: ['北上', '花巻', '奥州', '一関', '水沢'] },
    { name: '岩手その他', slug: 'iwate-other', order: 99, keywords: ['岩手その他', '二戸', '宮古', '釜石', '大船渡', '久慈'] },
  ],
  akita: [
    { name: '秋田市・能代・男鹿', slug: 'akita-city', order: 1, keywords: ['秋田', '能代', '男鹿'] },
    { name: '秋田その他', slug: 'akita-other', order: 99, keywords: ['秋田その他', '横手', '大曲', '大仙', '湯沢', '大館', '鹿角'] },
  ],
  aomori: [
    { name: '青森・弘前', slug: 'aomori-city', order: 1, keywords: ['青森', '弘前', '黒石'] },
    { name: '八戸・三沢', slug: 'hachinohe', order: 2, keywords: ['八戸', '三沢', '十和田'] },
    { name: '青森その他', slug: 'aomori-other', order: 99, keywords: ['青森その他', 'むつ', '下北'] },
  ],
  kyoto: [
    { name: '京都', slug: 'kyoto-city', order: 1, keywords: ['京都'] },
  ],
  hiroshima: [
    { name: '広島市', slug: 'hiroshima-city', order: 1, keywords: ['広島', '流川', '薬研堀', '八丁堀'] },
    { name: '福山・尾道', slug: 'fukuyama', order: 2, keywords: ['福山', '尾道', '三原', '竹原'] },
    { name: '広島その他', slug: 'hiroshima-other', order: 99, keywords: ['広島その他', '呉', '東広島', '廿日市'] },
  ],
  nagano: [
    { name: '長野市・千曲', slug: 'nagano-city', order: 1, keywords: ['長野', '千曲', '須坂', '飯山'] },
    { name: '上田・佐久・軽井沢', slug: 'ueda', order: 2, keywords: ['上田', '佐久', '軽井沢', '小諸'] },
    { name: '松本・安曇野', slug: 'matsumoto', order: 3, keywords: ['松本', '塩尻', '安曇野', '大町'] },
    { name: '諏訪・伊那・飯田', slug: 'suwa', order: 4, keywords: ['諏訪', '岡谷', '伊那', '飯田', '茅野', '駒ヶ根'] },
    { name: '長野その他', slug: 'nagano-other', order: 99, keywords: ['長野その他'] },
  ],
  okayama: [
    { name: '岡山市', slug: 'okayama-city', order: 1, keywords: ['岡山', '吉備'] },
    { name: '倉敷', slug: 'kurashiki', order: 2, keywords: ['倉敷', '笠岡', '井原'] },
    { name: '岡山その他', slug: 'okayama-other', order: 99, keywords: ['岡山その他', '津山', '美作'] },
  ],
  yamaguchi: [
    { name: '山口・防府・周南', slug: 'yamaguchi-city', order: 1, keywords: ['山口', '防府', '周南', '下松', '光'] },
    { name: '宇部・小野田', slug: 'ube', order: 2, keywords: ['宇部', '小野田', '美祢'] },
    { name: '山口その他', slug: 'yamaguchi-other', order: 99, keywords: ['山口その他', '岩国', '柳井', '萩', '長門'] },
  ],
  okinawa: [
    { name: '那覇', slug: 'naha', order: 1, keywords: ['那覇', '国際通り', '松山', '久茂地'] },
    { name: '沖縄その他', slug: 'okinawa-other', order: 99, keywords: ['沖縄その他', '沖縄市', 'コザ', '北谷', '宜野湾', '浦添', '名護', '恩納', '石垣', '宮古島', '本島'] },
  ],
  kagoshima: [
    { name: '鹿児島市', slug: 'kagoshima-city', order: 1, keywords: ['鹿児島', '天文館'] },
    { name: '鹿児島その他', slug: 'kagoshima-other', order: 99, keywords: ['鹿児島その他', '霧島', '薩摩川内', '指宿', '奄美', '大隅', '鹿屋', '志布志', '枕崎', '出水', '種子島', '南薩摩', '国分'] },
  ],
  kumamoto: [
    { name: '熊本市', slug: 'kumamoto-city', order: 1, keywords: ['熊本'] },
    { name: '熊本その他', slug: 'kumamoto-other', order: 99, keywords: ['熊本その他', '八代', '天草', '人吉', '玉名', '大津', '菊陽', '宇土', '宇城'] },
  ],
  ishikawa: [
    { name: '金沢', slug: 'kanazawa', order: 1, keywords: ['金沢', '片町', '香林坊'] },
    { name: '石川その他', slug: 'ishikawa-other', order: 99, keywords: ['石川その他', '小松', '加賀', '白山', '能美', '能登', '七尾', '輪島'] },
  ],
  nara: [
    { name: '奈良', slug: 'nara-city', order: 1, keywords: ['奈良', '生駒', '大和郡山', '橿原', '御所', '飛鳥', '天理'] },
  ],
  wakayama: [
    { name: '和歌山', slug: 'wakayama-city', order: 1, keywords: ['和歌山', '高野山', '海南', '有田'] },
  ],
  gifu: [
    { name: '岐阜・金津園', slug: 'gifu-city', order: 1, keywords: ['岐阜', '金津園', '大垣', '西濃', '各務原', '羽島'] },
    { name: '岐阜その他', slug: 'gifu-other', order: 99, keywords: ['岐阜その他', '多治見', '恵那', '中津川', '東濃', '美濃加茂', '郡上', '中濃', '高山', '飛騨', '下呂', '白川', '関'] },
  ],
  shiga: [
    { name: '滋賀', slug: 'shiga', order: 1, keywords: ['大津', '草津', '守山', '栗東', '湖南', '彦根', '近江', '長浜', '米原', '東近江', '湖東', '甲賀', '高島'] },
  ],
  oita: [
    { name: '大分市', slug: 'oita-city', order: 1, keywords: ['大分'] },
    { name: '大分その他', slug: 'oita-other', order: 99, keywords: ['大分その他', '別府', '湯布院', '中津', '日田', '佐伯', '臼杵', '津久見', '宇佐'] },
  ],
  saga: [
    { name: '佐賀', slug: 'saga-city', order: 1, keywords: ['佐賀', '鳥栖', 'みやき', '唐津', '伊万里', '有田', '嬉野', '武雄'] },
  ],
  miyazaki: [
    { name: '宮崎', slug: 'miyazaki-city', order: 1, keywords: ['宮崎', '西都'] },
    { name: '宮崎その他', slug: 'miyazaki-other', order: 99, keywords: ['宮崎その他', '都城', '延岡', '日向', '日南'] },
  ],
  nagasaki: [
    { name: '長崎', slug: 'nagasaki-city', order: 1, keywords: ['長崎', '諫早', '大村'] },
    { name: '佐世保', slug: 'sasebo', order: 2, keywords: ['佐世保', '平戸'] },
  ],
  fukui: [
    { name: '福井', slug: 'fukui-city', order: 1, keywords: ['福井', '芦原', '永平寺', '坂井', '武生', '鯖江', '越前', '敦賀', '若狭', '小浜'] },
  ],
  yamanashi: [
    { name: '山梨', slug: 'yamanashi', order: 1, keywords: ['甲府', '石和', '山梨', '甲斐', '笛吹', '韮崎', '富士吉田', '都留', '大月'] },
  ],
  tottori: [
    { name: '鳥取', slug: 'tottori-city', order: 1, keywords: ['鳥取', '米子', '境港', '倉吉'] },
  ],
  shimane: [
    { name: '島根', slug: 'shimane', order: 1, keywords: ['松江', '出雲', '安来', '浜田', '益田'] },
  ],
  kagawa: [
    { name: '高松', slug: 'takamatsu', order: 1, keywords: ['高松'] },
    { name: '香川その他', slug: 'kagawa-other', order: 99, keywords: ['香川その他', '丸亀', '坂出', '善通寺', '琴平', '観音寺', '三豊'] },
  ],
  ehime: [
    { name: '松山', slug: 'matsuyama', order: 1, keywords: ['松山', '伊予', '中予'] },
    { name: '愛媛その他', slug: 'ehime-other', order: 99, keywords: ['愛媛その他', '今治', '新居浜', 'しまなみ', '東予', '西条', '大洲', '内子', '久万', '宇和島', '愛南', '南予'] },
  ],
  kochi: [
    { name: '高知', slug: 'kochi-city', order: 1, keywords: ['高知', '南国', '嶺北'] },
  ],
};

// ============================================================
// マッチング関数
// ============================================================

function normalizeForMatch(name) {
  return name
    .replace(/[（(][^)）]*[)）]/g, '') // (風俗じゃぱん)等を除去
    .replace(/[\s　]+/g, '')
    .replace(/[・\/]/g, '')
    .replace(/風俗/g, '')
    .replace(/エリア/g, '')
    .trim();
}

function findBestMatch(areaName, unifiedAreas) {
  const norm = normalizeForMatch(areaName);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const ua of unifiedAreas) {
    for (const kw of ua.keywords) {
      let score = 0;
      if (norm === kw) {
        score = kw.length * 100; // 完全一致
      } else if (norm.includes(kw)) {
        score = kw.length * 2; // 部分一致（長いキーワード優先）
      } else if (kw.includes(norm) && norm.length >= 2) {
        score = norm.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ua;
      }
    }
  }
  
  return bestMatch;
}

// ============================================================
// メイン処理
// ============================================================

function main() {
  console.log('=== パネマジ エリア統一マイグレーション v4 (MECE) ===\n');
  
  const allAreasBefore = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
  const allShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get().c;
  console.log(`Before: ${allAreasBefore} エリア, ${allShops} アクティブ店舗\n`);
  
  const stats = { created: 0, reused: 0, merged: 0, reassigned: 0, deleted: 0 };
  
  // 県ごとに処理
  for (const [pref, unifiedDefs] of Object.entries(UNIFIED_AREAS)) {
    const existingAreas = db.prepare('SELECT * FROM areas WHERE prefecture = ? ORDER BY display_order, id').all(pref);
    if (existingAreas.length === 0) continue;
    
    const shopsBefore = db.prepare(`
      SELECT COUNT(*) as c FROM shops s 
      JOIN areas a ON s.area_id = a.id 
      WHERE a.prefecture = ? AND s.is_active = 1
    `).get(pref).c;
    
    console.log(`--- ${pref} (${existingAreas.length}エリア → ${unifiedDefs.length}エリア, ${shopsBefore}店) ---`);
    
    // 1. 統一エリアをUPSERT
    const unifiedAreaMap = {}; // slug -> area record
    
    for (const ud of unifiedDefs) {
      // 既存をslugまたはnameで検索
      let existing = db.prepare('SELECT * FROM areas WHERE slug = ? AND prefecture = ?').get(ud.slug, pref);
      if (!existing) {
        existing = db.prepare('SELECT * FROM areas WHERE name = ? AND prefecture = ?').get(ud.name, pref);
      }
      
      if (existing) {
        db.prepare('UPDATE areas SET name = ?, slug = ?, display_order = ? WHERE id = ?').run(ud.name, ud.slug, ud.order, existing.id);
        unifiedAreaMap[ud.slug] = { ...existing, name: ud.name, slug: ud.slug, display_order: ud.order };
        stats.reused++;
      } else {
        // 新規作成（name重複回避）
        const nameExists = db.prepare('SELECT id FROM areas WHERE name = ?').get(ud.name);
        const insertName = nameExists ? `${ud.name}(${pref})` : ud.name;
        const result = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, ?)').run(insertName, ud.slug, pref, ud.order);
        unifiedAreaMap[ud.slug] = { id: Number(result.lastInsertRowid), name: insertName, slug: ud.slug, prefecture: pref, display_order: ud.order };
        stats.created++;
      }
    }
    
    // 統一エリアのIDセット
    const unifiedAreaIds = new Set(Object.values(unifiedAreaMap).map(a => a.id));
    
    // 2. 旧エリアの店舗を統一エリアに移行
    for (const oldArea of existingAreas) {
      if (unifiedAreaIds.has(oldArea.id)) continue;
      
      const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ? AND is_active = 1').get(oldArea.id).c;
      
      // マッチング
      const match = findBestMatch(oldArea.name, unifiedDefs);
      
      if (match) {
        const targetArea = unifiedAreaMap[match.slug];
        if (shopCount > 0) {
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(targetArea.id, oldArea.id);
          stats.reassigned += shopCount;
          stats.merged++;
        }
      } else {
        // マッチなし → "その他" にフォールバック
        const otherSlug = `${pref}-other`;
        const otherArea = unifiedAreaMap[otherSlug];
        if (otherArea && shopCount > 0) {
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(otherArea.id, oldArea.id);
          console.log(`  ! ${oldArea.name} (${shopCount}店) → ${otherArea.name} (fallback)`);
          stats.reassigned += shopCount;
          stats.merged++;
        } else if (shopCount > 0) {
          // 「その他」もない県 → 最初の統一エリアにフォールバック
          const firstArea = Object.values(unifiedAreaMap)[0];
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(firstArea.id, oldArea.id);
          console.log(`  ! ${oldArea.name} (${shopCount}店) → ${firstArea.name} (force-fallback)`);
          stats.reassigned += shopCount;
          stats.merged++;
        }
      }
      
      // 旧エリア削除（全店舗移行済みなら）
      const remaining = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(oldArea.id).c;
      if (remaining === 0) {
        db.prepare('DELETE FROM areas WHERE id = ?').run(oldArea.id);
        stats.deleted++;
      }
    }
    
    // 移行後のエリア別店舗数を表示
    const afterAreas = db.prepare(`
      SELECT a.name, a.display_order, COUNT(s.id) as shops 
      FROM areas a 
      LEFT JOIN shops s ON s.area_id = a.id AND s.is_active = 1
      WHERE a.prefecture = ? 
      GROUP BY a.id 
      ORDER BY a.display_order
    `).all(pref);
    
    for (const a of afterAreas) {
      console.log(`  ${a.name}: ${a.shops}店`);
    }
  }
  
  // UNIFIED_AREASに定義がない県
  const definedPrefs = new Set(Object.keys(UNIFIED_AREAS));
  const undefinedPrefs = db.prepare(`
    SELECT DISTINCT a.prefecture, COUNT(s.id) as shops 
    FROM areas a 
    JOIN shops s ON s.area_id = a.id AND s.is_active = 1 
    GROUP BY a.prefecture 
    HAVING a.prefecture NOT IN (${[...definedPrefs].map(() => '?').join(',')})
  `).all(...definedPrefs);
  
  if (undefinedPrefs.length > 0) {
    console.log('\n--- 未定義県（そのまま） ---');
    for (const p of undefinedPrefs) {
      console.log(`  ${p.prefecture}: ${p.shops}店`);
    }
  }
  
  // 0店舗のエリアを削除
  const emptyAreas = db.prepare(`
    SELECT a.id, a.name, a.prefecture FROM areas a
    LEFT JOIN shops s ON s.area_id = a.id AND s.is_active = 1
    GROUP BY a.id
    HAVING COUNT(s.id) = 0
  `).all();
  
  if (emptyAreas.length > 0) {
    console.log(`\n0店舗エリアを削除: ${emptyAreas.length}件`);
    for (const ea of emptyAreas) {
      // 非アクティブ店舗も移す必要がある
      const inactiveCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(ea.id).c;
      if (inactiveCount > 0) {
        // 同県の最初の有効エリアに非アクティブ店舗を移す
        const fallback = db.prepare(`
          SELECT a.id FROM areas a 
          JOIN shops s ON s.area_id = a.id AND s.is_active = 1 
          WHERE a.prefecture = ? 
          GROUP BY a.id 
          ORDER BY COUNT(s.id) DESC 
          LIMIT 1
        `).get(ea.prefecture);
        if (fallback) {
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(fallback.id, ea.id);
        }
      }
      db.prepare('DELETE FROM areas WHERE id = ?').run(ea.id);
      stats.deleted++;
    }
  }
  
  // 最終統計
  const finalAreas = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
  const finalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1 AND area_id IS NOT NULL').get().c;
  const orphanShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1 AND area_id NOT IN (SELECT id FROM areas)').get().c;
  
  console.log('\n=== 最終結果 ===');
  console.log(`エリア: ${allAreasBefore} → ${finalAreas}`);
  console.log(`新規作成: ${stats.created}, 既存流用: ${stats.reused}`);
  console.log(`統合: ${stats.merged}, 店舗再割当: ${stats.reassigned}`);
  console.log(`削除: ${stats.deleted}`);
  console.log(`アクティブ店舗: ${finalShops}, 孤立: ${orphanShops}`);
  
  if (orphanShops > 0) {
    console.log('\n!!! 孤立店舗あり - 要修正 !!!');
  }
  
  db.close();
  console.log('\n完了！');
}

main();
