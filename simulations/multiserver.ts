import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Exponential, Uniform, LogNormal } from '../simscript/random';

const _NUMSERVERS = 20;
const _INTERARR = 10;
const _SERVICE = _INTERARR * _NUMSERVERS * .8;

export class MultiServer extends Simulation {
    qMulti = new Queue('MultiServer', _NUMSERVERS);
    qMultiWait = new Queue('MultiServerWait');

    qSingle: Queue[] = [];
    qSingleWait = new Queue('SingleServerWait');

    qSingleNC: Queue[] = [];
    qSingleWaitNC = new Queue('SingleServerWaitNC');

    interArrival = new Exponential(_INTERARR);
    service = new Exponential(_SERVICE);

    constructor(options?: any) {
        super(options);
        for (let i = 0; i < _NUMSERVERS; i++) {
            this.qSingle.push(new Queue(`Single(${i})`, 1))
            this.qSingleNC.push(new Queue(`SingleNC(${i})`, 1))
        }
    }
    onStarting() {
        super.onStarting();

        // one multi-server resource
        this.generateEntities(MultiServerResource, this.interArrival);

        // n single-server resources
        this.generateEntities(SingleServerResources, this.interArrival);

        // n single-server resources, random server
        this.generateEntities(SingleServerResourcesNoChoice, this.interArrival);
    }
}

// entities that use multiple single-server resources
export class MultiServerResource extends Entity {
    async script() {
        const sim = this.simulation as MultiServer;

        // enter
        await this.enterQueue(sim.qMultiWait);
        await this.enterQueue(sim.qMulti);

        // wait
        await this.delay(sim.service.sample());

        // leave
        this.leaveQueue(sim.qMulti);
        this.leaveQueue(sim.qMultiWait);
    }
}

// entities that use n single-server resources and pick a server that is available
export class SingleServerResources extends Entity {
    async script() {
        const sim = this.simulation as MultiServer;
        await this.enterQueue(sim.qSingleWait);

        // select queue that is not busy
        let serviceQueue: Queue;
        while (serviceQueue == null) {
            for (let i = 0; i < sim.qSingle.length; i++) {
                let q = sim.qSingle[i];
                if (q.canEnter()) {
                    serviceQueue = q;
                    this.enterQueueImmediately(serviceQueue);
                    break;
                }
            }
            if (serviceQueue == null) {
                await this.waitSignal(SingleServerResources);
            }
        }

        // wait
        await this.delay(sim.service.sample());

        // leave
        this.leaveQueue(serviceQueue);
        this.leaveQueue(sim.qSingleWait);
        this.sendSignal(SingleServerResources);
    }
}

// entities that use n single-server resources and pick the server at random
export class SingleServerResourcesNoChoice extends Entity {
    async script() {
        const sim = this.simulation as MultiServer;
        await this.enterQueue(sim.qSingleWaitNC);

        // select a random service queue
        let i = Math.floor(Math.random() * _NUMSERVERS);
        let serviceQueue = sim.qSingleNC[i];

        // enter
        await this.enterQueue(serviceQueue);

        // wait
        await this.delay(sim.service.sample());

        // leave
        this.leaveQueue(serviceQueue);
        this.leaveQueue(sim.qSingleWaitNC);
    }
}