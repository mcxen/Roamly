import { cn } from './utils';

/**
 * Resolve a variant key from a variants map, falling back to default.
 * Kumo pattern: resolveVariant(KUMO_BUTTON_VARIANTS.variant, variant, KUMO_BUTTON_DEFAULT_VARIANTS.variant)
 *
 * @param {Record<string, {classes: string, description?: string}>} variants
 * @param {string} key
 * @param {string} defaultKey
 * @returns {{classes: string, description?: string}}
 */
export function resolveVariant(variants, key, defaultKey) {
  if (key in variants) return variants[key];
  return variants[defaultKey];
}

/**
 * Create a variant resolver for a specific variants map.
 * Returns a function that resolves given key or defaultKey.
 *
 * @param {Record<string, {classes: string, description?: string}>} variants
 * @param {string} defaultKey
 * @returns {(key?: string) => {classes: string, description?: string}}
 */
export function createVariantResolver(variants, defaultKey) {
  return (key) => {
    const k = key ?? defaultKey;
    return k in variants ? variants[k] : variants[defaultKey];
  };
}

/**
 * Compose variant classes together into a single cn() call.
 *
 * @param {...({classes: string} | string | false | null | undefined)} args
 * @returns {string}
 */
export function composeVariants(...args) {
  const classes = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      classes.push(arg);
    } else if (arg.classes) {
      classes.push(arg.classes);
    }
  }
  return cn(...classes);
}
