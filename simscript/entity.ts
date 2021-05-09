import { Simulation, FecItem, IMovePath } from './simulation';
import { Queue } from './queue';
import { RandomVar } from './random';
import { assert, setOptions } from './util';

/**
 * Abstract base class for {@link Entity} objects.
 * 
 * Entities are the actors in simulations.
 * 
 * They have an asynchronous {@link script} method that contains the
 * actions carried out by the entity within the simulation.
 * 
 * These actions typically include asyncronous methods such as 
 * {@link delay}, {@link enterQueue}, and {@link waitSignal}. 
 * Calls to asynchonous methods should include the **await** keyword.
 * 
 * For example:
 * 
 * ```typescript
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
export class Entity {
    /** @internal */ _sim: Simulation | null = null;
    /** @internal */ _queues = new Map();
    private _serial = 0;
    private _prty = 0;
    private static _serial = 0;

    /**
     * Initializes a new instance of the {@link Entity} class.
     * 
     * Entities are typically created by the {@link Simulation.bootstrap} 
     * method in the parent simulation, either using the {@link Simulation.generateEntities}
     * method (which creates and activates entities) or the {@link Simulation.activate} 
     * method (which activates new entities).
     * 
     * @param options Object with parameters used to initialize the {@link Entity}.
     */
    constructor(options?: any) {
        this._serial = Entity._serial++;
        setOptions(this, options);
    }

    /**
     * Gets a reference to the {@link Simulation} object that this entity
     * is part of.
     */
    get simulation(): Simulation {
        return this._sim;
    }
    /**
     * Gets a serial number that uniquely identifies the {@link Entity}.
     */
    get serial(): number {
        return this._serial;
    }
    /**
     * Gets or sets a number that represents the entity's priority.
     * 
     * The default value for this property is **0**.
     * 
     * Entities with higher priority will skip ahead of other entities
     * when entering {@link Queue} objects and when finishing delays
     * that end at the same simulated time.
     */
    get priority(): number {
        return this._prty;
    }
    set priority(value: number) {
        this._prty = value;
    }
    /**
     * Async method that simulates a delay.
     * 
     * When this method is invoked, the {@link Entity} pauses execution
     * for a given number of simulated time units.
     * 
     * For example, the script below causes the **Customer** entity to
     * enter a service queue **qJoe**, then undergo a delay based on
     * a **service** random variable, then leave the service queue:
     * 
     * ```typescript
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
     * 
     * Note that calls to the async methods {@link enterQueue}, {@link waitSignal},
     * and {@link delay} should be preceded by the **await** keyword.
     * 
     * @param delay Number of simulated time units to wait for.
     * @param path {@link IMovePath} object containing information about how
     * the entity should be animated during the delay.
     */
    async delay(delay: number, path?: IMovePath) {
        assert(path == null || path.queues.length > 1, 'delay path should have at least two queues');
        return new FecItem(this, {
            delay: delay,
            path: path
        }).promise;
    }
    /**
     * Async method that waits until a {@link Queue} has enough capacity, 
     * then inserts this {@link Entity} into the {@link Queue} seizing a 
     * specified number of capacity units.
     * 
     * An entity may enter multiple queues at once, but it cannot enter
     * the same queue multiple times.
     * 
     * For example, the script below causes the **Customer** entity to
     * enter a service queue **qJoe**, then undergo a delay based on
     * a **service** random variable, then leave the service queue:
     * 
     * ```typescript
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
     * 
     * Note that calls to the async methods {@link enterQueue}, {@link waitSignal},
     * and {@link delay} should be preceded by the **await** keyword.
     * 
     * @param queue {@link Queue} that the {@link Entity} will enter.
     * @param units Number of {@link Queue} capacity units to seize.
     */
    async enterQueue(queue: Queue, units = 1) {
        return new FecItem(this, {
            queue: queue,
            units: units
        }).promise;
    }
    /**
     * Adds this {@link Entity} into a {@link Queue} seizing a 
     * specified number of capacity units.
     * 
     * This method is synchronous. It does not require an **await**
     * and assumes the queue has enough capacity to take the 
     * entity.
     * 
     * This method is slightly more efficient than {@see enterQueue},
     * but should only be used if the {@link Queue} is guaranteed
     * to have enough capacity.
     * 
     * For example:
     * 
     * ```typescript
     * class Customer extends Entity {
     *     async script() {
     *         let sim = this.simulation as MMC;
     * 
     *         // enter waiting queue
     *         if (sim.qWait.canEnter()) { // queue has enough capacity
     *             this.enterQueueImmediately(sim.qWait); // no need to wait (faster)
     *         } else {
     *             await this.enterQueue(sim.qWait); // might have to wait (slower)
     *         }
     * 
     *         await this.enterQueue(sim.qService);
     *         this.leaveQueue(sim.qWait);
     *         await this.delay(sim.service.sample());
     *         this.leaveQueue(sim.qService);
     *     }
     * }
     * ```
     * 
     * @param queue {@link Queue} that the {@link Entity} will enter.
     * @param units Number of {@link Queue} capacity units to seize.
     */
    enterQueueImmediately(queue: Queue, units = 1) {
        queue.add(this, units);
    }
    /**
     * Causes the {@link Entity} to leave a {@link Queue} it has previously
     * entered using the {@link enterQueue} method.
     * 
     * @param q {@link Queue} to leave.
     */
    leaveQueue(q: Queue) {
        q.remove(this);
    }
    /**
     * Pauses entity execution until another entity sends a signal.
     * 
     * For example, the code below shows how you could use the 
     * {@link sendSignal} and {@link waitSignal} methods to simulate
     * a traffic light:
     * 
     * ```typescript
     * class Car extends Entity {
     *     async script() {
     *         let sim = this.simulation as CrossWalk;
     * 
     *         // enter crossing wait area
     *         await this.enterQueue(sim.qCarXing);
     * 
     *         // wait for green light
     *         while (sim.light != Signal.GREEN) {
     *             await this.waitSignal(Signal.GREEN);
     *         }
     * 
     *         // leave crossing wait area
     *         this.leaveQueue(sim.qCarXing);
     *     }
     * }
     * class TrafficLight extends Entity {
     *     async script() {
     *         let sim = this.simulation as CrossWalk;
     *         while (true) {
     *             this.setLight(Signal.GREEN);
     *             await this.delay(sim.cycle.green);
     *             this.setLight(Signal.YELLOW);
     *             await this.delay(sim.cycle.yellow);
     *             this.setLight(Signal.RED);
     *             await this.delay(sim.cycle.red);
     *         }
     *     }
     *     setLight(value: Signal) {
     *         const sim = this.simulation as CrossWalk;
     *         sim.light = value;
     *         let released = this.sendSignal(value);
     *         console.log('light is', Signal[sim.light], released, 'entities released at', sim.timeNow);
     *     }
     * }
     * ```
     * 
     * @param signal Value of the the signal to wait for.
     */
    async waitSignal(signal: any) {
        return new FecItem(this, {
            signal: signal
        }).promise;
    }
    /**
     * Releases entities that are currently waiting for a signal.
     * 
     * @param signal Value of the signal.
     * @param releaseMax Maximum number of entities to release.
     * If not specified, all entities waiting for the signal are
     * released.
     */
    sendSignal(signal: any, releaseMax?: number): number {
        let fec = this.simulation._fec,
            cnt = 0;
        for (let i = 0; i < fec.length; i++) {
            if (releaseMax != null && cnt >= releaseMax) {
                break;
            }
            let item = fec[i];
            if (item.options.signal == signal) {
                item.ready = true;
                cnt++;
            }
        }
        return cnt;
    }
    /**
     * Method invoked when an {@link Entity} finishes executing
     * its {@link script}.
     */
    dispose() {
        if (this._queues.size) {
            let queues = [];
            Array.from(this._queues.keys()).forEach(q => queues.push(q.name));
            assert(false, `Entity finished script without leaving all queues: ${queues.join(', ')}.`);
        }
    }
    /**
     * Returns a string representation of the {@link Entity}.
     * @returns 
     */
    toString() {
        return this.constructor.name + '#' + this.serial.toString()
    }
    /**
     * Async method that contains the sequence of operations to be
     * carried out by an {@link Entity} within a {@link Simulation}.
     * 
     * The {@link script} method contains the bulk of the simulation
     * logic. It typically contains of sequences of calls to methods
     * that cause the entity to 
     * enter or leave queues ({@link enterQueue}/{@link leaveQueue}),
     * undergo delays ({@link delay}), or
     * wait for and send signals ({@link waitSignal}/{@link sendSignal}).
     * 
     * For example:
     * ```typescript
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
    async script() {
        // override this in derived classes
    }
}

/**
 * Entity generator class used internally by the 
 * {@link Simulation.generateEntities} method.
 */
