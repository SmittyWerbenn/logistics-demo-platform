/**
 * Image URLs for Company Profile sections.
 * All images are from free stock photo sources (Unsplash, Pexels, Pixabay)
 * with CC0 or equivalent license for commercial use.
 * 
 * Image sources:
 * - Unsplash (unsplash.com) - CC0
 * - Pexels (pexels.com) - CC0
 * - Pixabay (pixabay.com) - Pixabay License
 */

export const COMPRO_IMAGES = {
  // Hero section
  hero: {
    url: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=1600&h=900&fit=crop&q=90",
    alt: "Truck logistik modern melakukan perjalanan di jalan raya dengan muatan cargo",
  },
  
  // About section
  about: {
    url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=800&fit=crop&q=90",
    alt: "Tim operasional GMS Logistics bekerja di warehouse logistics modern",
  },

  // Journey timeline (6 steps)
  journey: {
    order: {
      url: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=600&fit=crop&q=90",
      alt: "Admin GMS Logistics memproses order pengiriman di komputer",
    },
    pickup: {
      url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop&q=90",
      alt: "Truck logistik melakukan loading barang di warehouse",
    },
    transit: {
      url: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=600&h=600&fit=crop&q=90",
      alt: "Driver logistik mengantarkan cargo menggunakan truck",
    },
    update: {
      url: "https://images.unsplash.com/photo-1516321318423-f06f70a504f9?w=600&h=600&fit=crop&q=90",
      alt: "Driver melakukan update status pengiriman melalui smartphone",
    },
    arrived: {
      url: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=600&h=600&fit=crop&q=90",
      alt: "Truck logistik tiba di lokasi tujuan warehouse",
    },
    delivered: {
      url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=600&fit=crop&q=90",
      alt: "Driver menyerahkan barang kepada penerima dengan dokumentasi",
    },
  },

  // Services section
  services: {
    ltl: {
      url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=600&fit=crop&q=90",
      alt: "Truck CDE dan CDD untuk layanan LTL Less Than Truckload",
    },
    ftl: {
      url: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=800&h=600&fit=crop&q=90",
      alt: "Truck penuh untuk layanan FTL Full Truckload",
    },
    fcl: {
      url: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800&h=600&fit=crop&q=90",
      alt: "Container truck untuk layanan FCL Full Container Load",
    },
    lcl: {
      url: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop&q=90",
      alt: "Warehouse konsolidasi cargo untuk layanan LCL Less Than Container Load",
    },
    air: {
      url: "https://images.unsplash.com/photo-1531746790731-6c87cfe2e500?w=800&h=600&fit=crop&q=90",
      alt: "Pesawat cargo untuk layanan Air Express pengiriman cepat",
    },
    procargo: {
      url: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=800&h=600&fit=crop&q=90",
      alt: "Lowbed dan heavy truck untuk layanan Project Cargo",
    },
  },

  // Fleet cards (fallback images for fleet types)
  fleet: {
    ltl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop&q=90",
    ftl: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=400&h=300&fit=crop&q=90",
    container: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=400&h=300&fit=crop&q=90",
    reefer: "https://images.unsplash.com/photo-1578362996442-48f60103fc96?w=400&h=300&fit=crop&q=90",
    heavy: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop&q=90",
  },
} as const;
