import { Simulation } from './simulation';
import { Entity } from './entity';
import { Tally } from './tally';
import { assert, setOptions } from './util';

/**
 * Class that represents a resource and collects statistics within 
 * a simulation.
 * 
 * We refer to queues and resources interchangeably. Resources are
 * just Queues with limited capacity. Seizing a resource is the
 * same as entering a Queue, and releasing a resource is the same
 * as leaving a Queue.
 * 
 * Queues can be seized and released by entities while the simulation
 * runs using the {@link Entity.enterQueue} and {@link Entity.leaveQueue}
 * methods.
 * 
 * When that happens, the simulation collects aggregate statistics
 * about the number of entities in the queue and the amount of time
 * they spent there.
 * 
 * For example, the script below causes entities to enter a waiting
 * queue, seize one capacity unit of a server queue, leave the waiting 
 * queue, undergo a delay that represents the service, then leave the
 * server:
 * 
 * ```typescript
 * class Customer extends Entity<BarberShop> {
 *     service = new Uniform(15 - 3, 15 + 3);
 *     async script() {
 *         const shop = this.simulation;
 *         await this.enterQueue(shop.qWait); // enter the line (unlimited capacity)
 *         await this.enterQueue(shop.qJoe); // seize Joe the barber (capacity == 1)
 *         this.leaveQueue(shop.qWait); // leave the line
 *         await this.delay(this.service.sample()); // get a haircut
 *         this.leaveQueue(shop.qJoe); // free Joe        
 *     }
 * }
 * ```
 * 
 * Queue statistics can be obtained at the end of the simulation by
 * inspecting the queue's {@link grossPop} and {@link grossDwell} 
 * {@link Tally} objects.
 * 
 * You can also generate complete reports on queue utilization using 
 * the {@link Simulation.getStatsTable} method.
 * 
 * In addition to the {@link Entity.enterQueue} and {@link Entity.leaveQueue}
 * methods, SimScript has an {@link Entity.seize} method that provides a
 * shorter way to instruct entities to enter one or more waiting queues
 * (unlimited capacity), seize a resource (limited capacity), undergo a delay,
 * and leave the waiting queues.
 * 
 * For example, the code below uses the {@link Entity.seize} method to perform
 * the same tasks as the script listed above:
 * 
  * ```typescript
 * class Customer extends Entity<BarberShop> {
 *     service = new Uniform(15 - 3, 15 + 3);
 *     async script() {
 *         const shop = this.simulation;
 * 
 *         // seize method: enter the line, seize the barber, leave the line,
 *         // get a haircut, release the barber
 *         await this.seize(shop.qJoe, this.service.sample(), shop.qWait);
 *     }
 * }
 * ```
 */
export class Queue {
    private _sim: Simulation | null = null;
    private _name = '';
    private _capy: number | null = null;
    private _items = new Map<Entity, QueueItem>();
    private _entities: Entity[];
    private _tmLastChange = 0;
    private _inUse = 0;
    private _totalIn = 0;
    private _grossPop = new Tally();
    private _grossDwell = new Tally();
    private _netPop = new Tally();
    private _netDwell = new Tally();
    
