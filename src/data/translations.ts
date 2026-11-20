export type Language = "id" | "en";

interface Translations {
  nav: {
    tagline: string;
    home: string;
    about: string;
    services: string;
    advantages: string;
    checkPrice: string;
    trackPackage: string;
    openMenu: string;
    closeMenu: string;
  };
  footer: {
    tagline: string;
    description: string;
    navHeading: string;
    contactHeading: string;
    contactText: string;
    contactLink: string;
    contactTextAfter: string;
    adminPortal: string;
    copyright: string;
  };
  home: {
    heroBadge: string;
    heroTitleA: string;
    heroTitleHighlight: string;
    heroDesc: string;
    heroImageAlt: string;
    ctaContact: string;
    ctaCheckPrice: string;
    ctaServices: string;
    coverageLabel: string;
    coverageSuffix: string;
    aboutHeading: string;
    aboutP1: string;
    aboutP2: string;
    servicesHeading: string;
    servicesDesc: string;
    services: { title: string; desc: string; benefit: string }[];
    technologyHeading: string;
    technologyDesc: string;
    technology: { title: string; desc: string }[];
    advantagesHeading: string;
    advantagesDesc: string;
    advantages: { title: string; desc: string }[];
    statsHeading: string;
    statsDesc: string;
    statTotalShipments: string;
    statCitiesCovered: string;
    statFleet: string;
    trustStrip: string[];
    ctaHeading: string;
    ctaDesc: string;
    ctaButton: string;
  };
  companyValues: { title: string; desc: string }[];
  about: {
    title: string;
    p1: string;
    p2: string;
  };
  contact: {
    title: string;
    desc: string;
    channelPhone: string;
    channelWhatsapp: string;
    channelEmail: string;
    hqLabel: string;
    hoursLabel: string;
    hoursValue: string;
    footNote: string;
    footNoteLink: string;
  };
  trackingSearch: {
    heroTitle: string;
    heroTitleGold: string;
    heroDesc: string;
    placeholder: string;
    submitButton: string;
    notFound: string;
    scanButton: string;
    historyTitle: string;
    clearAll: string;
    lastViewed: string;
    removeFromHistory: string;
    exampleTitle: string;
    taglineImage: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
  };
  trackingResult: {
    back: string;
    searchPlaceholder: string;
    notFoundTitle: string;
    notFoundDesc: string;
    notFoundBack: string;
    notFoundError: string;
    resiNumber: string;
    estimatedArrival: string;
    delivered: string;
    notAvailable: string;
    origin: string;
    destination: string;
    sender: string;
    receiver: string;
    shipmentDetail: string;
    resiNumberLabel: string;
    service: string;
    weight: string;
    packageCount: string;
    packageContent: string;
    shippingDate: string;
    destinationAddress: string;
    currentTruck: string;
    transferNote: string;
    noTruckAssigned: string;
    journeyHeading: string;
    helpText: string;
  };
  cekOngkir: {
    title: string;
    heroTitle: string;
    heroTitleGold: string;
    desc: string;
    formTitle: string;
    formDesc: string;
    originCity: string;
    destinationCity: string;
    swapCities: string;
    cityNotFound: string;
    weightLabel: string;
    weightPlaceholder: string;
    koliLabel: string;
    serviceLabel: string;
    submitButton: string;
    errorCities: string;
    errorWeight: string;
    resultDisclaimer: string;
    route: string;
    estimatedDistance: string;
    estimatedArrival: string;
    weightKoli: string;
    /** "{kategori}", "{min}", "{charge}" are filled in by the page. */
    minWeightNote: string;
    minWeightHint: string;
    belowMinWarning: string;
    noRateNote: string;
    originProvince: string;
    destinationProvince: string;
    destinationDistrict: string;
    provinceNotFound: string;
    selectProvinceFirst: string;
    errorRoute: string;
    errorPricing: string;
    calculating: string;
    areaCategory: string;
    publishPrice: string;
    originAdjustment: string;
    priceAfterAdjustment: string;
    perKg: string;
    originAdjustmentNote: string;
    benefit1Title: string;
    benefit1Desc: string;
    benefit2Title: string;
    benefit2Desc: string;
    benefit3Title: string;
    benefit3Desc: string;
  };
  pod: {
    title: string;
    delivered: string;
    dateTime: string;
    location: string;
    receivedBy: string;
    itemPhoto: string;
    suratJalan: string;
    noPhoto: string;
  };
  stepper: {
    orderCreated: string;
    pickedUp: string;
    inTransit: string;
    outForDelivery: string;
    delivered: string;
    kendalaWarning: string;
  };
  timeline: {
    latest: string;
    noTruckAssigned: string;
  };
  feedback: {
    floatingButton: string;
    close: string;
    prompt: string;
    commentLabel: string;
    commentPlaceholder: string;
    submitButton: string;
    thankYou: string;
    starLabel: (n: number) => string;
  };
  scanner: {
    title: string;
    close: string;
    openingCamera: string;
    cameraError: string;
    instructions: string;
  };
}

