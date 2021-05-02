import { Event } from './event';

/**
 * Throws an Exception if a condition is false.
 * 
 * @param condition Boolean value representing the condition to test.
 * @param msg Message of the Exception thrown if the condition is false.
 */
export function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(msg);
        throw msg;
    }
}

/**
 * Formats a number using the current culture.
 * 
 * @param value Number to be formatted.
 * @param decimals Number of decimals to display.
 * @returns A string containing the representation of the given number.
 */
export function format(value: number, decimals = 2) {
    return _getNumberFormat(decimals).format(value);
}
const _numberFormats: any = {};
function _getNumberFormat(decimals: number): Intl.NumberFormat {
    let nf = _numberFormats[decimals];
    if (!nf) {
        nf = _numberFormats[decimals] = new Intl.NumberFormat(navigator.language, {
            useGrouping: true,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    return nf;
}

/**
 * Applies a group of property values and event handlers to an object.
 * 
 * @param obj Object that contains the properties and events.
 * @param options Object that contains the property values and event handlers to apply.
 */
export function setOptions(obj: any, options: any) {
    if (options) {
        for (let key in options) {
            assert(key in obj, `Property ${key} is not defined`);
            if (obj[key] instanceof Event) { // add event handler
                obj[key].addHandler(options[key]);
            } else {
                obj[key] = options[key]; // property assignment
            }
        }
    }
}

/**
 * Gets an HTML element from a query selector.
 *
 * @param selector An HTML element or a query selector string, or a jQuery object.
 */
export function getElement(selector: any): Element {
    let e = typeof selector === 'string'
        ? document.querySelector(selector)
        : selector;
    assert(e instanceof Element, 'Element not found:' + selector);
    return e;
}

/**
 * Clamps a value to a given range.
 * 
 * @param value Value to clamp.
 * @param min Minimum allowed value, or null of there is no lower bound.
 * @param max Maximum allowed value, or null of there is no upper bound.
 * @returns The clamped value (value >= min && value <= max).
 */
export function clamp(value: number, min: number | null, max: number | null): number {
    return (min != null && value < min) ? min
        : (max != null && value > max) ? max
        : value;
}