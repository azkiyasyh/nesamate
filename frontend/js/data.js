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

  // CHALLENGE MODE: 6 Pos Pameran Misi Petualangan (sesuai urutan LOC025–LOC030 di spots.json)
  challengePositions: [
    {
      id: 'pos-1',
      spotId: 'LOC025',
      index: 1,
      name: 'Pos 1: Pixora',
      title: 'Tantangan Foto AI Artistik (Pixora)',
      desc: 'Kunjungi stan Pixora di Hutan UNESA dan ubah potret wajahmu menjadi karya seni unik menggunakan AI berbasis GAN.',
      lat: -7.300603,
      lng: 112.670254,
      passcode: 'PIXORA',
      badge: '🎨 Kreator Seni AI'
    },
    {
      id: 'pos-2',
      spotId: 'LOC026',
      index: 2,
      name: 'Pos 2: BIOVA',
      title: 'Tantangan Eksplorasi BIOVA',
      desc: 'Temui tim penjaga di stan BIOVA dan pelajari inovasi proyek TRM di kawasan Hutan UNESA.',
      lat: -7.300958,
      lng: 112.670983,
      passcode: 'BIOVA',
      badge: '🔬 Penjelajah BIOVA'
    },
    {
      id: 'pos-3',
      spotId: 'LOC027',
      index: 3,
      name: 'Pos 3: Wildex',
      title: 'Tantangan Eksplorasi Satwa (Wildex)',
      desc: 'Pindai satwa di sekitar Hutan UNESA dengan aplikasi Wildex untuk membuka Card Index sistem respiratori hewan.',
      lat: -7.300992,
      lng: 112.670338,
      passcode: 'WILDEX',
      badge: '🦊 Ahli Satwa Wildex'
    },
    {
      id: 'pos-4',
      spotId: 'LOC028',
      index: 4,
      name: 'Pos 4: BioSphere',
      title: 'Tantangan Sensor Lingkungan IoT (BioSphere)',
      desc: 'Amati pemantauan suhu, kelembapan, dan pH air kolam berbasis IoT di stan BioSphere untuk deteksi dini kualitas air dan risiko kebakaran.',
      lat: -7.300995,
      lng: 112.671087,
      passcode: 'BIOSPHERE',
      badge: '🌡️ Penjaga Ekosistem IoT'
    },
    {
      id: 'pos-5',
      spotId: 'LOC029',
      index: 5,
      name: 'Pos 5: Animora',
      title: 'Tantangan Augmented Reality 3D (Animora)',
      desc: 'Pindai gambar hewan menggunakan kamera AR Animora untuk melihat model hewan 3D secara langsung dan selesaikan kuisnya.',
      lat: -7.300395,
      lng: 112.670696,
      passcode: 'ANIMORA',
      badge: '📱 Kolektor AR Animora'
    },
    {
      id: 'pos-6',
      spotId: 'LOC030',
      index: 6,
      name: 'Pos 6: SmartPark Vision',
      title: 'Tantangan Deteksi Aktivitas YOLOv8 (SmartPark Vision)',
      desc: 'Kunjungi stan SmartPark Vision dan amati pemantauan kepadatan pengunjung serta klasifikasi aktivitas Hutan Kota Unesa secara real-time.',
      lat: -7.3000963,
      lng: 112.671238,
      passcode: 'SMARTPARK',
      badge: '📹 Pengawas SmartPark'
    }
  ],

  // JOGGING MODE: Track Rute Hutan UNESA & Audio Turn-by-Turn
  joggingTrack: {
    name: 'Loop Hutan & Danau UNESA',
    distanceFormatted: '0.60 km',
    timeFormatted: '5 Menit',
    caloriesFormatted: '45 kkal',
    coordinates: [
      [-7.3013298, 112.6718818],
      [-7.3013013, 112.6719053],
      [-7.3010152, 112.6719904],
      [-7.3006214, 112.6721022],
      [-7.3003147, 112.6721937],
      [-7.3001161, 112.6722317],
      [-7.3000742, 112.6722317],
      [-7.300039, 112.6722122],
      [-7.3000168, 112.6721647],
      [-7.3000111, 112.6720625],
      [-7.3000005, 112.6719092],
      [-7.2999877, 112.6718359],
      [-7.2999662, 112.6717579],
      [-7.2999236, 112.6716292],
      [-7.2999013, 112.6715863],
      [-7.2998824, 112.6715501],
      [-7.2998026, 112.671428],
      [-7.2996935, 112.6713087],
      [-7.2995743, 112.6711821],
      [-7.2995198, 112.6710754],
      [-7.299518, 112.6710397],
      [-7.2995396, 112.6710148],
      [-7.2995721, 112.6710108],
      [-7.2996474, 112.6710213],
      [-7.2997651, 112.6710592],
      [-7.2998515, 112.6710673],
      [-7.29992, 112.671066],
      [-7.3000598, 112.6710758],
      [-7.3002899, 112.6710691],
      [-7.3006192, 112.6710425],
      [-7.3008178, 112.6710187],
      [-7.3009426, 112.6709828],
      [-7.3010942, 112.6709847],
      [-7.301144, 112.6710409],
      [-7.3012333, 112.6714187],
      [-7.3013341, 112.6718446],
      [-7.3013298, 112.6718818]
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
  },

  // 30 Spot Resmi Hutan & Kampus UNESA (Wisata, Satwa, Fasilitas Umum, & Projek TRM)
  spots: [
    { id: 'LOC001', name: 'Pusat Observasi Flora & Burung', icon: '🦜', category: 'wisata', tag: '🦜 Observasi Hayati', lat: -7.301325, lng: 112.671791, desc: 'Tempat teduh melihat burung dan flora hutan mini yang cocok buat nugas, dilengkapi gazebo, bangku taman, colokan, wifi, dan parkiran sepeda.' },
    { id: 'LOC002', name: 'Kandang Ayam', icon: '🐔', category: 'fauna', tag: '🐔 Kandang Ayam Hutan', lat: -7.301034, lng: 112.671424, desc: 'Tempat ayam dikandangkan dan dirawat di Hutan UNESA, dilengkapi tempat sampah agar lingkungan tetap bersih.' },
    { id: 'LOC003', name: 'Gazeboo 1', icon: '🛖', category: 'fasilitas', tag: '🛖 Gazebo Istirahat', lat: -7.300744, lng: 112.671448, desc: 'Tempat beristirahat sambil menikmati pemandangan hutan/taman, dilengkapi tempat sampah agar lingkungan terjaga.' },
    { id: 'LOC004', name: 'Gazeboo 2', icon: '🛖', category: 'fasilitas', tag: '🛖 Gazebo Istirahat', lat: -7.300440, lng: 112.671475, desc: 'Tempat beristirahat sambil menikmati pemandangan hutan/taman, dilengkapi tempat sampah agar lingkungan terjaga.' },
    { id: 'LOC005', name: 'Danau Bunga Kertas', icon: '🌺', category: 'wisata', tag: '🌺 Panorama Danau', lat: -7.300294, lng: 112.671901, desc: 'Spot wisata danau kecil yang dikelilingi pagar bunga kertas yang indah, cocok untuk liburan atau menenangkan diri.' },
    { id: 'LOC006', name: 'Taman Jalan Setapak', icon: '🥾', category: 'wisata', tag: '🥾 Jalur Trekking', lat: -7.300170, lng: 112.671744, desc: 'Spot wisata di Hutan UNESA yang cocok untuk berjalan santai atau jogging, nyaman didatangi bahkan saat malam hari dengan lampu hias taman.' },
    { id: 'LOC007', name: 'Penangkaran Hewan', icon: '🦌', category: 'fauna', tag: '🦌 Penangkaran Satwa', lat: -7.300416, lng: 112.670883, desc: 'Tempat kandang rusa totol dan iguana berada di kawasan Hutan UNESA.' },
    { id: 'LOC008', name: 'Kandang Rusa', icon: '🦌', category: 'fauna', tag: '🦌 Kandang Rusa Utama', lat: -7.300756, lng: 112.670951, desc: 'Tempat pengunjung melihat rusa di kawasan konservasi Hutan UNESA.' },
    { id: 'LOC009', name: 'Danau Kecil Unesa', icon: '⛵', category: 'wisata', tag: '⛵ Danau Alami', lat: -7.300828, lng: 112.670299, desc: 'Danau kecil alami penyejuk ekosistem Hutan UNESA.' },
    { id: 'LOC010', name: 'zona Merak', icon: '🦚', category: 'fauna', tag: '🦚 Konservasi Burung Merak', lat: -7.300464, lng: 112.670441, desc: 'Tempat merak bersantai dan pengunjung dapat melihatnya dengan nyaman.' },
    { id: 'LOC011', name: 'Tugu Taman', icon: '🗿', category: 'wisata', tag: '🗿 Landmark Taman', lat: -7.300793, lng: 112.671071, desc: 'Tugu yang menyambut semua orang dan bisa dijadikan spot foto-foto.' },
    { id: 'LOC012', name: 'zona Angsa & Bebek', icon: '🦢', category: 'fauna', tag: '🦢 Satwa Unggas Air', lat: -7.300517, lng: 112.670652, desc: 'Tempat melihat bebek dan angsa. Jangan diberi makan sembarangan ya!' },
    { id: 'LOC013', name: 'Zona Bugar', icon: '🏃', category: 'fasilitas', tag: '🏃 Area Olahraga', lat: -7.300548, lng: 112.670248, desc: 'Fasilitas umum untuk berolahraga oleh pengunjung dengan banyak alat olahraga tersedia.' },
    { id: 'LOC014', name: 'Zona Merpati', icon: '🕊️', category: 'fauna', tag: '🕊️ Kawanan Merpati', lat: -7.300471, lng: 112.670307, desc: 'Tempat pengunjung melihat kawanan merpati di kawasan Hutan UNESA.' },
    { id: 'LOC015', name: 'TPST', icon: '♻️', category: 'fasilitas', tag: '♻️ Pengolahan Sampah', lat: -7.302821, lng: 112.668399, desc: 'Tempat Pembuangan Sampah Terpadu untuk pengolahan limbah ramah lingkungan.' },
    { id: 'LOC016', name: 'Toilet Shelter Hutan & Danau', icon: '🚻', category: 'toilet', tag: '🚻 Fasilitas Sanitasi', lat: -7.3018, lng: 112.6726, desc: 'Fasilitas toilet umum dekat shelter hutan dan danau.' },
    { id: 'LOC017', name: 'Toilet Gedung Rektorat', icon: '🚻', category: 'toilet', tag: '🚻 Fasilitas Sanitasi', lat: -7.3005, lng: 112.6726, desc: 'Fasilitas toilet di gedung rektorat UNESA.' },
    { id: 'LOC018', name: 'Toilet Koridor Arboretum', icon: '🚻', category: 'toilet', tag: '🚻 Fasilitas Sanitasi', lat: -7.3028, lng: 112.6738, desc: 'Toilet koridor jalur hijau arboretum hutan kampus.' },
    { id: 'LOC019', name: 'Toilet Gelora UNESA Barat', icon: '🚻', category: 'toilet', tag: '🚻 Fasilitas Sanitasi', lat: -7.2988, lng: 112.6720, desc: 'Toilet di area kompleks Gelora UNESA Barat.' },
    { id: 'LOC020', name: 'Masjid al-hikmah', icon: '🕌', category: 'musholla', tag: '🕌 Masjid FBS UNESA', lat: -7.302139, lng: 112.669196, desc: 'Fasilitas umum masjid ibadah di kawasan FBS UNESA.' },
    { id: 'LOC021', name: 'Kantin FBS', icon: '🍽️', category: 'fasilitas', tag: '🍽️ Kantin FBS', lat: -7.302060, lng: 112.669011, desc: 'Fasilitas umum kantin di kawasan FBS UNESA.' },
    { id: 'LOC022', name: 'Mushola FIP', icon: '🕌', category: 'musholla', tag: '🕌 Mushola FIP/FIB', lat: -7.301643, lng: 112.670476, desc: 'Fasilitas umum mushola di kawasan FIP/FIB UNESA.' },
    { id: 'LOC023', name: 'Kantin FIP', icon: '🍽️', category: 'fasilitas', tag: '🍽️ Kantin FIP/FIB', lat: -7.301813, lng: 112.670420, desc: 'Fasilitas umum kantin di kawasan FIP/FIB UNESA.' },
    { id: 'LOC024', name: 'Parkiran Tingkat', icon: '🅿️', category: 'parkiran', tag: '🅿️ Parkiran FIKK UNESA', lat: -7.300674, lng: 112.668072, desc: 'Fasilitas umum area parkir bertingkat di kawasan FIKK UNESA.' },
    { id: 'LOC025', name: 'Pixora', icon: '🎨', category: 'wisata', tag: '🎨 Projek TRM (AI GAN)', lat: -7.300603, lng: 112.670254, desc: 'AI Pixora berbasis Generative Adversarial Networks (GAN) yang mengubah potret wajah secara instan ke berbagai gaya artistik.' },
    { id: 'LOC026', name: 'BIOVA', icon: '🔬', category: 'wisata', tag: '🔬 Projek TRM', lat: -7.300958, lng: 112.670983, desc: 'Stan projek TRM BIOVA di kawasan Hutan UNESA.' },
    { id: 'LOC027', name: 'Wildex', icon: '🦊', category: 'wisata', tag: '🦊 Projek TRM (Wildex)', lat: -7.300992, lng: 112.670338, desc: 'WILDEX (Wild Index): aplikasi pembelajaran interaktif berbasis Object Detection & Image Segmentation untuk eksplorasi sistem respiratori 8 satwa UNESA.' },
    { id: 'LOC028', name: 'BioSphere', icon: '🌡️', category: 'wisata', tag: '🌡️ Projek TRM (IoT)', lat: -7.300995, lng: 112.671087, desc: 'Sistem pemantauan lingkungan berbasis IoT untuk suhu, kelembapan, dan pH air kolam di Hutan UNESA guna deteksi dini kualitas air & risiko kebakaran.' },
    { id: 'LOC029', name: 'Animora', icon: '📱', category: 'wisata', tag: '📱 Projek TRM (AR 3D)', lat: -7.300395, lng: 112.670696, desc: 'Media pembelajaran interaktif berbasis Augmented Reality (AR) 3D hewan dengan kuis, poin pembuka koleksi, dan leaderboard.' },
    { id: 'LOC030', name: 'SmartPark Vision: Real-Time Visitor & Activity Monitoring Hutan Kota Unesa', icon: '📹', category: 'wisata', tag: '📹 Projek TRM (YOLOv8)', lat: -7.3000963, lng: 112.671238, desc: 'Sistem pemantauan kepadatan pengunjung dan pola aktivitas (YOLOv8 + Flask) di Working Space, Gazebo, Kebun Binatang Mini, dan Taman Kebugaran dengan log otomatis ke Google Sheets.' }
  ]
};
