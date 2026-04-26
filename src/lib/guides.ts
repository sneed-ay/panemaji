import fs from 'node:fs';
import path from 'node:path';

// Read once per process — Next.js keeps the module cached
let cachedSlugs: string[] | null = null;

export function getAllGuideSlugs(): string[] {
  if (cachedSlugs) return cachedSlugs;
  const guideDir = path.join(process.cwd(), 'src/app/guide');
  try {
    cachedSlugs = fs
      .readdirSync(guideDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
  } catch {
    cachedSlugs = [];
  }
  return cachedSlugs;
}

// Return guides whose slug starts with `${areaSlug}-` or `${prefSlug}-`.
// Limits to `max` results, area matches first.
export function getRelatedGuides(
  areaSlug: string | null | undefined,
  prefSlug: string | null | undefined,
  max = 3,
): { slug: string; title: string }[] {
  const all = getAllGuideSlugs();
  const seen = new Set<string>();
  const picks: string[] = [];

  const addMatches = (prefix: string | null | undefined) => {
    if (!prefix) return;
    for (const slug of all) {
      if (picks.length >= max) break;
      if (seen.has(slug)) continue;
      if (slug.startsWith(`${prefix}-`)) {
        picks.push(slug);
        seen.add(slug);
      }
    }
  };

  addMatches(areaSlug);
  if (picks.length < max) addMatches(prefSlug);

  return picks.map((slug) => ({ slug, title: slugToTitle(slug) }));
}

// Convert a slug like "shinjuku-deriheru-guide" to display title
export function slugToTitle(slug: string): string {
  const replacements: Record<string, string> = {
    // 業態
    'deriheru': 'デリヘル', 'menesu': 'メンエス', 'menesthe': 'メンエス',
    'soap': 'ソープ', 'health': 'ヘルス', 'hotelhel': 'ホテヘル', 'esthe': 'エステ',
    'panemaji': 'パネマジ', 'fuzoku': '風俗', 'massage': 'マッサージ',
    // 地名 (都道府県・主要都市・歓楽街)
    'akihabara': '秋葉原', 'akita': '秋田', 'aomori': '青森', 'atsugi': '厚木',
    'chiba': '千葉', 'fukui': '福井', 'fukuoka': '福岡', 'fukushima': '福島',
    'funabashi': '船橋', 'gifu': '岐阜', 'gotanda': '五反田', 'hamamatsu': '浜松',
    'hiroshima': '広島', 'ikebukuro': '池袋', 'iwate': '岩手', 'kagoshima': '鹿児島',
    'kamata': '蒲田', 'kanazawa': '金沢', 'kashiwa': '柏', 'kawagoe': '川越',
    'kawaguchi': '川口', 'kawasaki': '川崎', 'kichijoji': '吉祥寺',
    'kinshicho': '錦糸町', 'kitakyushu': '北九州', 'kobe': '神戸', 'kochi': '高知',
    'koriyama': '郡山', 'koshigaya': '越谷', 'kumamoto': '熊本', 'kyoto': '京都',
    'matsuyama': '松山', 'mie': '三重', 'mito': '水戸', 'miyazaki': '宮崎',
    'nagano': '長野', 'nagasaki': '長崎', 'nagoya': '名古屋', 'naha': '那覇',
    'nakano': '中野', 'nara': '奈良', 'niigata': '新潟', 'oita': '大分',
    'okayama': '岡山', 'okinawa': '沖縄', 'omiya': '大宮', 'osaka': '大阪',
    'otsuka': '大塚', 'roppongi': '六本木', 'saga': '佐賀', 'sagamihara': '相模原',
    'saitama': '埼玉', 'sapporo': '札幌', 'sendai': '仙台', 'shibuya': '渋谷',
    'shinbashi': '新橋', 'shinjuku': '新宿', 'shizuoka': '静岡', 'takamatsu': '高松',
    'takasaki': '高崎', 'tachikawa': '立川', 'tokushima': '徳島', 'toyama': '富山',
    'ueno': '上野', 'utsunomiya': '宇都宮', 'wakayama': '和歌山', 'yamagata': '山形',
    'yokohama': '横浜', 'ginza': '銀座', 'akasaka': '赤坂',
    'horinouchi': '堀之内', 'kanazuka': '金津園', 'nakasu': '中洲',
    'nishikawaguchi': '西川口', 'ogoto': '雄琴', 'susukino': 'すすきの',
    'tobita': '飛田', 'yoshiwara': '吉原', 'iidabashi': '飯田橋', 'tokyo': '東京',
    // 一般語
    'guide': 'ガイド', 'detail': '徹底解説', 'night': 'ナイト', 'taisaku': '対策',
    'first': '初めての', 'hajimete': '初めての', 'erabikata': '選び方',
    'ryoukin': '料金', 'souba': '相場', 'faq': 'FAQ', 'beginner': '初心者',
    'checklist': 'チェックリスト', 'check': 'チェック', 'kuchikomi': '口コミ',
    'katsuyou': '活用法', 'shinjitsu': '真実', 'tokou': '投稿', 'kaishu': '加修',
    'kaishuu': '加修', 'gihou': '技法', 'kiwadoi': '際どい', 'nagare': 'の流れ',
    'after': 'アフター', 'aroma': 'アロマ', 'oil': 'オイル', 'foot': '足',
    'hand': 'ハンド', 'leg': '脚', 'back': '背中', 'neck': '首', 'shoulder': '肩',
    'scalp': 'スカルプ', 'morning': '朝', 'weekday': '平日', 'weekend': '週末',
    'weekly': '週間', 'holiday': '休日', 'premium': 'プレミアム', 'repeat': 'リピート',
    'frequency': '頻度', 'difference': '違い', 'pressure': '指圧', 'stretch': 'ストレッチ',
    'technique': 'テクニック', 'service': 'サービス', 'flow': 'の流れ',
    'panel': 'パネル', 'photo': '写真', 'mitiwake': '見分け方', 'rekishi': '歴史',
    'kako': '加工', 'sagasu': '事情', 'real': 'リアル', 'do': '度',
    'ranking': 'ランキング', 'system': 'システム', 'shame': '写メ', 'nikki': '日記',
    'mikata': '見方', 'shop': '店舗', 'time': '時間', 'short': 'ショート', 'long': 'ロング',
    'course': 'コース', 'change': '本指名', 'erabi': '選び',
    'av': 'AV', 'joyuu': '女優', 'zaiseki': '在籍', 'nenmatsu': '年末', 'nenshi': '年始',
    'trend': 'トレンド', 'budget': '予算', 'plan': 'プラン',
    'cosplay': 'コスプレ', 'mature': '熟女', 'student': '学生', 'foreign': '外国人',
    'amateur': '素人', 'newcomer': '新人', 'couple': 'カップル',
    'season': '季節', 'summer': '夏', 'winter': '冬', 'rainy': '雨',
    'christmas': 'クリスマス', 'valentines': 'バレンタイン', 'white': 'ホワイト',
    'day': 'デー', 'golden': 'ゴールデン', 'week': 'ウィーク', 'obon': 'お盆',
    'anniversary': '記念日', 'event': 'イベント', 'option': 'オプション',
    'discount': '割引', 'cashless': 'キャッシュレス', 'free': 'フリー',
    'point': 'ポイント', 'rank': 'ランク', 'membership': '会員', 'referral': '紹介',
    'reservation': '予約', 'phone': '電話', 'line': 'LINE', 'sns': 'SNS',
    'hotel': 'ホテル', 'apartment': 'マンション', 'parking': '駐車場',
    'taxi': 'タクシー', 'travel': '旅行', 'business': '出張', 'trip': '出張',
    'manner': 'マナー', 'tipping': 'チップ', 'hangover': '二日酔い',
    'eisei': '衛生', 'hair': '脱毛', 'removal': '脱毛', 'skin': '肌', 'care': 'ケア',
    'smell': '匂い', 'diet': 'ダイエット', 'body': '体型', 'type': 'タイプ',
    'mental': 'メンタル', 'stress': 'ストレス', 'relief': '解消', 'relationship': '関係',
    'self': 'セルフ', 'multiple': '複数', 'double': 'ダブル', 'booking': '予約',
    'late': '深夜', 'daytime': '昼', 'nightlife': 'ナイトライフ',
    'request': 'リクエスト', 'review': 'レビュー', 'analyze': '分析',
    'video': '動画', 'edit': '編集', 'app': 'アプリ', 'ai': 'AI',
    'age': '年齢', 'limit': '制限', 'verification': '本人確認', 'privacy': 'プライバシー',
    'accessibility': 'アクセシビリティ', 'category': '業態', 'comparison': '比較',
    'regional': '地域', 'rule': 'ルール', 'law': '法律', 'safety': '安全',
    'dispatch': '派遣', 'soapland': 'ソープランド', 'combo': 'はしご',
    'cost': 'コスト', 'save': '節約', 'luxury': '高級', 'vip': 'VIP', 'vs': 'vs',
    'typhoon': '台風', 'chain': 'チェーン',
    'trouble': 'トラブル', 'case1': '事例1', 'case2': '事例2', 'case3': '事例3',
    'future': '未来', 'prediction': '予測', '2026': '2026',
    'price': '価格', 'tips': 'コツ', 'how': '使い方', 'to': 'の', 'use': '使い方',
    'ns': 'NS', 'nn': 'NN', 'toha': 'とは', 'fag': 'FAQ',
    'yougo': '用語集',
    'lighting': '照明', 'music': '音楽', 'room': 'ルーム', 'gift': 'プレゼント',
    'timing': 'タイミング', 'ear': '耳', 'facial': 'フェイシャル', 'deep': 'ディープ',
    'certification': '認定', 'therapist': 'セラピスト', 'stone': 'ストーン', 'hot': 'ホット',
    // 区分
    'compare': '比較', 'special': '特集', 'column': 'コラム',
  };
  const parts = slug.split('-');
  return parts
    .map((p) => replacements[p] || p.replace(/^\w/, (c) => c.toUpperCase()))
    .join(' ');
}
