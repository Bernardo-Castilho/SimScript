import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';

// Simple Test
export class SimpleTest extends Simulation {
    qWait = new Queue('Wait');
    qService = new Queue('Service', 1);
    onStarting() {
        super.onStarting();
        this.generateEntities(SimpleEntity, null, 1, 0);
        this.generateEntities(SimpleEntity, null, 1, 5);
    }
}

// customer
class SimpleEntity extends Entity {
    async script() {
        let sim = this.simulation as SimpleTest;
        console.log(this.toString(), 'entered simulation at', sim.timeNow);
        //await this.enterQueue(sim.qWait);
        this.enterQueueImmediately(sim.qWait);
        console.log(this.toString(), 'entered wait at', sim.timeNow, sim.qWait.pop);
        await this.enterQueue(sim.qService);
        console.log(this.toString(), 'entered service at', sim.timeNow);
        this.leaveQueue(sim.qWait);
        console.log(this.toString(), 'left wait at', sim.timeNow);
        await this.delay(10);
        this.leaveQueue(sim.qService);
        console.log(this.toString(), 'left service at', sim.timeNow);
    }
}
