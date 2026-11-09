/**
 * NesaMate - Data Master Navigasi Kampus Hutan UNESA Lidah Wetan
 * Terintegrasi dengan data koordinat presisi Hutan UNESA & Landmark Kampus
 * Disusun dengan jarak proporsional agar tidak saling bertumpuk di peta.
 */

const NESA_DATA = {
  // Titik Pusat Peta: Hutan & Kampus UNESA Lidah Wetan
  campusCenter: [-7.3005, 112.6740],
  zoomDefault: 16,

  // Titik Koordinat Kustom POI (Spot Hutan Kota UNESA, Musholla, Parkiran, Toilet)
  poi: {
    hutan: [
      {
        id: 'htn-1',
        name: 'Pintu Masuk Hutan UNESA',
        category: 'hutan',
        icon: '🌲',
        lat: -7.3006,
        lng: 112.6708,
        desc: 'Gerbang utama menuju kawasan konservasi rimbun dan jalur setapak Hutan UNESA.',
        highlight: 'Spot Rimbun Alami'
      },
      {
        id: 'htn-2',
        name: 'Jalur Setapak Hutan (Trekking)',
        category: 'hutan',
        icon: '🥾',
        lat: -7.3015,
        lng: 112.6702,
        desc: 'Jalur jalan kaki alami berbayang kanopi pohon tropis yang sejuk dan menenangkan.',
        highlight: 'Kanopi Pohon Tropis'
      },
      {
        id: 'htn-3',
        name: 'Pusat Observasi Flora & Burung',
        category: 'hutan',
        icon: '🦜',
        lat: -7.3025,
        lng: 112.6712,
        desc: 'Area edukasi keanekaragaman hayati tempat singgah burung liar dan tanaman konservasi.',
        highlight: 'Konservasi Hayati'
      },
      {
        id: 'htn-4',
        name: 'Pos Jagawana & Shelter Hutan',
        category: 'hutan',
        icon: '🛖',
        lat: -7.3022,
        lng: 112.6722,
        desc: 'Shelter peristirahatan bagi pejalan kaki dengan air minum ramah lingkungan.',
        highlight: 'Shelter Istirahat'
      },
      {
        id: 'htn-5',
        name: 'Jalur Pejalan Kaki Tepi Danau',
        category: 'hutan',
        icon: '⛵',
        lat: -7.3015,
        lng: 112.6732,
        desc: 'Tepian danau kampus yang asri dengan hembusan angin sepoi-sepoi.',
        highlight: 'Panorama Danau'
      }
    ],
    musholla: [
      {
        id: 'msh-1',
        name: 'Masjid Baitul Makmur UNESA',
        category: 'musholla',
        icon: '🕌',
        lat: -7.3002,
        lng: 112.6722,
        desc: 'Masjid utama kampus dengan arsitektur terbuka yang sangat sejuk dan wudhu luas.',
        highlight: 'Masjid Utama Kampus'
      },
      {
        id: 'msh-2',
        name: 'Musholla Gedung Rektorat Lt. 1',
        category: 'musholla',
        icon: '🕌',
        lat: -7.2998,
        lng: 112.6746,
        desc: 'Musholla ber-AC di sayap timur Gedung Rektorat UNESA.',
        highlight: 'Full AC & Nyaman'
      },
      {
        id: 'msh-3',
        name: 'Musholla Fakultas Ilmu Pendidikan (FIP)',
        category: 'musholla',
        icon: '🕌',
        lat: -7.3032,
        lng: 112.6725,
        desc: 'Musholla mahasiswa dan dosen di kompleks FIP dengan taman rindang.',
        highlight: 'Dekat Gedung Kuliah'
      },
      {
        id: 'msh-4',
        name: 'Musholla Plaza Seni & Budaya (FBS)',
        category: 'musholla',
        icon: '🕌',
        lat: -7.3036,
        lng: 112.6756,
        desc: 'Musholla berdesain artistik dekat laboratorium teater dan seni.',
        highlight: 'Sirkulasi Alami'
      }
    ],
    parkiran: [
      {
        id: 'prk-1',
        name: 'Parkiran Utama Rektorat',
        category: 'parkiran',
        icon: '🅿️',
        lat: -7.2990,
        lng: 112.6750,
        desc: 'Area parkir berkanopi utama untuk mobil dan motor dengan pos penjagaan 24 jam.',
        highlight: 'Kapasitas 450 Motor / 100 Mobil'
      },
      {
        id: 'prk-2',
        name: 'Parkir Terpadu Hutan & Jogging',
        category: 'parkiran',
        icon: '🅿️',
        lat: -7.3002,
        lng: 112.6712,
        desc: 'Titik parkir strategis bagi pengunjung yang ingin langsung jalan santai di hutan.',
        highlight: 'Akses Langsung Hutan'
      },
      {
        id: 'prk-3',
        name: 'Parkiran Barat Kompleks FIP/FBS',
        category: 'parkiran',
        icon: '🅿️',
        lat: -7.3036,
        lng: 112.6716,
        desc: 'Parkir rimbun di bawah naungan pohon trembesi dekat kantin.',
        highlight: 'Teduh & Luas'
      },
      {
        id: 'prk-4',
        name: 'Parkiran Sport Center & Gelora',
        category: 'parkiran',
        icon: '🅿️',
        lat: -7.2985,
        lng: 112.6728,
        desc: 'Parkir luas untuk mahasiswa olahraga dan kendaraan besar.',
        highlight: 'Dekat Gelora UNESA'
      }
    ],
    gerbang: [
      {
        id: 'grb-1',
        name: 'Gerbang Masuk Utama UNESA Lidah Wetan',
        category: 'gerbang',
        icon: '🚪',
        lat: -7.2978,
        lng: 112.6742,
        desc: 'Gerbang masuk utama kampus UNESA Lidah Wetan di Jl. Raya Kampus Unesa, akses utama menuju Rektorat dan seluruh kawasan kampus.',
        highlight: 'Pintu Masuk Utama Kampus'
      }
    ],
    toilet: [
      {
        id: 'tlt-1',
        name: 'Toilet Shelter Hutan & Danau',
        category: 'toilet',
        icon: '🚻',
        lat: -7.3018,
        lng: 112.6726,
        desc: 'Toilet bersih ramah lingkungan di tepi danau Hutan UNESA.',
        highlight: 'Sangat Bersih & Ramah Difabel'
      },
      {
        id: 'tlt-2',
        name: 'Toilet Gedung Rektorat',
        category: 'toilet',
        icon: '🚻',
        lat: -7.3005,
        lng: 112.6748,
        desc: 'Fasilitas sanitasi nyaman di lobi lantai 1 Rektorat UNESA.',
        highlight: 'Higienis & Kering'
      },
      {
        id: 'tlt-3',
        name: 'Toilet Koridor Arboretum',
        category: 'toilet',
        icon: '🚻',
        lat: -7.3028,
        lng: 112.6738,
        desc: 'Fasilitas toilet di persilangan jalur hijau arboretum hutan.',
        highlight: 'Air Sejuk Alami'
      },
      {
        id: 'tlt-4',
        name: 'Toilet Gelora UNESA Barat',
        category: 'toilet',
        icon: '🚻',
        lat: -7.2988,
        lng: 112.6720,
        desc: 'Kamar bilas dan toilet khusus area olahraga kampus.',
        highlight: 'Kamar Mandi Bilas'
      }
    ]
  },

  // CHALLENGE MODE: 6 Pos Pameran Misi Petualangan
  challengePositions: [
    {
      id: 'pos-1',
      index: 1,
      name: 'Pos 1: Plaza Rektorat',
      title: 'Tantangan Sensor Kualitas Udara',
      desc: 'Temui tim penjaga di depan Rektorat dan amati sensor pemantau mikroklimat.',
      lat: -7.2998,
      lng: 112.6746,
      passcode: 'NESA1',
      badge: '🏅 Sahabat Udara Bersih'
    },
    {
      id: 'pos-2',
      index: 2,
      name: 'Pos 2: Dermaga Danau',
      title: 'Tantangan Ekosistem Air',
      desc: 'Lakukan uji kejernihan air danau dan mintalah kata kunci kelulusan dari tim.',
      lat: -7.3015,
      lng: 112.6732,
      passcode: 'DANAU',
      badge: '💧 Penjaga Danau Asri'
    },
    {
      id: 'pos-3',
      index: 3,
      name: 'Pos 3: Pintu Masuk Hutan',
      title: 'Tantangan Kenali Pohon Rimbun',
      desc: 'Identifikasi pohon Trembesi tertua di gerbang masuk hutan bersama pemandu.',
      lat: -7.3006,
      lng: 112.6708,
      passcode: 'HUTAN',
      badge: '🌲 Penjelajah Rimba'
    },
    {
      id: 'pos-4',
      index: 4,
      name: 'Pos 4: Observasi Flora & Burung',
      title: 'Tantangan Suara Satwa Alami',
      desc: 'Dengarkan kicauan burung pemakan serangga di pos observasi kanopi.',
      lat: -7.3025,
      lng: 112.6712,
      passcode: 'FLORA',
      badge: '🦜 Sahabat Satwa Liar'
    },
    {
      id: 'pos-5',
      index: 5,
      name: 'Pos 5: Shelter Jagawana',
      title: 'Tantangan Zero-Waste Kampus',
      desc: 'Pilah sampah botol ke tempat sampah cerdas otomatis di shelter peristirahatan.',
      lat: -7.3022,
      lng: 112.6722,
      passcode: 'BERSIH',
      badge: '♻️ Juara Daur Ulang'
    },
    {
      id: 'pos-6',
      index: 6,
      name: 'Pos 6: Gelora Kampus Hijau',
      title: 'Tantangan Energi Langkah Kinetik',
      desc: 'Langkah energik di atas ubin konversi energi untuk menyalakan lampu taman.',
      lat: -7.2985,
      lng: 112.6728,
      passcode: 'JUARA',
      badge: '⚡ Pahlawan Energi Bersih'
    }
  ],

  // JOGGING MODE: Track Rute Hutan UNESA & Audio Turn-by-Turn
  joggingTrack: {
    name: 'Loop Hutan & Danau UNESA',
    distanceFormatted: '2.35 km',
    timeFormatted: '16 Menit',
    caloriesFormatted: '175 kkal',
    coordinates: [
      [-7.2998, 112.6746], // Start Rektorat
      [-7.3005, 112.6738], // Tikungan Menuju Danau
      [-7.3015, 112.6732], // Pejalan Kaki Tepi Danau
      [-7.3022, 112.6722], // Koridor Shelter Jagawana
      [-7.3025, 112.6712], // Pusat Observasi Flora
      [-7.3015, 112.6702], // Jalur Setapak Rimbun Barat
      [-7.3006, 112.6708], // Pintu Masuk Hutan
      [-7.3002, 112.6722], // Masjid Baitul Makmur
      [-7.2998, 112.6746]  // Finish Loop
    ],
    voiceSteps: [
      {
        step: 1,
        title: 'Mulai Pemanasan di Koridor Rektorat',
        prompt: 'Halo! Kita mulai jogging santai dari Koridor Rektorat. Udara pagi Hutan UNESA sangat sejuk. Mari mulai melangkah!'
      },
      {
        step: 2,
        title: 'Persimpangan Danau (100 meter ke Depan)',
        prompt: 'Di pertigaan depan, ambil arah kiri menuju area danau rindang. Nikmati pemandangan air danau yang tenang.'
      },
      {
        step: 3,
        title: 'Memasuki Jalur Hutan Tropis',
        prompt: 'Terus lurus di bawah kanopi pohon rimbun. Udara di sini kaya oksigen segar dan bersuhu 26 derajat Celsius.'
      },
      {
        step: 4,
        title: 'Melintasi Shelter Jagawana',
        prompt: 'Perhatian, ada tikungan halus ke kanan di dekat Shelter Jagawana. Pertahankan ritme napas Anda dengan santai.'
      },
      {
        step: 5,
        title: 'Jalur Setapak Bambu & Flora',
        prompt: 'Ambil jalur kanan mengarah kembali ke sisi utara kampus. Dengar kicauan burung kutilang yang menemani lari Anda.'
      },
      {
        step: 6,
        title: 'Sprint Akhir Menuju Garis Finish',
        prompt: 'Luar biasa! 150 meter terakhir menuju garis finish satu putaran. Anda telah membakar 175 kalori penuh!'
      }
    ]
  }
};
