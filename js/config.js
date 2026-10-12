/* ============================================================
 * config.js  -  Static settings: company, routes, fares, seat layout
 * Edit this file to change the route list, default fares, PIN,
 * or the vessel seat layout. Nothing here touches the DOM.
 * ============================================================ */
window.G7 = window.G7 || {};

(function () {
  const COLS = 8; // every deck row is laid out on an 8-column grid

  // Helpers for describing a seat layout
  const L = (label, span) => ({ label, span: span || 1 }); // non-seat label block
  const _ = null; // empty grid cell

  // Pads a row with empty cells so it always fills COLS columns
  function pad(row) {
    let used = 0;
    row.forEach(c => (used += c && typeof c === 'object' ? c.span : 1));
    if (used > COLS) throw new Error('Seat layout row wider than ' + COLS + ' columns: ' + JSON.stringify(row));
    const out = row.slice();
    for (; used < COLS; used++) out.push(null);
    return out;
  }

  const sections = [
    {
      id: 'front',
      name: 'Front Accommodation',
      rows: [
        [_, _, _, L('Emergency Exit', 2)],
        [1, 2, 3, _, _, 4, 5, 6],
        [7, 8, 9, 10, _, 11, 12, 13],
        [14, 15, 16, 17, _, 18, 19, 20],
        [21, 22, 23, 24, _, 25, 26, 27],
        [28, 29, 30, 31, _, 32, 33, 34],
        [35, 36, 37, 38, _, 39, 40, 41],
        [L('Comfort Room'), _, 42, 43, _, _, _, 44],
      ],
    },
    {
      id: 'mid',
      name: 'Mid Section',
      rows: [
        [L('Pilot House', 4)],
        [45, 46, 47, 48, 49, 50],
        [L('Port Side Entrance / Exit', 4), L('Starboard Entrance / Exit', 4)],
        [51, 52, 53, _, 54],
      ],
    },
    {
      id: 'aft',
      name: 'Aft Accommodation',
      rows: [
        [55, 56, 57, _, L('Comfort Room', 4)],
        [58, 59, 60, _, 61, 62, 63, 64],
        [65, 66, 67, _, 68, 69, 70, 71],
        [72, 73, 74, _, 75, 76, 77, 78],
        [79, 80, 81, _, 82, 83, 84, 85],
        [_, 86, 87, _, 88, _, _, 89],
      ],
    },
    {
      id: 'upper',
      name: 'Upper Accommodation',
      rows: [
        [95, 94, 93, _, _, 92, 91, 90],
        [96, 97, 98, _, _, 99, 100, 101],
        [102, 103, 104, _, _, 105, 106, 107],
        [108, 109, 110, _, 111, 112, 113, 114],
        [L('Emergency Exit', 3), 115, 116, 117, 118, 119],
      ],
    },
  ];
  sections.forEach(s => (s.rows = s.rows.map(pad)));
  // "AISLE" marker shown in the seat plan: grid column and the rows it spans (1-based)
  const sec = id => sections.find(s => s.id === id);
  sec('front').aisle = { col: 5, from: 2, to: 7 };
  sec('aft').aisle = { col: 4, from: 2, to: 6 };
  sec('upper').aisle = { col: 4, from: 1, to: 4 };

  G7.config = {
    company: 'G7 Marine Transport',
    vessel: 'MV Group 7 / MV G7 FastCraft',
    currency: '₱',
    adminPin: '1234', // CHANGE THIS. Client-side only, not real security (see README).
    maxPassengersPerBooking: 10,
    advanceBookingDays: 90,
    bookingCutoffMinutes: 60, // online booking closes this many minutes before departure
    travelTime: 'Approx. 2 to 3 hours',

    // Shown in the booking sidebar ("Important Reminders")
    reminders: [
      'Schedules may vary by day and weather.',
      'Ensure all passenger details are correct.',
      'Present valid IDs for discounted fares (Student and Senior/PWD).',
      'Infants ride on an adult\'s lap.',
    ],

    // Shown at the bottom of every ticket (edit to match your real policies)
    ticketNotes: [
      'Please be at the port at least 1 hour before departure.',
      'Present this ticket or your booking reference at the ticket counter.',
      'Schedules may change due to weather conditions.',
      'Unpaid bookings may be released per company policy.',
    ],

    idTypes: ['Driver\'s License', 'Passport', 'UMID', 'PhilSys National ID', 'Student ID', 'Senior Citizen ID', 'PWD ID', 'Postal ID', 'Voter\'s ID', 'PRC ID', 'Other government-issued ID'],

    // Text for the Travel Advisory bar and its "View Advisory" popup (edit freely)
    advisory: {
      summary: 'Please check the latest announcements, travel requirements, and schedule updates before booking your trip.',
      items: [
        'Sailing schedules may change because of weather and sea conditions.',
        'Student and Senior/PWD fares require a valid ID at boarding.',
        'Infants ride on an adult\'s lap and must be booked with an adult.',
      ],
    },

    // Shown in the landing page footer / contact section. Leave '' to hide a line.
    contact: {
      phone: '',
      email: '',
      facebook: '',
      messenger: '',
      youtube: '',
    },

    // About Us paragraph. Leave '' to use the default wording built from the vessel and ports.
    about: '',

    // Footer legal links appear only when you fill in the text (blank paragraphs separate with an empty line).
    legal: {
      terms: '',
      privacy: '',
      faq: '',
    },

    ports: {
      TILIK: { name: 'Tilik Port', area: 'Lubang Island, Occidental Mindoro' },
      NASUGBU: { name: 'Wawa Port', area: 'Nasugbu, Batangas' },
    },

    // Default departure times. Schedules can vary by day/weather,
    // so the Ticket Office can override a single trip's time or cancel it.
    routes: [
      { id: 'TILIK-NASUGBU', from: 'TILIK', to: 'NASUGBU', departs: '07:00' },
      { id: 'NASUGBU-TILIK', from: 'NASUGBU', to: 'TILIK', departs: '10:00' },
    ],

    // Default fares (editable in Ticket Office -> Fares)
    fares: {
      regular: { label: 'Regular', price: 780, seat: true, note: '' },
      student: { label: 'Student', price: 670, seat: true, note: 'Valid student ID required at boarding' },
      senior_pwd: { label: 'Senior / PWD', price: 650, seat: true, note: 'Valid Senior/PWD ID required at boarding' },
      child: { label: 'Child', price: 500, seat: true, note: 'Age range per company policy' },
      infant: { label: 'Infant', price: 200, seat: false, note: 'Rides on an adult\'s lap, no seat assigned' },
    },
    fareOrder: ['regular', 'student', 'senior_pwd', 'child', 'infant'],

    // Seats that are permanently out of service (wrench icons in the seat plan)
    outOfService: [86, 87, 88, 89],

    paymentMethods: {
      cash: 'Pay at ticket counter (cash)',
      gcash: 'GCash',
      bank: 'Bank transfer',
    },

    sections,
  };
})();
