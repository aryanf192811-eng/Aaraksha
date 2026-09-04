// src/i18n/locales/as.ts
// Assamese (অসমীয়া) translations for Guardian Portal.
export default {
  brand: {
    title: 'আৰক্ষা',
    portal: 'অভিভাৱক পৰ্টেল',
    tagline: 'আৰক্ষা · সুগম পৰ্যটন · সুৰক্ষিত যাত্ৰা',
  },
  common: {
    language: 'ভাষা',
    defaultTraveler: 'যাত্ৰী',
    loading: 'ট্ৰেকিং তথ্য লোড হৈ আছে...',
  },
  notFound: {
    title: 'ট্ৰেকিং লিংক পোৱা নগ’ল',
    desc: 'অনুগ্ৰহ কৰি যাত্ৰীজনক এটা বৈধ অভিভাৱক ট্ৰেকিং লিংক শ্বেয়াৰ কৰিবলৈ কওক।',
  },
  pin: {
    title: 'ট্ৰেকিং পিন (PIN) দিয়ক',
    desc: 'যাত্ৰীজনে এই লিংকটোৰ লগতে আপোনাক ৪টা সংখ্যাৰ পিন সুকীয়াকৈ দিছে — লাইভ ট্ৰেকিং চাবলৈ ইয়াক প্ৰবিষ্ট কৰক।',
    unlock: 'ট্ৰেকিং খোলক',
    unlocking: 'খোলা হৈ আছে...',
    placeholder: '••••',
  },
  error: {
    shareNewLink: 'অনুগ্ৰহ কৰি যাত্ৰীজনক এটা নতুন ট্ৰেকিং লিংক শ্বেয়াৰ কৰিবলৈ কওক।',
  },
  status: {
    safe: {
      headline: '{{name}} সুৰক্ষিত আছে',
      sub: 'শেহতীয়া চেক-ইন পোৱা গৈছে',
      badge: 'সুৰক্ষিত',
    },
    sos: {
      headline: '{{name}}ক জৰুৰী সহায়ৰ প্ৰয়োজন!',
      sub: 'জৰুৰীকালীন সেৱাক অৱগত কৰা হৈছে',
      badge: 'জৰুৰীকালীন (SOS)',
    },
    assigned: {
      headline: '{{name}}ৰ সহায়ৰ বাবে উদ্ধাৰকাৰী দল ওলাইছে',
      sub: 'এটা উদ্ধাৰকাৰী দল প্ৰেৰণ কৰা হৈছে',
      badge: 'সহায় প্ৰেৰিত',
    },
    warning: {
      headline: '{{name}}ৰ চেক-ইনৰ সময় হৈছে',
      sub: 'পৰৱৰ্তী চেক-ইনৰ বাবে অপেক্ষা কৰা হৈছে',
      badge: 'চেক-ইন প্ৰত্যাশিত',
    },
    noSignal: {
      headline: '{{name}}ৰ পৰা কোনো সংকেত (চিগনেল) নাই',
      sub: 'শেহতীয়া স্থান তলত দেখুওৱা হৈছে',
      badge: 'চিগনেল নাই',
    },
    confirmed: {
      headline: 'সহায় {{name}}ৰ ওচৰ পাইছেগৈ',
      sub: 'ব্যক্তিগতভাৱে নিশ্চিত কৰা হৈছে — ঘটনাৰ সমাপ্তি ঘটোৱা হৈছে',
      badge: 'নিশ্চিত',
    },
  },
  sos: {
    category: 'শ্ৰেণী: {{category}}',
    triggeredAt: 'সতৰ্কতাৰ সময়: {{time}}',
  },
  assigned: {
    verifiedBy: '{{name}}ৰ দ্বাৰা সত্যায়িত',
    dispatched: '{{name}}ক প্ৰেৰণ কৰা হৈছে',
    defaultTeam: 'উদ্ধাৰকাৰী দল',
    volunteerPrefix: 'স্থানীয় স্বেচ্ছাসেৱক · ',
    confirmedAt: 'নিশ্চিতকৰণৰ সময়: {{time}}',
    confirmed: 'নিশ্চিত',
    eta: 'আনুমানিক সময় ~{{eta}}',
    onTheWay: 'পথত আছে',
    navigating: ' · 🧭 যাত্ৰীৰ ফালে অগ্ৰসৰ',
    delayedTitle: 'পাহাৰীয়া এলেকাৰ বাবে পলম হ’ব পাৰে — উদ্ধাৰকাৰী দল আহি আছে।',
    delayedAction: 'খবৰ ল’বলৈ তেওঁলোকক বাৰ্তা প্ৰেৰণ কৰক।',
    rescuerCancelled: 'নিৰ্ধাৰিত উদ্ধাৰকাৰী আগবাঢ়িব নোৱাৰিলে — প্ৰশাসনে অন্য দল প্ৰেৰণ কৰিছে।',
  },
  map: {
    recenter: 'যাত্ৰীৰ স্থানত পুনৰ কেন্দ্ৰীভূত কৰক',
    openInMaps: 'মেপ্‌ছত খোলক',
    locationNotAvailable: 'স্থান উপলব্ধ নহয়',
    lastSeen: 'শেহতীয়াকৈ দেখা গৈছে: {{time}}',
    livePosition: 'সজীৱ (লাইভ) অৱস্থান',
    dispatchBase: 'প্ৰেৰণ কেন্দ্ৰ',
  },
  cards: {
    lastSeen: 'শেহতীয়া সক্ৰিয়তা',
    battery: 'বেটাৰী',
    destination: 'গন্তব্যস্থান',
    unknown: 'অজ্ঞাত',
    tsi: 'যাত্ৰা সুৰক্ষা সূচকাংক (TSI)',
    medicalInfo: 'চিকিৎসা তথ্য',
    bloodGroup: 'তেজৰ গ্ৰুপ:',
    messageTraveler: '{{name}}ক বাৰ্তা পঠিয়াওক',
    autoRefresh: 'আপডেট: {{time}} · প্ৰতি ৩০ ছেকেণ্ডত স্বয়ংক্ৰিয় সতেজ',
  },
  messages: {
    empty: 'এতিয়ালৈ কোনো বাৰ্তা নাই — এটা বাৰ্তা পঠিয়াওক, তেওঁলোকে তাৎক্ষণিকভাৱে পাব।',
    placeholder: 'এটা বাৰ্তা লিখক…',
    send: 'পঠিয়াওক',
    sender: {
      TOURIST: 'যাত্ৰী',
      GUARDIAN: 'আপুনি',
      VOLUNTEER: 'উদ্ধাৰকাৰী',
      TEAM: 'উদ্ধাৰকাৰী দল',
    },
  },
  enums: {
    sosCategory: {
      MEDICAL: 'চিকিৎসা',
      LOST: 'পথ হেৰুওৱা',
      TRAPPED: 'আৱদ্ধ',
      DISASTER: 'প্ৰাকৃতিক দুৰ্যোগ',
      MISSING: 'নিৰুদ্দেশ',
      CRIME: 'অপৰাধ',
      OTHER: 'অন্যান্য',
    },
    tsiLabel: {
      LOW: 'কম বিপদ',
      MODERATE: 'মধ্যমীয়া বিপদ',
      HIGH: 'উচ্চ বিপদ',
      EXTREME: 'চৰম বিপদ',
    },
  },
}
