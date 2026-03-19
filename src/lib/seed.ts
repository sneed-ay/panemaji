import db from './db';

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM areas').get() as { c: number };
  if (count.c > 0) return;

  const insertArea = db.prepare('INSERT INTO areas (name, slug) VALUES (?, ?)');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, description, source_url) VALUES (?, ?, ?, ?, ?)');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  const areas = [
    { name: '新宿・歌舞伎町', slug: 'shinjuku' },
    { name: '池袋', slug: 'ikebukuro' },
    { name: '渋谷', slug: 'shibuya' },
    { name: '五反田', slug: 'gotanda' },
    { name: '鶯谷・日暮里', slug: 'uguisudani' },
    { name: '上野・浅草', slug: 'ueno' },
    { name: '品川', slug: 'shinagawa' },
    { name: '錦糸町', slug: 'kinshicho' },
    { name: '立川・八王子', slug: 'tachikawa' },
    { name: '吉原', slug: 'yoshiwara' },
  ];

  const transaction = db.transaction(() => {
    const areaMap: Record<string, number> = {};
    for (const a of areas) {
      const result = insertArea.run(a.name, a.slug);
      areaMap[a.name] = result.lastInsertRowid as number;
    }

    // Real shops from cityheaven page 1
    const shops = [
      { name: 'ウルトラグレイス24', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: 'エピソード', area: '品川', cat: 'デリヘル' },
      { name: 'GINGIRA☆TOKYO～ギンギラ東京～', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: 'アロマファンタジー', area: '渋谷', cat: 'エステ・アロマ' },
      { name: 'E+アイドルスクール池袋店', area: '池袋', cat: 'デリヘル' },
      { name: 'ウルトラハピネス', area: '錦糸町', cat: 'デリヘル' },
      { name: 'レッドベリル', area: '五反田', cat: 'デリヘル' },
      { name: 'マテリアル', area: '渋谷', cat: 'デリヘル' },
      { name: 'アバンチュール', area: '五反田', cat: 'デリヘル' },
      { name: 'ハニーコレクション', area: '吉原', cat: 'ソープ' },
      { name: 'Okini東京', area: '立川・八王子', cat: 'デリヘル' },
      { name: 'グッドワイフ', area: '吉原', cat: 'ソープ' },
      { name: 'ウルトラプラチナム', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: 'ごほうびSPA五反田店', area: '五反田', cat: 'エステ・アロマ' },
      { name: 'とろリッチSPA五反田店', area: '五反田', cat: 'エステ・アロマ' },
      { name: '新宿人妻城', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: '風神会館', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: 'Versailles', area: '吉原', cat: 'ソープ' },
      { name: '池袋人妻城', area: '池袋', cat: 'デリヘル' },
      { name: '性の極み 技の伝道師 ver.匠', area: '池袋', cat: 'デリヘル' },
      { name: 'E+錦糸町', area: '錦糸町', cat: 'デリヘル' },
      { name: 'デザインプリズム新宿', area: '新宿・歌舞伎町', cat: 'デリヘル' },
      { name: 'カサノヴァ', area: '吉原', cat: 'ソープ' },
      { name: 'Platinum stage', area: '吉原', cat: 'ソープ' },
      { name: 'ウルトラロイヤル', area: '五反田', cat: 'デリヘル' },
      { name: 'LUXE リュクス', area: '吉原', cat: 'ソープ' },
      { name: '吉原美女革命', area: '吉原', cat: 'ソープ' },
      { name: 'グランドオペラ東京', area: '渋谷', cat: 'デリヘル' },
      { name: 'ロマネコンティ', area: '吉原', cat: 'ソープ' },
      { name: '人妻出逢い会 百合の園', area: '渋谷', cat: 'デリヘル' },
      { name: '池袋にゃんだ☆FULL☆MIX', area: '池袋', cat: 'デリヘル' },
      { name: 'BLUE TOKYO', area: '吉原', cat: 'ソープ' },
    ];

    function getAreaId(areaName: string): number {
      // Try exact match first
      if (areaMap[areaName]) return areaMap[areaName];
      // Try partial match
      for (const [key, id] of Object.entries(areaMap)) {
        if (key.includes(areaName) || areaName.includes(key)) return id;
      }
      // Default to first area
      return Object.values(areaMap)[0];
    }

    const shopIds: number[] = [];
    for (const s of shops) {
      const areaId = getAreaId(s.area);
      const result = insertShop.run(s.name, areaId, s.cat, null, null);
      shopIds.push(result.lastInsertRowid as number);
    }

    // Real girls data from ウルトラグレイス24 (shop index 0)
    const realGirls = [
      ['桜井こと',21,153,85,'D',57,85],['巡あい',22,144,86,'F',57,84],
      ['のの',21,160,90,'G',58,85],['るり',20,161,94,'G',56,85],
      ['ことね',20,162,88,'E',57,85],['なぎ',18,158,83,'C',56,84],
      ['るな',20,159,84,'C',57,85],['卯月うい',22,160,87,'E',56,86],
      ['かすみ',20,164,89,'F',57,84],['りら',20,165,83,'B',56,84],
      ['えりか',19,161,88,'E',56,86],['桜田えみ',21,153,84,'C',55,86],
      ['白鳥みほ',20,170,88,'F',57,87],['春乃うらら',21,151,89,'E',57,84],
      ['あんこ',22,160,84,'C',57,85],['まり',24,160,92,'G',57,86],
      ['みか',22,157,84,'C',57,86],['れいら',22,158,97,'G',57,85],
      ['夢乃つづき',24,152,86,'D',58,86],['はづき',20,156,87,'E',57,85],
    ];

    for (const g of realGirls) {
      insertGirl.run(g[0], shopIds[0], g[1], g[2], g[3], g[4], g[5], g[6]);
    }

    // Generate sample girls for other shops
    const names = [
      'あいり','みく','さくら','りん','ゆい','ひなた','もも','れな','あやか','まい',
      'ゆうな','かのん','しおり','つばさ','ここあ','みお','あかり','ひかり','なな','えま',
      'ここな','りこ','さな','みゆ','あおい','はるか','まりな','のぞみ','ちはる','ゆめ',
      'かれん','みさき','あいな','りさ','まお','ゆきの','せりな','あんな','みほ','かな',
      'ゆりあ','すず','まどか','しずく','あすか','めい','ふうか','ちなつ','あみ','るか',
    ];
    const cups = ['B','C','C','D','D','E','E','F','G'];
    let nameIdx = 0;

    for (let si = 1; si < shopIds.length; si++) {
      const numGirls = 5 + Math.floor(Math.random() * 10);
      for (let g = 0; g < numGirls; g++) {
        const n = names[nameIdx % names.length];
        nameIdx++;
        const age = 19 + Math.floor(Math.random() * 10);
        const height = 148 + Math.floor(Math.random() * 22);
        const cup = cups[Math.floor(Math.random() * cups.length)];
        const bust = cup === 'B' ? 80 : cup === 'C' ? 83 : cup === 'D' ? 86 :
                     cup === 'E' ? 89 : cup === 'F' ? 92 : 95;
        const b = bust + Math.floor(Math.random() * 4);
        const w = 55 + Math.floor(Math.random() * 6);
        const h = 83 + Math.floor(Math.random() * 8);
        insertGirl.run(n, shopIds[si], age, height, b, cup, w, h);
      }
    }
  });

  transaction();
}
