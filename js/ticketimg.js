/* ============================================================
 * ticketimg.js  -  Saves a booking confirmation as a PNG / JPG
 * Drawn directly on a <canvas> (no libraries, works offline and
 * from file://). Uses the inline logo in logo-data.js.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.ticketImg = (function () {
  const { u, config, trips, store } = G7;

  const NAVY = '#0a2f7a', INK = '#0c1f4a', MUTED = '#5b6a82', LINE = '#e3eaf4', GOLD = '#e8a33a';
  const FONT = '"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  const W = 1080, PAD = 56, SCALE = 2;

  function loadLogo() {
    return new Promise(res => {
      if (!G7.logoData) return res(null);
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = G7.logoData;
    });
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function text(c, s, x, y, o) {
    o = o || {};
    c.font = (o.weight || 400) + ' ' + (o.size || 24) + 'px ' + FONT;
    c.fillStyle = o.color || INK; c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
    c.fillText(s, x, y);
  }
  function fit(c, s, maxW) { // trims with an ellipsis so long names never overflow
    if (c.measureText(s).width <= maxW) return s;
    while (s.length > 1 && c.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function chip(c, label, x, y, bg, fg) { // returns the chip width
    c.font = '700 22px ' + FONT; const w = c.measureText(label).width + 36;
    rr(c, x, y, w, 40, 20); c.fillStyle = bg; c.fill();
    text(c, label, x + 18, y + 28, { weight: 700, size: 22, color: fg });
    return w;
  }

  function build(b, logo) {
    const trip = trips.byId(b.tripId) || trips.get(b.date, b.routeId);
    const r = trip.route, from = config.ports[r.from], to = config.ports[r.to];
    const pst = b.payment.status, paid = pst === 'paid', refunded = pst === 'refunded', cancelled = b.status === 'cancelled';
    const payLabel = config.paymentMethods[b.payment.method] || b.payment.method;
    const pax = b.passengers;
    const ROW = 52;
    const H = 1070 + pax.length * ROW;

    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const c = cv.getContext('2d'); c.scale(SCALE, SCALE);

    // page + card
    c.fillStyle = '#eef3fa'; c.fillRect(0, 0, W, H);
    rr(c, 24, 24, W - 48, H - 48, 28); c.fillStyle = '#fff'; c.fill();
    c.save(); rr(c, 24, 24, W - 48, H - 48, 28); c.clip();

    // header band
    let y = 24;
    const hg = c.createLinearGradient(0, y, W, y); hg.addColorStop(0, '#0a2f7a'); hg.addColorStop(1, '#0d4a9e');
    c.fillStyle = hg; c.fillRect(24, y, W - 48, 150);
    c.fillStyle = GOLD; c.fillRect(24, y + 150, W - 48, 6);
    if (logo) { const lh = 112, lw = lh * logo.width / logo.height; c.drawImage(logo, PAD, y + 19, lw, lh); }
    const tx = PAD + 140;
    text(c, config.company, tx, y + 68, { weight: 800, size: 36, color: '#fff' });
    text(c, 'BOOKING CONFIRMATION', tx, y + 108, { weight: 600, size: 22, color: '#cfe0fa' });
    c.restore();

    // reference + amount
    y = 24 + 156 + 44;
    text(c, 'BOOKING REFERENCE', PAD, y, { weight: 700, size: 20, color: MUTED });
    text(c, b.ref, PAD, y + 62, { weight: 800, size: 60, color: NAVY });
    text(c, 'TOTAL AMOUNT', W - PAD, y, { weight: 700, size: 20, color: MUTED, align: 'right' });
    text(c, u.money(b.total), W - PAD, y + 62, { weight: 800, size: 60, color: INK, align: 'right' });

    // status chips
    y += 96;
    let x = PAD;
    x += chip(c, cancelled ? 'Cancelled' : 'Confirmed', x, y, cancelled ? '#f8dcd8' : '#dff3e7', cancelled ? '#a3281c' : '#12703f') + 12;
    x += chip(c, paid ? 'Paid' : refunded ? 'Refunded' : 'Unpaid', x, y, paid ? '#dff3e7' : refunded ? '#e6dbfb' : '#fdf0d2', paid ? '#12703f' : refunded ? '#5b3fa8' : '#b86a05') + 12;
    c.font = '600 24px ' + FONT;
    text(c, 'Payment: ' + payLabel, x + 6, y + 29, { weight: 600, size: 24, color: INK });

    // trip box
    y += 78;
    rr(c, PAD, y, W - PAD * 2, 190, 20); c.fillStyle = '#f3f7fd'; c.fill();
    const colW = (W - PAD * 2 - 40) / 2;
    text(c, 'FROM', PAD + 28, y + 40, { weight: 700, size: 18, color: MUTED });
    text(c, from.name, PAD + 28, y + 78, { weight: 800, size: 34 });
    text(c, from.area, PAD + 28, y + 108, { size: 21, color: MUTED });
    text(c, '→', PAD + colW - 10, y + 76, { weight: 700, size: 36, color: NAVY, align: 'center' });
    text(c, 'TO', PAD + colW + 20, y + 40, { weight: 700, size: 18, color: MUTED });
    text(c, to.name, PAD + colW + 20, y + 78, { weight: 800, size: 34 });
    text(c, to.area, PAD + colW + 20, y + 108, { size: 21, color: MUTED });
    c.fillStyle = LINE; c.fillRect(PAD + 28, y + 128, W - PAD * 2 - 56, 2);
    text(c, 'DEPARTURE', PAD + 28, y + 158, { weight: 700, size: 18, color: MUTED });
    text(c, u.fmtDate(trip.date) + ' · ' + u.fmtTime(trip.departs), PAD + 175, y + 160, { weight: 700, size: 24 });
    text(c, config.vessel, W - PAD - 28, y + 160, { size: 21, color: MUTED, align: 'right' });

    // passengers
    y += 190 + 44;
    text(c, 'PASSENGERS', PAD, y, { weight: 700, size: 20, color: MUTED });
    y += 18;
    rr(c, PAD, y, W - PAD * 2, 48, 10); c.fillStyle = '#eef3fb'; c.fill();
    const cx = [PAD + 20, PAD + 80, PAD + 520, PAD + 700];
    text(c, '#', cx[0], y + 31, { weight: 700, size: 19, color: '#3b4a62' });
    text(c, 'NAME', cx[1], y + 31, { weight: 700, size: 19, color: '#3b4a62' });
    text(c, 'FARE', cx[2], y + 31, { weight: 700, size: 19, color: '#3b4a62' });
    text(c, 'SEAT', cx[3], y + 31, { weight: 700, size: 19, color: '#3b4a62' });
    text(c, 'AMOUNT', W - PAD - 20, y + 31, { weight: 700, size: 19, color: '#3b4a62', align: 'right' });
    y += 48;
    pax.forEach((p, i) => {
      c.font = '600 24px ' + FONT;
      text(c, String(i + 1), cx[0], y + 34, { size: 23, color: MUTED });
      c.font = '600 24px ' + FONT; text(c, fit(c, p.name || '-', 450), cx[1], y + 34, { weight: 600, size: 24 });
      c.font = '400 23px ' + FONT; text(c, fit(c, p.fareLabel || p.fareType, 200), cx[2], y + 34, { size: 23, color: '#3b4a62' });
      text(c, p.seat ? String(p.seat) : 'Lap infant', cx[3], y + 34, { size: 23, color: '#3b4a62' });
      text(c, u.money(p.fare), W - PAD - 20, y + 34, { weight: 600, size: 23, align: 'right' });
      y += ROW; c.fillStyle = LINE; c.fillRect(PAD, y - 1, W - PAD * 2, 1);
    });
    text(c, 'Total Amount', W - PAD - 220, y + 46, { weight: 700, size: 24, align: 'right' });
    text(c, u.money(b.total), W - PAD - 20, y + 46, { weight: 800, size: 28, color: NAVY, align: 'right' });

    // notes
    y += 90;
    const notes = (config.ticketNotes || []).slice(0, 4);
    rr(c, PAD, y, W - PAD * 2, 40 + notes.length * 34, 16); c.fillStyle = '#fff8e8'; c.fill();
    notes.forEach((n, i) => { c.font = '400 21px ' + FONT; text(c, '•  ' + fit(c, n, W - PAD * 2 - 70), PAD + 26, y + 36 + i * 34, { size: 21, color: '#5a4a1c' }); });
    y += 40 + notes.length * 34;

    // footer
    text(c, 'Booked on ' + new Date(b.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), W / 2, H - 52, { size: 20, color: MUTED, align: 'center' });

    if (cancelled) {
      c.save(); c.translate(W / 2, H / 2); c.rotate(-0.35); c.globalAlpha = .18;
      text(c, 'CANCELLED', 0, 0, { weight: 800, size: 160, color: '#c0192e', align: 'center' }); c.restore();
    }
    return cv;
  }

  // type: 'png' | 'jpg'
  async function save(b, type) {
    try {
      const logo = await loadLogo();
      const cv = build(b, logo);
      const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
      cv.toBlob(blob => {
        if (!blob) return u.toast('Could not create the image.', 'err');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'G7-Booking-' + b.ref + '.' + (type === 'jpg' ? 'jpg' : 'png');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        u.toast('Saved ' + a.download, 'ok');
      }, mime, 0.92);
    } catch (e) { console.error('[ticketimg]', e); u.toast('Could not create the image.', 'err'); }
  }

  // ---------------------------------------------------------------
  // Official receipt / refund voucher (narrow, thermal-receipt style)
  // kind: 'payment' | 'refund'
  // ---------------------------------------------------------------
  function buildReceipt(b, kind, logo) {
    const p = b.payment, isRefund = kind === 'refund';
    const trip = trips.byId(b.tripId) || trips.get(b.date, b.routeId), r = trip.route;
    const RW = 760, RP = 48, SC = 2;
    const rf = p.refund || {};
    const lines = [];                       // [label, value, bold?]
    const when = iso => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
    if (!isRefund) {
      lines.push(['Receipt No.', p.receiptNo || '-', true], ['Date & time', p.paidAt ? when(p.paidAt) : '-']);
    } else {
      lines.push(['Refund No.', rf.refundNo || '-', true], ['Date & time', rf.at ? when(rf.at) : '-']);
    }
    lines.push(['Booking ref', b.ref, true], ['Customer', (b.contact && b.contact.name) || '-'],
      ['Trip', config.ports[r.from].name + ' → ' + config.ports[r.to].name],
      ['Departure', u.fmtDate(trip.date) + ' · ' + u.fmtTime(trip.departs)],
      ['Passengers', b.passengers.length + (b.passengers.length > 1 ? ' persons' : ' person')]);
    const money = [];
    if (!isRefund) {
      money.push(['Amount due', u.money(b.total)]);
      if (p.method === 'cash') money.push(['Cash received', u.money(p.amountReceived || b.total)], ['Change', u.money(p.change || 0)]);
      else money.push(['Payment', G7.pay.methodLabel(p.method)], ['Reference no.', p.reference || '-']);
      if (p.method === 'cash') money.unshift(['Payment', 'Cash']);
    } else {
      money.push(['Amount paid', u.money(b.total)], ['Refund method', G7.pay.methodLabel(rf.method)]);
      if (rf.reference) money.push(['Reference no.', rf.reference]);
      money.push(['Reason', rf.reason || '-']);
    }
    const staff = isRefund ? rf.byName : p.receivedByName;
    const H = 300 + lines.length * 46 + money.length * 46 + 200;
    const cv = document.createElement('canvas'); cv.width = RW * SC; cv.height = H * SC;
    const c = cv.getContext('2d'); c.scale(SC, SC);
    c.fillStyle = '#fff'; c.fillRect(0, 0, RW, H);
    // header
    let y = 40;
    if (logo) { const lh = 96, lw = lh * logo.width / logo.height; c.drawImage(logo, RW / 2 - lw / 2, y, lw, lh); y += lh + 14; }
    text(c, config.company, RW / 2, y + 26, { weight: 800, size: 30, color: NAVY, align: 'center' });
    text(c, isRefund ? 'REFUND VOUCHER' : 'OFFICIAL RECEIPT', RW / 2, y + 62, { weight: 700, size: 22, color: isRefund ? '#7b3fb8' : MUTED, align: 'center' });
    y += 86;
    const dash = yy => { c.strokeStyle = '#b9c4d6'; c.setLineDash([8, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(RP, yy); c.lineTo(RW - RP, yy); c.stroke(); c.setLineDash([]); };
    dash(y); y += 14;
    const row = (l, v, bold) => { text(c, l, RP, y + 30, { size: 21, color: MUTED }); c.font = (bold ? 700 : 500) + ' 23px ' + FONT; text(c, fit(c, String(v), RW - RP * 2 - 200), RW - RP, y + 30, { weight: bold ? 700 : 500, size: 23, align: 'right' }); y += 46; };
    lines.forEach(l => row(l[0], l[1], l[2]));
    y += 4; dash(y); y += 14;
    money.forEach(m => row(m[0], m[1], false));
    y += 4; dash(y); y += 20;
    // big amount
    const amt = isRefund ? rf.amount : b.total;
    text(c, isRefund ? 'AMOUNT REFUNDED' : 'AMOUNT PAID', RW / 2, y + 22, { weight: 700, size: 20, color: MUTED, align: 'center' });
    text(c, u.money(amt), RW / 2, y + 86, { weight: 800, size: 64, color: isRefund ? '#7b3fb8' : '#12703f', align: 'center' });
    y += 120;
    text(c, (isRefund ? 'Refunded by: ' : 'Received by: ') + (staff || '-'), RW / 2, y + 22, { size: 21, color: '#3b4a62', align: 'center' });
    text(c, 'Thank you for traveling with ' + config.company + '.', RW / 2, y + 58, { size: 20, color: MUTED, align: 'center' });
    // outer border
    c.strokeStyle = LINE; c.lineWidth = 4; c.strokeRect(2, 2, RW - 4, H - 4);
    return cv;
  }

  function download(cv, name, type) {
    const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
    cv.toBlob(blob => {
      if (!blob) return u.toast('Could not create the image.', 'err');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name + '.' + (type === 'jpg' ? 'jpg' : 'png');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      u.toast('Saved ' + a.download, 'ok');
    }, mime, 0.92);
  }

  async function saveReceipt(b, kind, type) {
    try {
      const cv = buildReceipt(b, kind, await loadLogo());
      const no = kind === 'refund' ? (b.payment.refund || {}).refundNo : b.payment.receiptNo;
      download(cv, (kind === 'refund' ? 'G7-Refund-' : 'G7-Receipt-') + (no || b.ref), type);
    } catch (e) { console.error('[ticketimg]', e); u.toast('Could not create the receipt.', 'err'); }
  }

  // Prints the receipt through a hidden frame (no pop-up window needed)
  async function printReceipt(b, kind) {
    try {
      const cv = buildReceipt(b, kind, await loadLogo());
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(f);
      const d = f.contentWindow.document;
      d.open(); d.write('<!doctype html><title>Receipt</title><style>@page{margin:8mm}body{margin:0;text-align:center}img{width:100%;max-width:110mm}</style><img src="' + cv.toDataURL('image/png') + '">'); d.close();
      const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); };
      const im = d.querySelector('img'); im.complete ? go() : (im.onload = go);
    } catch (e) { console.error('[ticketimg]', e); u.toast('Could not print the receipt.', 'err'); }
  }

  return { save, build, buildReceipt, saveReceipt, printReceipt };
})();
