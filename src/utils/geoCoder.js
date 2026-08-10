/**
 * Eagle Drone Spatial Geocoder Engine
 * Offline-first high-precision reverse geocoder for Indonesia and Global Coordinates
 * with Multi-API Online Fallback Cascade & Caching (English Standard).
 */

// Haversine Distance in Kilometers
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999999
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Format decimal coordinates to DMS (Degrees, Minutes, Seconds)
export function formatCoordinatesDMS(lat, lon) {
  if (lat === undefined || lon === undefined || lat === null || lon === null) return ''
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  const absLat = Math.abs(lat)
  const absLon = Math.abs(lon)

  const latDeg = Math.floor(absLat)
  const latMin = Math.floor((absLat - latDeg) * 60)
  const latSec = ((absLat - latDeg - latMin / 60) * 3600).toFixed(1)

  const lonDeg = Math.floor(absLon)
  const lonMin = Math.floor((absLon - lonDeg) * 60)
  const lonSec = ((absLon - lonDeg - lonMin / 60) * 3600).toFixed(1)

  return `${latDeg}°${latMin}'${latSec}"${latDir}, ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`
}

/**
 * Key Aviation, Topography, Volcanic & SAR Landmarks in Indonesia (English)
 */
const INDONESIA_LANDMARKS = [
  // D.I. Yogyakarta & Central Java Landmarks
  { name: 'Kaliurang Area', sub: 'Sleman, Yogyakarta', lat: -7.5980, lon: 110.4285, radiusKm: 6 },
  { name: 'Mt. Merapi Slopes', sub: 'Sleman / Boyolali, Central Java', lat: -7.5407, lon: 110.4457, radiusKm: 9 },
  { name: 'Pakem Area', sub: 'Sleman, Yogyakarta', lat: -7.6650, lon: 110.4200, radiusKm: 7 },
  { name: 'Cangkringan Area', sub: 'Sleman, Yogyakarta', lat: -7.6350, lon: 110.4550, radiusKm: 6 },
  { name: 'Selo Highland', sub: 'Boyolali, Central Java', lat: -7.5120, lon: 110.4650, radiusKm: 6 },
  { name: 'Borobudur Temple Area', sub: 'Magelang, Central Java', lat: -7.6079, lon: 110.2038, radiusKm: 5 },
  { name: 'Prambanan Temple Area', sub: 'Sleman / Klaten', lat: -7.7520, lon: 110.4915, radiusKm: 4 },
  { name: 'Adisutjipto Airport (JOG)', sub: 'Sleman, Yogyakarta', lat: -7.7881, lon: 110.4318, radiusKm: 4 },
  { name: 'YIA International Airport', sub: 'Kulon Progo, Yogyakarta', lat: -7.9006, lon: 110.0575, radiusKm: 6 },
  { name: 'Iswahyudi Air Base', sub: 'Magetan, East Java', lat: -7.6166, lon: 111.4333, radiusKm: 6 },
  { name: 'Mt. Merbabu Area', sub: 'Boyolali / Magelang, Central Java', lat: -7.4540, lon: 110.4380, radiusKm: 8 },
  { name: 'Mt. Lawu Area', sub: 'Karanganyar / Magetan', lat: -7.6250, lon: 111.1920, radiusKm: 8 },
  { name: 'Mt. Slamet Area', sub: 'Banyumas / Purbalingga, Central Java', lat: -7.2420, lon: 109.2080, radiusKm: 9 },
  { name: 'Dieng Plateau', sub: 'Wonosobo / Banjarnegara, Central Java', lat: -7.2050, lon: 109.9050, radiusKm: 8 },

  // West Java, Banten & Jakarta
  { name: 'Soekarno-Hatta Intl Airport (CGK)', sub: 'Tangerang, Banten', lat: -6.1275, lon: 106.6537, radiusKm: 6 },
  { name: 'Halim Perdanakusuma Airport (HLP)', sub: 'East Jakarta, Jakarta', lat: -6.2656, lon: 106.8906, radiusKm: 5 },
  { name: 'National Monument (Monas)', sub: 'Central Jakarta, Jakarta', lat: -6.1754, lon: 106.8272, radiusKm: 5 },
  { name: 'Port of Tanjung Priok', sub: 'North Jakarta, Jakarta', lat: -6.1040, lon: 106.8830, radiusKm: 5 },
  { name: 'Puncak Highland Area', sub: 'Bogor / Cianjur, West Java', lat: -6.7020, lon: 106.9920, radiusKm: 8 },
  { name: 'Mt. Tangkuban Parahu', sub: 'Lembang, West Java', lat: -6.7596, lon: 107.6098, radiusKm: 7 },
  { name: 'Mt. Gede Pangrango', sub: 'Cianjur / Bogor, West Java', lat: -6.7850, lon: 106.9850, radiusKm: 9 },
  { name: 'Mt. Papandayan', sub: 'Garut, West Java', lat: -7.3200, lon: 107.7300, radiusKm: 7 },
  { name: 'Mt. Ciremai', sub: 'Kuningan / Majalengka, West Java', lat: -6.8920, lon: 108.4010, radiusKm: 8 },

  // East Java, Bali & Nusa Tenggara
  { name: 'Mt. Bromo Area', sub: 'Bromo Tengger Semeru, East Java', lat: -7.9425, lon: 112.9530, radiusKm: 8 },
  { name: 'Mt. Semeru Area', sub: 'Lumajang / Malang, East Java', lat: -8.1080, lon: 112.9220, radiusKm: 9 },
  { name: 'Ijen Crater Area', sub: 'Banyuwangi, East Java', lat: -8.0580, lon: 114.2420, radiusKm: 7 },
  { name: 'Juanda Intl Airport (SUB)', sub: 'Sidoarjo, East Java', lat: -7.3798, lon: 112.7874, radiusKm: 6 },
  { name: 'Ngurah Rai Intl Airport (DPS)', sub: 'Badung, Bali', lat: -8.7482, lon: 115.1672, radiusKm: 6 },
  { name: 'Kuta & Seminyak Area', sub: 'Badung, Bali', lat: -8.6913, lon: 115.1682, radiusKm: 5 },
  { name: 'Nusa Dua Area', sub: 'Badung, Bali', lat: -8.8000, lon: 115.2300, radiusKm: 5 },
  { name: 'Ubud Cultural Area', sub: 'Gianyar, Bali', lat: -8.5069, lon: 115.2625, radiusKm: 5 },
  { name: 'Mt. Agung Area', sub: 'Karangasem, Bali', lat: -8.3430, lon: 115.5080, radiusKm: 8 },
  { name: 'Mt. Rinjani Area', sub: 'Lombok, West Nusa Tenggara', lat: -8.4190, lon: 116.4580, radiusKm: 9 },
  { name: 'Mandalika International Circuit', sub: 'Central Lombok, West Nusa Tenggara', lat: -8.8950, lon: 116.2970, radiusKm: 6 },
  { name: 'Komodo National Park', sub: 'Labuan Bajo, East Nusa Tenggara', lat: -8.5600, lon: 119.5000, radiusKm: 15 },
  { name: 'Labuan Bajo Area', sub: 'West Manggarai, East Nusa Tenggara', lat: -8.4964, lon: 119.8877, radiusKm: 7 },

  // Sumatra
  { name: 'Lake Toba Area', sub: 'Samosir, North Sumatra', lat: 2.6845, lon: 98.8756, radiusKm: 15 },
  { name: 'Mt. Sinabung', sub: 'Karo, North Sumatra', lat: 3.1700, lon: 98.3920, radiusKm: 8 },
  { name: 'Kualanamu Intl Airport (KNO)', sub: 'Deli Serdang, North Sumatra', lat: 3.6422, lon: 98.8853, radiusKm: 6 },
  { name: 'Mt. Kerinci Area', sub: 'Kerinci, Jambi / West Sumatra', lat: -1.6970, lon: 101.2640, radiusKm: 9 },
  { name: 'Bukittinggi & Sianok Canyon', sub: 'Bukittinggi, West Sumatra', lat: -0.3050, lon: 100.3690, radiusKm: 5 },

  // Kalimantan
  { name: 'Nusantara Capital City (IKN)', sub: 'East Kalimantan', lat: -0.9700, lon: 116.7000, radiusKm: 18 },
  { name: 'IKN Zero Point Area', sub: 'Sepaku, East Kalimantan', lat: -0.9610, lon: 116.7110, radiusKm: 8 },
  { name: 'Sepinggan Airport (BPN)', sub: 'Balikpapan, East Kalimantan', lat: -1.2683, lon: 116.8944, radiusKm: 6 },

  // Sulawesi & Maluku & Papua
  { name: 'Sultan Hasanuddin Airport (UPG)', sub: 'Makassar, South Sulawesi', lat: -5.0616, lon: 119.5540, radiusKm: 6 },
  { name: 'Tana Toraja Highland', sub: 'South Sulawesi', lat: -3.0500, lon: 119.8700, radiusKm: 12 },
  { name: 'Bunaken Marine Park', sub: 'Manado, North Sulawesi', lat: 1.6250, lon: 124.7600, radiusKm: 8 },
  { name: 'Raja Ampat Islands', sub: 'Southwest Papua', lat: -0.2333, lon: 130.5167, radiusKm: 25 },
  { name: 'Baliem Valley Area', sub: 'Jayawijaya, Highland Papua', lat: -4.0900, lon: 138.9400, radiusKm: 12 },
  { name: 'Puncak Jaya / Carstensz', sub: 'Central Papua', lat: -4.0789, lon: 137.1583, radiusKm: 12 },
  { name: 'Lake Sentani Area', sub: 'Jayapura, Papua', lat: -2.6000, lon: 140.5000, radiusKm: 10 },
]

