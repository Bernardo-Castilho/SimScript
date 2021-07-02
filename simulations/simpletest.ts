import { Simulation, FecItem } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform, Exponential } from '../simscript/random';
import { assert } from '../simscript/util';

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

class SimpleEntity extends Entity {
    async script() {
        const sim = this.simulation as SimpleTest;

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

class SimplerEntity extends Entity {
    service = new Uniform(5, 10);
    async script() {
        let sim = this.simulation as SimpleTest;
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

class SimplestReally extends Entity {
    async script() {
        const sim = this.simulation as SimplestSimulation;

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
class GeneratorEntity extends Entity {
    async script() {
        const sim = this.simulation as Generator;
        sim.cnt++;
        console.log(' at', sim.timeNow);
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
class Interruptible extends Entity {
    async script() {
        const sim = this.simulation as Interrupt;
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
class Interruptor extends Entity {
    async script() {
        const sim = this.simulation as Interrupt;
        this.sendSignal(sim);
        await this.delay(sim.delay.sample());
        this.sendSignal(sim);
    }
}