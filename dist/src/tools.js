/**
 * Deep Merge -- assigns properties from source to target, merging nested
 * objects instead of replacing them. Arrays are replaced, not merged.
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
export function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' &&
            !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
export function normalizeHeaderName(name) {
    // Normalize to kebab case
    name = name
        .replace(/ /g, '-')
        .replace(/([A-Z])/g, '-$1')
        .replace(/\-+/g, '-')
        .replace(/^\-/, '')
        .toLowerCase();
    // raise the case
    let raiseNextCase = true;
    let charArray = [];
    for (let idx = 0; idx < name.length; idx++) {
        let ca = name.charAt(idx);
        if (raiseNextCase) {
            ca = ca.toUpperCase();
            raiseNextCase = false;
        }
        else if (ca === '-') {
            raiseNextCase = true;
        }
        charArray.push(ca);
    }
    // initialCaps
    return charArray.join('');
}
//# sourceMappingURL=tools.js.map