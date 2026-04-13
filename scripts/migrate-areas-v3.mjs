#!/usr/bin/env node
/**
 * エリア統一マイグレーション v3
 * 
 * 各ソース（本家、風俗じゃぱん、fujoho等）のエリアを
 * パネマジ独自の統一エリア区分にマージする。
 * 
 * 方針:
 * - 各県に統一エリアを定義（既存の本家エリアをベースにする）
 * - 風俗じゃぱん等のエリアに紐づく店舗を、名前マッチングで統一エリアに再割り当て
 * - 使われなくなった旧エリアは削除
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF');

// ============================================================
// パネマジ統一エリア定義
// key: prefecture, value: array of { name, slug, keywords[] }
// keywords は旧エリア名からのマッチングに使う
// ============================================================
const UNIFIED_AREAS = {
  tokyo: [
    { name: '新宿・歌舞伎町', slug: 'shinjuku', order: 1, keywords: ['新宿', '歌舞伎町', '高田馬場', '大久保'] },
    { name: '池袋', slug: 'ikebukuro', order: 2, keywords: ['池袋'] },
    { name: '渋谷・恵比寿', slug: 'shibuya', order: 3, keywords: ['渋谷', '恵比寿', '代官山', '中目黒'] },
    { name: '五反田・目黒', slug: 'gotanda', order: 4, keywords: ['五反田', '目黒'] },
    { name: '品川・田町', slug: 'shinagawa', order: 5, keywords: ['品川', '田町', '三田'] },
    { name: '蒲田・大井町', slug: 'kamata', order: 6, keywords: ['蒲田', '大井町', '大森'] },
    { name: '上野・鶯谷', slug: 'ueno', order: 7, keywords: ['上野', '鶯谷', '浅草', '日暮里', '入谷'] },
    { name: '吉原', slug: 'yoshiwara', order: 8, keywords: ['吉原'] },
    { name: '錦糸町・亀戸・小岩', slug: 'kinshicho', order: 9, keywords: ['錦糸町', '亀戸', '小岩', '新小岩', '葛飾'] },
    { name: '新橋・銀座・汐留', slug: 'shinbashi', order: 10, keywords: ['新橋', '銀座', '汐留', '有楽町', '日本橋'] },
    { name: '秋葉原・神田', slug: 'akihabara', order: 11, keywords: ['秋葉原', '神田', '御茶ノ水', '水道橋'] },
    { name: '六本木・赤坂・麻布', slug: 'roppongi', order: 12, keywords: ['六本木', '赤坂', '麻布', '西麻布'] },
    { name: '飯田橋・神楽坂', slug: 'iidabashi', order: 13, keywords: ['飯田橋', '神楽坂', '市ヶ谷', '四ツ谷'] },
    { name: '大塚・巣鴨・赤羽', slug: 'otsuka', order: 14, keywords: ['大塚', '巣鴨', '赤羽', '板橋', '十条'] },
    { name: '吉祥寺・三鷹・府中', slug: 'kichijoji', order: 15, keywords: ['吉祥寺', '三鷹', '府中', '調布', '国分寺', '武蔵野', '多摩'] },
    { name: '立川・八王子・町田', slug: 'tachikawa', order: 16, keywords: ['立川', '八王子', '町田', '青梅', '昭島', '福生', '羽村'] },
    { name: '中野・高円寺・荻窪', slug: 'nakano', order: 17, keywords: ['中野', '高円寺', '荻窪', '阿佐ヶ谷', '西荻窪', '杉並'] },
    { name: '北千住・綾瀬・足立', slug: 'kitasenju', order: 18, keywords: ['北千住', '綾瀬', '足立', '竹ノ塚', '西新井'] },
    { name: '練馬・光が丘', slug: 'nerima', order: 19, keywords: ['練馬', '光が丘', '石神井'] },
    { name: '自由が丘・二子玉川', slug: 'jiyugaoka', order: 20, keywords: ['自由が丘', '二子玉川', '三軒茶屋', '世田谷', '下北沢', '経堂'] },
    { name: '東京その他', slug: 'tokyo-other', order: 99, keywords: ['東京その他', '23区外'] },
  ],
  kanagawa: [
    { name: '横浜・関内', slug: 'yokohama', order: 1, keywords: ['横浜', '関内', '日ノ出町', '福富町', '曙町', '桜木町', '野毛', '宮川町', '伊勢佐木', '横浜西口', '横浜駅'] },
    { name: '川崎', slug: 'kawasaki', order: 2, keywords: ['川崎', '武蔵小杉', '溝の口', '新城', '登戸', '武蔵溝ノ口'] },
    { name: '新横浜・鶴見・港北', slug: 'shin-yokohama', order: 3, keywords: ['新横浜', '鶴見', '港北', '菊名', '綱島', '日吉'] },
    { name: '戸塚・上大岡・金沢', slug: 'totsuka', order: 4, keywords: ['戸塚', '上大岡', '金沢', '港南', '磯子'] },
    { name: '横須賀・三浦', slug: 'yokosuka', order: 5, keywords: ['横須賀', '三浦', '逗子', '葉山', '久里浜'] },
    { name: '藤沢・鎌倉・湘南', slug: 'fujisawa', order: 6, keywords: ['藤沢', '鎌倉', '湘南', '茅ヶ崎', '平塚', '大船', '辻堂'] },
    { name: '厚木・海老名・大和', slug: 'atsugi', order: 7, keywords: ['厚木', '海老名', '大和', '本厚木', '座間', '伊勢原', '秦野'] },
    { name: '相模原・橋本', slug: 'sagamihara', order: 8, keywords: ['相模原', '橋本', '相模大野'] },
    { name: '小田原・箱根', slug: 'odawara', order: 9, keywords: ['小田原', '箱根', '南足柄', '足柄'] },
    { name: '神奈川その他', slug: 'kanagawa-other', order: 99, keywords: ['神奈川その他'] },
  ],
  saitama: [
    { name: '大宮・さいたま', slug: 'omiya', order: 1, keywords: ['大宮', 'さいたま', '浦和', '与野', '南浦和', '北浦和', '武蔵浦和', 'さいたま市'] },
    { name: '川口・蕨・戸田', slug: 'kawaguchi', order: 2, keywords: ['川口', '蕨', '戸田', '鳩ヶ谷', '西川口'] },
    { name: '川越・ふじみ野', slug: 'kawagoe', order: 3, keywords: ['川越', 'ふじみ野', '富士見', '坂戸', '鶴ヶ島', '東松山'] },
    { name: '所沢・入間・飯能', slug: 'tokorozawa', order: 4, keywords: ['所沢', '入間', '飯能', '狭山'] },
    { name: '越谷・草加・春日部', slug: 'koshigaya', order: 5, keywords: ['越谷', '草加', '春日部', '三郷', '八潮', '吉川', '松伏'] },
    { name: '熊谷・深谷・本庄', slug: 'kumagaya', order: 6, keywords: ['熊谷', '深谷', '本庄', '行田', '秩父', '加須', '羽生', '鴻巣'] },
    { name: '久喜・蓮田・上尾', slug: 'kuki', order: 7, keywords: ['久喜', '蓮田', '上尾', '桶川', '北本', '幸手', '白岡'] },
    { name: '埼玉その他', slug: 'saitama-other', order: 99, keywords: ['埼玉その他'] },
  ],
  chiba: [
    { name: '千葉市・栄町', slug: 'chiba-city', order: 1, keywords: ['千葉', '栄町', '千葉市', '稲毛', '幕張'] },
    { name: '船橋・西船橋・津田沼', slug: 'funabashi', order: 2, keywords: ['船橋', '西船橋', '津田沼', '八千代'] },
    { name: '柏・松戸', slug: 'kashiwa', order: 3, keywords: ['柏', '松戸', '新松戸', '我孫子', '流山', '野田', '鎌ヶ谷'] },
    { name: '市川・浦安・本八幡', slug: 'ichikawa', order: 4, keywords: ['市川', '浦安', '本八幡', '行徳'] },
    { name: '成田・酒々井・富里', slug: 'narita', order: 5, keywords: ['成田', '酒々井', '富里', '佐倉', '四街道', '印西', '白井'] },
    { name: '東金・九十九里・茂原', slug: 'togane', order: 6, keywords: ['東金', '九十九里', '茂原', '大網'] },
    { name: '木更津・君津・市原', slug: 'kisarazu', order: 7, keywords: ['木更津', '君津', '市原', '袖ケ浦', '富津'] },
    { name: '館山・南房総', slug: 'tateyama', order: 8, keywords: ['館山', '南房総', '勝浦', '鴨川', '銚子', '旭', '香取', '佐原'] },
    { name: '千葉その他', slug: 'chiba-other', order: 99, keywords: ['千葉その他'] },
  ],
  hokkaido: [
    { name: '札幌・すすきの', slug: 'sapporo', order: 1, keywords: ['札幌', 'すすきの', '中央区', '豊平', '白石', '手稲', '厚別', '東区', '北区', '西区', '南区', '清田'] },
    { name: '旭川', slug: 'asahikawa', order: 2, keywords: ['旭川'] },
    { name: '函館', slug: 'hakodate', order: 3, keywords: ['函館'] },
    { name: '釧路・帯広・十勝', slug: 'kushiro', order: 4, keywords: ['釧路', '帯広', '十勝', '北見', '網走'] },
    { name: '苫小牧・室蘭', slug: 'tomakomai', order: 5, keywords: ['苫小牧', '室蘭', '千歳', '恵庭', '登別', '伊達'] },
    { name: '小樽・余市', slug: 'otaru', order: 6, keywords: ['小樽', '余市', '岩内', 'ニセコ'] },
    { name: '北海道その他', slug: 'hokkaido-other', order: 99, keywords: ['北海道その他', '稚内', '紋別', '留萌', '滝川', '岩見沢', '名寄', '深川'] },
  ],
  osaka: [
    { name: '難波・日本橋', slug: 'namba', order: 1, keywords: ['難波', '日本橋', 'ミナミ', '心斎橋', '道頓堀', '千日前'] },
    { name: '梅田・キタ', slug: 'umeda', order: 2, keywords: ['梅田', 'キタ', '北区', '中崎町', '天神橋', '扇町', '兎我野'] },
    { name: '天王寺・阿倍野', slug: 'tennoji', order: 3, keywords: ['天王寺', '阿倍野', '新世界', '動物園前'] },
    { name: '京橋・谷九・鶴橋', slug: 'kyobashi', order: 4, keywords: ['京橋', '谷九', '谷町', '鶴橋', '今里', '玉造', '森ノ宮'] },
    { name: '堺・泉州', slug: 'sakai', order: 5, keywords: ['堺', '泉州', '岸和田', '泉大津', '和泉', '貝塚', '泉南', '泉佐野'] },
    { name: '東大阪・八尾・布施', slug: 'higashi-osaka', order: 6, keywords: ['東大阪', '八尾', '布施', '枚方', '守口', '門真', '大東', '四條畷', '寝屋川', '交野'] },
    { name: '豊中・吹田・北摂', slug: 'toyonaka', order: 7, keywords: ['豊中', '吹田', '北摂', '箕面', '茨木', '高槻', '摂津', '池田'] },
    { name: '大阪その他', slug: 'osaka-other', order: 99, keywords: ['大阪その他', '松原', '藤井寺', '河内長野', '富田林'] },
  ],
  aichi: [
    { name: '名古屋', slug: 'nagoya', order: 1, keywords: ['名古屋', '栄', '今池', '金山', '大須', '名駅', '千種', '池下'] },
    { name: '一宮・稲沢・北名古屋', slug: 'ichinomiya', order: 2, keywords: ['一宮', '稲沢', '北名古屋', '津島', '清須', '弥富'] },
    { name: '小牧・春日井・瀬戸', slug: 'komaki', order: 3, keywords: ['小牧', '春日井', '瀬戸', '尾張旭', '犬山', '江南'] },
    { name: '大府・知多・常滑', slug: 'obu', order: 4, keywords: ['大府', '知多', '常滑', '東海', '半田', '碧南'] },
    { name: '豊田・岡崎・刈谷', slug: 'toyota', order: 5, keywords: ['豊田', '岡崎', '刈谷', '安城', '西尾', '知立', '高浜'] },
    { name: '豊橋・豊川', slug: 'toyohashi', order: 6, keywords: ['豊橋', '豊川', '蒲郡', '新城', '田原'] },
  ],
  miyagi: [
    { name: '仙台', slug: 'sendai', order: 1, keywords: ['仙台', '国分町', '青葉区', '宮城野', '太白', '泉区', '若林'] },
    { name: '石巻・東松島', slug: 'ishinomaki', order: 2, keywords: ['石巻', '東松島', '松島', '塩竈'] },
    { name: '大崎・古川', slug: 'osaki', order: 3, keywords: ['大崎', '古川', '栗原', '登米'] },
    { name: '宮城その他', slug: 'miyagi-other', order: 99, keywords: ['宮城その他', '名取', '岩沼', '白石', '角田', '柴田', '多賀城'] },
  ],
  fukuoka: [
    { name: '福岡市・中洲', slug: 'fukuoka-city', order: 1, keywords: ['福岡市', '福岡', '中洲', '博多', '天神', '春日', '大野城', '太宰府', '筑紫野'] },
    { name: '北九州・筑豊', slug: 'kitakyushu', order: 2, keywords: ['北九州', '小倉', '筑豊', '飯塚', '直方', '田川'] },
    { name: '久留米・筑後', slug: 'kurume', order: 3, keywords: ['久留米', '筑後', '大牟田', '柳川', '八女'] },
    { name: '下関', slug: 'shimonoseki', order: 4, keywords: ['下関'] },
    { name: '福岡その他', slug: 'fukuoka-other', order: 99, keywords: ['福岡その他', '古賀', '福津', '宗像', '糸島', '前原'] },
  ],
  // 以下は小規模県 - 既存の本家エリアをそのまま使う場合が多い
  // 風俗じゃぱんのエリアだけ統合する
  fukushima: [
    { name: '福島市・二本松', slug: 'fukushima-city', order: 1, keywords: ['福島', '二本松', '伊達'] },
    { name: '郡山', slug: 'koriyama', order: 2, keywords: ['郡山', '須賀川', '田村'] },
    { name: 'いわき・小名浜', slug: 'iwaki', order: 3, keywords: ['いわき', '小名浜', '湯本', '勿来', '泉'] },
    { name: '会津若松', slug: 'aizu', order: 4, keywords: ['会津', '喜多方'] },
    { name: '白河', slug: 'shirakawa', order: 5, keywords: ['白河', '矢吹', '棚倉'] },
    { name: '福島その他', slug: 'fukushima-other', order: 99, keywords: ['福島その他', '相馬', '南相馬'] },
  ],
  tochigi: [
    { name: '宇都宮', slug: 'utsunomiya', order: 1, keywords: ['宇都宮'] },
    { name: '小山・栃木・佐野', slug: 'oyama', order: 2, keywords: ['小山', '栃木', '佐野', '足利', '真岡', '下野'] },
    { name: '那須・日光', slug: 'nasu', order: 3, keywords: ['那須', '日光', '鹿沼', '矢板', '大田原', '那須塩原'] },
    { name: '栃木その他', slug: 'tochigi-other', order: 99, keywords: ['栃木その他'] },
  ],
  gunma: [
    { name: '高崎・前橋', slug: 'takasaki', order: 1, keywords: ['高崎', '前橋', '安中', '渋川', '藤岡'] },
    { name: '太田・伊勢崎・桐生', slug: 'ota', order: 2, keywords: ['太田', '伊勢崎', '桐生', '館林', 'みどり', '邑楽'] },
    { name: '群馬その他', slug: 'gunma-other', order: 99, keywords: ['群馬その他', '沼田', '利根', '富岡', '草津'] },
  ],
  ibaraki: [
    { name: '水戸', slug: 'mito', order: 1, keywords: ['水戸', 'ひたちなか', '那珂', '笠間'] },
    { name: '土浦・つくば', slug: 'tsuchiura', order: 2, keywords: ['土浦', 'つくば', '牛久', '龍ケ崎', '稲敷', '取手'] },
    { name: '日立・北茨城', slug: 'hitachi', order: 3, keywords: ['日立', '北茨城', '高萩', '常陸太田', '常陸大宮'] },
    { name: '古河・下妻', slug: 'koga', order: 4, keywords: ['古河', '下妻', '結城', '坂東', '境', '五霞', '八千代'] },
    { name: '鹿嶋・神栖', slug: 'kashima', order: 5, keywords: ['鹿嶋', '神栖', '潮来', '鹿島'] },
    { name: '茨城その他', slug: 'ibaraki-other', order: 99, keywords: ['茨城その他'] },
  ],
  niigata: [
    { name: '新潟市', slug: 'niigata-city', order: 1, keywords: ['新潟', '万代', '古町'] },
    { name: '長岡・三条', slug: 'nagaoka', order: 2, keywords: ['長岡', '三条', '見附', '柏崎', '燕'] },
    { name: '上越・妙高', slug: 'joetsu', order: 3, keywords: ['上越', '妙高', '糸魚川', '直江津'] },
    { name: '新潟その他', slug: 'niigata-other', order: 99, keywords: ['新潟その他', '魚沼', '南魚沼', '十日町', '佐渡', '村上'] },
  ],
  yamagata: [
    { name: '山形市・天童', slug: 'yamagata-city', order: 1, keywords: ['山形', '天童', '上山', '寒河江'] },
    { name: '酒田・鶴岡・庄内', slug: 'sakata', order: 2, keywords: ['酒田', '鶴岡', '庄内'] },
    { name: '米沢・置賜', slug: 'yonezawa', order: 3, keywords: ['米沢', '置賜', '南陽', '長井'] },
    { name: '新庄・最上', slug: 'shinjo', order: 4, keywords: ['新庄', '最上'] },
    { name: '山形その他', slug: 'yamagata-other', order: 99, keywords: ['山形その他', '村山', '東根'] },
  ],
  shizuoka: [
    { name: '静岡・清水', slug: 'shizuoka-city', order: 1, keywords: ['静岡', '清水', '焼津', '藤枝', '島田'] },
    { name: '浜松・湖西', slug: 'hamamatsu', order: 2, keywords: ['浜松', '湖西', '磐田', '袋井', '掛川'] },
    { name: '沼津・三島・富士', slug: 'numazu', order: 3, keywords: ['沼津', '三島', '富士', '御殿場', '裾野', '伊豆', '熱海', '下田'] },
  ],
  hyogo: [
    { name: '神戸・三宮', slug: 'kobe', order: 1, keywords: ['神戸', '三宮', '元町', '兵庫', '灘', '東灘', '長田', '須磨', '垂水', '西宮', '芦屋', '尼崎', '伊丹', '宝塚'] },
    { name: '姫路・加古川', slug: 'himeji', order: 2, keywords: ['姫路', '加古川', '明石', '高砂', '赤穂', '相生', 'たつの'] },
    { name: '兵庫その他', slug: 'hyogo-other', order: 99, keywords: ['兵庫その他', '豊岡', '但馬', '淡路', '洲本', '丹波', '篠山', '三田'] },
  ],
  mie: [
    { name: '四日市・桑名', slug: 'yokkaichi', order: 1, keywords: ['四日市', '桑名', '鈴鹿', '亀山', 'いなべ'] },
    { name: '津・松阪', slug: 'tsu', order: 2, keywords: ['津', '松阪', '多気', '明和'] },
    { name: '伊勢・鳥羽・志摩', slug: 'ise', order: 3, keywords: ['伊勢', '鳥羽', '志摩', '度会'] },
    { name: '伊賀・名張', slug: 'iga', order: 4, keywords: ['伊賀', '名張', '上野'] },
    { name: '三重その他', slug: 'mie-other', order: 99, keywords: ['三重その他', '尾鷲', '熊野', '紀北'] },
  ],
  toyama: [
    { name: '富山市', slug: 'toyama-city', order: 1, keywords: ['富山'] },
    { name: '高岡・射水', slug: 'takaoka', order: 2, keywords: ['高岡', '射水', '砺波', '小矢部', '南砺', '氷見'] },
    { name: '魚津・黒部', slug: 'uozu', order: 3, keywords: ['魚津', '黒部', '滑川', '入善', '朝日'] },
    { name: '富山その他', slug: 'toyama-other', order: 99, keywords: ['富山その他'] },
  ],
  tokushima: [
    { name: '徳島市', slug: 'tokushima-city', order: 1, keywords: ['徳島'] },
    { name: '鳴門・阿南', slug: 'naruto', order: 2, keywords: ['鳴門', '阿南', '小松島', '吉野川', '阿波'] },
    { name: '徳島その他', slug: 'tokushima-other', order: 99, keywords: ['徳島その他', '美馬', '三好'] },
  ],
  // 残り小規模県は一括処理
  iwate: [
    { name: '盛岡', slug: 'morioka', order: 1, keywords: ['盛岡', '滝沢'] },
    { name: '北上・花巻・奥州', slug: 'kitakami', order: 2, keywords: ['北上', '花巻', '奥州', '一関', '水沢', '江刺'] },
    { name: '岩手その他', slug: 'iwate-other', order: 99, keywords: ['岩手その他', '宮古', '釜石', '大船渡', '久慈'] },
  ],
  akita: [
    { name: '秋田市', slug: 'akita-city', order: 1, keywords: ['秋田'] },
    { name: '横手・大曲・大仙', slug: 'yokote', order: 2, keywords: ['横手', '大曲', '大仙', '湯沢'] },
    { name: '能代・男鹿', slug: 'noshiro', order: 3, keywords: ['能代', '男鹿'] },
    { name: '秋田その他', slug: 'akita-other', order: 99, keywords: ['秋田その他', '大館', '鹿角'] },
  ],
  aomori: [
    { name: '青森・弘前', slug: 'aomori-city', order: 1, keywords: ['青森', '弘前', '黒石'] },
    { name: '八戸・三沢・十和田', slug: 'hachinohe', order: 2, keywords: ['八戸', '三沢', '十和田'] },
    { name: '青森その他', slug: 'aomori-other', order: 99, keywords: ['青森その他', 'むつ', '下北'] },
  ],
  kyoto: [
    { name: '京都・河原町・祇園', slug: 'kyoto-city', order: 1, keywords: ['京都', '河原町', '祇園', '木屋町', '烏丸', '四条', '五条', '伏見'] },
    { name: '京都その他', slug: 'kyoto-other', order: 99, keywords: ['京都その他', '宇治', '舞鶴', '福知山', '亀岡'] },
  ],
  hiroshima: [
    { name: '広島市・流川', slug: 'hiroshima-city', order: 1, keywords: ['広島', '流川', '薬研堀', '八丁堀', '中区', '東区', '南区', '西区'] },
    { name: '福山・尾道', slug: 'fukuyama', order: 2, keywords: ['福山', '尾道', '三原', '竹原'] },
    { name: '呉・東広島', slug: 'kure', order: 3, keywords: ['呉', '東広島', '廿日市'] },
    { name: '広島その他', slug: 'hiroshima-other', order: 99, keywords: ['広島その他'] },
  ],
  nagano: [
    { name: '長野市・上田', slug: 'nagano-city', order: 1, keywords: ['長野', '上田', '千曲', '須坂', '飯山'] },
    { name: '松本・塩尻', slug: 'matsumoto', order: 2, keywords: ['松本', '塩尻', '安曇野', '大町'] },
    { name: '諏訪・岡谷・伊那', slug: 'suwa', order: 3, keywords: ['諏訪', '岡谷', '伊那', '飯田', '茅野', '駒ヶ根'] },
    { name: '佐久・小諸・軽井沢', slug: 'saku', order: 4, keywords: ['佐久', '小諸', '軽井沢', '御代田'] },
    { name: '長野その他', slug: 'nagano-other', order: 99, keywords: ['長野その他'] },
  ],
  okayama: [
    { name: '岡山市', slug: 'okayama-city', order: 1, keywords: ['岡山'] },
    { name: '倉敷', slug: 'kurashiki', order: 2, keywords: ['倉敷', '水島', '児島'] },
    { name: '岡山その他', slug: 'okayama-other', order: 99, keywords: ['岡山その他', '津山', '玉野', '総社', '笠岡', '備前'] },
  ],
  yamaguchi: [
    { name: '山口・周南', slug: 'yamaguchi-city', order: 1, keywords: ['山口', '周南', '防府', '下松', '光'] },
    { name: '宇部・山陽小野田', slug: 'ube', order: 2, keywords: ['宇部', '山陽小野田', '美祢'] },
    { name: '岩国・柳井', slug: 'iwakuni', order: 3, keywords: ['岩国', '柳井', '大竹'] },
    { name: '山口その他', slug: 'yamaguchi-other', order: 99, keywords: ['山口その他', '萩', '長門'] },
  ],
  okinawa: [
    { name: '那覇・国際通り', slug: 'naha', order: 1, keywords: ['那覇', '国際通り', '松山', '久茂地', '小禄'] },
    { name: '沖縄市・コザ', slug: 'okinawa-city', order: 2, keywords: ['沖縄市', 'コザ', '北谷', '宜野湾', '浦添'] },
    { name: '沖縄その他', slug: 'okinawa-other', order: 99, keywords: ['沖縄その他', '名護', '恩納', '読谷', '嘉手納', '糸満', '豊見城', '南城'] },
  ],
  kagoshima: [
    { name: '鹿児島市・天文館', slug: 'kagoshima-city', order: 1, keywords: ['鹿児島', '天文館'] },
    { name: '鹿児島その他', slug: 'kagoshima-other', order: 99, keywords: ['鹿児島その他', '霧島', '薩摩川内', '指宿', '奄美'] },
  ],
  kumamoto: [
    { name: '熊本市', slug: 'kumamoto-city', order: 1, keywords: ['熊本'] },
    { name: '熊本その他', slug: 'kumamoto-other', order: 99, keywords: ['熊本その他', '八代', '天草', '人吉', '玉名'] },
  ],
  ishikawa: [
    { name: '金沢', slug: 'kanazawa', order: 1, keywords: ['金沢', '片町', '香林坊'] },
    { name: '小松・加賀', slug: 'komatsu', order: 2, keywords: ['小松', '加賀', '白山', '能美'] },
    { name: '石川その他', slug: 'ishikawa-other', order: 99, keywords: ['石川その他', '七尾', '輪島', '珠洲', '羽咋'] },
  ],
  nara: [
    { name: '奈良市', slug: 'nara-city', order: 1, keywords: ['奈良'] },
    { name: '奈良その他', slug: 'nara-other', order: 99, keywords: ['奈良その他', '橿原', '桜井', '天理', '五條', '生駒', '大和郡山', '大和高田'] },
  ],
  wakayama: [
    { name: '和歌山市', slug: 'wakayama-city', order: 1, keywords: ['和歌山'] },
    { name: '和歌山その他', slug: 'wakayama-other', order: 99, keywords: ['和歌山その他', '田辺', '新宮', '海南', '橋本', '有田', '御坊', '白浜'] },
  ],
  gifu: [
    { name: '岐阜市・大垣', slug: 'gifu-city', order: 1, keywords: ['岐阜', '大垣', '各務原', '瑞穂', '本巣', '羽島'] },
    { name: '多治見・中津川', slug: 'tajimi', order: 2, keywords: ['多治見', '中津川', '恵那', '土岐', '瑞浪'] },
    { name: '岐阜その他', slug: 'gifu-other', order: 99, keywords: ['岐阜その他', '高山', '飛騨', '下呂', '関', '美濃', '郡上'] },
  ],
  shiga: [
    { name: '大津・草津', slug: 'otsu', order: 1, keywords: ['大津', '草津', '守山', '栗東', '野洲', '湖南'] },
    { name: '彦根・近江', slug: 'hikone', order: 2, keywords: ['彦根', '近江', '長浜', '米原', '東近江', '八日市'] },
    { name: '滋賀その他', slug: 'shiga-other', order: 99, keywords: ['滋賀その他', '甲賀', '信楽', '高島'] },
  ],
  oita: [
    { name: '大分市', slug: 'oita-city', order: 1, keywords: ['大分'] },
    { name: '別府', slug: 'beppu', order: 2, keywords: ['別府'] },
    { name: '大分その他', slug: 'oita-other', order: 99, keywords: ['大分その他', '中津', '日田', '佐伯', '臼杵', '宇佐'] },
  ],
  saga: [
    { name: '佐賀市', slug: 'saga-city', order: 1, keywords: ['佐賀'] },
    { name: '佐賀その他', slug: 'saga-other', order: 99, keywords: ['佐賀その他', '唐津', '鳥栖', '伊万里', '武雄', '嬉野'] },
  ],
  miyazaki: [
    { name: '宮崎市', slug: 'miyazaki-city', order: 1, keywords: ['宮崎'] },
    { name: '宮崎その他', slug: 'miyazaki-other', order: 99, keywords: ['宮崎その他', '都城', '延岡', '日向', '日南'] },
  ],
  nagasaki: [
    { name: '長崎市', slug: 'nagasaki-city', order: 1, keywords: ['長崎', '思案橋', '銅座'] },
    { name: '佐世保', slug: 'sasebo', order: 2, keywords: ['佐世保'] },
  ],
  fukui: [
    { name: '福井・芦原', slug: 'fukui-city', order: 1, keywords: ['福井', '芦原', '永平寺', '坂井'] },
    { name: '武生・鯖江', slug: 'takefu', order: 2, keywords: ['武生', '鯖江', '越前'] },
    { name: '敦賀・若狭', slug: 'tsuruga', order: 3, keywords: ['敦賀', '若狭', '小浜'] },
    { name: '福井その他', slug: 'fukui-other', order: 99, keywords: ['福井その他', '大野', '勝山'] },
  ],
  yamanashi: [
    { name: '甲府・石和', slug: 'kofu', order: 1, keywords: ['甲府', '石和', '山梨', '甲斐', '中央', '笛吹', '韮崎', '南アルプス'] },
    { name: '山梨その他', slug: 'yamanashi-other', order: 99, keywords: ['山梨その他', '富士吉田', '都留', '大月'] },
  ],
  tottori: [
    { name: '鳥取市', slug: 'tottori-city', order: 1, keywords: ['鳥取'] },
    { name: '米子・境港', slug: 'yonago', order: 2, keywords: ['米子', '境港', '倉吉'] },
    { name: '鳥取その他', slug: 'tottori-other', order: 99, keywords: ['鳥取その他'] },
  ],
  shimane: [
    { name: '松江', slug: 'matsue', order: 1, keywords: ['松江'] },
    { name: '出雲', slug: 'izumo', order: 2, keywords: ['出雲'] },
    { name: '島根その他', slug: 'shimane-other', order: 99, keywords: ['島根その他', '浜田', '益田', '大田', '江津', '安来'] },
  ],
  kagawa: [
    { name: '高松', slug: 'takamatsu', order: 1, keywords: ['高松'] },
    { name: '丸亀・坂出', slug: 'marugame', order: 2, keywords: ['丸亀', '坂出', '善通寺', '観音寺', '三豊'] },
    { name: '香川その他', slug: 'kagawa-other', order: 99, keywords: ['香川その他'] },
  ],
  ehime: [
    { name: '松山', slug: 'matsuyama', order: 1, keywords: ['松山', '伊予', '中予'] },
    { name: '今治・新居浜', slug: 'imabari', order: 2, keywords: ['今治', '新居浜', 'しまなみ', '東予', '西条'] },
    { name: '愛媛その他', slug: 'ehime-other', order: 99, keywords: ['愛媛その他', '大洲', '内子', '久万', '宇和島', '愛南', '南予'] },
  ],
  kochi: [
    { name: '高知市', slug: 'kochi-city', order: 1, keywords: ['高知'] },
    { name: '高知その他', slug: 'kochi-other', order: 99, keywords: ['高知その他', '南国', '四万十', '土佐', '安芸', '須崎', '宿毛'] },
  ],
};

// ============================================================
// メイン処理
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
  
  // 全候補をスコア付きで評価、最長マッチを優先
  let bestMatch = null;
  let bestScore = 0;
  
  for (const ua of unifiedAreas) {
    for (const kw of ua.keywords) {
      let score = 0;
      if (norm === kw) {
        score = kw.length * 10; // 完全一致は最高スコア
      } else if (norm.includes(kw)) {
        score = kw.length * 2; // 部分一致はキーワード長に比例
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

function main() {
  console.log('=== パネマジ エリア統一マイグレーション v3 ===\n');
  
  // バックアップ
  const allAreas = db.prepare('SELECT * FROM areas ORDER BY prefecture, display_order, id').all();
  const allShops = db.prepare('SELECT id, area_id FROM shops WHERE is_active = 1').all();
  console.log(`現状: ${allAreas.length} エリア, ${allShops.length} アクティブ店舗\n`);
  
  const stats = { created: 0, merged: 0, reassigned: 0, deleted: 0, unmatched: 0 };
  const unmatchedAreas = [];
  
  // 県ごとに処理
  for (const [pref, unifiedDefs] of Object.entries(UNIFIED_AREAS)) {
    const existingAreas = db.prepare('SELECT * FROM areas WHERE prefecture = ? ORDER BY display_order, id').all(pref);
    if (existingAreas.length === 0) continue;
    
    console.log(`\n--- ${pref} (既存: ${existingAreas.length} エリア) ---`);
    
    // 1. 統一エリアをUPSERT（既存slugがあればそのまま使う、なければ作成）
    const unifiedAreaMap = {}; // slug -> area record
    
    for (const ud of unifiedDefs) {
      let existing = db.prepare('SELECT * FROM areas WHERE slug = ? AND prefecture = ?').get(ud.slug, pref);
      if (!existing) {
        // slugで見つからない場合、nameで検索（既存名が一致する場合）
        existing = db.prepare('SELECT * FROM areas WHERE name = ? AND prefecture = ?').get(ud.name, pref);
      }
      if (existing) {
        // 名前・slug・display_orderを更新
        db.prepare('UPDATE areas SET name = ?, slug = ?, display_order = ? WHERE id = ?').run(ud.name, ud.slug, ud.order, existing.id);
        unifiedAreaMap[ud.slug] = { ...existing, name: ud.name, slug: ud.slug, display_order: ud.order };
      } else {
        // 新規作成（name重複チェック - 同名が別県にある場合はprefixつける）
        const nameExists = db.prepare('SELECT id FROM areas WHERE name = ?').get(ud.name);
        const insertName = nameExists ? `${ud.name}(${pref})` : ud.name;
        const result = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, ?)').run(insertName, ud.slug, pref, ud.order);
        unifiedAreaMap[ud.slug] = { id: result.lastInsertRowid, name: insertName, slug: ud.slug, prefecture: pref, display_order: ud.order };
        stats.created++;
        console.log(`  + 作成: ${insertName} (${ud.slug})`);
      }
    }
    
    // 統一エリアのIDセットを作成（既存エリアを流用したものも含む）
    const unifiedAreaIds = new Set(Object.values(unifiedAreaMap).map(a => a.id));
    
    // 2. 旧エリアの店舗を統一エリアに移行
    for (const oldArea of existingAreas) {
      // 既に統一エリアならスキップ（IDベースでチェック）
      if (unifiedAreaIds.has(oldArea.id)) continue;
      
      // マッチング
      const match = findBestMatch(oldArea.name, unifiedDefs);
      if (match) {
        const targetArea = unifiedAreaMap[match.slug];
        const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ? AND is_active = 1').get(oldArea.id).c;
        
        if (shopCount > 0) {
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(targetArea.id, oldArea.id);
          console.log(`  → ${oldArea.name} (${shopCount}店) → ${match.name}`);
          stats.reassigned += shopCount;
          stats.merged++;
        }
        
        // 旧エリアを削除（店舗が全て移行済み）
        const remaining = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(oldArea.id).c;
        if (remaining === 0) {
          db.prepare('DELETE FROM areas WHERE id = ?').run(oldArea.id);
          stats.deleted++;
        }
      } else {
        // マッチしなかった → "その他" にフォールバック
        const otherSlug = `${pref}-other`;
        const otherArea = unifiedAreaMap[otherSlug];
        const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ? AND is_active = 1').get(oldArea.id).c;
        
        if (otherArea && shopCount > 0) {
          db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?').run(otherArea.id, oldArea.id);
          console.log(`  ? ${oldArea.name} (${shopCount}店) → ${otherArea.name} (フォールバック)`);
          stats.reassigned += shopCount;
          stats.merged++;
        } else if (shopCount > 0) {
          console.log(`  ✗ ${oldArea.name} (${shopCount}店) マッチなし`);
          unmatchedAreas.push({ pref, area: oldArea.name, shops: shopCount });
          stats.unmatched++;
        }
        
        // 店舗がなければ削除
        const remaining = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(oldArea.id).c;
        if (remaining === 0) {
          db.prepare('DELETE FROM areas WHERE id = ?').run(oldArea.id);
          stats.deleted++;
        }
      }
    }
  }
  
  // UNIFIED_AREASに定義がない県の処理（そのまま残す）
  const definedPrefs = new Set(Object.keys(UNIFIED_AREAS));
  const allPrefs = db.prepare('SELECT DISTINCT prefecture FROM areas').pluck().all();
  const undefinedPrefs = allPrefs.filter(p => !definedPrefs.has(p));
  if (undefinedPrefs.length > 0) {
    console.log(`\n--- 未定義の県（そのまま残す）: ${undefinedPrefs.join(', ')} ---`);
  }
  
  // 最終統計
  const finalAreas = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
  const finalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1 AND area_id IS NOT NULL').get().c;
  const orphanShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1 AND area_id IS NULL').get().c;
  
  console.log('\n=== 結果 ===');
  console.log(`エリア作成: ${stats.created}`);
  console.log(`エリア統合: ${stats.merged}`);
  console.log(`店舗再割当: ${stats.reassigned}`);
  console.log(`旧エリア削除: ${stats.deleted}`);
  console.log(`マッチなし: ${stats.unmatched}`);
  console.log(`最終エリア数: ${finalAreas}`);
  console.log(`割当済み店舗: ${finalShops}`);
  console.log(`孤立店舗: ${orphanShops}`);
  
  if (unmatchedAreas.length > 0) {
    console.log('\n--- マッチしなかったエリア ---');
    for (const u of unmatchedAreas) {
      console.log(`  ${u.pref}: ${u.area} (${u.shops}店)`);
    }
  }
  
  db.close();
  console.log('\n完了！');
}

main();
