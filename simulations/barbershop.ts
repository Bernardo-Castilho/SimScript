import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform, Exponential } from '../simscript/random';

// https://try-mts.com/gpss-introduction-and-barber-shop-simulation/
export class BarberShop extends Simulation {
    qJoe = new Queue('Joe', 1);
    qWait = new Queue('Wait Area');

    // generate entities with inter-arrival times of 18 min for 8 hours * 7 days
    onStarting() {
        super.onStarting();
        this.timeEnd = 60 * 8 * 365; // 365 8-hour days
        this.qWait.grossDwell.setHistogramParameters(3);
        this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6));
    }
}
class Customer extends Entity {
    service = new Uniform(15 - 3, 15 + 3);
    async script() {
        const shop = this.simulation as BarberShop;
        await this.enterQueue(shop.qWait); // enter the line
        await this.enterQueue(shop.qJoe); // seize Joe the barber
        this.leaveQueue(shop.qWait); // leave the line
        await this.delay(this.service.sample()); // get a haircut
        this.leaveQueue(shop.qJoe); // free Joe        
    }
}
