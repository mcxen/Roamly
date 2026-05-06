import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const toolPath = process.env.APPLE_VISION_PATH || '/usr/local/bin/apple-vision';
const imagePath = process.argv[2];

const normalizeText = (input) => {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]/g, '')
    .trim();
};

const collectStrings = (value, output = []) => {
  if (typeof value === 'string') {
    const text = normalizeText(value);
    if (text) output.push(text);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const key of ['text', 'value', 'label', 'identifier', 'name', 'payloadStringValue']) {
      if (typeof value[key] === 'string') {
        const text = normalizeText(value[key]);
        if (text) output.push(text);
      }
    }
    for (const key of ['ocr', 'textObservations', 'texts', 'classification', 'classifications', 'labels', 'faces', 'barcodes', 'results']) {
      if (value[key]) collectStrings(value[key], output);
    }
  }
  return output;
};

if (!imagePath) {
  console.error('Usage: npm run vision -- /absolute/path/to/image.jpg');
  process.exit(2);
}

if (!fs.existsSync(toolPath)) {
  console.error(`apple-vision not found: ${toolPath}`);
  process.exit(2);
}

if (!fs.existsSync(imagePath)) {
  console.error(`image not found: ${imagePath}`);
  process.exit(2);
}

const { stdout } = await execFileAsync(toolPath, ['analyze', imagePath], {
  maxBuffer: 24 * 1024 * 1024,
  timeout: 120000
});

let parsed = null;
let normalizedText = '';
try {
  parsed = JSON.parse(stdout);
  normalizedText = normalizeText([...new Set(collectStrings(parsed))].join(' '));
} catch {
  normalizedText = normalizeText(
    [...new Set(String(stdout || '').split(/\r?\n/).map(normalizeText).filter(Boolean))].join(' ')
  );
}

console.log(JSON.stringify({
  ok: true,
  engine: 'apple-vision',
  image_path: imagePath,
  text: normalizedText,
  raw: parsed ?? stdout
}, null, 2));
