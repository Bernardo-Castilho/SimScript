import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform } from '../simscript/random';

export class Rotation extends Simulation {
    qAngle = 0;
    qRotate = new Queue('Rotate');
    qCircle: Queue[] = [];
    q1 = new Queue('q1');
    q2 = new Queue('q2');
    q3 = new Queue('q3');
    q4 = new Queue('q4');
    q5 = new Queue('q5');
    q6 = new Queue('q6');
    q7 = new Queue('q7');
    q8 = new Queue('q8');
    q9 = new Queue('q9');
    q10 = new Queue('q10');
    q11 = new Queue('q11');
    q12 = new Queue('q12');

    onStarting() {
        super.onStarting();

        // create 6 entities to enter and leave the center queue
        this.generateEntities(EnterLeave, new Uniform(0, 0), 6);

        // create 6 entities to roam around
        this.generateEntities(Roam, new Uniform(10, 10), 6, 0);

        // create an entity to slow things down
        this.activate(new SlowDowner());
    }
}

class EnterLeave extends Entity {
    async script() {
        let sim = this.simulation as Rotation;
        for (; ;) {
            await this.enterQueue(sim.qRotate);
            await this.delay(1000);
            this.leaveQueue(sim.qRotate);
        }
    }
}

class Roam extends Entity {
    async script() {
        let sim = this.simulation as Rotation;
        console.log(this.toString(), 'created at', sim.timeNow);
        for (; ;) {
            console.log(this.toString(), 'started q12=>q6 at', sim.timeNow);
            await this.move(30, {
                queues: [sim.q12, sim.q1, sim.q2, sim.q3, sim.q4, sim.q5, sim.q6],
                tension: 0.5
            });
            console.log(this.toString(), 'started q6=>q12 at', sim.timeNow);
            await this.move(30, {
                queues: [sim.q6, sim.q7, sim.q8, sim.q9, sim.q10, sim.q11, sim.q12],
                tension: 0.5
            });
            console.log(this.toString(), 'arrived at', sim.timeNow);
        }
    }
}

class SlowDowner extends Entity {
    async script() {
        for (; ;) {
            await this.delay(0.1);
        }
    }
}
