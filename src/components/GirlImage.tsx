type Props = {
  // 🚨 src は意図的に受け取らない (2026-09-06)。
  //   写真は 2026-08-08 に表示停止したが、呼び出し側は src={girl.image_url} を渡し続けていたため、
  //   掲載元の画像URLがクライアントへ送る RSC ペイロードに丸ごと残っていた
  //   (実測: /shop/2117 のペイロードに 137本)。表示していなくても「掲載元のURLを配っている」
  //   状態なので、無断掲載の苦情 (feedback #52〜#56) に対する対応として不十分だった。
  //   型から外すことで、渡している箇所があればビルドで落ちる。
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
