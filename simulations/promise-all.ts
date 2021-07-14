import { Simulation } from '../simscript/simulation';
import { Queue } from '../simscript/queue';
import { Entity } from '../simscript/entity';
import { Exponential } from '../simscript/random';

export class PromiseAll extends Simulation {
    delay = new Exponential(100);
    qWork = new Queue('work', 1);
    qWait = new Queue('wait');
    onStarting() {
        super.onStarting();
        this.activate(new PromiseAllEntityMain());
    }
}
class PromiseAllEntityMain extends Entity<PromiseAll> {
    async script() {

        // create some child-tasks and run them all
        console.log('creating 5 child-tasks at', this.simulation.timeNow);
        let all = await Promise.all([
            this.simulation.activate(new PromiseAllEntityChild()),
            this.simulation.activate(new PromiseAllEntityChild()),
            this.simulation.activate(new PromiseAllEntityChild()),
            this.simulation.activate(new PromiseAllEntityChild()),
            this.simulation.activate(new PromiseAllEntityChild()),
        ]);
        console.log('all child-tasks done at', this.simulation.timeNow);
    }
}
class PromiseAllEntityChild extends Entity<PromiseAll> {
    async script() {
        const sim = this.simulation;
        console.log(this.serial, 'child starting at', this.simulation.timeNow);
        await this.seize(sim.qWork, sim.delay.sample(), sim.qWait);
        console.log(this.serial, 'child done at', this.simulation.timeNow);
    }
}
