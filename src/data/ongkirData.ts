// Approximate representative road-distance-from-Jakarta (km) per master kota.
// This is only a mock proxy so "Cek Ongkir" has *some* distance signal
// between any two cities in master data - not a real routing/geo distance.
export const JARAK_DARI_JAKARTA_KM: Record<string, number> = {
  Jakarta: 0,
  Bekasi: 25,
  Depok: 25,
  Tangerang: 30,
  Cikarang: 55,
  Bogor: 60,
  Karawang: 80,
  Cikampek: 90,
  Purwakarta: 100,
  Sukabumi: 120,
  Bandung: 150,
  Cirebon: 250,
  Semarang: 450,
  Solo: 550,
  Yogyakarta: 560,
  Surabaya: 800,
  Sidoarjo: 810,
  Malang: 850,
  Lampung: 280,
  Palembang: 600,
  Pekanbaru: 1200,
  Denpasar: 1150,
  Makassar: 1450,
  Balikpapan: 1500,
  Medan: 1900,
  Manado: 2400,
};

// Which island/region each master kota belongs to - used so the tier lookup
// in ongkir.ts can tell "still in Java, just far" apart from "different
// island entirely" instead of relying on raw distance alone (that alone
// mislabeled Java cities like Surabaya as "Luar Jawa").
export const PULAU_KOTA: Record<string, string> = {
  Jakarta: "Jawa",
  Bekasi: "Jawa",
  Depok: "Jawa",
  Tangerang: "Jawa",
  Cikarang: "Jawa",
  Bogor: "Jawa",
  Karawang: "Jawa",
  Cikampek: "Jawa",
  Purwakarta: "Jawa",
  Sukabumi: "Jawa",
  Bandung: "Jawa",
  Cirebon: "Jawa",
  Semarang: "Jawa",
  Solo: "Jawa",
  Yogyakarta: "Jawa",
  Surabaya: "Jawa",
  Sidoarjo: "Jawa",
  Malang: "Jawa",
  Lampung: "Sumatera",
  Palembang: "Sumatera",
  Pekanbaru: "Sumatera",
  Medan: "Sumatera",
  Denpasar: "Bali",
  Makassar: "Sulawesi",
  Manado: "Sulawesi",
  Balikpapan: "Kalimantan",
};
