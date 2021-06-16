import { assert } from './util';

/**
* Represents a random variable with a uniform distribution
* between zero and one.
* 
* The random variable constructor may specify a **seed** value, 
* which causes the random sequence to be repeatable.
* 
* Use the {@link sample} method to retrieve random values from 
* {@link RandomVar} objects.
*/
export class RandomVar {
    protected _seed: number | null = null;

    /**
     * Initializes a new instance of the {@link RandomVar} class.
     * 
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(seed: number | null = null) {
        this._seed = seed;
    }
    /**
     * Gets a random value uniformly distributed between zero and one.
     */
    sample() {

        // unseeded: use js random
        if (this._seed == null) {
            return Math.random();
        }

        // seeded: mulberry32
        // https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
        let t = this._seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * Represents a random variable with a uniform distribution 
 * based on given **min** and **max** values.
 * 
 * For more information on uniform distributions see 
 * [uniform distribution](https://en.wikipedia.org/wiki/Uniform_distribution).
 */
export class Uniform extends RandomVar {
    protected _min: number;
    protected _max: number;

    /**
     * Initializes a new instance of the {@link Uniform} class.
     * 
     * @param min Minimum generated value.
     * @param max Minimum generated value.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(min: number, max: number, seed?: number) {
        super(seed);
        assert(max >= min, 'max >= min');
        this._min = min;
        this._max = max;
    }
    /**
     * Gets the minimum generated value.
     */
    get min(): number {
        return this._min;
    }
    /**
     * Gets the maximum generated value.
     */
    get max(): number {
        return this._max;
    }
    /**
     * Gets a random value uniformly distributed between {@link min} and {@link max}.
     */
    sample(): number {
        return this._min + super.sample() * (this._max - this._min);
    }
}

/**
 * Represents a random variable with a triangular distribution
 * based on given min, peak, and max values.
 * 
 * For more information on triangular distributions see 
 * [triangular distribution](https://en.wikipedia.org/wiki/Triangular_distribution).
 */
export class Triangular extends RandomVar {
    _min: number;
    _peak: number;
    _max: number;

    /**
     * Initializes a new instance of the {@link Triangular} class.
     * 
     * @param min Minimum generated value.
     * @param mode Most common generated value.
     * @param max Minimum generated value.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(min: number, mode: number, max: number, seed?: number) {
        super(seed);
        assert(min <= mode && mode <= max, 'min, mode, max should be in order');
        this._min = min;
        this._peak = mode;
        this._max = max;
    }
    /**
     * Gets the minimum generated value.
     */
    get min(): number {
        return this._min;
    }
    /**
     * Gets the most common generated value.
     */
    get mode(): number {
        return this._peak;
    }
    /**
     * Gets the maximum generated value.
     */
    get max(): number {
        return this._max;
    }
    /**
     * Gets a random value that follows a triangular distribution between {@link min} and
     * {@link max} with mode {@link mode}.
     */
    sample(): number {
        const
            rng = this._max - this._min,
            c = (rng > 0) ? (this._peak - this._min) / rng : 0,
            u = super.sample();
        return (u <= c)
            ? this._min + rng * Math.sqrt(c * u)
            : this._min + rng * (1 - Math.sqrt((1 - c) * (1 - u)));
    }
}

/**
 * Represents a random variable with an empirical distribution defined
 * by two vectors containing X and Y values.
 * 
 * For more information on empirical distributions see 
 * [empirical distribution](https://en.wikipedia.org/wiki/Empirical_distribution_function).
 */
export class Empirical extends RandomVar {
    protected _xVals: number[];
    protected _yVals: number[];

    /**
     * Initializes a new instance of the {@link Empirical} class.
     * 
     * @param xVals Array with possible values for the variable (from min to max).
     * @param yVals Array with cumulative probabilities (from zero to one).
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(xVals: number[], yVals: number[], seed?: number) {
        super(seed);

        assert(yVals.length == xVals.length, 'x and y arrays should have the same length');
        for (let i = 1; i < yVals.length; i++) {
            assert(xVals[i] >= xVals[i - 1] && yVals[i] >= yVals[i - 1], 'x and y arrays should be in ascending order');
        }
        assert(yVals[0] == 0 && yVals[yVals.length - 1] == 1, 'y values should range from zero to one');

        this._xVals = xVals;
        this._yVals = yVals;
    }
    /**
     * Gets the array with x-values used to generate the random values.
     */
    get xVals(): number[] {
        return this._xVals;
    }
    /**
     * Gets the array with y-values used to generate the random values.
     */
    get yVals(): number[] {
        return this._yVals;
    }
    /**
     * Gets a random value that follows an empirical distribution with
     * a CDF function defined by the {@link xVals} and {@link yVals} arrays.
     */
    sample(): number {
        const
            y = super.sample(),
            xVals = this._xVals,
            yVals = this._yVals;
        let i = 0;
        while (y > yVals[i] && i < yVals.length) {
            i++;
        }
        if (i == 0) {
            return xVals[0];
        }
        return xVals[i - 1] + (y - yVals[i - 1]) * (xVals[i] - xVals[i - 1]) / (yVals[i] - yVals[i - 1]);
    }
}

/**
 * Represents a random variable with an exponential distribution 
 * with a given mean value.
 * 
 * For more information on exponential distributions see 
 * [exponential distribution](https://en.wikipedia.org/wiki/Exponential_distribution).
 */
export class Exponential extends RandomVar {
    protected _mean: number;

    /**
     * Initializes a new instance of the {@link Exponential} class.
     * 
     * @param mean Mean generated value.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(mean: number, seed?: number) {
        super(seed);
        assert(mean > 0, 'mean >= 0');
        this._mean = mean;
    }
    /**
     * Gets the mean generated value.
     */
    get mean(): number {
        return this._mean;
    }
    /**
     * Gets a random value that follows an exponential distribution with
     * a given {@link mean}.
     */
    sample(): number {
        return -this._mean * Math.log(super.sample());
    }
}

/**
 * Represents a random variable with a Normal distribution with
 * given mean and standard deviation values.
 * 
 * For more information on the Normal distribution see 
 * [Normal distribution](https://en.wikipedia.org/wiki/Normal_distribution).
 */
export class Normal extends RandomVar {
    protected _mean: number;
    protected _std: number;
    protected _n1: number;
    protected _positive = true;

    /**
     * Initializes a new instance of the {@link Normal} class.
     * 
     * @param mean Mean generated value.
     * @param std Standard deviation of the generated values.
     * @param positive Always return values greater than or equal to zero.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(mean: number, std: number, positive = true, seed?: number) {
        super(seed);
        assert(std >= 0, 'std >= 0');
        this._mean = mean;
        this._std = std;
        this._positive = positive;
    }
    /**
     * Gets the mean value of the generated values.
     */
    get mean(): number {
        return this._mean;
    }
    /**
     * Gets the standard deviation of the generated values.
     */
    get std(): number {
        return this._std;
    }
    /**
     * Gets a random value that follows a normal distribution with
     * a given {@link mean} and standard deviation ({@link std}).
     */
    sample(): number {

        // x1 is normal(0, 1)
        let n1 = this._n1;
        if (n1 != null) { // n1 calculated previously
            this._n1 = null;
        } else {
            let v1: number, v2: number, w: number, y: number;
            do {
                v1 = 2 * super.sample() - 1;
                v2 = 2 * super.sample() - 1;
                w = v1 * v1 + v2 * v2;
            } while (w > 1);
            y = Math.sqrt(-2 * Math.log(w) / w);
            this._n1 = v1 * y; // save for next time
            n1 = v2 * y; // use this
        }

        // apply mean and std to n1
        let val = this._mean + this._std * n1;

        // return value, honor positive setting
        return this._positive ? Math.max(0, val) : val;
    }
}

/**
 * Represents a random variable with a log-normal distribution with
 * given mean and standard deviation values.
 * 
 * For more information on log-normal distributions see 
 * [log-normal distribution](https://en.wikipedia.org/wiki/LogNormal_distribution).
 */
export class LogNormal extends RandomVar {
    protected _mean: number;
    protected _std: number;
    protected _normal: Normal;

    /**
     * Initializes a new instance of the {@link LogNormal} class.
     * 
     * @param mean Mean generated value.
     * @param std Standard deviation of the generated values.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(mean: number, std: number, seed?: number) {
        super(seed);
        assert(std >= 0, 'std >= 0');
        this._mean = mean;
        this._std = std;
        let sq_mean = mean * mean,
            sq_stddev = std * std,
            m = Math.log(sq_mean / Math.sqrt(sq_mean + sq_stddev)),
            s = Math.sqrt(Math.log((sq_mean + sq_stddev) / sq_mean));
        this._normal = new Normal(m, s, false, seed); // inner normal
    }
    /**
     * Gets the mean value of the generated values.
     */
    get mean(): number {
        return this._mean;
    }
    /**
     * Gets the standard deviation of the generated values.
     */
    get std(): number {
        return this._std;
    }
    /**
     * Gets a random value that follows a lognormal distribution with
     * a given {@link mean} and standard deviation ({@link std}).
     */
    sample(): number {
        return this._mean == 0 ? 0 : Math.pow(Math.E, this._normal.sample());
    }
}

/**
 * Represents a random variable that returns integer values
 * between 0 and a given maximum value.
 */
 export class RandomInt extends RandomVar {
    protected _max: number;

    /**
     * Initializes a new instance of the {@link RandomInt} class.
     * 
     * @param max Maximum value.
     * @param seed Optional value used to initialize the random sequence.
     */
    constructor(max: number, seed?: number) {
        super(seed);
        this._max = max;
    }
    /**
     * Gets the maximum value of the generated values.
     */
    get max(): number {
        return this._max;
    }
    /**
     * Gets a random value that follows a lognormal distribution with
     * a given {@link mean} and standard deviation ({@link std}).
     */
    sample(): number {
        return Math.floor(super.sample() * (this._max + 1));
    }
}
