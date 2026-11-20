/**
 * Asset paths untuk Services dan Journey steps.
 * Semua gambar dari /assets folder project.
 */

export const ASSETS_PATH = "/assets";

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
