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
    protected _cnt = 0;
    protected _min = 0;
    protected _max = 0;
    protected _sum = 0;
    protected _sum2 = 0;
    protected _histo: Map<number, number> | null = null;
    protected _histoParms: IHistogramParameters | null = null;

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
        assert(weight >= 0, 'Tally weights must be >= 0');

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
            const bins = this._histo;
            const keys = Array.from(bins.keys());
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
                const parms = this._histoParms,
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
     * @param title Optional table title. Defaults to an empty string.
     * @param type Optional chart type. Defaults to 'column'.
     * @returns An HTML string showing the {@link Tally} as a histogram
     * formatted for display using the [chart.css](https://chartscss.org/) library.
     */
    getHistogramTable(title = '', type = 'column'): string {
        let table = '',
            histo = this.getHistogram();
        if (histo) {

            // table
            table = `<table 
                class="charts-css ${type} data-spacing-5 hide-data show-labels
                ${title ? ' show-heading' : ''}">`;

            // caption
            if (title) {
                table += `<caption>${title}</caption>`;
            }

            // histogram data
            let maxCount = 0;
            histo.forEach(entry => {
                maxCount = Math.max(maxCount, entry.count)
            });
            const dec = this._histoParms.size < 1 ? 1 : 0;
            histo.forEach(entry => {
                let cls = entry.from <= this.avg && entry.to >= this.avg
                    ? 'class="avg" '
                    : '';
                table += `<tr>
                    <th scope="row">${format(entry.from, dec)}-${format(entry.to, dec)}</th>
                    <td ${cls}style="--size:${entry.count / maxCount}"><span class="data">${entry.count}</span></td>
                </tr>`;
            });

            // done
            table += '</table>';
            return table;
        }

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