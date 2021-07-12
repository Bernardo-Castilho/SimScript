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
        //await this.delay(this.simulation.delay.sample());
        await this.seize(sim.qWork, sim.delay.sample(), sim.qWait);//, sim.qWork);
        console.log(this.serial, 'child done at', this.simulation.timeNow);
    }
    /**
     * Seizes a resource (possibly preempting it), enters one or more waiting 
     * queues, performs a delay, and leaves the waiting queues and the resource.
     * 
     * @param resource Resource to seize.
     * @param delay Amount of time required to perform the work.
     * @param waitingQueues Waiting queues (defaults to none).
     * @param preemptSignal Signal used to pre-empt the resource (defaults to none).
     */
    async seize(resource: Queue, delay: number, waitingQueues: Queue[] | Queue = [], preemptSignal: any = null) {

        // handle a single waiting queue
        if (waitingQueues instanceof Queue) {
            waitingQueues = [waitingQueues];
        }

        // while we have a delay
        while (delay >= 1e-3) {

            // send signal to interrupt lower-priority entities
            if (preemptSignal != null) {
                this.sendSignal(preemptSignal);
            }

            // enter waiting queues, seize the resource
            waitingQueues.forEach(async (q: Queue) => await this.enterQueue(q));
            await this.enterQueue(resource);
            waitingQueues.forEach(q => this.leaveQueue(q));

            // apply interruptible delay and update delay value
            delay -= await this.delay(delay, null, resource);

            // release the resource (time-out or signal)
            this.leaveQueue(resource);
        }
    }
}