    /**
     * Initializes a new instance of a {@link Queue} object.
     * 
     * @param name Queue name.
     * This is the name that will appear in reports generated by the 
     * {@link Simulation.getStatsTable} method.
     * If ommitted, the queue will not be included in any reports.
     * @param capacity Queue capacity.
     * If an entity tries to enter a queue that does not have enough capacity,
     * it enters a wait state until another entity leaves the queue and enough
     * capacity becomes available.
     * If ommitted, the queue has infinite capacity.
     * @param options Object with parameters used to initialize the {@link Queue}.
     */
    constructor(name = '', capacity: number | null = null, options?: any) {
        this._name = name;
        this._capy = capacity;
        setOptions(this, options);
    }
    /**
     * Gets or sets the {@link Queue} name.
     * 
     * The queue's name is used in output reports such as the ones
     * created by the {@link Simulation.getStatsTable} method.
     */
    get name(): string {
        return this._name;
    }
    set name(value: string) {
        this._name = value;
    }
    /**
     * Gets or sets the {@link Queue} capacity.
     * 
     * The queue's capacity limits the flow of entities through the
     * simulation. When an entity tries to enter a queue that is 
     * at capacity, it is forced to wait until another entity exits
     * the queue.
     * 
     * This property is set to **null** by default, which means the
     * queue has infinite capacity.
     */
    get capacity(): number | null {
        return this._capy;
    }
    set capacity(value: number | null) {
        this._capy = value;
    }
    /**
     * Gets the total number of capacity units currently in use.
     * 
     * The {@link Entity.enterQueue} method allows entities to seize
     * arbitry capacity units when entering queues. 
     * If all entities seize one capacity unit when entering the queue,
     * then the {@link unitsInUse} property returns the same value as the 
     * {@link pop} property.
     */
    get unitsInUse(): number {
        return this._inUse;
    }
    /**
     * Gets the number of entities currently in the queue.
     * 
     * This value is usually, but not always, the same as the number
     * of queue capacity units in use.
     * 
     * By default, entities entering queues use up one capacity unit.
     * In this case, the **pop** and **unitsInUse** properties will
     * return the same value. But if entities take arbitrary queue 
     * capacity units when they enter the queue, those values will 
     * be different.
     */
    get pop(): number {
        return this._items.size;
    }
    /**
     * Gets the total number of entities that have entered the queue
     * since the simulation started.
     */
    get totalIn(): number {
        return this._totalIn;
    }
    /**
     * Gets an array containing the entities currently in the {@link Queue}.
     */
    get entities(): Entity[] {
        if (!this._entities) {
            this._entities = Array.from(this._items.keys());
        }
        return this._entities;
    }
    /**
     * Gets a **Map** where the keys are the entities in the queue and the values
     * are {@link QueueItem} objects containing information about the entities.
     */
    get items(): Map<Entity, QueueItem> {
        return this._items;
    }
    /**
     * Gets the last simulated time when an entity entered or left the queue.
     */
    get lastChange(): number {
        return this._tmLastChange;
    }
    /**
     * Gets a {@link Tally} object containing statistics about the queue population
     * (capacity units used).
     */
    get grossPop(): Tally {
        return this._grossPop;
    }
    /**
     * Gets a {@link Tally} object containing statistics about the queue dwell times
     * (amount of simulated time during which capacity units were in use).
     */
    get grossDwell(): Tally {
        return this._grossDwell;
    }
    /**
     * Gets a {@link Tally} object containing statistics about the queue **net** population
     * (capacity units used).
     * 
     * This {@link Tally} excludes periods when the {@link Queue} was empty.
     */
    get netPop(): Tally {
        return this._netPop;
    }
    /**
     * Gets a {@link Tally} object containing statistics about the queue **net** dwell times
     * (amount of simulated time during which capacity units were in use).
     * 
     * This {@link Tally} excludes periods when the {@link Queue} was empty.
     */
    get netDwell(): Tally {
        return this._netDwell;
    }
    /**
     * Gets the queue utilization. 
     * 
     * This value is calculated based on the queue's {@link capacity} and
     * {@link grossPop} tally.
     */
    get utilization(): number {
        return this.capacity ? this.grossPop.avg / this.capacity : 0;
    }
    /**
     * Gets the total number of entities/units that were seized and
     * released during the simulation.
     */
    get totalCount(): number {
        return this.grossDwell.cnt;
    }
    /**
     * Gets the average queue length in entities/units.
     */
     get averageLength(): number {
        return this.grossPop.avg;
    }
    /**
     * Gets the maximum queue length in entities/units.
     */
     get maxLength(): number {
        return this.grossPop.max;
    }
    /**
     * Gets the average dwell time for entities/units in this queue.
     */
     get averageDwell(): number {
        return this.grossDwell.avg;
    }
    /**
     * Gets the maximum dwell time for entities/units in this queue.
     */
     get maxDwell(): number {
        return this.grossDwell.max;
    }
    /**
     * Checks whether the {@link Queue} has enough capacity to accept a new entry.
     * 
     * @param units Number of units to check for.
     * @returns True {@link Queue} has at least **units** capacity units available,
     * false otherwise.
     */
    canEnter(units = 1): boolean {
        return this.capacity == null || this.unitsInUse + units <= this.capacity;
    }
    /**
     * Adds an {@link Entity} to the {@link Queue}.
     * 
     * @param e {@link Entity} to add to the {@link Queue}.
     * @param units Number of capacity units to seize.
     * @returns True if the {@link Entity} was added to the {@link Queue}, false otherwise.
     */
    add(e: Entity, units = 1) {

        // remember the simulation we're in
        let sim = this._sim;
        if (sim == null) {
            sim = this._sim = e.simulation;
            sim.queues.push(this);
            sim.queues.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? +1 : 0);
            this._tmLastChange = 0;
        } else if (sim != e.simulation) {
            assert(false, 'Queue already in use by another simulation');
        }

