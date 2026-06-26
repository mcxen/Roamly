/**
 * EXIF GPS Extraction Module
 * Extracts GPS coordinates (latitude, longitude) from image EXIF metadata.
 * Supports JPEG, HEIC, PNG, TIFF and other common formats.
 */
import fsp from 'fs/promises';
import fs from 'fs';
import exifReader from 'exif-reader';
import { logger } from './logger.js';

/**
 * Convert EXIF GPS coordinate format to decimal degrees.
 * EXIF stores GPS as degrees + minutes + seconds (rational numbers).
 *
 * @param {{}[]} coord - Array of [degrees, minutes, seconds] from exif-reader
 * @param {string} ref - GPS reference ('N'/'S' or 'E'/'W')
 * @returns {number|null}
 */
function gpsToDecimal(coord, ref) {
  if (!coord || coord.length < 3) return null;

  const degrees = coord[0] ?? 0;
  const minutes = coord[1] ?? 0;
  const seconds = coord[2] ?? 0;

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }

  return parseFloat(decimal.toFixed(6));
}

/**
 * Extract EXIF GPS data from a file buffer.
 *
 * @param {Buffer|string} source - File buffer or path to image file
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, timestamp: string|null, make: string|null, model: string|null, raw: object|null}>}
 */
export async function extractExifGps(source) {
  try {
    let buffer;

    if (Buffer.isBuffer(source)) {
      buffer = source;
    } else if (typeof source === 'string') {
      buffer = await fsp.readFile(source);
    } else {
      return emptyResult();
    }

    // Quick check: look for EXIF header in first 64KB
    const header = buffer.slice(0, 65536);
    const exifStart = findExifStart(header);

    if (!exifStart) {
      return emptyResult();
    }

    const exifData = exifReader(header.slice(exifStart));
    if (!exifData || !exifData.gps) {
      return emptyResult();
    }

    const gps = exifData.gps;
    const image = exifData.image || {};

    const latitude = gps.GPSLatitude
      ? gpsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef)
      : null;
    const longitude = gps.GPSLongitude
      ? gpsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef)
      : null;
    const altitude = gps.GPSAltitude ?? null;

    // Parse GPS timestamp
    let timestamp = null;
    if (gps.GPSDateStamp) {
      timestamp = gps.GPSDateStamp;
    }

    const make = image.Make || null;
    const model = image.Model || null;

    return {
      latitude,
      longitude,
      altitude: altitude ? parseFloat(altitude.toFixed(1)) : null,
      timestamp,
      make,
      model,
      raw: {
        ...(gps.GPSLatitude && { GPSLatitude: gps.GPSLatitude }),
        ...(gps.GPSLatitudeRef && { GPSLatitudeRef: gps.GPSLatitudeRef }),
        ...(gps.GPSLongitude && { GPSLongitude: gps.GPSLongitude }),
        ...(gps.GPSLongitudeRef && { GPSLongitudeRef: gps.GPSLongitudeRef }),
        ...(gps.GPSAltitude && { GPSAltitude: gps.GPSAltitude }),
        ...(gps.GPSDateStamp && { GPSDateStamp: gps.GPSDateStamp }),
      },
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to extract EXIF GPS data');
    return emptyResult();
  }
}

/**
 * Find the start of the EXIF data segment in a buffer.
 * EXIF starts with 'Exif\0\0' marker after the APP1 marker (0xFFE1).
 *
 * @param {Buffer} buffer
 * @returns {number|null}
 */
function findExifStart(buffer) {
  // Search for EXIF APP1 marker: FF E1 <size> Exif 00 00
  for (let i = 0; i < buffer.length - 10; i++) {
    if (
      buffer[i] === 0xff &&
      buffer[i + 1] === 0xe1 &&
      buffer[i + 4] === 0x45 && // 'E'
      buffer[i + 5] === 0x78 && // 'x'
      buffer[i + 6] === 0x69 && // 'i'
      buffer[i + 7] === 0x66 && // 'f'
      buffer[i + 8] === 0x00 &&
      buffer[i + 9] === 0x00
    ) {
      return i + 4; // Skip APP1 marker + size, return to 'Exif\0\0'
    }
  }

  // Also try searching for TIFF header within first 64KB
  for (let i = 0; i < buffer.length - 4; i++) {
    const mark = buffer.readUInt16BE(i);
    // TIFF byte order markers
    if (mark === 0x4949 || mark === 0x4d4d) {
      // Verify it looks like TIFF IFD
      const tag = buffer.readUInt16LE(i + 2);
      if (tag === 0x002a || tag === 0x2a00) {
        return i;
      }
    }
  }

  return null;
}

function emptyResult() {
  return {
    latitude: null,
    longitude: null,
    altitude: null,
    timestamp: null,
    make: null,
    model: null,
    raw: null,
  };
}

/**
 * Extract EXIF GPS from an uploaded file and return the geo metadata.
 * Designed to be called during the upload pipeline.
 *
 * @param {string} filePath - Path to the uploaded (temp) image file
 * @returns {Promise<{latitude: number|null, longitude: number|null, country_code: string|null}>}
 */
export async function extractGeoFromUpload(filePath) {
  const exif = await extractExifGps(filePath);

  if (exif.latitude != null && exif.longitude != null) {
    return {
      latitude: exif.latitude,
      longitude: exif.longitude,
      altitude: exif.altitude,
      timestamp: exif.timestamp,
      make: exif.make,
      model: exif.model,
      hasExif: true,
    };
  }

  return { latitude: null, longitude: null, hasExif: false };
}

/**
 * Re-extract EXIF from an existing map record.
 *
 * @param {string} imagePath - Path to the image file in storage
 * @returns {Promise<{latitude: number|null, longitude: number|null, hasExif: boolean}>}
 */
export async function reExtractExif(imagePath) {
  const exif = await extractExifGps(imagePath);

  return {
    latitude: exif.latitude,
    longitude: exif.longitude,
    altitude: exif.altitude,
    timestamp: exif.timestamp,
    make: exif.make,
    model: exif.model,
    hasExif: exif.latitude != null && exif.longitude != null,
  };
}
