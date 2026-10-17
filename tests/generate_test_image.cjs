const fs = require('fs');
const path = require('path');
const bmp = require('bmp-js');

// Simple 5x7 bitmap font for ASCII characters
const FONT = {
  ' ': [0, 0, 0, 0, 0],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  'A': [0x7e, 0x11, 0x11, 0x11, 0x7e],
  'B': [0x7f, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3e, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7f, 0x41, 0x41, 0x22, 0x1c],
  'E': [0x7f, 0x49, 0x49, 0x49, 0x41],
  'G': [0x3e, 0x41, 0x49, 0x49, 0x7a],
  'I': [0x00, 0x41, 0x7f, 0x41, 0x00],
  'K': [0x7f, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7f, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  'N': [0x7f, 0x04, 0x08, 0x10, 0x7f],
  'O': [0x3e, 0x41, 0x41, 0x41, 0x3e],
  'P': [0x7f, 0x09, 0x09, 0x09, 0x06],
  'R': [0x7f, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7f, 0x01, 0x01],
  'U': [0x3f, 0x40, 0x40, 0x40, 0x3f],
  'W': [0x7f, 0x20, 0x18, 0x20, 0x7f],
};

function createScheduleBmp() {
  const scale = 3;
  const width = 600;
  const height = 180;
  const buffer = Buffer.alloc(width * height * 4);

  // Fill with pure white background (ABGR)
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;     // B
    buffer[i + 1] = 255; // G
    buffer[i + 2] = 255; // R
    buffer[i + 3] = 255; // A
  }

  function drawChar(char, startX, startY) {
    const glyph = FONT[char.toUpperCase()] || FONT[' '];
    for (let col = 0; col < 5; col++) {
      const colBits = glyph[col];
      for (let row = 0; row < 7; row++) {
        if ((colBits >> row) & 1) {
          // Draw scaled pixel (black)
          for (let dx = 0; dx < scale; dx++) {
            for (let dy = 0; dy < scale; dy++) {
              const x = startX + col * scale + dx;
              const y = startY + row * scale + dy;
              if (x < width && y < height) {
                const idx = (y * width + x) * 4;
                buffer[idx] = 0;     // B
                buffer[idx + 1] = 0; // G
                buffer[idx + 2] = 0; // R
                buffer[idx + 3] = 255;
              }
            }
          }
        }
      }
    }
  }

  function drawText(text, x, y) {
    let curX = x;
    for (let c of text) {
      drawChar(c, curX, y);
      curX += 6 * scale;
    }
  }

  drawText("1. PEMROGRAMAN WEB", 30, 30);
  drawText("SENIN 08:00 - 10:30 3 SKS", 30, 75);
  drawText("RUANG LAB-1 DOSEN: BUDI", 30, 120);

  const rawData = {
    data: buffer,
    width,
    height,
  };
  return bmp.encode(rawData).data;
}

const bmpData = createScheduleBmp();
const testBmpPath = path.join(__dirname, 'test_schedule.bmp');
fs.writeFileSync(testBmpPath, bmpData);
console.log('Generated test BMP at', testBmpPath, 'size:', bmpData.length);