/**
 * Indonesian Regencies & Major Cities Matrix (English Province Names)
 */
const INDONESIA_CITIES = [
  // D.I. Yogyakarta
  { name: 'Sleman', prov: 'Yogyakarta', lat: -7.7156, lon: 110.3556, rKm: 20 },
  { name: 'Yogyakarta City', prov: 'Yogyakarta', lat: -7.7956, lon: 110.3695, rKm: 10 },
  { name: 'Bantul', prov: 'Yogyakarta', lat: -7.8928, lon: 110.3298, rKm: 20 },
  { name: 'Gunungkidul (Wonosari)', prov: 'Yogyakarta', lat: -7.9650, lon: 110.6030, rKm: 28 },
  { name: 'Kulon Progo (Wates)', prov: 'Yogyakarta', lat: -7.8590, lon: 110.1580, rKm: 22 },

  // Central Java
  { name: 'Boyolali', prov: 'Central Java', lat: -7.5350, lon: 110.5960, rKm: 22 },
  { name: 'Klaten', prov: 'Central Java', lat: -7.7030, lon: 110.6040, rKm: 18 },
  { name: 'Magelang', prov: 'Central Java', lat: -7.4720, lon: 110.2190, rKm: 20 },
  { name: 'Surakarta (Solo)', prov: 'Central Java', lat: -7.5666, lon: 110.8267, rKm: 12 },
  { name: 'Sukoharjo', prov: 'Central Java', lat: -7.6830, lon: 110.8350, rKm: 18 },
  { name: 'Karanganyar', prov: 'Central Java', lat: -7.5970, lon: 110.9520, rKm: 22 },
  { name: 'Sragen', prov: 'Central Java', lat: -7.4270, lon: 111.0220, rKm: 22 },
  { name: 'Wonogiri', prov: 'Central Java', lat: -7.8180, lon: 110.9250, rKm: 30 },
  { name: 'Semarang City', prov: 'Central Java', lat: -6.9667, lon: 110.4167, rKm: 18 },
  { name: 'Semarang Regency (Ungaran)', prov: 'Central Java', lat: -7.1400, lon: 110.4000, rKm: 22 },
  { name: 'Salatiga City', prov: 'Central Java', lat: -7.3305, lon: 110.5084, rKm: 10 },
  { name: 'Purworejo', prov: 'Central Java', lat: -7.7150, lon: 110.0080, rKm: 22 },
  { name: 'Kebumen', prov: 'Central Java', lat: -7.6690, lon: 109.6520, rKm: 25 },
  { name: 'Banyumas (Purwokerto)', prov: 'Central Java', lat: -7.4243, lon: 109.2302, rKm: 22 },
  { name: 'Cilacap', prov: 'Central Java', lat: -7.7180, lon: 109.0150, rKm: 32 },
  { name: 'Purbalingga', prov: 'Central Java', lat: -7.3890, lon: 109.3630, rKm: 18 },
  { name: 'Banjarnegara', prov: 'Central Java', lat: -7.3970, lon: 109.6970, rKm: 22 },
  { name: 'Wonosobo', prov: 'Central Java', lat: -7.3630, lon: 109.9000, rKm: 20 },
  { name: 'Temanggung', prov: 'Central Java', lat: -7.3160, lon: 110.1770, rKm: 18 },
  { name: 'Kendal', prov: 'Central Java', lat: -7.0250, lon: 110.2030, rKm: 22 },
  { name: 'Batang', prov: 'Central Java', lat: -7.0500, lon: 109.8500, rKm: 22 },
  { name: 'Pekalongan', prov: 'Central Java', lat: -6.8886, lon: 109.6753, rKm: 18 },
  { name: 'Pemalang', prov: 'Central Java', lat: -6.8920, lon: 109.3800, rKm: 22 },
  { name: 'Tegal', prov: 'Central Java', lat: -6.8694, lon: 109.1402, rKm: 20 },
  { name: 'Brebes', prov: 'Central Java', lat: -6.8710, lon: 109.0430, rKm: 28 },
  { name: 'Demak', prov: 'Central Java', lat: -6.8940, lon: 110.6380, rKm: 20 },
  { name: 'Kudus', prov: 'Central Java', lat: -6.8049, lon: 110.8405, rKm: 16 },
  { name: 'Jepara', prov: 'Central Java', lat: -6.5920, lon: 110.6780, rKm: 22 },
  { name: 'Pati', prov: 'Central Java', lat: -6.7550, lon: 111.0380, rKm: 25 },
  { name: 'Rembang', prov: 'Central Java', lat: -6.7110, lon: 111.3430, rKm: 24 },
  { name: 'Blora', prov: 'Central Java', lat: -7.0000, lon: 111.4170, rKm: 26 },
  { name: 'Grobogan (Purwodadi)', prov: 'Central Java', lat: -7.0860, lon: 110.9170, rKm: 28 },

  // Jakarta, Banten & West Java
  { name: 'Central Jakarta', prov: 'Jakarta', lat: -6.1805, lon: 106.8284, rKm: 8 },
  { name: 'South Jakarta', prov: 'Jakarta', lat: -6.2615, lon: 106.8106, rKm: 10 },
  { name: 'West Jakarta', prov: 'Jakarta', lat: -6.1683, lon: 106.7588, rKm: 10 },
  { name: 'East Jakarta', prov: 'Jakarta', lat: -6.2250, lon: 106.9004, rKm: 12 },
  { name: 'North Jakarta', prov: 'Jakarta', lat: -6.1384, lon: 106.8640, rKm: 12 },
  { name: 'Thousand Islands', prov: 'Jakarta', lat: -5.6000, lon: 106.5600, rKm: 30 },
  { name: 'Tangerang City', prov: 'Banten', lat: -6.1783, lon: 106.6319, rKm: 12 },
  { name: 'South Tangerang', prov: 'Banten', lat: -6.2889, lon: 106.7180, rKm: 12 },
  { name: 'Tangerang Regency', prov: 'Banten', lat: -6.2570, lon: 106.4900, rKm: 22 },
  { name: 'Serang City', prov: 'Banten', lat: -6.1200, lon: 106.1500, rKm: 14 },
  { name: 'Cilegon City', prov: 'Banten', lat: -6.0170, lon: 106.0530, rKm: 12 },
  { name: 'Pandeglang', prov: 'Banten', lat: -6.5000, lon: 105.8000, rKm: 35 },
  { name: 'Lebak (Rangkasbitung)', prov: 'Banten', lat: -6.6000, lon: 106.2500, rKm: 35 },
  { name: 'Bandung City', prov: 'West Java', lat: -6.9175, lon: 107.6191, rKm: 12 },
  { name: 'Cimahi City', prov: 'West Java', lat: -6.8722, lon: 107.5422, rKm: 8 },
  { name: 'West Bandung', prov: 'West Java', lat: -6.8500, lon: 107.4500, rKm: 22 },
  { name: 'Bandung Regency (Soreang)', prov: 'West Java', lat: -7.0300, lon: 107.5200, rKm: 25 },
  { name: 'Bekasi City', prov: 'West Java', lat: -6.2383, lon: 106.9756, rKm: 12 },
  { name: 'Bekasi Regency (Cikarang)', prov: 'West Java', lat: -6.3000, lon: 107.1500, rKm: 22 },
  { name: 'Depok City', prov: 'West Java', lat: -6.4025, lon: 106.7942, rKm: 12 },
  { name: 'Bogor City', prov: 'West Java', lat: -6.5971, lon: 106.8060, rKm: 12 },
  { name: 'Bogor Regency (Cibinong)', prov: 'West Java', lat: -6.4800, lon: 106.8500, rKm: 28 },
  { name: 'Karawang', prov: 'West Java', lat: -6.3070, lon: 107.3070, rKm: 26 },
  { name: 'Purwakarta', prov: 'West Java', lat: -6.5560, lon: 107.4430, rKm: 18 },
  { name: 'Subang', prov: 'West Java', lat: -6.5710, lon: 107.7580, rKm: 26 },
  { name: 'Sukabumi', prov: 'West Java', lat: -6.9277, lon: 106.9299, rKm: 32 },
  { name: 'Cianjur', prov: 'West Java', lat: -6.8200, lon: 107.1400, rKm: 30 },
  { name: 'Garut', prov: 'West Java', lat: -7.2160, lon: 107.9000, rKm: 30 },
  { name: 'Tasikmalaya', prov: 'West Java', lat: -7.3274, lon: 108.2207, rKm: 25 },
  { name: 'Ciamis', prov: 'West Java', lat: -7.3260, lon: 108.3530, rKm: 22 },
  { name: 'Banjar City', prov: 'West Java', lat: -7.3700, lon: 108.5300, rKm: 10 },
  { name: 'Pangandaran', prov: 'West Java', lat: -7.7000, lon: 108.6500, rKm: 22 },
  { name: 'Sumedang', prov: 'West Java', lat: -6.8580, lon: 107.9200, rKm: 22 },
  { name: 'Majalengka', prov: 'West Java', lat: -6.8360, lon: 108.2280, rKm: 22 },
  { name: 'Cirebon', prov: 'West Java', lat: -6.7320, lon: 108.5523, rKm: 22 },
  { name: 'Kuningan', prov: 'West Java', lat: -6.9770, lon: 108.4830, rKm: 20 },
  { name: 'Indramayu', prov: 'West Java', lat: -6.3260, lon: 108.3200, rKm: 30 },

  // East Java
  { name: 'Surabaya', prov: 'East Java', lat: -7.2575, lon: 112.7521, rKm: 15 },
  { name: 'Sidoarjo', prov: 'East Java', lat: -7.4478, lon: 112.7183, rKm: 16 },
  { name: 'Gresik', prov: 'East Java', lat: -7.1560, lon: 112.6560, rKm: 22 },
  { name: 'Malang City', prov: 'East Java', lat: -7.9666, lon: 112.6326, rKm: 12 },
  { name: 'Batu City', prov: 'East Java', lat: -7.8710, lon: 112.5270, rKm: 12 },
  { name: 'Malang Regency (Kepanjen)', prov: 'East Java', lat: -8.1300, lon: 112.5700, rKm: 35 },
  { name: 'Pasuruan', prov: 'East Java', lat: -7.6450, lon: 112.9070, rKm: 22 },
  { name: 'Probolinggo', prov: 'East Java', lat: -7.7540, lon: 113.2160, rKm: 24 },
  { name: 'Lumajang', prov: 'East Java', lat: -8.1330, lon: 113.2250, rKm: 25 },
  { name: 'Jember', prov: 'East Java', lat: -8.1720, lon: 113.7000, rKm: 30 },
  { name: 'Banyuwangi', prov: 'East Java', lat: -8.2190, lon: 114.3690, rKm: 38 },
  { name: 'Bondowoso', prov: 'East Java', lat: -7.9130, lon: 113.8210, rKm: 22 },
  { name: 'Situbondo', prov: 'East Java', lat: -7.7060, lon: 114.0050, rKm: 28 },
  { name: 'Kediri', prov: 'East Java', lat: -7.8167, lon: 112.0167, rKm: 15 },
  { name: 'Blitar', prov: 'East Java', lat: -8.0983, lon: 112.1681, rKm: 16 },
  { name: 'Madiun', prov: 'East Java', lat: -7.6298, lon: 111.5239, rKm: 15 },
  { name: 'Magetan', prov: 'East Java', lat: -7.6530, lon: 111.3280, rKm: 20 },
  { name: 'Ngawi', prov: 'East Java', lat: -7.4040, lon: 111.4460, rKm: 22 },
  { name: 'Ponorogo', prov: 'East Java', lat: -7.8680, lon: 111.4620, rKm: 25 },
  { name: 'Pacitan', prov: 'East Java', lat: -8.2070, lon: 111.0920, rKm: 26 },
  { name: 'Trenggalek', prov: 'East Java', lat: -8.0500, lon: 111.7100, rKm: 22 },
  { name: 'Tulungagung', prov: 'East Java', lat: -8.0660, lon: 111.9000, rKm: 22 },
  { name: 'Nganjuk', prov: 'East Java', lat: -7.6050, lon: 111.9040, rKm: 22 },
  { name: 'Jombang', prov: 'East Java', lat: -7.5460, lon: 112.2330, rKm: 20 },
  { name: 'Mojokerto', prov: 'East Java', lat: -7.4720, lon: 112.4380, rKm: 18 },
  { name: 'Bojonegoro', prov: 'East Java', lat: -7.1500, lon: 111.8820, rKm: 26 },
  { name: 'Tuban', prov: 'East Java', lat: -6.8980, lon: 112.0640, rKm: 28 },
  { name: 'Lamongan', prov: 'East Java', lat: -7.1280, lon: 112.4130, rKm: 24 },
  { name: 'Bangkalan (Madura)', prov: 'East Java', lat: -7.0300, lon: 112.7500, rKm: 22 },
  { name: 'Sampang (Madura)', prov: 'East Java', lat: -7.1870, lon: 113.2390, rKm: 22 },
  { name: 'Pamekasan (Madura)', prov: 'East Java', lat: -7.1610, lon: 113.4790, rKm: 22 },
  { name: 'Sumenep (Madura)', prov: 'East Java', lat: -7.0170, lon: 113.8670, rKm: 30 },

  // Bali & Nusa Tenggara
  { name: 'Denpasar', prov: 'Bali', lat: -8.6705, lon: 115.2126, rKm: 12 },
  { name: 'Badung (Mangupura)', prov: 'Bali', lat: -8.5830, lon: 115.1830, rKm: 20 },
  { name: 'Gianyar', prov: 'Bali', lat: -8.5440, lon: 115.3280, rKm: 18 },
  { name: 'Tabanan', prov: 'Bali', lat: -8.5410, lon: 115.1250, rKm: 22 },
  { name: 'Buleleng (Singaraja)', prov: 'Bali', lat: -8.1120, lon: 115.0880, rKm: 30 },
  { name: 'Karangasem', prov: 'Bali', lat: -8.4480, lon: 115.6120, rKm: 22 },
  { name: 'Klungkung', prov: 'Bali', lat: -8.5350, lon: 115.4050, rKm: 15 },
  { name: 'Bangli', prov: 'Bali', lat: -8.4540, lon: 115.3550, rKm: 18 },
  { name: 'Jembrana', prov: 'Bali', lat: -8.3580, lon: 114.6180, rKm: 25 },
  { name: 'Mataram City', prov: 'West Nusa Tenggara', lat: -8.5833, lon: 116.1167, rKm: 12 },
  { name: 'West Lombok', prov: 'West Nusa Tenggara', lat: -8.6830, lon: 116.1330, rKm: 22 },
  { name: 'Central Lombok (Praya)', prov: 'West Nusa Tenggara', lat: -8.7050, lon: 116.2750, rKm: 24 },
  { name: 'East Lombok (Selong)', prov: 'West Nusa Tenggara', lat: -8.6500, lon: 116.5330, rKm: 28 },
  { name: 'North Lombok (Tanjung)', prov: 'West Nusa Tenggara', lat: -8.3500, lon: 116.1500, rKm: 22 },
  { name: 'Sumbawa', prov: 'West Nusa Tenggara', lat: -8.5000, lon: 117.4300, rKm: 38 },
  { name: 'Bima City', prov: 'West Nusa Tenggara', lat: -8.4500, lon: 118.7300, rKm: 20 },
  { name: 'Dompu', prov: 'West Nusa Tenggara', lat: -8.5330, lon: 118.4500, rKm: 25 },
  { name: 'Kupang City', prov: 'East Nusa Tenggara', lat: -10.1772, lon: 123.6070, rKm: 15 },
  { name: 'West Manggarai (Labuan Bajo)', prov: 'East Nusa Tenggara', lat: -8.4964, lon: 119.8877, rKm: 25 },
  { name: 'Sikka (Maumere)', prov: 'East Nusa Tenggara', lat: -8.6180, lon: 122.2130, rKm: 22 },
  { name: 'Ende', prov: 'East Nusa Tenggara', lat: -8.8430, lon: 121.6620, rKm: 22 },
  { name: 'East Sumba (Waingapu)', prov: 'East Nusa Tenggara', lat: -9.6500, lon: 120.2670, rKm: 35 },

  // Sumatra
  { name: 'Medan', prov: 'North Sumatra', lat: 3.5952, lon: 98.6722, rKm: 16 },
  { name: 'Deli Serdang', prov: 'North Sumatra', lat: 3.5600, lon: 98.8700, rKm: 28 },
  { name: 'Binjai City', prov: 'North Sumatra', lat: 3.6000, lon: 98.4830, rKm: 12 },
  { name: 'Pematangsiantar', prov: 'North Sumatra', lat: 2.9600, lon: 99.0600, rKm: 14 },
  { name: 'Karo (Kabanjahe)', prov: 'North Sumatra', lat: 3.1000, lon: 98.4900, rKm: 22 },
  { name: 'Samosir (Lake Toba)', prov: 'North Sumatra', lat: 2.6000, lon: 98.7000, rKm: 25 },
  { name: 'Banda Aceh', prov: 'Aceh', lat: 5.5483, lon: 95.3238, rKm: 15 },
  { name: 'Aceh Besar', prov: 'Aceh', lat: 5.2800, lon: 95.6200, rKm: 32 },
  { name: 'Sabang (Weh Island)', prov: 'Aceh', lat: 5.8900, lon: 95.3200, rKm: 18 },
  { name: 'Lhokseumawe', prov: 'Aceh', lat: 5.1800, lon: 97.1400, rKm: 15 },
  { name: 'Padang City', prov: 'West Sumatra', lat: -0.9492, lon: 100.3543, rKm: 20 },
  { name: 'Bukittinggi', prov: 'West Sumatra', lat: -0.3056, lon: 100.3692, rKm: 12 },
  { name: 'Payakumbuh', prov: 'West Sumatra', lat: -0.2250, lon: 100.6330, rKm: 14 },
  { name: 'Pekanbaru', prov: 'Riau', lat: 0.5071, lon: 101.4478, rKm: 20 },
  { name: 'Dumai City', prov: 'Riau', lat: 1.6667, lon: 101.4500, rKm: 22 },
  { name: 'Batam City', prov: 'Riau Islands', lat: 1.1301, lon: 104.0529, rKm: 25 },
  { name: 'Tanjungpinang', prov: 'Riau Islands', lat: 0.9167, lon: 104.4500, rKm: 16 },
  { name: 'Bintan Island', prov: 'Riau Islands', lat: 1.0500, lon: 104.5500, rKm: 28 },
  { name: 'Jambi City', prov: 'Jambi', lat: -1.6100, lon: 103.6100, rKm: 18 },
  { name: 'Palembang', prov: 'South Sumatra', lat: -2.9909, lon: 104.7565, rKm: 22 },
  { name: 'Bengkulu City', prov: 'Bengkulu', lat: -3.8000, lon: 102.2667, rKm: 18 },
  { name: 'Bandar Lampung', prov: 'Lampung', lat: -5.4500, lon: 105.2667, rKm: 20 },
  { name: 'South Lampung', prov: 'Lampung', lat: -5.7330, lon: 105.5830, rKm: 28 },
  { name: 'Pangkalpinang', prov: 'Bangka Belitung Islands', lat: -2.1333, lon: 106.1167, rKm: 16 },
  { name: 'Belitung (Tanjung Pandan)', prov: 'Bangka Belitung Islands', lat: -2.7400, lon: 107.6400, rKm: 25 },

  // Kalimantan
  { name: 'Balikpapan', prov: 'East Kalimantan', lat: -1.2379, lon: 116.8289, rKm: 22 },
  { name: 'Samarinda', prov: 'East Kalimantan', lat: -0.5022, lon: 117.1536, rKm: 22 },
  { name: 'Penajam Paser Utara (IKN)', prov: 'East Kalimantan', lat: -1.2500, lon: 116.7500, rKm: 32 },
  { name: 'Kutai Kartanegara', prov: 'East Kalimantan', lat: -0.4167, lon: 116.9833, rKm: 35 },
  { name: 'Banjarmasin', prov: 'South Kalimantan', lat: -3.3167, lon: 114.5900, rKm: 18 },
  { name: 'Banjarbaru', prov: 'South Kalimantan', lat: -3.4400, lon: 114.8300, rKm: 16 },
  { name: 'Pontianak', prov: 'West Kalimantan', lat: -0.0263, lon: 109.3425, rKm: 18 },
  { name: 'Singkawang', prov: 'West Kalimantan', lat: 0.9069, lon: 108.9869, rKm: 18 },
  { name: 'Palangka Raya', prov: 'Central Kalimantan', lat: -2.2077, lon: 113.9165, rKm: 25 },
  { name: 'Tarakan', prov: 'North Kalimantan', lat: 3.3000, lon: 117.6333, rKm: 18 },
  { name: 'Tanjung Selor', prov: 'North Kalimantan', lat: 2.8333, lon: 117.3667, rKm: 28 },

  // Sulawesi
  { name: 'Makassar', prov: 'South Sulawesi', lat: -5.1477, lon: 119.4327, rKm: 18 },
  { name: 'Gowa', prov: 'South Sulawesi', lat: -5.2000, lon: 119.4500, rKm: 22 },
  { name: 'Maros', prov: 'South Sulawesi', lat: -5.0000, lon: 119.5700, rKm: 22 },
  { name: 'Parepare', prov: 'South Sulawesi', lat: -4.0133, lon: 119.6256, rKm: 14 },
  { name: 'Palopo', prov: 'South Sulawesi', lat: -2.9940, lon: 120.1970, rKm: 16 },
  { name: 'Manado', prov: 'North Sulawesi', lat: 1.4748, lon: 124.8428, rKm: 16 },
  { name: 'Bitung', prov: 'North Sulawesi', lat: 1.4444, lon: 125.1833, rKm: 16 },
  { name: 'Palu City', prov: 'Central Sulawesi', lat: -0.8917, lon: 119.8707, rKm: 18 },
  { name: 'Kendari', prov: 'Southeast Sulawesi', lat: -3.9985, lon: 122.5126, rKm: 18 },
  { name: 'Gorontalo City', prov: 'Gorontalo', lat: 0.5435, lon: 123.0568, rKm: 16 },
  { name: 'Mamuju', prov: 'West Sulawesi', lat: -2.6770, lon: 118.8880, rKm: 22 },

  // Maluku & Papua
  { name: 'Ambon City', prov: 'Maluku', lat: -3.6954, lon: 128.1814, rKm: 18 },
  { name: 'Ternate City', prov: 'North Maluku', lat: 0.7833, lon: 127.3667, rKm: 16 },
  { name: 'Jayapura', prov: 'Papua', lat: -2.5337, lon: 140.7181, rKm: 22 },
  { name: 'Sorong', prov: 'Southwest Papua', lat: -0.8762, lon: 131.2558, rKm: 22 },
  { name: 'Manokwari', prov: 'West Papua', lat: -0.8615, lon: 134.0620, rKm: 22 },
  { name: 'Timika (Mimika)', prov: 'Central Papua', lat: -4.5467, lon: 136.8837, rKm: 30 },
  { name: 'Nabire', prov: 'Central Papua', lat: -3.3667, lon: 135.4833, rKm: 25 },
  { name: 'Wamena (Jayawijaya)', prov: 'Highland Papua', lat: -4.0980, lon: 138.9440, rKm: 22 },
  { name: 'Merauke', prov: 'South Papua', lat: -8.4932, lon: 140.4018, rKm: 35 },
  { name: 'Biak Island', prov: 'Papua', lat: -1.1833, lon: 136.0833, rKm: 25 },
]

