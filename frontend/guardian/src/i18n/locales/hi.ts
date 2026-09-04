// src/i18n/locales/hi.ts
// Hindi translations for Guardian Portal.
export default {
  brand: {
    title: 'आरक्षा',
    portal: 'अभिभावक पोर्टल',
    tagline: 'आरक्षा · सुगम पर्यटन · सुरक्षित यात्रा',
  },
  common: {
    language: 'भाषा',
    defaultTraveler: 'यात्री',
    loading: 'ट्रैकिंग डेटा लोड हो रहा है...',
  },
  notFound: {
    title: 'ट्रैकिंग लिंक नहीं मिला',
    desc: 'कृपया यात्री से वैध गार्जियन ट्रैकिंग लिंक साझा करने के लिए कहें।',
  },
  pin: {
    title: 'ट्रैकिंग पिन दर्ज करें',
    desc: 'यात्री ने इस लिंक के साथ आपसे 4 अंकों का पिन अलग से साझा किया है — लाइव ट्रैकिंग खोलने के लिए इसे दर्ज करें।',
    unlock: 'ट्रैकिंग अनलॉक करें',
    unlocking: 'अनलॉक हो रहा है...',
    placeholder: '••••',
  },
  error: {
    shareNewLink: 'कृपया यात्री से नया ट्रैकिंग लिंक साझा करने के लिए कहें।',
  },
  status: {
    safe: {
      headline: '{{name}} सुरक्षित हैं',
      sub: 'अंतिम चेक-इन प्राप्त हुआ',
      badge: 'सुरक्षित',
    },
    sos: {
      headline: '{{name}} को मदद की ज़रूरत है!',
      sub: 'आपातकालीन सेवाओं को सूचित कर दिया गया है',
      badge: 'आपातकालीन (SOS)',
    },
    assigned: {
      headline: '{{name}} के लिए मदद भेजी जा चुकी है',
      sub: 'बचाव दल को रवाना कर दिया गया है',
      badge: 'मदद रवाना',
    },
    warning: {
      headline: '{{name}} का चेक-इन बाकी है',
      sub: 'अगले चेक-इन की प्रतीक्षा है',
      badge: 'चेक-इन प्रतीक्षित',
    },
    noSignal: {
      headline: '{{name}} से कोई सिग्नल नहीं',
      sub: 'अंतिम ज्ञात स्थान नीचे दिखाया गया है',
      badge: 'सिग्नल नहीं',
    },
    confirmed: {
      headline: 'मदद {{name}} तक पहुँच गई है',
      sub: 'व्यक्तिगत रूप से पुष्टि की गई — स्थिति सामान्य की जा रही है',
      badge: 'पुष्टि हुई',
    },
  },
  sos: {
    category: 'श्रेणी: {{category}}',
    triggeredAt: 'अलर्ट समय: {{time}}',
  },
  assigned: {
    verifiedBy: '{{name}} द्वारा पुष्टि की गई',
    dispatched: '{{name}} को रवाना किया गया',
    defaultTeam: 'बचाव दल',
    volunteerPrefix: 'स्थानीय वालंटियर · ',
    confirmedAt: 'पुष्टि समय: {{time}}',
    confirmed: 'पुष्टि हुई',
    eta: 'अनुमानित समय ~{{eta}}',
    onTheWay: 'मार्ग में है',
    navigating: ' · 🧭 मार्ग पर बढ़ रहे हैं',
    delayedTitle: 'पहाड़ी इलाके के कारण समय लग सकता है — सहायता मार्ग में है।',
    delayedAction: 'अपडेट के लिए उन्हें संदेश भेजें।',
    rescuerCancelled: 'निर्धारित बचावकर्मी आगे नहीं बढ़ सके — प्रशासन द्वारा दूसरा बचाव दल भेजा जा रहा है।',
  },
  map: {
    recenter: 'यात्री के स्थान पर पुनः केंद्रित करें',
    openInMaps: 'मैप्स में खोलें',
    locationNotAvailable: 'स्थान उपलब्ध नहीं है',
    lastSeen: 'अंतिम देखा गया: {{time}}',
    livePosition: 'लाइव स्थिति',
    dispatchBase: 'डिस्पैच केंद्र',
  },
  cards: {
    lastSeen: 'अंतिम सक्रिय',
    battery: 'बैटरी',
    destination: 'गंतव्य',
    unknown: 'अज्ञात',
    tsi: 'यात्रा सुरक्षा सूचकांक (TSI)',
    medicalInfo: 'चिकित्सा विवरण',
    bloodGroup: 'रक्त समूह:',
    messageTraveler: '{{name}} को संदेश भेजें',
    autoRefresh: 'अपडेट: {{time}} · हर 30 सेकंड में स्वतः रीफ्रेश',
  },
  messages: {
    empty: 'अभी कोई संदेश नहीं — संदेश भेजें, यह सीधे उनके ऐप पर पहुंचेगा।',
    placeholder: 'संदेश लिखें…',
    send: 'भेजें',
    sender: {
      TOURIST: 'यात्री',
      GUARDIAN: 'आप',
      VOLUNTEER: 'बचावकर्मी',
      TEAM: 'बचाव दल',
    },
  },
  enums: {
    sosCategory: {
      MEDICAL: 'चिकित्सा',
      LOST: 'मार्ग भटके',
      TRAPPED: 'फंसे हुए',
      DISASTER: 'आपदा',
      MISSING: 'लापता',
      CRIME: 'अपराध',
      OTHER: 'अन्य',
    },
    tsiLabel: {
      LOW: 'कम जोखिम',
      MODERATE: 'मध्यम जोखिम',
      HIGH: 'उच्च जोखिम',
      EXTREME: 'अत्यधिक जोखिम',
    },
  },
}
