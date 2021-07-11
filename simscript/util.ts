import { Event } from './event';

/**
 * Throws an Exception if a condition is false.
 * 
 * @param condition Boolean value representing the condition to test.
 * @param msg Message of the Exception thrown if the condition is false.
 * This parameter can be a string or a function that returns a string.
 */
export function assert(condition: boolean, msg: string | Function) {
    if (!condition) {
        if (typeof msg === 'function') {
            msg = msg();
        }
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
 * Binds an input element to a variable (parameter).
 * 
 * @param id Id of the input element to bind.
 * @param initialValue Initial value applied to the input element.
 * @param onInput Function called when the input value changes.
 * @param suffix String appended to the span element after input range elements.
 * @param decimals Number of decimal places to show for numeric values.
 */
export function bind(id: string, initialValue: any, onInput: Function, suffix = '', decimals?: number) {
    const input = document.getElementById(id) as any;
    const isCheck = input.type == 'checkbox';
    const isNumber = input.type == 'range' || input.type == 'number';
    const isSelect = input instanceof HTMLSelectElement;

    // format value for display
    const fmt = (value: number) => {
        const dec = decimals != null
            ? decimals
            : value == Math.round(value) ? 0 : 2;
        return ` ${format(value, dec)}${suffix}`;
    }

    // set initial value
    if (isCheck) {
        input.checked = initialValue as boolean;
    } else if (isSelect) {
        input.selectedIndex = initialValue;
    } else if (isNumber) {
        input.valueAsNumber = initialValue;
    } else {
        input.value = initialValue;
    }

    // show current range value
    const span = input.type == 'range'
        ? input.insertAdjacentElement('afterend', document.createElement('span'))
        : null;
    if (span) {
        span.textContent = fmt(input.valueAsNumber);
    }
    
    // apply changes
    input.addEventListener('input', e => {
        if (span) {
            span.textContent = fmt(input.valueAsNumber);
        }
        const value = isCheck ? input.checked :
            isSelect ? input.selectedIndex :
            isNumber ? input.valueAsNumber :
            input.value;
        onInput(value);
    });
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
                (obj[key] as Event).addEventListener(options[key]);
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

/**
 * Checks whether a value is a number.
 * @param val Value to check.
 * @returns True if the value is a number.
 */
export function isNumber(val: any): boolean {
    return typeof val == 'number';
}

/**
 * Defines the properties of point objects.
 */
 export interface IPoint {
    x: number;
    y: number;
    z?: number;
}

/**
 * Represents a point with x, y, and z coordinates.
 */
export class Point implements IPoint {
    x: number;
    y: number;
    z: number;

    /**
     * Instantiates a new instance of a {@link Point} object.
     * @param x X coordinate of the point.
     * @param y Y coordinate of the point.
     * @param z Z coordinate of the point.
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    /**
     * Creates a clone of a given {@link IPoint} object.
     * @param p {@link IPoint} object to clone.
     * @returns A copy of the given {@link IPoint} object.
     */
    static clone(p: IPoint): IPoint {
        return {
            x: p.x,
            y: p.y,
            z: p.z
        }
    }
    /**
     * Copies an {@link IPoint} object into another.
     * @param dst Destination {@link IPoint} object.
     * @param src Source {@link IPoint} object.
     * @returns The destination {@link IPoint} object.
     */
    static copy(dst: IPoint, src: IPoint): IPoint {
        dst.x = src.x;
        dst.y = src.y;
        dst.z = src.z;
        return dst;
    }
    /**
     * Calculates the distance between two {@link IPoint} objects.
     * @param p1 First point.
     * @param p2 Second point.
     * @returns The distance between the two points.
     */
    static distance(p1: IPoint, p2: IPoint): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z || 0 - p2.z || 0;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * Calculates an {@link IPoint} by performing a linear interpolation 
     * between two {@link IPoint} objects.
     * @param p1 First point.
     * @param p2 Second point.
     * @param t Coefficient that corresponds to the relative distance of
     * the result to the first point. Zero corresponds to the first point,
     * one to the second point.
     * @returns A point between the two given points.
     */
    static interpolate(p1: IPoint, p2: IPoint, t: number): IPoint {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: (p1.z || 0) + (p2.z || 0 - p1.z || 0) * t
        };
    }
    /**
     * Calculates the angle (in degrees or radians) of the line that
     * connects two points.
     * @param p1 First point.
     * @param p2 Second point.
     * @param radians Whether to return the result in radians.
     * @returns The angle (in degrees or radians) of the line that
     * connects the two points.
     */
    static angle(p1: IPoint, p2: IPoint, radians = false): number {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        return radians? angle : Math.round(angle * 180 / Math.PI);
    }
}
