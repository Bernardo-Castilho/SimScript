import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Exponential, Uniform } from '../simscript/random';

export enum Signal {
    RED,
    YELLOW,
    GREEN,
}

// CrossWalk simulation
// time units: seconds
export class Crosswalk extends Simulation {
    qPedArr = new Queue('Pedestrian Arrival');
    qPedXing = new Queue('Pedestrian Crossing');
    qPedXed = new Queue('Pedestrian Crossed');
    qPedLeave = new Queue('Pedestrian Leaving');

    qCarArr = new Queue('Car Arrival');
    qCarXing = new Queue('Car Crossing');
    qCarXed = new Queue('Car Crossed');
    
    walkToXing = new Uniform(60, 120);
    walkAcross = new Uniform(10, 20);
    walkAway = new Uniform(120, 180);

    driveToXing = new Uniform(5, 6);
    driveAway = new Uniform(10, 12);

    pedestrianArrivalInterval = new Exponential(60 / 10); // 10/min
    carArrivalInterval = new Exponential(60 / 6); // 6/min

    cycle = {
        red: 20,
        yellow: 10,
        green: 30,
    };
    light = Signal.RED;

    // initialize Simulation
    constructor(options?: any) {
        super(options);
        this.timeUnit = 's';
        this.qPedXing.grossPop.setHistogramParameters(3);
        this.qCarXing.grossPop.setHistogramParameters(2);
        if (this.timeEnd == null) {
            this.timeEnd = 3600 * 24; // 24 hours
        }
    }

    // create entity generators
    onStarting() {
        super.onStarting();
        this.activate(new TrafficLight());
        this.generateEntities(Pedestrian, this.pedestrianArrivalInterval);
        this.generateEntities(Car, this.carArrivalInterval);
    }
}


// pedestrians
export class Pedestrian extends Entity<Crosswalk> {
    async script() {
        let sim = this.simulation;

        // walk to crosswalk
        await this.delay(sim.walkToXing.sample(), {
            queues: [sim.qPedArr, sim.qPedXing]
        });

        // enter pedestrian crosswalk
        await this.enterQueue(sim.qPedXing);

        // wait for green light
        while (sim.light != Signal.GREEN) {
            await this.waitSignal(Signal.GREEN);
        }

        // leave crossing
        this.leaveQueue(sim.qPedXing);

        // walk across and away
        await this.delay(sim.walkAcross.sample(), {
            queues: [sim.qPedXing, sim.qPedXed]
        });
        await this.delay(sim.walkAway.sample(), {
            queues: [sim.qPedXed, sim.qPedLeave]
        });
    }
}

// cars
export class Car extends Entity<Crosswalk> {
    async script() {
        let sim = this.simulation;

        // drive to crosswalk
        await this.delay(sim.driveToXing.sample(), {
            queues: [sim.qCarArr, sim.qCarXing]
        });

        // enter crosswalk
        await this.enterQueue(sim.qCarXing);

        // wait until red for pedestrians
        while (sim.light != Signal.RED) {
            await this.waitSignal(Signal.RED);
        }

        // leave crosswalk
        this.leaveQueue(sim.qCarXing);

        // drive away
        await this.delay(sim.driveAway.sample(), {
            queues: [sim.qCarXing, sim.qCarXed]
        });
    }
}

// traffic light
class TrafficLight extends Entity<Crosswalk> {
    async script() {
        let sim = this.simulation;
        while (true) {

            // turn green to allow pedestrians to cross
            this.setLight(Signal.GREEN);
            await this.delay(sim.cycle.green);

            // turn yellow to clear pedestrians
            this.setLight(Signal.YELLOW);
            await this.delay(sim.cycle.yellow);

            // turn red to allow cars to cross
            this.setLight(Signal.RED);
            await this.delay(sim.cycle.red);
        }
    }
    setLight(value: Signal) {
        this.simulation.light = value;
        this.sendSignal(value);
    }
}
