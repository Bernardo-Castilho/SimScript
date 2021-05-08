import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { assert } from '../simscript/util';

// Simple Test
export class SimpleTest extends Simulation {
    qWait = new Queue('Wait');
    qService = new Queue('Service', 1);
    onStarting() {
        super.onStarting();
        this.activate(new SimpleEntity());
    }
}

// customer
class SimpleEntity extends Entity {
    async script() {
        let sim = this.simulation as SimpleTest;

        console.log('started at', sim.timeNow);
        let time = sim.timeNow;
        await this.enterQueue(sim.qWait);
        await this.delay(0);
        this.leaveQueue(sim.qWait);
        assert(time == sim.timeNow, 'no limit, no wait');
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
}