        // check that the entity is not already in the queue
        assert(this._items.get(e) == null, () => e.toString() + ' is already in queue' + this.name);

        // check that the entity fits
        assert(this.canEnter(units), 'Queue does not have enough capacity');
        
        // update tallies before adding
        this._updatePopTallies();

        // add the entity to the queue
        e._queues.set(this, true);
        this._items.set(e, new QueueItem(e, units, sim.timeNow));
        this._inUse += units;
        this._totalIn++;

        // update entities array
        const ents = this._entities;
        if (ents) {
            ents.push(e);
        }
    }
    /**
     * Removes an {@link Entity} from this {@link Queue}.
     * 
     * @param e {@link Entity} to remove from the {@link Queue}.
     * 
     * If the {@link Entity} is not currently in the {@link Queue}, an exception is thrown.
     */
    remove(e: Entity) {

        // get the item
        const item = this._items.get(e) as QueueItem;
        assert(item != null, () => 'Entity ' + e.toString() + ' is not in queue ' + this.toString());

        // update tallies
        this._updatePopTallies();
        this._updateDwellTallies(item.timeIn);

        // remove item from queue
        this._items.delete(e);
        e._queues.delete(this);
        this._inUse -= item.units;

        // update entities array
        const ents = this._entities;
        if (ents) {
            ents.splice(ents.indexOf(e), 1);
        }
    }
    /**
     * Resets the {@link Queue} to its initial state, removing all entities and
     * resetting all its {@link Tally} objects.
     */
    reset() {
        this._sim = null;
        this._inUse = 0;
        this._totalIn = 0;
        this._tmLastChange = 0;
        this._entities = null;
        this._items.clear();
        this._grossPop.reset();
        this._grossDwell.reset();
        this._netPop.reset();
        this._netDwell.reset();
    }

    // ** implementation

    // called by the simulation when finishing up
    /** internal */ _updateTallies() {
        this._updatePopTallies();
        for (let item of this.items.values()) {
            this._updateDwellTallies(item.timeIn);
        }        
    }

    // update population tallies
    protected _updatePopTallies() {
        const
            value = this._inUse,
            timeNow = this._sim.timeNow,
            timeDelta = timeNow - this._tmLastChange;
        assert(timeDelta >= 0, 'Time delta cannot be negative');
        this._grossPop.add(value, timeDelta);
        if (value) {
            this._netPop.add(value, timeDelta);
        }
        this._tmLastChange = timeNow;
    }

    // update dwell time tallies
    protected _updateDwellTallies(timeIn: number) {
        const dwell = this._sim.timeNow - timeIn;
        assert(dwell >= 0, 'Dwell time cannot be negative');
        this._grossDwell.add(dwell, 1);
        if (dwell > 0) {
            this._netDwell.add(dwell, 1);
        }
    }
}

/**
 * Class that contains information about entitities in queues.
 */
class QueueItem {
    protected _e: Entity;
    protected _units: number;
    protected _timeIn: number;

    /**
     * 
     * @param e {@link Entity} in the {@link Queue}.
     * @param units {@link Queue} capacity units in use by the {@link Entity}.
     * @param timeIn Simulated time when the {@link Entity} entered the {@link Queue}.
     */
    constructor(e: Entity, units: number, timeIn: number) {
        this._e = e;
        this._units = units;
        this._timeIn = timeIn;
    }

    /**
     * Gets a reference to the {@link Entity} in the {@link Queue}.
     */
    get entity(): Entity {
        return this._e;
    }
    /**
     * Gets the number {@link Queue} capacity units in use by the {@link Entity}
     */
    get units(): number {
        return this._units;
    }
    /**
     * Gets the simulated time when the {@link Entity} entered the {@link Queue}.
     */
    get timeIn(): number {
        return this._timeIn;
    }
}
