type Props = {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: number;
  className?: string;
};

// 2026-08: 嬢のパネル写真(外部ホットリンク)を全面撤去。
//   当初は名前イニシャルの色付きアバターに置換したが、写真が無い以上アイコンも不要との判断で
//   何も描画しない(null)ことにし、名前・スペック・パネマジ度が主役のテキスト中心カードにする。
//   props は呼び出し側互換のため型として受け取るが使用しない(=非描画)。DBの image_url は保持(可逆)。
//   復活させる場合は git 履歴の <img>版 or アバター版を参照。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function GirlImage(_props: Props) {
  return null;
}
