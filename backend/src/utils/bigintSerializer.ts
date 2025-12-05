/**
 * Global BigInt JSON serialization polyfill
 * Ensures BigInt values (like telegramId) are serialized as strings in JSON responses
 */

// Add toJSON method to BigInt prototype for automatic serialization
if (typeof (BigInt.prototype as any).toJSON === 'undefined') {
    (BigInt.prototype as any).toJSON = function (): string {
        return this.toString();
    };
}

export { };
