import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform } from '../simscript/random';

// https://try-mts.com/gpss-introduction-and-barber-shop-simulation/
export class BarberShop extends Simulation {
    qJoe = new Queue('Joe', 1);
    qWait = new Queue('Wait Area');

    // generate entities with inter-arrival times of 18 min for 8 hours * 7 days
    onStarting() {
        super.onStarting();
        this.timeEnd = 60 * 8 * 7; // 8 hours * 7 days
        this.qWait.grossDwell.setHistogramParameters(1);
        this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6)); // arrivals every ~18min
    }
}
class Customer extends Entity<BarberShop> {
    service = new Uniform(15 - 3, 15 + 3); // service takes ~15min
    async script() {
        const sim = this.simulation;
        if (true) { // compact version: using seize
            await this.seize(sim.qJoe, this.service.sample(), sim.qWait);
        } else { // explicit version: using enterQueue/delay/leaveQueue
            await this.enterQueue(sim.qWait); // enter the line
            await this.enterQueue(sim.qJoe); // seize Joe the barber
            this.leaveQueue(sim.qWait); // leave the line
            await this.delay(this.service.sample()); // get a haircut
            this.leaveQueue(sim.qJoe); // free Joe        
        }
    }
}
