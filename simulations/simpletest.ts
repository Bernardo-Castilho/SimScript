import { Simulation, FecItem } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform } from '../simscript/random';
import { assert } from '../simscript/util';

// Simple Test
export class SimpleTest extends Simulation {
    qWait = new Queue('Wait');
    qService = new Queue('Service', 1);
    onStarting() {
        super.onStarting();
        this.activate(new SimpleEntity());
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

        console.log('done at', sim.timeNow);
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
        console.log('done with delays');
    }

}

class SimplerEntity extends Entity {
    service = new Uniform(10, 100);
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

        console.log('before delay 0', sim.timeNow);
        await this.delay(0);
        console.log('after delay 0', sim.timeNow);

        console.log('calling enterLeave', sim.timeNow, 'fec', sim._fec.length);
        await this.enterLeave();
        console.log('returned from enterLeave', sim.timeNow);

        await this.enterQueue(sim.q);
        console.log('entered queue at', sim.timeNow);
        this.leaveQueue(sim.q);
        console.log('left queue at', sim.timeNow);
        await this.delay(10);
        console.log('after delay 10', sim.timeNow);
        await this.delay(0);
        console.log('after another delay 0', sim.timeNow);
        console.log('** all done **');
    }

    async enterLeave() {
        const sim = this.simulation as SimplestSimulation;
        for (let i = 0; i < 10; i++) {
            await this.enterQueue(sim.q);
            await this.delay(0);
            this.leaveQueue(sim.q);
            console.log('loop', i, sim.timeNow);
        }

        // this is needed in case the async function doesn't 
        // cause any simulated delays
        new FecItem(this, { ready: true });
    }    
}