export class EntityGenerator extends Entity {
    private _type: any;
    private _interval: RandomVar | null;
    private _max: number;
    private _tmStart: number;
    private _tmEnd: number;

    /**
     * Initializes a new instance of the {@link EntityGenerator} class.
     * 
     * @param entityType Type of {@link Entity} to generate.
     * @param interval {@link RandomVar} that defines the entity inter-arrival times, or
     * **null** to generate a single entity.
     * @param max Maximum number of entities to generate.
     * @param startTime Simulated time when entity generation should start.
     * @param endTime Simulated time when entity generation should stop.
     */
    constructor(entityType: any, interval: RandomVar | null, max?: number, startTime?: number, endTime?: number) {
        super();
        this._type = entityType;
        this._interval = interval;
        this._max = max;
        this._tmStart = startTime;
        this._tmEnd = endTime;
    }

    /**
     * Generates entities according to a schedule.
     */
    async script() {
        const sim = this.simulation;
        const now = sim.timeNow;
        const interval = this._interval;

        // start delay
        if (this._tmStart != null && now < this._tmStart) {
            await this.delay(this._tmStart - now);
        }

        // initial interval (half)
        if (interval && this._tmStart == null) {
            await this.delay(interval.sample() / 2);
        }

        // creator loop
        for (let cnt = 0; ; cnt++) {

            // break on max entity count
            if (this._max != null && cnt >= this._max) {
                break;
            }

            // break on time limit
            if (this._tmEnd != null && sim.timeNow > this._tmEnd) {
                break; // reached max scheduled time
            }

            // create and activate an entity
            var e = new this._type;
            this.simulation.activate(e);

            // wait for the given interval or break if no interval
            if (interval) {
                await this.delay(interval.sample());
            } else {
                break;
            }
        }
    }
}
