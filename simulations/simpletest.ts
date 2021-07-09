import { Simulation, FecItem } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform, Exponential } from '../simscript/random';
import { assert, setOptions } from '../simscript/util';

// Simple Test
export class SimpleTest extends Simulation {
    qWait = new Queue('Wait');
    qService = new Queue('Service', 1);
    onStarting() {
        super.onStarting();

        console.log('activating SimpleEntity');
        this.activate(new SimpleEntity());

        console.log('generating 1000 SimplerEntity');
        this.generateEntities(SimplerEntity, new Uniform(5, 10), 1000);
    }
}
class SimpleEntity extends Entity<SimpleTest> {
    async script() {
        const sim = this.simulation;

        // call a separate async method
        console.log('started at', sim.timeNow);
        await this.doSomeOtherStuff();
        console.log('done some other stuff at', sim.timeNow);

        // now perform some simple tests
        let time = sim.timeNow;
        await this.enterQueue(sim.qWait);
        assert(time == sim.timeNow, 'no limit, no wait');
        await this.delay(0);
        assert(time == sim.timeNow, 'no delay, no wait');
        this.leaveQueue(sim.qWait);
        assert(time == sim.timeNow, 'no await, no wait');
        console.log('left wait at', sim.timeNow);
        let noWait = sim.qService.pop == 0;
        time = sim.timeNow;
        await this.enterQueue(sim.qWait);
        await this.enterQueue(sim.qService);
        console.log('entered service at', sim.timeNow);
        this.leaveQueue(sim.qWait);
        console.log('left service at', sim.timeNow);
        if (noWait) {
            assert(time == sim.timeNow, 'no customer, no wait');
        }
        time = sim.timeNow;
        await this.delay(10);
        this.leaveQueue(sim.qService);
        assert(sim.timeNow == time + 10, 'waited for 10 tu');
    }
    async doSomeOtherStuff() {
        const sim = this.simulation as SimpleTest;
        const cnt = 10;
        const delay = 10;
        const t = this.simulation.timeNow;
        for (let i = 0; i < cnt; i++) {
            await this.delay(delay);
        }
        assert(this.simulation.timeNow == t + cnt * delay, 'should have waited (cnt * delay) tus');
        console.log('other stuff done');
    }

}

class SimplerEntity extends Entity<SimpleTest> {
    service = new Uniform(5, 10);
    async script() {
        let sim = this.simulation;
        await this.enterQueue(sim.qWait);
        await this.enterQueue(sim.qService);
        this.leaveQueue(sim.qWait);
        await this.delay(this.service.sample());
        this.leaveQueue(sim.qService);
    }
}

export class SimplestSimulation extends Simulation {
    q = new Queue('simple');
    onStarting() {
        super.onStarting();
        this.activate(new SimplestReally());
    }
}
class SimplestReally extends Entity<SimplestSimulation> {
    async script() {
        const sim = this.simulation;

        console.log('calling enterLeave', sim.timeNow, 'fec', sim._fec.length);
        await this.enterLeave();
        console.log('returned from enterLeave', sim.timeNow);

        console.log('before delay 10', sim.timeNow);
        await this.delay(10);
        console.log('after delay 10', sim.timeNow);

        console.log('before delay 0', sim.timeNow);
        await this.delay(0);
        console.log('after delay 0', sim.timeNow);

        console.log('calling enterLeave', sim.timeNow, 'fec', sim._fec.length);
        await this.enterLeave();
        console.log('returned from enterLeave', sim.timeNow);

        await this.enterQueue(sim.q);
        this.leaveQueue(sim.q);
        await this.enterQueue(sim.q);
        await this.delay(10);
        await this.delay(0);
        this.leaveQueue(sim.q);
        console.log('** SimplestReally done at', sim.timeNow);
    }

    async enterLeave() {
        const sim = this.simulation as SimplestSimulation;
        for (let i = 0; i < 10; i++) {
            await this.enterQueue(sim.q);
            await this.delay(0);
            this.leaveQueue(sim.q);
            console.log('loop', i, sim.timeNow);
        }

        // ** REVIEW **
        // this is needed in case the async function doesn't 
        // cause any simulated delays
        new FecItem(this, { ready: true });
    }    
}