/**
 * Indonesian Provinces Bounding Box & Centroid (English Names)
 */
const INDONESIA_PROVINCES = [
  { name: 'Yogyakarta', lat: -7.87, lon: 110.42, minLat: -8.21, maxLat: -7.53, minLon: 110.00, maxLon: 110.84 },
  { name: 'Central Java', lat: -7.15, lon: 110.14, minLat: -8.25, maxLat: -6.40, minLon: 108.70, maxLon: 111.60 },
  { name: 'West Java', lat: -6.90, lon: 107.60, minLat: -7.82, maxLat: -5.91, minLon: 106.35, maxLon: 108.85 },
  { name: 'Jakarta', lat: -6.20, lon: 106.82, minLat: -6.37, maxLat: -5.20, minLon: 106.40, maxLon: 107.00 },
  { name: 'Banten', lat: -6.40, lon: 106.10, minLat: -7.02, maxLat: -5.80, minLon: 105.10, maxLon: 106.75 },
  { name: 'East Java', lat: -7.53, lon: 112.23, minLat: -8.78, maxLat: -6.70, minLon: 111.00, maxLon: 114.65 },
  { name: 'Bali', lat: -8.40, lon: 115.18, minLat: -8.85, maxLat: -8.05, minLon: 114.40, maxLon: 115.75 },
  { name: 'West Nusa Tenggara', lat: -8.65, lon: 117.36, minLat: -9.15, maxLat: -8.00, minLon: 115.80, maxLon: 119.35 },
  { name: 'East Nusa Tenggara', lat: -8.65, lon: 121.07, minLat: -11.00, maxLat: -8.00, minLon: 118.90, maxLon: 125.20 },
  { name: 'North Sumatra', lat: 2.11, lon: 99.54, minLat: -0.60, maxLat: 4.30, minLon: 97.00, maxLon: 100.70 },
  { name: 'Aceh', lat: 4.69, lon: 96.74, minLat: 1.95, maxLat: 6.08, minLon: 95.00, maxLon: 98.30 },
  { name: 'West Sumatra', lat: -0.73, lon: 100.80, minLat: -3.50, maxLat: 0.90, minLon: 98.60, maxLon: 101.90 },
  { name: 'Riau', lat: 0.29, lon: 101.70, minLat: -1.15, maxLat: 2.50, minLon: 100.00, maxLon: 103.80 },
  { name: 'Riau Islands', lat: 3.94, lon: 108.14, minLat: -0.90, maxLat: 5.00, minLon: 103.50, maxLon: 109.20 },
  { name: 'Jambi', lat: -1.48, lon: 102.43, minLat: -2.75, maxLat: -0.75, minLon: 101.15, maxLon: 104.55 },
  { name: 'South Sumatra', lat: -3.31, lon: 104.16, minLat: -4.95, maxLat: -1.65, minLon: 102.05, maxLon: 106.15 },
  { name: 'Bengkulu', lat: -3.57, lon: 102.34, minLat: -5.50, maxLat: -2.25, minLon: 101.00, maxLon: 103.75 },
  { name: 'Lampung', lat: -4.55, lon: 105.40, minLat: -6.00, maxLat: -3.75, minLon: 103.50, maxLon: 106.00 },
  { name: 'Bangka Belitung Islands', lat: -2.74, lon: 106.44, minLat: -3.80, maxLat: -1.50, minLon: 105.00, maxLon: 108.50 },
  { name: 'West Kalimantan', lat: -0.27, lon: 111.47, minLat: -3.10, maxLat: 2.10, minLon: 108.50, maxLon: 114.20 },
  { name: 'Central Kalimantan', lat: -1.68, lon: 113.38, minLat: -3.60, maxLat: 0.80, minLon: 111.00, maxLon: 116.00 },
  { name: 'South Kalimantan', lat: -3.09, lon: 115.28, minLat: -4.20, maxLat: -1.30, minLon: 114.20, maxLon: 116.60 },
  { name: 'East Kalimantan', lat: 0.53, lon: 116.41, minLat: -2.50, maxLat: 2.60, minLon: 115.00, maxLon: 119.00 },
  { name: 'North Kalimantan', lat: 3.07, lon: 116.04, minLat: 1.10, maxLat: 4.40, minLon: 114.50, maxLon: 118.00 },
  { name: 'South Sulawesi', lat: -3.66, lon: 119.97, minLat: -7.50, maxLat: -2.00, minLon: 118.70, maxLon: 121.90 },
  { name: 'West Sulawesi', lat: -2.84, lon: 119.23, minLat: -3.65, maxLat: -0.90, minLon: 118.70, maxLon: 119.90 },
  { name: 'Southeast Sulawesi', lat: -4.14, lon: 122.17, minLat: -6.20, maxLat: -2.80, minLon: 120.80, maxLon: 124.60 },
  { name: 'Central Sulawesi', lat: -1.43, lon: 121.44, minLat: -3.50, maxLat: 1.40, minLon: 119.40, maxLon: 124.30 },
  { name: 'Gorontalo', lat: 0.69, lon: 122.44, minLat: 0.20, maxLat: 1.10, minLon: 121.10, maxLon: 123.60 },
  { name: 'North Sulawesi', lat: 0.62, lon: 123.97, minLat: 0.25, maxLat: 5.60, minLon: 123.10, maxLon: 127.20 },
  { name: 'Maluku', lat: -3.23, lon: 130.14, minLat: -8.40, maxLat: -1.50, minLon: 125.70, maxLon: 135.00 },
  { name: 'North Maluku', lat: 1.57, lon: 127.80, minLat: -2.50, maxLat: 2.70, minLon: 124.20, maxLon: 129.70 },
  { name: 'Papua', lat: -2.50, lon: 139.00, minLat: -4.00, maxLat: 0.00, minLon: 137.50, maxLon: 141.00 },
  { name: 'West Papua', lat: -1.33, lon: 133.17, minLat: -4.30, maxLat: 0.50, minLon: 132.00, maxLon: 135.50 },
  { name: 'Southwest Papua', lat: -0.80, lon: 131.50, minLat: -2.50, maxLat: 1.00, minLon: 129.50, maxLon: 133.50 },
  { name: 'Central Papua', lat: -3.80, lon: 136.50, minLat: -5.20, maxLat: -2.00, minLon: 134.50, maxLon: 138.50 },
  { name: 'Highland Papua', lat: -4.20, lon: 139.50, minLat: -5.50, maxLat: -3.20, minLon: 138.00, maxLon: 141.00 },
  { name: 'South Papua', lat: -7.50, lon: 139.50, minLat: -9.20, maxLat: -4.80, minLon: 137.50, maxLon: 141.00 },
]

