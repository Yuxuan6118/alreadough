/**
 * The vision board's font library. Every font here is free for commercial use (SIL Open Font License).
 * At build time vinext downloads them from Google Fonts and serves them from our own domain, split into small files,
 * so a phone only fetches the characters it draws. This module is loaded on demand (VisionCanvasStudio imports it
 * when text is on the board or the text tools open), so the rest of the app never pays for it.
 */
import { Abril_Fatface, Bebas_Neue, Cormorant_Garamond, Dancing_Script, Great_Vibes, Long_Cang, Ma_Shan_Zheng, Playfair_Display, ZCOOL_KuaiLe, ZCOOL_QingKe_HuangYou, ZCOOL_XiaoWei, Zhi_Mang_Xing } from "next/font/google";

const xiaowei = ZCOOL_XiaoWei({ weight: "400", preload: false, display: "swap" });
const mashan = Ma_Shan_Zheng({ weight: "400", preload: false, display: "swap" });
const zhimang = Zhi_Mang_Xing({ weight: "400", preload: false, display: "swap" });
const longcang = Long_Cang({ weight: "400", preload: false, display: "swap" });
const kuaile = ZCOOL_KuaiLe({ weight: "400", preload: false, display: "swap" });
const huangyou = ZCOOL_QingKe_HuangYou({ weight: "400", preload: false, display: "swap" });
const playfair = Playfair_Display({ weight: "500", subsets: ["latin"], preload: false, display: "swap" });
const cormorant = Cormorant_Garamond({ weight: "500", style: "italic", subsets: ["latin"], preload: false, display: "swap" });
const greatvibes = Great_Vibes({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const dancing = Dancing_Script({ weight: "500", subsets: ["latin"], preload: false, display: "swap" });
const abril = Abril_Fatface({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

/** CSS font-family (and style) for each web font id in VISION_FONTS */
export const visionFontFaces: Record<string, { fontFamily: string; fontStyle?: string }> = {
  xiaowei: xiaowei.style, mashan: mashan.style, zhimang: zhimang.style, longcang: longcang.style, kuaile: kuaile.style, huangyou: huangyou.style,
  playfair: playfair.style, cormorant: cormorant.style, greatvibes: greatvibes.style, dancing: dancing.style, abril: abril.style, bebas: bebas.style,
};
