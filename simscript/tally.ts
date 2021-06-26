import { setOptions, assert, clamp, format } from './util';

/**
 * Represents an entry in a histogram created by the
 * {@link Tally.getHistogram} method.
 */
export interface IHistogramEntry {
    from: number,
    to: number,
    count: number
}

/**
 * Specifies parameters used when creating histograms with the
 * {@link Tally.getHistogram} method.
 */
interface IHistogramParameters {
    size: number,
    min: number | null,
    max: number | null
}

/**
 * Class that collects observations and provides summary statistics 
 * and histograms.
 * 
 * The {@link Tally} class is used by {@link Queue} objects to provide
 * statistics about queue populations and dwell times.
 */
export class Tally {
    private _cnt = 0;
    private _min = 0;
    private _max = 0;
    private _sum = 0;
    private _sum2 = 0;
    private _histo: Map<number, number> | null = null;
    private _histoParms: IHistogramParameters | null = null;

    /**
     * Initializes a new instance of the {@link Tally} class.
     * 
     * @param options Optional object uses to initialize the
     * {@link Tally} properties.
     */
    constructor(options?: any) {
        setOptions(this, options);
    }

    /**
     * Gets the minimum observed value.
     */
    get min(): number {
        return this._min;
    }
    /**
     * Gets the maximum observed value.
     */
    get max(): number {
        return this._max;
    }
    /**
     * Gets the number of observed values.
     */
    get cnt(): number {
        return this._cnt;
    }
    /**
     * Gets the average of the observed values.
     */
    get avg(): number {
        return this._cnt > 0
            ? this._sum / this._cnt
            : 0;
    }
    /**
     * Gets the variance of the observed values.
     */
    get var(): number {
        return this._cnt > 0 && this._max > this._min
            ? Math.max(0, (this._sum2 - this._sum * this._sum / this._cnt) / this._cnt)
            : 0;
    }
    /**
     * Gets the standard deviation of the observed values.
     */
    get stdev(): number {
        return Math.sqrt(this.var);
    }
    /**
     * Adds a value to the {@link Tally}.
     * 
     * @param value Value to add to the tally.
     * @param weight Weight of the observed value.
     */
    add(value: number, weight = 1) {
        assert(weight >= 0, 'tally weights must be >= 0');

        // keep track of min/max
        if (!this._cnt || value > this._max) this._max = value;
        if (!this._cnt || value < this._min) this._min = value;

        // keep counts
        this._cnt += weight;
        this._sum += value * weight;
        this._sum2 += value * value * weight;

        // update histogram
        if (this._histo) {
            value = clamp(value, this._histoParms.min, this._histoParms.max);
            let bin = Math.floor(value / this._histoParms.size);
            let cnt = this._histo.get(bin) || 0;
            this._histo.set(bin, cnt + weight);
        }
    }
    /**
     * Gets an array of {@link IHistogramEntry} objects that show
     * the {@link Tally} observations as a histogram.
     * 
     * Before using this method, call the {@link setHistogramParameters}
     * to specify the desired histogram's bin size and limits.
     * 
     * @returns An array of {@link IHistogramEntry} objects.
     */
    getHistogram(): IHistogramEntry[] | null {
        if (this._histo) {

            // get sorted list of bins
            const
                bins = this._histo,
                keys = Array.from(bins.keys());
            keys.sort((a, b) => a - b); // sort bins in ascending order

            // add missing keys
            for (let i = 1; i < keys.length; i++) {
                if (keys[i] > keys[i - 1] + 1) {
                    keys.splice(i, 0, keys[i - 1] + 1);
                }
            }

            // build histogram
            const binSize = this._histoParms.size;
            let h = keys.map(key => {
                return {
                    from: key * binSize,
                    to: (key + 1) * binSize,
                    count: bins.get(key) || 0
                }
            });

            // honor min/max histogram parameters
            if (h.length) {
                const
                    parms = this._histoParms,
                    min = parms.min,
                    max = parms.max;
                if (min != null && h[0].from > this.min) {
                    h[0].from = this.min;
                }
                if (max != null && h[h.length - 1].to < this.max) {
                    h[h.length - 1].to = this.max;
                }
            }

            // done
            return h;
        }
        return null;
    }
    /**
     * Gets an HTML string showing the {@link Tally} as a histogram.
     * 
     * Before using this method, call the {@link setHistogramParameters}
     * to specify the desired histogram's bin size and limits.
     * 
     * @returns An HTML string showing the {@link Tally} as a histogram.
     */
    getHistogramChart(title = ''): string {

        // get the histogram
        let histo = this.getHistogram();

        // sanity
        if (!histo || !histo.length) {
            return '';
        }

        // get parameters
        let maxCnt = 0;
        histo.forEach(e => maxCnt = Math.max(maxCnt, e.count));
        const
            barWidth = Math.round(1 / histo.length * 100),
            dec = this._histoParms.size < 1 ? 1 : 0;

        // build bars
        let bars = '';
        histo.forEach((e, index) => {
            const
                cls = this.avg >= e.from && this.avg <= e.to ? ' class="avg"' : '',
                hei = Math.round(e.count / maxCnt * 100),
                x = index * barWidth,
                gap = 5;
            bars += `<g${cls}>
                <title>${e.count}</title>
                <rect
                    ${cls}
                    x="calc(${x}% + ${gap}px)"
                    width="calc(${barWidth}% - ${2 * gap}px)"
                    y="calc(${100 - hei}% - 1.2em)"
                    height="${hei}%" />
                <text
                    ${cls}
                    x="${(x + barWidth / 2)}%"
                    y="100%"
                    text-anchor="middle"
                    dominant-baseline="text-top">
                    ${format(e.from, dec)}-${format(e.to, dec)}
                </text>
            </g>`;
        });
        return `
            <figure class="ss-histogram">
                <figcaption>${title}</figcaption>
                <svg width="100%" height="100%">
                    ${bars}
                </svg>
            </figure>`;
    }
    /**
     * Sets the parameters used to build histograms for this {@link Tally}.
     * 
     * Use the {@link getHistogram} and {@link getHistogramTable} methods
     * to create tally histograms that can be added to reports.
     * 
     * The default value for this property is null, which prevents the
     * creation of any histograms.
     */
    setHistogramParameters(binSize: number | null, min: number | null = null, max: number | null = null) {
        if (!binSize) {
            this._histoParms = null;
            this._histo = null;
        } else {
            assert(binSize > 0, 'bin size must be positive');
            assert(min == null || max == null || min <= max, 'histogram min must be <= max');
            this._histoParms = {
                size: binSize,
                min: min,
                max: max
            };
            this._histo = new Map<number, number>();
        }
    }
    /**
     * Resets the {@link Tally} by clearing all values, statistics, and
     * histogram data.
     */
    reset() {
        this._cnt = this._max = this._min = this._sum = this._sum2 = 0;
        if (this._histo) {
            this._histo.clear();
        }
    }
}