/**
 * Major International Regions & Hubs
 */
const GLOBAL_HUBS = [
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, rKm: 30 },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lon: 101.6869, rKm: 35 },
  { name: 'Johor Bahru', country: 'Malaysia', lat: 1.4927, lon: 103.7414, rKm: 25 },
  { name: 'Penang (George Town)', country: 'Malaysia', lat: 5.4141, lon: 100.3288, rKm: 25 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018, rKm: 40 },
  { name: 'Phuket', country: 'Thailand', lat: 7.8804, lon: 98.3923, rKm: 30 },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842, rKm: 35 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lon: 106.6297, rKm: 35 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0285, lon: 105.8542, rKm: 35 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, rKm: 45 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.9780, rKm: 40 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074, rKm: 50 },
  { name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694, rKm: 30 },
  { name: 'Taipei', country: 'Taiwan', lat: 25.0330, lon: 121.5654, rKm: 30 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, rKm: 45 },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631, rKm: 45 },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lon: 115.8605, rKm: 40 },
  { name: 'Darwin', country: 'Australia', lat: -12.4634, lon: 130.8456, rKm: 30 },
  { name: 'Port Moresby', country: 'Papua New Guinea', lat: -9.4438, lon: 147.1803, rKm: 35 },
  { name: 'Dili', country: 'Timor-Leste', lat: -8.5569, lon: 125.5783, rKm: 25 },
  { name: 'Bandar Seri Begawan', country: 'Brunei', lat: 4.9031, lon: 114.9398, rKm: 25 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708, rKm: 40 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, rKm: 45 },
  { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060, rKm: 45 },
  { name: 'San Francisco', country: 'United States', lat: 37.7749, lon: -122.4194, rKm: 40 },
]

