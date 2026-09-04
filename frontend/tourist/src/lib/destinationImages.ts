// src/lib/destinationImages.ts
// Curated HD photography per seeded NE India destination (backend/scripts/seed.js).
// Unsplash CDN — verified reachable; each photo matches the destination's real
// character (Kaziranga -> rhino, Cherrapunji -> waterfalls, Tawang -> monastery).
const DESTINATION_PHOTOS: Record<string, string> = {
  TAWANG:      '1691723815489-9d4cda571baf', // Buddhist monastery, snow peaks
  SHILLONG:    '1629465659213-d28388bc05ff', // misty green hills
  CHERRAPUNJI: '1620358594775-050d831306a3', // waterfalls between rocky cliffs
  SOHRA:       '1620358594775-050d831306a3',
  KAZIRANGA:   '1541414779316-956a5084c0d4', // one-horned rhino, grassland
  DZUKOU:      '1659809665546-f8b909e4d51f', // green valley meadow, clouds
  ZIRO:        '1551651437-f293403584ec',    // rice terraces
  LOKTAK:      '1784715595775-09dc6de0678c', // floating huts on lake
  PELLING:     '1616942986550-ea6469c08530', // snowy Himalayan village
  MAJULI:      '1758622354183-829e31592235', // river island at sunset
  LONGWA:      '1665043413574-422332646cce', // misty Nagaland hills
  IMPHAL:      '1672908158912-bdc33db841a6', // Imphal cityscape at night
  AIZAWL:      '1756149625066-e776f405bad0', // Aizawl hillside cityscape
  CHAMPHAI:    '1640529209198-0c56ce522607', // Champhai morning valley landscape
  GANGTOK:     '1748722873181-03b100cfd883', // Gangtok hillside town
  AGARTALA:    '1652926212113-33825c149cc8', // Agartala waterfront building
}

const FALLBACK_PHOTO = '1671404478922-a50366b728d0' // dramatic cloud-covered peaks

export function getDestinationImage(cityName: string | undefined | null, opts?: { w?: number; q?: number }): string {
  const w = opts?.w ?? 1200
  const q = opts?.q ?? 80
  const key = Object.keys(DESTINATION_PHOTOS).find(k =>
    (cityName || '').toUpperCase().includes(k)
  )
  const photoId = key ? DESTINATION_PHOTOS[key] : FALLBACK_PHOTO
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&q=${q}&auto=format&fit=crop`
}

// Additional REAL, individually-verified photo IDs per destination, beyond
// the single hero shot above -- for the destination detail page's photo
// gallery strip. Every id here was confirmed by actually opening the
// Unsplash photo page and checking its subject matches (see chatbot.md's
// provenance discipline: no id goes in unverified). Deliberately sparse
// rather than padded -- a destination with no verified extra photos here
// just shows its one hero shot, not a mismatched stock substitute.
const DESTINATION_GALLERY_EXTRA: Record<string, string[]> = {
  TAWANG: [
    '1776834831114-77b5616f09cb', // Tawang Monastery
    '1633728476110-9827024ed86b', // monks at Tawang Monastery
    '1781676863301-88596d2c481c', // golden Buddha statues, cloudy mountain sky
  ],
  SHILLONG: [
    '1565716665452-2a4e3445b378', // Umiam Lake, Shillong
    '1568657862118-98f96fb1f3b5', // Shillong street at night
    '1664175756882-a977ef952b94', // water surrounded by trees, Shillong
  ],
  CHERRAPUNJI: [
    '1735567065045-97ba386867ad', // Cherrapunji waterfall
    '1686472886489-1d2d7e08ff9c', // Cherrapunji waterfall, wide view
    '1742494267580-e026d3737f65', // living root bridge, Nongriat
  ],
  KAZIRANGA: [
    '1675296098616-53e3d4a1dd57', // one-horned rhino
    '1675296098308-f9f526c6b724', // rhinoceros in Kaziranga National Park
    '1637391783805-f1393be00fcf', // rhinoceros in muddy field, Kaziranga
  ],
  DZUKOU: [
    '1712055196088-9bc6da4ffbce', // Dzukou Valley grassy field
    '1712055196085-bf5fb4198259', // Dzukou Valley grassy field, wide view
    '1590415433359-851e8287150a', // camping in Dzukou Valley
  ],
  LOKTAK: [
    '1760637626688-a9fc45b672b3', // floating phumdi islands with huts
    '1674722612663-c34ad2c24648', // house on small island, Loktak Lake
    '1674722606403-51d785c416f6', // Loktak Lake
  ],
  PELLING: [
    '1724600453681-403504e5d3f6', // Sky Walk, Pelling
    '1724600457405-a7eeabcff6b5', // aerial view of Sky Walk statue, Pelling
    '1724600455438-7fb421057965', // Kanchenjunga waterfalls near Pelling
  ],
  MAJULI: [
    '1759738094899-b05622c5de7f', // Majuli river island
    '1759738093180-aa603b03fc7d', // Bihu dance, Majuli
    '1759738099669-d64b0656f6cf', // weaving fabric on loom, Majuli
  ],
  IMPHAL: [
    '1636988285188-6d9400c4f07f', // Imphal cityscape
    '1672908435871-66d1e03b9516', // Imphal at night
  ],
  AIZAWL: [
    '1744262254593-989e765a8fcb', // Aizawl aerial cityscape
    '1742489419728-a30421b6d94b', // Aizawl city in the mountains
  ],
  CHAMPHAI: [
    '1640529209437-1d61c4f82cce', // old building on hill, Champhai
    '1776601797829-90c169cfbf2e', // huts dotting agricultural fields, Champhai
  ],
  GANGTOK: [
    '1628837234647-b35db4740c85', // houses in Gangtok, Sikkim
    '1672740461276-7dc89382da34', // sunset over Gangtok, Sikkim
  ],
  AGARTALA: [
    '1651942365746-b1a70d76f952', // waterfront building, Agartala
    '1651942365033-1056f51a10ed', // Agartala building with water
  ],
}

export function getDestinationGallery(cityName: string | undefined | null, opts?: { w?: number; q?: number }): string[] {
  const w = opts?.w ?? 1000
  const q = opts?.q ?? 80
  const key = Object.keys(DESTINATION_PHOTOS).find(k =>
    (cityName || '').toUpperCase().includes(k)
  )
  const ids = [key ? DESTINATION_PHOTOS[key] : FALLBACK_PHOTO, ...(key ? DESTINATION_GALLERY_EXTRA[key] || [] : [])]
  return ids.map((id) => `https://images.unsplash.com/photo-${id}?w=${w}&q=${q}&auto=format&fit=crop`)
}

// Hero-grade banner photo — sharp snow-capped Himalayan range, used for the
// landing page hero and any full-bleed section not tied to one city.
// Verified reachable directly (not routed through getDestinationImage's
// fuzzy name match) since it's not standing in for any one destination.
export const HERO_PHOTO = 'https://images.unsplash.com/photo-1616942986550-ea6469c08530?w=1920&q=85&auto=format&fit=crop'
