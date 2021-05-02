import { Entity, EntityGenerator } from './entity';
import { Queue } from './queue';
import { Tally } from './tally';
import { Event, EventArgs } from './event';
import { assert, format, setOptions } from './util';

/**
 * Represents the current simulation state.
 */
export enum SimulationState {
    /** 
     * The simulation is paused but has not finished yet. 
     * It can be started by calling the {@link Simulation.start} method.
     */
    Paused,
    /** 
     * The simulation has finished execution. 
     * It can be re-started by calling the {@link Simulation.start} method.
     */
    Finished,
    /** 
     * The simulation is running.
     * It can be stopped by calling the {@link Simulation.stop} method.
     */
    Running
}

/**
 * Abstract base class for simulations.
 * 
 * {@link Simulation} objects are basically schedulers. 
 * They act as a stage where the actors are {@link Entity} objects
 * and have props represents by {@link Queue} objects.
 * 
 * Simulations keep a list of active entities and conditions these
 * entities are waiting for within their {@link Entity.script} methods,
 * which execute asynchronously.
 * As these conditions are satisfied along the simulated time, the
 * {@link Entity} objects resume executing their scripts.
 * When the simulation runs out of active entities, that means all
 * entities have finished their scripts and the simulation ends.
 * 
 * To create simulations follow these steps:
 * 
 * 1. Create one or more classes that extend the {@link Entity} class
 * and override the {@link Entity.script} method to describe the entity's 
 * actions within the simulation.
 * 
 * 2. Create a class that extends {@link Simulation} to use the entities
 * you defined in step 1.
 * 
 * 3. Override the simulation's {@link onStarting} method to create and activate
 * one or more of the entities you defined in step 1.
 * 
 * For example:
 * 
 * ```typescript
 * // define the BarberShop simulation 
 * export class BarberShop extends Simulation {
 *     qJoe = new Queue('Joe', 1);
 *     qWait = new Queue('Wait Area');
 * 
 *     // generate Customer entities with inter-arrival times of 18 min for 8 hours
 *     onStarting() {
 *         super.onStarting();
 *         this.qWait.grossDwell.binSize = 1;
 *         this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6));
 *     }
 * }
 * 
 * // define the Customer entity used by the Barbershop simulation
 * class Customer extends Entity {
 *     service = new Uniform(15 - 3, 15 + 3);
 *     async script() {
 *         const shop = this.simulation as BarberShop;
 *         await this.enterQueue(shop.qWait); // enter the line
 *         await this.enterQueue(shop.qJoe); // seize Joe the barber
 *         this.leaveQueue(shop.qWait); // leave the line
 *         await this.delay(this.service.sample()); // get a haircut
 *         this.leaveQueue(shop.qJoe); // free Joe        
 *     }
 * }
 * ```
 */
export class Simulation {
    private _tmNow = 0;
    private _tmEnd: number | null = null;
    private _tmStart = 0;
    private _tmElapsed = 0;
    private _state = SimulationState.Paused;
    private _stopRequested = false;
    private _queues: Queue[] = [];
    private _lastUpdate = 0;
    private _yieldInterval = 100;
    /** @internal */ _fec: FecItem[] = [];

    /**
     * Initializes a new instance of the {@link Simulation} class.
     * 
     * Use the {@link onStarting} method to generate entities when
     * the simulation starts running.
     * 
     * @param options Object with parameters used to initialize the 
     * simulation (properties and event handlers).
     */
    constructor(options?: any) {
        setOptions(this, options);
    }