/**
 * Maritime and Oceanic Sectors surrounding Indonesia (English)
 */
function getMaritimeSectorName(lat, lon) {
  if (lat >= -12 && lat <= -8 && lon >= 105 && lon <= 118) return 'Indian Ocean Waters (South Java)'
  if (lat >= -11 && lat <= -8 && lon >= 118 && lon <= 126) return 'Timor Sea / Indian Ocean Waters'
  if (lat >= -7 && lat <= -4 && lon >= 106 && lon <= 116) return 'Java Sea Waters'
  if (lat >= -1 && lat <= 6 && lon >= 95 && lon <= 104) return 'Strait of Malacca / Andaman Sea'
  if (lat >= -8 && lat <= -5 && lon >= 116 && lon <= 124) return 'Flores Sea Waters'
  if (lat >= -7 && lat <= -3 && lon >= 124 && lon <= 134) return 'Banda Sea Waters'
  if (lat >= 0 && lat <= 5 && lon >= 118 && lon <= 126) return 'Celebes Sea Waters'
  if (lat >= -2 && lat <= 2 && lon >= 125 && lon <= 130) return 'Molucca Sea Waters'
  if (lat >= -9 && lat <= -5 && lon >= 134 && lon <= 141) return 'Arafura Sea Waters'
  if (lat >= -10 && lat <= -6 && lon >= 104 && lon <= 106) return 'Sunda Strait Waters'
  if (lat >= -9 && lat <= -8 && lon >= 114 && lon <= 116) return 'Bali / Lombok Strait Waters'
  if (lat >= -2 && lat <= 0 && lon >= 117 && lon <= 120) return 'Makassar Strait Waters'
  if (lat >= 0 && lat <= 7 && lon >= 106 && lon <= 110) return 'North Natuna Sea Waters'
  return null
}

