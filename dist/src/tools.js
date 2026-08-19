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
    // handle whole-header-name special cases. These are standard headers with
    // multiple uppercase letters in a row that would not be common in
    // non-standard headers
    const fixedHeaders = ['ETag', 'TE'];
    const fixedHeaderFound = fixedHeaders.find(h => h.toLowerCase() === name.toLowerCase());
    if (fixedHeaderFound) {
        return fixedHeaderFound;
    }
    // Normalize to kebab case
    name = name
        .replace(/ /g, '-')
        // uppercase letters that do not follow other uppercase letters
        .replace(/(?<!^|[A-Z])([A-Z])/g, '-$1')
        .replace(/\-+/g, '-')
        .replace(/^\-/, '')
        .toLowerCase();
    // raise the case to initial caps
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
    let result = charArray.join('');
    // dehyphenate certain fragments
    const dehyphenate = ['Rate-Limit'];
    for (const d of dehyphenate) {
        result = result.replace(d, d.replace(/\-/g, ''));
    }
    // handle certain fragments that should have a specific casing that is not initial caps.
    const specialCases = ['API', 'MD5', 'WWW', 'XSS', 'RateLimit'];
    for (const sc of specialCases) {
        let lastScIndex = -1;
        let scIndex;
        while ((scIndex = result.toLowerCase().indexOf(sc.toLowerCase(), lastScIndex))
            > -1) {
            result =
                result.substring(0, scIndex) + sc +
                    result.substring(scIndex + sc.length);
            lastScIndex = scIndex + sc.length;
        }
    }
    return result;
}
//# sourceMappingURL=tools.js.map