    /**
     * Gets the simulation state.
     * 
     * Use the {@link start} and {@link stop} methods to change the 
     * simulation state.
     */
    get state(): SimulationState {
        return this._state;
    }
    /**
     * Gets or sets the simulation end time.
     * 
     * The default value for this property is **null**, which causes the
     * simulation to run until the {@link stop} method is called or
     * until it runs out of things to do.
     */
    get timeEnd(): number | null {
        return this._tmEnd;
    }
    set timeEnd(value: number | null) {
        this._tmEnd = value;
    }
    /**
     * Gets the actual simulation time in milliseconds.
     */
    get timeElapsed(): number {
        return this._state == SimulationState.Paused
            ? this._tmElapsed
            : Date.now() - this._tmStart;
    }
    /**
     * Gets the current simulated time in simulation time units.
     */
    get timeNow(): number {
        return this._tmNow;
    }
    /**
     * Gets or sets a value that determines how often the {@link Simulation}
     * will release control of the thread so the brower remains responsive.
     * 
     * The default value for this property is **100** ms, which is enough to
     * keep the UI responsive. Use higher values to increase the simulation 
     * speed at the expense of UI responsiveness.
     */
    get yieldInterval(): number {
        return this._yieldInterval;
    }
    set yieldInterval(value: number) {
        this._yieldInterval = value;
    }
    /**
     * Starts the {@link Simulation} or resumes the execution of a stopped simulation.
     * 
     * @param reset Whether to restart the simulation or resume execution 
     * from where it stopped.
     */
    async start(reset = false) {

        // sanity
        if (this.state == SimulationState.Running) {
            return;
        };

        // cancel stop request
        this._stopRequested = false;

        // always reset if we're done
        reset = reset || this._fec.length == 0;

        // reset
        if (reset) {
            this._queues.forEach(q => q.reset());
            this._fec = [];
            this._queues = [];
            this._setTimeNow(0);
            this.onStarting();
        }

        // run the simulation
        this._tmStart = Date.now();
        this._setState(SimulationState.Running);
        if (reset) {
            this.onStarted();
        }
        this._step();
    }
    /**
     * Stops the {@link Simulation}.
     */
    stop() {
        if (this.state == SimulationState.Running) {
            this._stopRequested = true;
        }
    }
    /**
     * Activates an {@link Entity}.
     * 
     * Activating an {@link Entity} causes it to enter the simulation
     * and start executing its {@link Entity.script} method.
     * 
     * @param e {@link Entity} to activate.
     */
    async activate(e: Entity) {

        // activate only once!
        assert(e.simulation == null, 'Entity ' + e.toString() + ' is already active');

        // initialize entity
        e._sim = this;

        // execute the entity's script
        await e.script();

        // call dispose to indicate the entity is done
        e.dispose();
        e._sim = null;
    }
    /**
     * Generates {@link Entity} objects and activates them.
     * 
     * @param type Type of {@link Entity} to generate.
     * @param interArrival {@link RandomVar} that returns the inter-arrival time.
     * @param max Maximum number of entities to generate.
     * @param startTime Time to start generating entities.
     * @param endTime Time to stop generating entities.
     */
    generateEntities(type, interArrival, max?: number, startTime?: number, endTime?: number) {
        const gen = new EntityGenerator(type, interArrival, max, startTime, endTime);
        this.activate(gen);
    }
    /**
     * Gets an array with the {@link Queue} objects in use by this {@link Simulation}.
     */
    get queues(): Queue[] {
        return this._queues;
    }
    /**
     * Creates a table with the {@link Simulation} statistics.
     * 
     * @param showNetValues Whether to include net statistics (non-zero {@link Queue} 
     * dwell times and populations).
     * @returns An HTML string defining a table with statistics for all {@link Queue} 
     * objects in the simulation.
     */
    getStatsTable(showNetValues = false): string {
        return '<table class="ss-stats">' +
            this._createSimulationReport() +
            this._createQueueReport('Populations', 'grossPop') +
            (showNetValues ? this._createQueueReport('Net Populations', 'netPop') : '') +
            this._createQueueReport('Dwell Times', 'grossDwell') +
            (showNetValues ? this._createQueueReport('Net Dwell Times', 'netDwell') : '') +
        '</table>';
    }

    // ** events