const id: Translations = {
  nav: {
    tagline: "Jasa Logistik & Pengiriman",
    home: "Beranda",
    about: "Tentang Kami",
    services: "Layanan",
    advantages: "Keunggulan",
    checkPrice: "Cek Ongkir",
    trackPackage: "Lacak Paket",
    openMenu: "Buka menu navigasi",
    closeMenu: "Tutup menu navigasi",
  },
  footer: {
    tagline: "GMS Logistics",
    description:
      "Perusahaan jasa logistik dan pengiriman barang antar kota, didukung sistem digital agar proses layanan lebih transparan dan efisien.",
    navHeading: "Navigasi",
    contactHeading: "Kontak",
    contactText: "Butuh bantuan seputar layanan kami? Kunjungi halaman",
    contactLink: "Hubungi Kami",
    contactTextAfter: "untuk kontak tim customer service kami.",
    adminPortal: "Portal Admin",
    copyright: "PT Gangsar Mitra Suatama · Sistem Tracking & Resi Digital",
  },
  home: {
    heroBadge: "Mitra Logistik Terpadu",
    heroTitleA: "Solusi Pengiriman Barang yang Rapi, Terkoordinasi, dan",
    heroTitleHighlight: "Bisa Diandalkan",
    heroDesc:
      "PT Gangsar Mitra Suatama menghadirkan layanan logistik antar kota yang dikelola secara profesional oleh tim operasional kami sendiri, didukung sistem digital agar setiap proses berjalan konsisten dan terdokumentasi.",
    heroImageAlt: "Serah terima paket antara kurir dan penerima",
    ctaContact: "Hubungi Kami",
    ctaCheckPrice: "Lacak Paket",
    ctaServices: "Pelajari Layanan Kami",
    coverageLabel: "Cakupan layanan",
    coverageSuffix: "kota di Indonesia",
    aboutHeading: "Tentang Kami",
    aboutP1:
      "PT Gangsar Mitra Suatama adalah perusahaan jasa logistik dan pengiriman barang yang melayani rute antar kota di Indonesia. Kami hadir untuk menjawab kebutuhan bisnis dan individu akan layanan pengiriman yang terkoordinasi rapi, dengan proses kerja yang jelas di setiap tahapnya.",
    aboutP2:
      "Operasional kami dijalankan oleh tim internal yang menangani langsung setiap pengiriman - mulai dari penerimaan barang, koordinasi armada, hingga serah terima ke penerima - didukung sistem digital agar prosesnya konsisten dan terdokumentasi dengan baik. Kami berkomitmen menghadirkan layanan pengiriman yang transparan dan mudah dipantau, sehingga customer tidak perlu lagi menghubungi tim secara manual untuk mengetahui posisi barangnya.",
    servicesHeading: "Layanan Kami",
    servicesDesc: "Solusi pengiriman menyeluruh, dari penerimaan barang hingga sampai ke tangan penerima.",
    services: [
      {
        title: "Pengiriman Antar Kota",
        desc: "Layanan pengiriman darat ke berbagai kota tujuan, didukung armada truck sesuai kebutuhan muatan Anda.",
        benefit: "Jangkauan luas, armada bervariasi",
      },
      {
        title: "Dukungan Tim Operasional",
        desc: "Tim internal kami mengelola setiap pengiriman secara aktif, mulai dari koordinasi driver hingga penanganan kendala di perjalanan.",
        benefit: "Terkoordinasi & responsif",
      },
      {
        title: "Resi & Tracking Digital",
        desc: "Setiap pengiriman mendapat resi digital (AWB) yang dapat dipantau statusnya kapan saja untuk kebutuhan dokumentasi Anda.",
        benefit: "Transparan & mudah diakses",
      },
      {
        title: "Proof of Delivery",
        desc: "Foto barang diterima dan surat jalan yang telah ditandatangani tersimpan digital sebagai bukti serah terima.",
        benefit: "Validitas & kepercayaan terjaga",
      },
    ],
    technologyHeading: "Solusi & Teknologi Kami",
    technologyDesc: "Sistem digital yang menghubungkan pelanggan, tim operasional, dan armada dalam satu alur kerja.",
    technology: [
      {
        title: "Website Pelacakan",
        desc: "Pelanggan dapat melacak status pengiriman kapan saja hanya dengan nomor AWB, tanpa perlu menghubungi tim secara manual.",
      },
      {
        title: "Dashboard Admin",
        desc: "Tim operasional mengelola pengiriman, armada, dan lokasi transit dalam satu panel kerja yang terpusat.",
      },
      {
        title: "Akses Mobile",
        desc: "Tampilan tracking dan panel admin dioptimalkan agar tetap nyaman digunakan dari perangkat mobile.",
      },
      {
        title: "Notifikasi Otomatis",
        desc: "Pelanggan mendapat notifikasi email saat resi diterbitkan, ada kendala, hingga pengiriman selesai.",
      },
    ],
    advantagesHeading: "Keunggulan Kami",
    advantagesDesc: "Prinsip kerja yang kami pegang di setiap layanan pengiriman.",
    advantages: [
      {
        title: "Data Tervalidasi",
        desc: "Setiap update status diinput dan diverifikasi oleh tim internal kami, sehingga informasi yang Anda terima akurat.",
      },
      {
        title: "Dokumentasi Lengkap",
        desc: "Setiap tahap pengiriman didokumentasikan dengan foto, sehingga riwayat proses dapat ditelusuri kembali.",
      },
      {
        title: "Sistem Terintegrasi",
        desc: "Operasional lapangan dan layanan pelanggan berjalan dalam satu sistem terpadu, menjaga konsistensi informasi.",
      },
      {
        title: "Update Berkala",
        desc: "Kami menginformasikan perkembangan status pengiriman secara berkala di setiap tahap perjalanan.",
      },
    ],
    statsHeading: "Kapasitas Layanan Kami",
    statsDesc: "Ringkasan operasional layanan kami hingga saat ini.",
    statTotalShipments: "Pengiriman Tercatat",
    statCitiesCovered: "Kota Terjangkau",
    statFleet: "Armada Truck",
    trustStrip: [
      "Keamanan Data Pelanggan",
      "Proses Pengiriman Efisien",
      "Layanan Pelanggan Responsif",
      "Siap Mendukung Pertumbuhan Bisnis Anda",
    ],
    ctaHeading: "Konsultasikan Kebutuhan Pengiriman Anda",
    ctaDesc: "Tim kami siap membantu merancang solusi pengiriman yang sesuai dengan kebutuhan bisnis Anda.",
    ctaButton: "Hubungi Kami",
  },
  companyValues: [
    {
      title: "Transparan",
      desc: "Setiap pengiriman dapat dipantau customer secara mandiri melalui resi digital dan tracking real-time.",
    },
    {
      title: "Terpercaya",
      desc: "Setiap update status divalidasi oleh tim internal kami, mulai dari penerimaan hingga serah terima barang.",
    },
    {
      title: "Handal",
      desc: "Didukung armada dan mitra transportasi di berbagai kota untuk menjangkau tujuan pengiriman Anda.",
    },
  ],
  about: {
    title: "Tentang Kami",
    p1: "PT Gangsar Mitra Suatama adalah perusahaan jasa logistik dan pengiriman barang yang melayani rute antar kota di Indonesia. Kami berkomitmen menghadirkan layanan pengiriman yang transparan dan mudah dipantau, sehingga customer tidak perlu lagi menghubungi tim secara manual untuk mengetahui posisi barangnya.",
    p2: "Melalui Sistem Tracking & Resi Digital, setiap pengiriman kini memiliki nomor resi (AWB) unik yang dapat dilacak kapan saja - lengkap dengan status, lokasi, foto dokumentasi, informasi unit truck yang membawa barang, hingga bukti serah terima (Proof of Delivery) saat barang sampai di tangan penerima.",
  },
  contact: {
    title: "Hubungi Kami",
    desc: "Butuh bantuan seputar pengiriman atau resi Anda? Tim customer service kami siap membantu.",
    channelPhone: "Telepon",
    channelWhatsapp: "WhatsApp",
    channelEmail: "Email",
    hqLabel: "Kantor Pusat",
    hoursLabel: "Jam Operasional",
    hoursValue: "Senin - Sabtu, 08.00 - 18.00 WIB",
    footNote:
      "Untuk menanyakan status pengiriman, siapkan nomor AWB Anda agar tim kami dapat membantu lebih cepat. Anda juga dapat melacak mandiri melalui halaman",
    footNoteLink: "Lacak Kiriman",
  },
  trackingSearch: {
    heroTitle: "Lacak",
    heroTitleGold: "Pengiriman Anda",
    heroDesc:
      "Masukkan nomor AWB (resi) yang tertera pada email atau resi fisik Anda untuk melihat status pengiriman secara real-time.",
    placeholder: "Contoh: G260911001",
    submitButton: "Lacak Sekarang",
    notFound: "Nomor AWB tidak ditemukan. Periksa kembali nomor resi Anda.",
    scanButton: "Scan Barcode / QR Code",
    historyTitle: "Riwayat Pencarian",
    clearAll: "Hapus Semua",
    lastViewed: "Terakhir dilihat",
    removeFromHistory: "Hapus dari riwayat",
    exampleTitle: "Contoh AWB (demo)",
    taglineImage: "Setiap pengiriman, sampai tujuan.",
    feature1Title: "Update Real-time",
    feature1Desc: "Pantau status pengiriman kapan saja.",
    feature2Title: "Aman & Terpercaya",
    feature2Desc: "Data pengiriman Anda selalu aman.",
    feature3Title: "Notifikasi",
    feature3Desc: "Dapatkan informasi setiap perubahan status.",
  },
  trackingResult: {
    back: "Kembali",
    searchPlaceholder: "Lacak AWB lain...",
    notFoundTitle: "AWB tidak ditemukan",
    notFoundDesc: "tidak terdaftar dalam sistem. Silakan periksa kembali nomor resi Anda.",
    notFoundBack: "Kembali ke halaman pencarian",
    notFoundError: "AWB tidak ditemukan.",
    resiNumber: "Nomor Resi",
    estimatedArrival: "Estimasi Tiba",
    delivered: "Barang telah terkirim",
    notAvailable: "Belum tersedia",
    origin: "Asal",
    destination: "Tujuan",
    sender: "Pengirim",
    receiver: "Penerima",
    shipmentDetail: "Detail Pengiriman",
    resiNumberLabel: "Nomor Resi",
    service: "Layanan",
    weight: "Berat Final",
    packageCount: "Jumlah Koli",
    packageContent: "Isi Paket",
    shippingDate: "Tanggal Kirim",
    destinationAddress: "Alamat Tujuan",
    currentTruck: "Unit Truck Saat Ini",
    transferNote:
      "AWB ini pernah menggunakan unit truck lain di perjalanan. Lihat detail transfer unit pada riwayat perjalanan di bawah.",
    noTruckAssigned: "Belum ada unit truck ditugaskan pada tahap ini.",
    journeyHeading: "Perjalanan Pengiriman",
    helpText: "Butuh bantuan? Hubungi tim customer service PT Gangsar Mitra Suatama dengan menyertakan nomor AWB",
  },
  cekOngkir: {
    title: "Cek Ongkir",
    heroTitle: "Hitung Ongkir",
    heroTitleGold: "dengan Mudah",
    desc: "Dapatkan estimasi biaya dan waktu pengiriman antar kota sebelum Anda mengirim barang.",
    formTitle: "Cek Estimasi Ongkir",
    formDesc: "Isi data pengiriman untuk mengetahui estimasi biaya dan waktu.",
    originCity: "Kota Asal",
    destinationCity: "Kota Tujuan",
    swapCities: "Tukar kota asal & tujuan",
    cityNotFound: "Kota tidak ditemukan.",
    weightLabel: "Berat Final (Kg)",
    weightPlaceholder: "Contoh: 5",
    koliLabel: "Jumlah Koli",
    serviceLabel: "Layanan",
    submitButton: "Cek Estimasi Ongkir",
    errorCities: "Pilih kota asal dan kota tujuan terlebih dahulu.",
    errorWeight: "Masukkan Berat Final (Kg) yang valid.",
    resultDisclaimer: "Estimasi biaya (perkiraan). Harga aktual dapat berbeda saat pengiriman.",
    route: "Rute",
    estimatedDistance: "Jarak Perkiraan",
    estimatedArrival: "Estimasi Tiba",
    weightKoli: "Berat Final / Koli",
    minWeightHint: "Minimum berat rute {kategori}: {min} kg.",
    belowMinWarning: "Berat di bawah minimum rute {kategori}. Tetap ditagih minimal {min} kg.",
    minWeightNote: "Rute {kategori}: minimum penagihan {min} kg (dihitung {charge} kg).",
    noRateNote: "Rate Publish layanan ini Rp 0, sehingga harga belum tersedia. Hubungi kami untuk penawaran.",
    originProvince: "Provinsi Asal",
    destinationProvince: "Provinsi Tujuan",
    destinationDistrict: "Kecamatan Tujuan",
    provinceNotFound: "Provinsi tidak ditemukan.",
    selectProvinceFirst: "Pilih provinsi terlebih dahulu",
    errorRoute: "Lengkapi provinsi & kota asal, serta provinsi, kota, dan kecamatan tujuan.",
    errorPricing: "Tarif tidak dapat dihitung saat ini. Silakan coba lagi.",
    calculating: "Menghitung...",
    areaCategory: "Kategori Area Tujuan",
    publishPrice: "Harga Publish",
    originAdjustment: "Penyesuaian Origin",
    priceAfterAdjustment: "Harga Setelah Penyesuaian",
    perKg: "/kg",
    originAdjustmentNote: "Penyesuaian ditentukan oleh wilayah asal.",
    benefit1Title: "Estimasi Akurat",
    benefit1Desc: "Dapatkan perhitungan biaya yang transparan.",
    benefit2Title: "Informasi Waktu",
    benefit2Desc: "Estimasi waktu pengiriman yang jelas.",
    benefit3Title: "Berbagai Pilihan Layanan",
    benefit3Desc: "Pilih layanan sesuai kebutuhan Anda.",
  },
  pod: {
    title: "Proof of Delivery",
    delivered: "Barang telah diterima",
    dateTime: "Tanggal & Waktu",
    location: "Lokasi",
    receivedBy: "Diterima oleh",
    itemPhoto: "Foto Barang Diterima",
    suratJalan: "Surat Jalan (Ditandatangani)",
    noPhoto: "Belum ada foto",
  },
  stepper: {
    orderCreated: "Pesanan Dibuat",
    pickedUp: "Berangkat",
    inTransit: "Dalam Pengiriman",
    outForDelivery: "Sedang Diantar",
    delivered: "Terkirim",
    kendalaWarning:
      "Ada kendala pada tahap pengiriman saat ini. Lihat detail pada riwayat perjalanan di bawah.",
  },
  timeline: {
    latest: "TERBARU",
    noTruckAssigned: "Belum ada unit truck ditugaskan pada tahap ini.",
  },
  feedback: {
    floatingButton: "Beri Rating",
    close: "Tutup",
    prompt: "Bagaimana pengalaman pengiriman Anda?",
    commentLabel: "Berikan komentar (opsional)",
    commentPlaceholder: "Ceritakan pengalaman pengiriman Anda...",
    submitButton: "Kirim Feedback",
    thankYou: "Terima kasih atas feedback Anda.",
    starLabel: (n: number) => `${n} bintang`,
  },
  scanner: {
    title: "Scan Barcode / QR AWB",
    close: "Tutup",
    openingCamera: "Membuka kamera...",
    cameraError: "Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan dan coba lagi.",
    instructions: "Arahkan kamera ke barcode atau QR code pada resi Anda.",
  },
};