/**
 * Offline High-Precision Location Name Resolver (English Standard)
 * Evaluates coordinates in 0 ms with 100% offline reliability.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} Fully formatted location name
 */
export function getOfflineLocationName(latitude, longitude) {
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
    return 'UAV Base Area'
  }

  const lat = Number(latitude)
  const lon = Number(longitude)

  // 1. Check Specific Topography / Aviation / SAR Landmarks (Closest within radius)
  let closestLandmark = null
  let minLandmarkDist = Infinity
  for (const lm of INDONESIA_LANDMARKS) {
    const dist = calculateHaversineKm(lat, lon, lm.lat, lm.lon)
    if (dist <= lm.radiusKm && dist < minLandmarkDist) {
      minLandmarkDist = dist
      closestLandmark = lm
    }
  }

  if (closestLandmark) {
    return `${closestLandmark.name}, ${closestLandmark.sub}`
  }

  // 2. Check Indonesian Regencies & Cities (Nearest within bounding radius)
  let closestCity = null
  let minCityDist = Infinity
  for (const city of INDONESIA_CITIES) {
    const dist = calculateHaversineKm(lat, lon, city.lat, city.lon)
    if (dist < minCityDist) {
      minCityDist = dist
      closestCity = city
    }
  }

  if (closestCity && minCityDist <= closestCity.rKm) {
    return `${closestCity.name}, ${closestCity.prov}`
  }

  // 3. Check Global International Hubs (Nearest within radius)
  let closestGlobal = null
  let minGlobalDist = Infinity
  for (const hub of GLOBAL_HUBS) {
    const dist = calculateHaversineKm(lat, lon, hub.lat, hub.lon)
    if (dist <= hub.rKm && dist < minGlobalDist) {
      minGlobalDist = dist
      closestGlobal = hub
    }
  }

  if (closestGlobal) {
    return `${closestGlobal.name}, ${closestGlobal.country}`
  }

  // 4. Check Indonesian Province Bounding Boxes
  for (const prov of INDONESIA_PROVINCES) {
    if (lat >= prov.minLat && lat <= prov.maxLat && lon >= prov.minLon && lon <= prov.maxLon) {
      if (closestCity && minCityDist < 45) {
        return `${closestCity.name} Area, ${prov.name}`
      }
      return `${prov.name} Region`
    }
  }

  // 5. Check Maritime & Regional Waters in Indonesia
  const maritime = getMaritimeSectorName(lat, lon)
  if (maritime) {
    return `${maritime} (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`
  }

  // 6. Generic Geographic Quadrant Fallback with Cardinal Directions
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `Coordinate Sector ${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`
}