export class Generator extends Simulation {
    cnt = 0;
    onStarting() {
        super.onStarting();
        this.generateEntities(GeneratorEntity, 10, 100);
    }
    onFinished() {
        super.onFinished();
        console.log('cnt is', this.cnt);
        console.log('elapsed', this.timeElapsed);
    }
}
class GeneratorEntity extends Entity<Generator> {
    async script() {
        this.simulation.cnt++;
        console.log(' at', this.simulation.timeNow);
    }
}

// test interruptible delays
export class Interrupt extends Simulation {
    q = new Queue('the queue');
    delay = new Exponential(10);
    elapsed = 0;
    interrupted = 0;
    onStarting() {
        super.onStarting();
        this.timeEnd = 10000;
        this.elapsed = 0;
        this.interrupted = 0;
        this.generateEntities(Interruptible, new Exponential(10));
        this.generateEntities(Interruptor, new Exponential(10));
    }
}
class Interruptible extends Entity<Interrupt> {
    async script() {
        const sim = this.simulation;
        this.enterQueueImmediately(sim.q);
        const
            delay = sim.delay.sample(),
            timeSpent = await this.delay(delay, null, sim);
        if (Math.abs(timeSpent - delay) < 1e-10) { // account for floating point accuracy
            sim.elapsed++;
        } else {
            sim.interrupted++;
        }
        this.leaveQueue(sim.q);
    }
}
class Interruptor extends Entity<Interrupt> {
    async script() {
        const sim = this.simulation;
        this.sendSignal(sim);
        await this.delay(sim.delay.sample());
        this.sendSignal(sim);
    }
}

// test pre-empting enterQueue
export class Preempt extends Simulation {
    resource = new Queue('resource', 1);
    q0 = new Queue('Prty 0');
    q1 = new Queue('Prty 1');
    q2 = new Queue('Prty 2');
    onStarting() {
        super.onStarting();
        this.activate(new Prty0({
            priority: 0,
            start: 0,
            duration: 100
        }));
        this.activate(new Prty1({
            priority: 1,
            start: 10,
            duration: 10
        }));
        this.activate(new Prty2({
            priority: 2,
            start: 12,
            duration: 5
        }));
    }
}
class PreemptEntity extends Entity<Preempt> {
    start = 0;
    duration = 0;

    // constructor with extra options
    constructor(options?: any) {
        super(null);
        setOptions(this, options);
    }
    
    /**
     * Seizes a resource for a specified time, allowing entities with
     * higher priorities to pre-empt.
     * @param resource Resource to seize.
     * @param delay Amount of time to spend in the resource.
     * @param queues Queues to enter/leave while the resource is seized.
     */
    async preempt(resource: Queue, delay: number, queues: Queue[] = []) {

        // while we have a delay
        while (delay >= 1e-3) {

            // send signal to interrupt lower-priority entities
            this.sendSignal(resource);

            // seize the resource
            queues.forEach(q => this.enterQueueImmediately(q));
            await this.enterQueue(resource);
            queues.forEach(q => this.leaveQueue(q));

            // apply interruptible delay and update delay value
            delay -= await this.delay(delay, null, resource);

            // release the resource (time-out or signal)
            this.leaveQueue(resource);
        }
    }

    // log a message from an entity
    log(msg: string) {
        console.log(`${this.constructor.name} ${msg} at ${this.simulation.timeNow}`);
    }
}
class Prty0 extends PreemptEntity {
    async script() {
        const sim = this.simulation;
        this.log('arrived');
        await this.delay(this.start);
        await this.preempt(sim.resource, this.duration, [sim.q0]);
        assert(sim.timeNow == 115, 'should finish at 115');
        this.log('done (@115)');
    }
}
class Prty1 extends PreemptEntity {
    async script() {
        const sim = this.simulation;
        this.log('arrived');
        await this.delay(this.start);
        await this.preempt(sim.resource, this.duration, [sim.q1]);
        assert(sim.timeNow == 25, 'should finish at 25');
        this.log('done (@25)');
    }
}
class Prty2 extends PreemptEntity {
    async script() {
        const sim = this.simulation;
        this.log('arrived');
        await this.delay(this.start);
        await this.preempt(sim.resource, this.duration, [sim.q2]);
        assert(sim.timeNow == 17, 'should finish at 17');
        this.log('done (@17)');
    }
}
