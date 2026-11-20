/**
 * Asset paths untuk Services dan Journey steps.
 * Semua gambar dari /assets folder project.
 */

export const ASSETS_PATH = "/assets";

export const serviceAssets: Record<string, string> = {
  ltl: `${ASSETS_PATH}/ltl.webp`,
  ftl: `${ASSETS_PATH}/ftl.webp`,
  fcl: `${ASSETS_PATH}/fcl.webp`,
  lcl: `${ASSETS_PATH}/lcl.webp`,
  "air-express": `${ASSETS_PATH}/air-express.webp`,
  procargo: `${ASSETS_PATH}/pro-cargo.webp`,
};

export const journeyAssets: Record<string, string> = {
  order: `${ASSETS_PATH}/1-order.webp`,
  pickup: `${ASSETS_PATH}/2-pickup.webp`,
  transit: `${ASSETS_PATH}/3-ontheway.webp`,
  update: `${ASSETS_PATH}/4-realtime-update.webp`,
  arrived: `${ASSETS_PATH}/5-tiba.webp`,
  delivered: `${ASSETS_PATH}/6-serahterima.webp`,
};

/** Fleet photos (served from /assets, files live in public/assets). */
export const fleetAssets = {
  "pickup-bak": `${ASSETS_PATH}/pickup-bak.webp`,
  "pickup-box": `${ASSETS_PATH}/pickup-box.webp`,
  "blind-van": `${ASSETS_PATH}/blind-van.webp`,
  "cde-bak-triway": `${ASSETS_PATH}/cde-bak-triway.webp`,
  "cdd-bak-sentral": `${ASSETS_PATH}/cdd-bak-sentral.webp`,
  "cdd-bak-triway": `${ASSETS_PATH}/cdd-bak-triway.webp`,
  "cdd-box-long": `${ASSETS_PATH}/cdd-box-long.webp`,
  "cdd-losbak": `${ASSETS_PATH}/cdd-losbak.webp`,
  "cdd-wingbox": `${ASSETS_PATH}/cdd-wingbox.webp`,
  "fuso-box": `${ASSETS_PATH}/fuso-box.webp`,
  "fuso-triway": `${ASSETS_PATH}/fuso-triway.webp`,
  "fuso-losbak": `${ASSETS_PATH}/fuso-losbak.webp`,
  "fuso-wingbox": `${ASSETS_PATH}/fuso-wingbox.webp`,
  "fuso-refer-termoking": `${ASSETS_PATH}/fuso-refer-termoking.webp`,
  "tronton-bak-triway": `${ASSETS_PATH}/tronton-bak-triway.webp`,
  "tronton-losbak": `${ASSETS_PATH}/tronton-losbak.webp`,
  "tronton-wingbox": `${ASSETS_PATH}/tronton-wingbox.webp`,
  "tronton-refer-termoking": `${ASSETS_PATH}/tronton-refer-termoking.webp`,
  "trailer-20ft": `${ASSETS_PATH}/trailer-20ft.webp`,
  "trailer-40ft": `${ASSETS_PATH}/trailer-40ft.webp`,
  "trailer-big-mama-wingbox": `${ASSETS_PATH}/trailer-big-mama-wingbox.webp`,
  lowbed: `${ASSETS_PATH}/lowbed.webp`,
  dolly: `${ASSETS_PATH}/dolly.webp`,
} as const;

/** The 13 client logos, one image each, in the order of their file numbers (assets/01 ... 13, served from public/assets). */
export const clientLogos = [
  { name: "J&T", file: "01.jnt.webp", width: 1983, height: 793 },
  { name: "Cimory", file: "02.cimory.webp", width: 1774, height: 887 },
  { name: "Transkon", file: "03.transkon.webp", width: 1983, height: 793 },
  { name: "Bukaka", file: "04.bukaka.webp", width: 2172, height: 724 },
  { name: "Bach Group", file: "05-bach-group.webp", width: 1774, height: 887 },
  { name: "Philips", file: "06-philips.webp", width: 2172, height: 724 },
  { name: "Häfele", file: "07-haefele.webp", width: 2172, height: 724 },
  { name: "Shopee Xpress", file: "08-shopee-xpress.webp", width: 2172, height: 724 },
  { name: "ANTV", file: "09-antv.webp", width: 2172, height: 724 },
  { name: "Lion Parcel", file: "10-lion-parcel.webp", width: 2172, height: 724 },
  { name: "Lazada Express", file: "11-lazada-express.webp", width: 1536, height: 1024 },
  { name: "SiCepat Ekspres", file: "12-sicepat-ekspres.webp", width: 2172, height: 724 },
  { name: "Tata Motors", file: "13-tata-motors.webp", width: 1536, height: 1024 },
].map((c) => ({ ...c, src: `${ASSETS_PATH}/${c.file}` }));