/**
 * In-Memory & LocalStorage Cache for Geocoding
 */
const geocodeCache = new Map()

/**
 * Fetch online reverse geocoding from multiple CORS-friendly resilient public APIs (English language output)
 */
export async function reverseGeocodeOnline(latitude, longitude) {
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) return ''

  const lat = Number(latitude)
  const lon = Number(longitude)
  const cleanLat = lat.toFixed(5)
  const cleanLon = lon.toFixed(5)
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`

  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)
  }

  // Helper for abortable fetch
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 3500) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...options, credentials: 'omit', signal: controller.signal })
      clearTimeout(timer)
      return res
    } catch (e) {
      clearTimeout(timer)
      throw e
    }
  }

  // 1. BigDataCloud Client Reverse Geocode (Browser client with English language)
  try {
    const bdcRes = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${cleanLat}&longitude=${cleanLon}&localityLanguage=en`
    )
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json()
      const locality = bdcData.locality || ''
      const city = bdcData.city || ''
      const state = bdcData.principalSubdivision || ''
      const country = bdcData.countryName || ''

      let adminName = ''
      if (bdcData.localityInfo && Array.isArray(bdcData.localityInfo.administrative)) {
        const sorted = bdcData.localityInfo.administrative
          .filter((a) => a.name && !['Indonesia', country].includes(a.name))
          .sort((a, b) => (b.adminLevel || 0) - (a.adminLevel || 0))
        if (sorted.length > 0) {
          adminName = sorted[0].name
        }
      }

      const primary = city || locality || adminName
      const secondary = state || (country !== 'Indonesia' ? country : '')
      const parts = [primary, secondary !== primary ? secondary : ''].filter(Boolean)
      if (parts.length > 0) {
        const result = parts.join(', ')
        geocodeCache.set(key, result)
        return result
      }
    }
  } catch {
    // continue to next source
  }

  // 2. OpenStreetMap Nominatim with safety timeout
  try {
    const nomRes = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${cleanLat}&lon=${cleanLon}&zoom=14&accept-language=en`
    )
    if (nomRes.ok) {
      const nomData = await nomRes.json()
      const addr = nomData.address || {}
      const local = addr.city || addr.town || addr.municipality || addr.regency || addr.county || addr.suburb || ''
      const state = addr.state || addr.province || ''
      const parts = [local, state].filter(Boolean)
      if (parts.length > 0) {
        const result = parts.join(', ')
        geocodeCache.set(key, result)
        return result
      }
      if (nomData.name) {
        geocodeCache.set(key, nomData.name)
        return nomData.name
      }
    }
  } catch {
    // continue
  }

  // 3. Photon Komoot API
  try {
    const photonRes = await fetchWithTimeout(`https://photon.komoot.io/reverse?lat=${cleanLat}&lon=${cleanLon}&lang=en`)
    if (photonRes.ok) {
      const photonData = await photonRes.json()
      const feat = photonData.features?.[0]?.properties
      if (feat) {
        const local = feat.district || feat.city || feat.county || feat.name || ''
        const state = feat.state || feat.country || ''
        const parts = [local, state].filter(Boolean)
        if (parts.length > 0) {
          const result = parts.join(', ')
          geocodeCache.set(key, result)
          return result
        }
      }
    }
  } catch {
    // continue
  }

  // 4. wttr.in JSON reverse geo fallback
  try {
    const wttrRes = await fetchWithTimeout(`https://wttr.in/${cleanLat},${cleanLon}?format=j1`)
    if (wttrRes.ok) {
      const wttrData = await wttrRes.json()
      const area = wttrData.nearest_area?.[0]
      if (area) {
        const areaName = area.areaName?.[0]?.value || ''
        const region = area.region?.[0]?.value || ''
        const country = area.country?.[0]?.value || ''

        const parts = [areaName, region, country !== 'Indonesia' ? country : ''].filter(Boolean)
        if (parts.length > 0) {
          const result = parts.join(', ')
          geocodeCache.set(key, result)
          return result
        }
      }
    }
  } catch {
    // continue to next source
  }

  return ''
}

/**
 * Unified Location Name Resolver (English Standard)
 * Immediately returns offline name if online is unavailable or pending,
 * and asynchronously resolves online name.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 */
export async function resolveLocationName(lat, lon) {
  const offlineName = getOfflineLocationName(lat, lon)
  try {
    const onlineName = await reverseGeocodeOnline(lat, lon)
    if (onlineName && onlineName.trim().length > 0) {
      return onlineName
    }
  } catch {
    // fallback to offline
  }
  return offlineName
}
