import { CHINA_PREFECTURE_CITIES } from './china-prefecture-cities.js';

export const CITY_COORDINATES = [
  { country_code: 'CN', country_name: '中国', province: '北京', city: '北京', latitude: 39.9042, longitude: 116.4074 },
  { country_code: 'CN', country_name: '中国', province: '上海', city: '上海', latitude: 31.2304, longitude: 121.4737 },
  { country_code: 'CN', country_name: '中国', province: '广东', city: '广州', latitude: 23.1291, longitude: 113.2644 },
  { country_code: 'CN', country_name: '中国', province: '广东', city: '深圳', latitude: 22.5431, longitude: 114.0579 },
  { country_code: 'CN', country_name: '中国', province: '重庆', city: '重庆', latitude: 29.563, longitude: 106.5516 },
  { country_code: 'CN', country_name: '中国', province: '天津', city: '天津', latitude: 39.3434, longitude: 117.3616 },
  { country_code: 'CN', country_name: '中国', province: '湖北', city: '武汉', latitude: 30.5928, longitude: 114.3055 },
  { country_code: 'CN', country_name: '中国', province: '四川', city: '成都', latitude: 30.5728, longitude: 104.0668 },
  { country_code: 'CN', country_name: '中国', province: '陕西', city: '西安', latitude: 34.3416, longitude: 108.9398 },
  { country_code: 'CN', country_name: '中国', province: '浙江', city: '杭州', latitude: 30.2741, longitude: 120.1551 },
  { country_code: 'US', country_name: 'United States', province: 'New York', city: 'New York', latitude: 40.7128, longitude: -74.006 },
  { country_code: 'US', country_name: 'United States', province: 'California', city: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
  { country_code: 'GB', country_name: 'United Kingdom', province: 'England', city: 'London', latitude: 51.5074, longitude: -0.1278 },
  { country_code: 'JP', country_name: 'Japan', province: 'Tokyo', city: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { country_code: 'FR', country_name: 'France', province: 'Ile-de-France', city: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { country_code: 'DE', country_name: 'Germany', province: 'Berlin', city: 'Berlin', latitude: 52.52, longitude: 13.405 },
  { country_code: 'AU', country_name: 'Australia', province: 'New South Wales', city: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
  { country_code: 'RU', country_name: 'Russia', province: 'Moscow', city: 'Moscow', latitude: 55.7558, longitude: 37.6173 }
];

const ETHNIC_KEYWORDS = [
  '土家族苗族',
  '朝鲜族',
  '哈尼族彝族',
  '壮族苗族',
  '布依族苗族',
  '蒙古族藏族',
  '哈萨克',
  '蒙古族',
  '藏族',
  '回族',
  '彝族',
  '傣族',
  '景颇族',
  '傈僳族',
  '柯尔克孜',
  '白族',
  '哈尼族',
  '壮族',
  '侗族',
  '羌族',
  '土家族',
  '苗族',
  '布依族'
];

const removeProvinceSuffix = (name) => {
  return String(name || '')
    .replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市$/g, '')
    .trim();
};

const normalizeCityName = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return '';

  if (raw.endsWith('自治州')) {
    const withoutSuffix = raw.replace(/自治州$/, '');
    for (const keyword of ETHNIC_KEYWORDS) {
      const idx = withoutSuffix.indexOf(keyword);
      if (idx > 0) {
        return withoutSuffix.slice(0, idx);
      }
    }
    return withoutSuffix;
  }

  return raw.replace(/市|地区|盟$/g, '').trim();
};

const findCoordinateByCity = (city) => {
  const normalized = normalizeCityName(city).toLowerCase();
  if (!normalized) return null;

  return CITY_COORDINATES.find((item) => normalizeCityName(item.city).toLowerCase() === normalized) || null;
};

export const findCityCoordinate = ({ countryCode, city }) => {
  if (!city) return null;
  const normalizedCity = normalizeCityName(city).toLowerCase();

  const match = CITY_COORDINATES.find((item) => {
    if (countryCode && item.country_code.toLowerCase() !== countryCode.toLowerCase()) {
      return false;
    }
    return normalizeCityName(item.city).toLowerCase() === normalizedCity;
  });

  return match || null;
};

const buildAliases = (cityName) => {
  const aliases = new Set();
  const raw = String(cityName || '').trim();
  if (!raw) return [];

  aliases.add(raw);
  aliases.add(raw.replace(/市|地区|盟$/g, ''));

  if (raw.endsWith('自治州')) {
    aliases.add(raw.replace(/自治州$/, ''));
    aliases.add(normalizeCityName(raw));
  }

  return Array.from(aliases)
    .map((alias) => alias.trim())
    .filter((alias) => alias && alias.length >= 2);
};

const chinaLocationItems = CHINA_PREFECTURE_CITIES.map((item) => {
  const coordinate = findCoordinateByCity(item.city);
  return {
    country_code: 'CN',
    country_name: '中国',
    province: removeProvinceSuffix(item.province),
    city: normalizeCityName(item.city),
    latitude: coordinate ? coordinate.latitude : null,
    longitude: coordinate ? coordinate.longitude : null,
    code: item.code,
    aliases: buildAliases(item.city)
  };
});

const aliasMatchers = chinaLocationItems
  .flatMap((item) => item.aliases.map((alias) => ({ alias, item })))
  .sort((a, b) => b.alias.length - a.alias.length);

export const matchChinaCityByFilename = (fileName) => {
  const raw = String(fileName || '').replace(/\.[^/.]+$/, '');
  if (!raw) return null;

  for (const matcher of aliasMatchers) {
    if (raw.includes(matcher.alias)) {
      return {
        scope_level: 'national',
        country_code: 'CN',
        country_name: '中国',
        province: matcher.item.province,
        city: matcher.item.city,
        district: null,
        latitude: matcher.item.latitude,
        longitude: matcher.item.longitude
      };
    }
  }

  return null;
};

export const suggestLocations = (q) => {
  const mixed = [...CITY_COORDINATES, ...chinaLocationItems];
  const seen = new Set();
  const merged = mixed.filter((item) => {
    const key = `${item.country_code || ''}|${item.province || ''}|${item.city || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({
    country_code: item.country_code,
    country_name: item.country_name,
    province: item.province,
    city: item.city,
    latitude: item.latitude,
    longitude: item.longitude
  }));

  if (!q) {
    return merged.slice(0, 40);
  }

  const keyword = q.trim().toLowerCase();
  if (!keyword) {
    return merged.slice(0, 40);
  }

  return merged.filter((item) => {
    return [item.country_name, item.province, item.city]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword));
  }).slice(0, 60);
};