    /**
     * Occurs before the simulation starts executing.
     */
    readonly starting = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link starting} event.
     * 
     * Classes that extend {@link Simulation} typically override this
     * method to create the entities that will drive the simulation.
     * 
     * For example:
     * 
     * ```typescript
     * export class BarberShop extends Simulation {
     *     qJoe = new Queue('Joe', 1);
     *     qWait = new Queue('Wait Area');
     * 
     *     // generate entities with inter-arrival times of 18 min for 8 hours
     *     onStarting() {
     *         this.qWait.grossDwell.binSize = 1;
     *         this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6));
     *     }
     * }
     * ```
     */
    onStarting(e = EventArgs.empty) {
        this.starting.raise(this, e);
    }
    /**
     * Occurs after the simulation starts executing.
     */
    readonly started = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link started} event.
     */
    onStarted(e = EventArgs.empty) {
        this.started.raise(this, e);
    }
    /**
     * Occurs before the simulation finishes executing.
     */
    readonly finishing = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link finishing} event.
     */
    onFinishing(e = EventArgs.empty) {
        this.finishing.raise(this, e);
    }
    /**
     * Occurs after the simulation finishes executing.
     */
    readonly finished = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link finished} event.
     */
    onFinished(e = EventArgs.empty) {
        this.finished.raise(this, e);
    }
    /**
   * Occurs before the simulation's {@link state} property changes.
   */
    readonly stateChanging = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link stateChanging} event.
     */
    onStateChanging(e = EventArgs.empty) {
        this.stateChanging.raise(this, e);
    }
    /**
     * Occurs after the simulation's {@link state} property changes.
     * 
     * For example:
     * 
     * ```typescript
     * sim.stateChanged.addEventListener(s => {
     *     console.log('the simulation state changed to', SimulationState[s.state]);
     * });
     * ```
     */
    readonly stateChanged = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link stateChanged} event.
     */
    onStateChanged(e = EventArgs.empty) {
        this.stateChanged.raise(this, e);
    }
    /**
     * Occurs before the simulation's {@link timeNow} property changes.
     */
    readonly timeNowChanging = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link timeNowChanging} event.
     */
    onTimeNowChanging(e = EventArgs.empty) {
        this.timeNowChanging.raise(this, e);
    }
    /**
     * Occurs after the simulation's {@link timeNow} property changes.
     * 
     * For example:
     * 
     * ```typescript
     * sim.timeChanged.addEventListener(s => {
     *     console.log('the simulation time advanced to', s.timeNow);
     * });
     * ```
     */
    readonly timeNowChanged = new Event<Simulation, EventArgs>();
    /**
     * Raises the {@link timeNowChanged} event.
     */
    onTimeNowChanged(e = EventArgs.empty) {
        this.timeNowChanged.raise(this, e);
    }

    // ** implementation

    // change simulation state
    protected _setState(value: SimulationState) {
        if (value != this._state) {
            this.onStateChanging();
            this._state = value;
            this.onStateChanged();
        }
    }

    // change simulation time
    protected _setTimeNow(value: number) {
        if (value != this._tmNow) {
            this.onTimeNowChanging();
            this._tmNow = value;
            this.onTimeNowChanged();
        }
    }

    // perform actions due now, wait and repeat
    private async _step() {

        // scan the fec to find out the next step
        let nextTime = await this._scanFec();

        // check if we should stop
        if (this._stopRequested) { // stop method called
            this._tmElapsed = Date.now() - this._tmStart;
            this._setState(SimulationState.Paused);
            return;
        }
        if ((this._tmEnd != null && this._tmNow >= this._tmEnd) || // end of simulation time
            (nextTime < 0)) { // out of things to do
            this._fec = [];
            this._tmElapsed = Date.now() - this._tmStart;
            this.onFinishing();
            this._setState(SimulationState.Finished);
            this.onFinished();
            return;
        }

        // advance the time
        if (nextTime > 0) {
            this._setTimeNow(nextTime);
        }

        // call requestAnimationFrame to keep the thread alive
        const now = Date.now();
        if (now - this._lastUpdate > this._yieldInterval) {
            this._lastUpdate = now;
            requestAnimationFrame(() => this._step());
        } else {
            this._step();
        }
    }

    // scan the fec, dispatch entities that are ready
    private async _scanFec(): Promise<number | null> {
        let fec = this._fec,
            dispatched = 0,
            nextTime: number | null = null;

        // scan the fec list and dispatch anyone who's ready
        for (var i = 0; i < fec.length; i++) {
            let item = fec[i],
                ready = item.ready;

            // dispatch items that are ready
            if (ready) {
                fec.splice(i, 1);
                dispatched++;
                await item.dispatch();
                i = -1; // re-start from the first item
                continue;
            }

            // keep track of next execution time
            const timeDue = item.timeDue;
            if (timeDue != null) {
                if (nextTime == null || nextTime > timeDue) {
                    nextTime = timeDue;
                }
            }
        }

        // if we dispatched anyone, do it again
        if (dispatched > 0) {
            return 0;
        }

        // if we don't have a nextTime, we're done
        if (nextTime == null) {
            return -1;
        }

        // return nextTime to advance the simulation
        return nextTime;
    }

    // creates a table row with the current simulation statistics
    private _createSimulationReport(): string {
        return `
            <tr>
                <th colspan="2">${this.constructor.name}</th>
            </tr>
            <tr>
                <th>Finish Time</th>
                <td>${format(this.timeNow, 0)}</td>
            </tr>
            <tr>
                <th>Elapsed Time (s)</th>
                <td>${format(this.timeElapsed / 1000)}</td>
            <tr>`;
    }

    // creates a table row with the current queue statistics
    private _createQueueReport(title: string, tallyName: string): string {
        const isPop = tallyName.indexOf('Pop') > -1;
        let html = `<tr>
                <th colspan="6">
                    ${title}
                </th>
            </tr>
            <tr>
                <th>Queue</th>
                <th>Min</th>
                <th>Avg</th>
                <th>Max</th>
                <th>StDev</th>
                <th>${isPop ? '' : 'Cnt'}</th>
            </tr>`;
        this.queues.forEach((q: Queue) => {
            if (q.name && q.grossDwell.cnt) {
                let tally = q[tallyName] as Tally;
                html += `<tr>
                    <th>${q.name}</th>
                    <td>${format(tally.min)}</td>
                    <td>${format(tally.avg)}</td>
                    <td>${format(tally.max)}</td>
                    <td>${format(tally.stdev)}</td>
                    <td>${isPop ? '' : format(tally.cnt, 0)}</td>
                </tr>`;
            }
        });
        return html;
    }
}

