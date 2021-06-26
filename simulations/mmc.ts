import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Exponential, LogNormal, RandomVar } from '../simscript/random';
import { Tally } from '../simscript/tally';

// MMC simulation
// time units: minutes
export class MMC extends Simulation {
    qWait = new Queue('Wait');
    qService = new Queue('Service', 2);
    interArrival = new Exponential(80);
    service = new Exponential(100);
    tally = new Tally();

    // generate entities with exponential inter-arrival times
    onStarting() {
        super.onStarting();

        // use seeded random generators with the same mean
        //// ** REVIEW: using the same seed produces wrong results?!?!?!?
        this.interArrival = new Exponential(this.interArrival.mean);
        this.service = new Exponential(this.service.mean);

        // get up tally histograms
        this.qWait.grossPop.setHistogramParameters(1, 0, 10);
        this.qWait.grossDwell.setHistogramParameters(60, 0, 500 - 0.1);

        // start simulation
        this.generateEntities(Customer, this.interArrival, 100000); // limit the # of customers
    }
}

// customer
class Customer extends Entity {
    async script() {
        let sim = this.simulation as MMC;

        if (sim.qWait.canEnter()) {
            this.enterQueueImmediately(sim.qWait); // faster (no await)
        } else {
            await this.enterQueue(sim.qWait); // same thing, but slower
        }
   
        if (sim.qService.canEnter()) {
            this.enterQueueImmediately(sim.qService); // faster (no await)
        } else {
            await this.enterQueue(sim.qService); // same thing, but slower
        }

        this.leaveQueue(sim.qWait);
        await this.delay(sim.service.sample());
        this.leaveQueue(sim.qService);
    }
}
