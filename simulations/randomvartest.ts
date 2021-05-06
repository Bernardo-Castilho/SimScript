import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Tally } from '../simscript/tally';
import { RandomVar, Uniform, Triangular, Empirical, Exponential, Normal, LogNormal } from '../simscript/random';

//
interface IRandomVar {
    var: RandomVar;
    name: string;
    binSize: number;
}

//
export class RandomVarTest extends Simulation {
    _tally = new Tally();
    _sampleSize = 1000;
    _seeded = false;
    _randomVars: IRandomVar[];
    _index = 0;

    constructor(options?: any) {
        super(options);
        this.createRandomVars();
    }

    get seeded() {
        return this._seeded;
    }
    set seeded(value: boolean) {
        this._seeded = value;
        this.createRandomVars();
    }
    get sampleSize(): number {
        return this._sampleSize;
    }
    set sampleSize(value: number) {
        this._sampleSize = value;
    }
    get randomVars(): any {
        return this._randomVars;
    }
    get randomVar(): IRandomVar {
        return this._randomVars[this._index];
    }
    get tally(): Tally {
        return this._tally;
    }
    get randomVarIndex(): number {
        return this._index;
    }
    set randomVarIndex(value: number) {
        this._index = value;
    }
    createRandomVars() {
        const seed = this._seeded ? 1 : null;
        this._randomVars = [
            { var: new RandomVar(seed), name: 'Uniform(0, 1)', binSize: 0.1 },
            { var: new Uniform(5, 10, seed), name: 'Uniform(5, 10)', binSize: 0.5 },
            { var: new Triangular(5, 6, 10, seed), name: 'Triangular(5, 6, 10)', binSize: 0.5 },
            { var: new Empirical([5, 8, 10], [0, .8, 1], seed), name: 'Empirical([5, 8, 10], [0, .8, 1])', binSize: 0.5 },
            { var: new Exponential(10, seed), name: 'Exponential(10)', binSize: 20 },
            { var: new Normal(10, 2, true, seed), name: 'Normal(10, 2)', binSize: 2 },
            { var: new LogNormal(10, 2, seed), name: 'LogNormal(10, 2)', binSize: 2 },
            { var: new EightEighty(seed), name: 'EightEighty()', binSize: 10 },
        ];
    }
    onStarting() {
        super.onStarting();
        this.createRandomVars();
        this.activate(new RandomVarTester());
    }
}

//
export class RandomVarTester extends Entity {
    async script() {
        const sim = this.simulation as RandomVarTest,
            rv = sim.randomVar,
            tally = sim.tally;
        tally.reset();
        tally.setHistogramParameters(rv.binSize);
        for (let i = 0; i < sim.sampleSize; i++) {
            tally.add(rv.var.sample());
        }
    }
}

// RandomVar that returns either 8 or 80
export class EightEighty extends RandomVar {
    sample(): number {
        return super.sample() < 0.5 ? 8 : 80;
    }
}