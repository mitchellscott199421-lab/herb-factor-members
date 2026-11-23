const sizes = require('./private/media/gallery/sizes.json');

const COPY = {
  '01': {
    alt: 'Two women holding the Ladbrokes Ultimate Driver winner cheque for $125,000 on the track at night.',
    caption: "The $125,000 winner's cheque.",
  },
  '02': {
    alt: 'The driver sitting in the sulky and waving, with supporters gathered behind.',
    caption: 'A wave from the sulky.',
  },
  '03': {
    alt: 'Presentation group in front of The Creek and Ladbrokes backdrop, with the trophies and the helmet trophy in a glass case.',
    caption: 'Trophies in front of The Creek backdrop.',
  },
  '04': {
    alt: 'The Herb Factor crew with the driver holding the $125,000 winner cheque, and a photographer in front.',
    caption: "The Herb Factor with the winner's cheque.",
  },
  '05': {
    alt: 'Draft day indoors, with The Herb Factor table, papers, a laptop and an interview under studio lights.',
    caption: 'Draft day.',
  },
  '06': {
    alt: 'The driver waving from the sulky after the win, the horse on the right and the crowd alongside.',
    caption: 'After the win, with the crowd.',
  },
  '07': {
    alt: 'The Herb Factor group with the helmet trophy in its glass case and the driver holding a trophy.',
    caption: "The helmet trophy and the driver's trophy.",
  },
  '08': {
    alt: 'The driver being interviewed in the sulky beside the horse, with the grandstand behind.',
    caption: 'A trackside interview.',
  },
  '09': {
    alt: 'The driver holding the championship helmet trophy in front of the Ladbrokes backdrop.',
    caption: 'The championship helmet trophy.',
  },
  '10': {
    alt: 'The Nutrien sales voucher being handed over on the presentation stage, with the trophies alongside.',
    caption: 'The Nutrien sales voucher.',
  },
  '11': {
    alt: 'The winning horse and driver on the track with the crowd and The Herb Factor banner at Albion Park.',
    caption: 'The Herb Factor banner on the track.',
  },
  '12': {
    alt: 'Supporters in a night-time group photo, wearing lanyards at Albion Park.',
    caption: 'Supporters on the night.',
  },
  '13': {
    alt: 'Presentation on the red carpet, with the television crew, the driver and the trophy.',
    caption: 'On the red carpet.',
  },
};

const ORDER = ['04', '06', '11', '01', '09', '03', '10', '07', '02', '08', '13', '05', '12'];
const EXPECTED = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];

function sameIds(ids) {
  return ids.slice().sort().join() === EXPECTED.join();
}

if (!sameIds(Object.keys(COPY)) || !sameIds(Object.keys(sizes)) || !sameIds(ORDER)) {
  throw new Error('Gallery ids must be photo 01 through 13, with copy, sizes, and order in sync');
}

function build(id) {
  const copy = COPY[id];
  const size = sizes[id];
  if (!size || !size.web || !size.thumb) {
    throw new Error(`Missing optimised size for gallery photo ${id}`);
  }
  return {
    id,
    alt: copy.alt,
    caption: copy.caption,
    feature: id === '04',
    web: {
      src: `/media/gallery/web/photo-${id}.jpg`,
      width: size.web.width,
      height: size.web.height,
    },
    thumb: {
      src: `/media/gallery/thumbs/photo-${id}.jpg`,
      width: size.thumb.width,
      height: size.thumb.height,
    },
  };
}

const photos = ORDER.map(build);
const byId = {};
for (const photo of photos) byId[photo.id] = photo;

module.exports = { photos, byId };