const en: Translations = {
  nav: {
    tagline: "Logistics & Delivery Services",
    home: "Home",
    about: "About Us",
    services: "Services",
    advantages: "Advantages",
    checkPrice: "Check Price",
    trackPackage: "Track Package",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
  },
  footer: {
    tagline: "GMS Logistics",
    description:
      "A logistics and intercity delivery company, supported by a digital system for more transparent and efficient service.",
    navHeading: "Navigation",
    contactHeading: "Contact",
    contactText: "Need help with our services? Visit the",
    contactLink: "Contact Us",
    contactTextAfter: "page to reach our customer service team.",
    adminPortal: "Admin Portal",
    copyright: "PT Gangsar Mitra Suatama · Digital Tracking & Receipt System",
  },
  home: {
    heroBadge: "Integrated Logistics Partner",
    heroTitleA: "A Shipping Solution That's Organized, Coordinated, and",
    heroTitleHighlight: "Reliable",
    heroDesc:
      "PT Gangsar Mitra Suatama delivers intercity logistics services professionally managed by our own operations team, supported by a digital system so every process stays consistent and documented.",
    heroImageAlt: "Handoff of a package between a courier and a recipient",
    ctaContact: "Contact Us",
    ctaCheckPrice: "Track Package",
    ctaServices: "Explore Our Services",
    coverageLabel: "Service coverage",
    coverageSuffix: "cities in Indonesia",
    aboutHeading: "About Us",
    aboutP1:
      "PT Gangsar Mitra Suatama is a logistics and freight company serving intercity routes across Indonesia. We're here to meet the needs of businesses and individuals for well-coordinated delivery services, with a clear process at every stage.",
    aboutP2:
      "Our operations are run by an internal team that directly handles every shipment - from receiving goods, coordinating the fleet, to handover with the recipient - supported by a digital system so the process stays consistent and well documented. We're committed to delivering transparent, easy-to-track service so customers no longer need to contact our team manually to find out where their shipment is.",
    servicesHeading: "Our Services",
    servicesDesc: "End-to-end delivery solutions, from receiving goods to handing them over to the recipient.",
    services: [
      {
        title: "Intercity Delivery",
        desc: "Ground shipping to various destination cities, supported by a truck fleet suited to your cargo needs.",
        benefit: "Wide reach, varied fleet",
      },
      {
        title: "Operations Team Support",
        desc: "Our internal team actively manages every shipment, from driver coordination to handling issues along the route.",
        benefit: "Coordinated & responsive",
      },
      {
        title: "Digital Receipt & Tracking",
        desc: "Every shipment gets a digital receipt (AWB) you can track anytime for your documentation needs.",
        benefit: "Transparent & easy to access",
      },
      {
        title: "Proof of Delivery",
        desc: "Photos of the received goods and the signed delivery note are stored digitally as proof of handover.",
        benefit: "Validity & trust maintained",
      },
    ],
    technologyHeading: "Our Solutions & Technology",
    technologyDesc: "A digital system connecting customers, the operations team, and the fleet in a single workflow.",
    technology: [
      {
        title: "Tracking Website",
        desc: "Customers can track shipment status anytime with just an AWB number, no need to contact the team manually.",
      },
      {
        title: "Admin Dashboard",
        desc: "The operations team manages shipments, fleet, and transit locations in one centralized work panel.",
      },
      {
        title: "Mobile Access",
        desc: "The tracking view and admin panel are optimized to stay comfortable to use from mobile devices.",
      },
      {
        title: "Automatic Notifications",
        desc: "Customers get email notifications when a receipt is issued, when there's an issue, and when delivery is complete.",
      },
    ],
    advantagesHeading: "Our Advantages",
    advantagesDesc: "The working principles we hold in every delivery service.",
    advantages: [
      {
        title: "Validated Data",
        desc: "Every status update is entered and verified by our internal team, so the information you receive is accurate.",
      },
      {
        title: "Complete Documentation",
        desc: "Every delivery stage is documented with photos, so the process history can be traced back.",
      },
      {
        title: "Integrated System",
        desc: "Field operations and customer service run on one unified system, keeping information consistent.",
      },
      {
        title: "Regular Updates",
        desc: "We inform you of shipment status progress regularly at every stage of the journey.",
      },
    ],
    statsHeading: "Our Service Capacity",
    statsDesc: "A summary of our operations to date.",
    statTotalShipments: "Shipments Recorded",
    statCitiesCovered: "Cities Covered",
    statFleet: "Truck Fleet",
    trustStrip: [
      "Customer Data Security",
      "Efficient Delivery Process",
      "Responsive Customer Service",
      "Ready to Support Your Business Growth",
    ],
    ctaHeading: "Let's Discuss Your Shipping Needs",
    ctaDesc: "Our team is ready to help design a delivery solution that fits your business needs.",
    ctaButton: "Contact Us",
  },
  companyValues: [
    {
      title: "Transparent",
      desc: "Every shipment can be tracked independently by the customer through a digital receipt and real-time tracking.",
    },
    {
      title: "Trusted",
      desc: "Every status update is validated by our internal team, from receiving the goods through to handover.",
    },
    {
      title: "Reliable",
      desc: "Backed by a fleet and transportation partners in various cities to reach your delivery destination.",
    },
  ],
  about: {
    title: "About Us",
    p1: "PT Gangsar Mitra Suatama is a logistics and freight company serving intercity routes across Indonesia. We're committed to delivering transparent, easy-to-track service so customers no longer need to contact our team manually to find out where their shipment is.",
    p2: "Through the Digital Tracking & Receipt System, every shipment now has a unique receipt number (AWB) that can be tracked anytime - complete with status, location, documentation photos, information on the truck unit carrying the goods, and Proof of Delivery once the goods reach the recipient.",
  },
  contact: {
    title: "Contact Us",
    desc: "Need help with your shipment or receipt? Our customer service team is ready to help.",
    channelPhone: "Phone",
    channelWhatsapp: "WhatsApp",
    channelEmail: "Email",
    hqLabel: "Head Office",
    hoursLabel: "Operating Hours",
    hoursValue: "Monday - Saturday, 08:00 - 18:00 WIB",
    footNote:
      "To ask about a shipment's status, have your AWB number ready so our team can help you faster. You can also track it yourself via the",
    footNoteLink: "Track Shipment",
  },
  trackingSearch: {
    heroTitle: "Track Your",
    heroTitleGold: "Shipment",
    heroDesc: "Enter the AWB (receipt) number shown on your email or physical receipt to see the delivery status in real time.",
    placeholder: "e.g. G260911001",
    submitButton: "Track Now",
    notFound: "AWB number not found. Please double-check your receipt number.",
    scanButton: "Scan Barcode / QR Code",
    historyTitle: "Search History",
    clearAll: "Clear All",
    lastViewed: "Last viewed",
    removeFromHistory: "Remove from history",
    exampleTitle: "Example AWB (demo)",
    taglineImage: "Every shipment, delivered.",
    feature1Title: "Real-time Updates",
    feature1Desc: "Monitor your shipment status anytime.",
    feature2Title: "Safe & Trusted",
    feature2Desc: "Your shipment data is always protected.",
    feature3Title: "Notifications",
    feature3Desc: "Get notified on every status change.",
  },
  trackingResult: {
    back: "Back",
    searchPlaceholder: "Track another AWB...",
    notFoundTitle: "AWB not found",
    notFoundDesc: "isn't registered in the system. Please double-check your receipt number.",
    notFoundBack: "Back to search page",
    notFoundError: "AWB not found.",
    resiNumber: "Receipt Number",
    estimatedArrival: "Estimated Arrival",
    delivered: "Package has been delivered",
    notAvailable: "Not available yet",
    origin: "Origin",
    destination: "Destination",
    sender: "Sender",
    receiver: "Receiver",
    shipmentDetail: "Shipment Details",
    resiNumberLabel: "Receipt Number",
    service: "Service",
    weight: "Weight",
    packageCount: "Package Count",
    packageContent: "Package Contents",
    shippingDate: "Shipping Date",
    destinationAddress: "Destination Address",
    currentTruck: "Current Truck Unit",
    transferNote: "This AWB has used another truck unit along the way. See the transfer details in the journey history below.",
    noTruckAssigned: "No truck unit has been assigned at this stage yet.",
    journeyHeading: "Delivery Journey",
    helpText: "Need help? Contact PT Gangsar Mitra Suatama's customer service and include this AWB number",
  },
  cekOngkir: {
    title: "Check Shipping Cost",
    heroTitle: "Calculate Shipping",
    heroTitleGold: "Made Easy",
    desc: "Get an estimated cost and delivery time between cities before you send your package.",
    formTitle: "Check Estimated Cost",
    formDesc: "Fill in your shipment details to see the estimated cost and time.",
    originCity: "Origin City",
    destinationCity: "Destination City",
    swapCities: "Swap origin & destination",
    cityNotFound: "City not found.",
    weightLabel: "Package Weight (Kg)",
    weightPlaceholder: "e.g. 5",
    koliLabel: "Number of Packages",
    serviceLabel: "Service",
    submitButton: "Check Estimated Cost",
    errorCities: "Please select an origin and destination city first.",
    errorWeight: "Enter a valid package weight (kg).",
    resultDisclaimer: "Estimated cost only. Actual pricing may differ at the time of shipment.",
    route: "Route",
    estimatedDistance: "Estimated Distance",
    estimatedArrival: "Estimated Arrival",
    weightKoli: "Weight / Packages",
    minWeightHint: "Minimum weight for {kategori} route: {min} kg.",
    belowMinWarning: "Weight is below the minimum for the {kategori} route. It is still billed at {min} kg minimum.",
    minWeightNote: "{kategori} route: minimum billing {min} kg (charged as {charge} kg).",
    noRateNote: "This service has a published rate of Rp 0, so no price is available. Contact us for a quotation.",
    originProvince: "Origin Province",
    destinationProvince: "Destination Province",
    destinationDistrict: "Destination District",
    provinceNotFound: "Province not found.",
    selectProvinceFirst: "Select a province first",
    errorRoute: "Complete the origin province & city, and the destination province, city and district.",
    errorPricing: "The rate cannot be calculated right now. Please try again.",
    calculating: "Calculating...",
    areaCategory: "Destination Area Category",
    publishPrice: "Published Rate",
    originAdjustment: "Origin Adjustment",
    priceAfterAdjustment: "Rate After Adjustment",
    perKg: "/kg",
    originAdjustmentNote: "The adjustment is determined by the origin region.",
    benefit1Title: "Accurate Estimate",
    benefit1Desc: "Get a transparent cost calculation.",
    benefit2Title: "Time Information",
    benefit2Desc: "Clear delivery time estimates.",
    benefit3Title: "Multiple Service Options",
    benefit3Desc: "Choose the service that fits your needs.",
  },
  pod: {
    title: "Proof of Delivery",
    delivered: "Package has been received",
    dateTime: "Date & Time",
    location: "Location",
    receivedBy: "Received by",
    itemPhoto: "Photo of Received Item",
    suratJalan: "Delivery Note (Signed)",
    noPhoto: "No photo yet",
  },
  stepper: {
    orderCreated: "Order Placed",
    pickedUp: "Picked Up",
    inTransit: "In Transit",
    outForDelivery: "Out for Delivery",
    delivered: "Delivered",
    kendalaWarning: "There's an issue at the current delivery stage. See details in the journey history below.",
  },
  timeline: {
    latest: "LATEST",
    noTruckAssigned: "No truck unit has been assigned at this stage yet.",
  },
  feedback: {
    floatingButton: "Rate Us",
    close: "Close",
    prompt: "How was your delivery experience?",
    commentLabel: "Leave a comment (optional)",
    commentPlaceholder: "Tell us about your delivery experience...",
    submitButton: "Send Feedback",
    thankYou: "Thank you for your feedback.",
    starLabel: (n: number) => `${n} star${n === 1 ? "" : "s"}`,
  },
  scanner: {
    title: "Scan Barcode / QR AWB",
    close: "Close",
    openingCamera: "Opening camera...",
    cameraError: "Can't access the camera. Make sure camera permission is enabled and try again.",
    instructions: "Point the camera at the barcode or QR code on your receipt.",
  },
};

export const translations: Record<Language, Translations> = { id, en };
export type { Translations };