/**
 * Represents options for {@link FecItem} objects.
 */
export interface IFecItemOptions {
    delay?: number,
    path?: IMovePath,
    queue?: Queue,
    units?: number,
    signal?: any,
}

/**
 * Represents a simulation event scheduled for future execution.
 */
export class FecItem {
    protected _e: Entity;
    protected _ready: boolean;
    protected _tmStart: number;
    protected _tmDue: number;
    protected _promise: Promise<void>;
    protected _resolve: Function | undefined;
    protected _options: IFecItemOptions;

    /**
     * Initializes a new instance of a {@link FecItem} object.
     * @param e {@link Entity} that the item refers to.
     * @param options {@link IFecItemOptions} used to initialize the object.
     */
    constructor(e: Entity, options: IFecItemOptions) {
        this._e = e;
        this._ready = false;
        this._options = options;

        // insert item into fec taking into account the entity priority
        let sim = e.simulation,
            fec = sim._fec,
            index = fec.length;
        while (index > 0 && fec[index - 1].e.priority < e.priority) {
            index--;
        }
        fec.splice(index, 0, this);

        // remember start and due times
        this._tmStart = sim.timeNow;
        if (options.delay != null) {
            this._tmDue = sim.timeNow + options.delay;
        }

        // create a promise and save the resolver to return later
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    /**
     * Gets a reference to the {@link Entity} that this item refers to.
     */
    get e(): Entity {
        return this._e;
    }
    /**
     * Gets the {@see IFecItemOptions} assigned to this item.
     */
    get options(): IFecItemOptions {
        return this._options;
    }
    /**
     * Gets or sets a value that determines if this item is ready to resume
     * execution.
     */
    get ready(): boolean {

        // signal has been sent
        if (this._ready) {
            return true;
        }

        // queue has become available
        const options = this.options;
        if (options.queue && options.queue.canEnter(options.units)) {
            return true;
        }

        // delay has elapsed
        if (this._tmDue != null && this._tmDue <= this._e.simulation.timeNow) {
            return true;
        }

        // nope
        return false;
    }
    set ready(value: boolean) {
        this._ready = value;
    }
    /**
     * Gets the simulated time when this item was created.
     */
     get timeStart(): number {
        return this._tmStart;
    }
    /**
     * Gets the simulated time when this item is due to resume execution.
     */
     get timeDue(): number {
        return this._tmDue;
    }
    /**
     * Dispatches the {@link Entity} so it resumes execution of its
     * {@link Entity.script} function.
     */
    async dispatch() {
        const options = this._options;
        const q = options.queue;
        if (q) {
            const units = options.units;
            q.add(this._e, units != null ? units : 1);
        }
        return this._resolve ? await this._resolve() : null;
    }
    /**
     * Gets the **Promise** represented by this item.
     */
    get promise(): Promise<void> {
        return this._promise;
    }
    then(resolver) {
        let r = resolver;
        debugger
    }
}

/**
 * Interface that defines a path defined by an array of {@link Queue} objects
 * and a tension to use when interpolating between the queues.
 */
export interface IMovePath {
    /** 
     * Array of {@link Queue} objects that define the path. 
     */
    queues: Queue[],
    /** 
     * Value that defines the tension of the spline used to interpolate between
     * the queues. Zero creates a path with straight line segments, 0.5 generates
     * a smooth curve.
     */
    tension?: number;
}
