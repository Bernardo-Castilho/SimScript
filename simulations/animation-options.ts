import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform } from '../simscript/random';
import { setOptions } from '../simscript/util';

export class AnimationOptions extends Simulation {
    qAngle = 270;
    qRotate = new Queue('Rotate');
    qCenter = new Queue('qcenter')
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
    splineTension = 0.5;
    interArrival = new Uniform(5, 10);
    moveDelayLong = new Uniform(50, 200);
    moveDelayShort = new Uniform(30, 60);
  
    onStarting() {
        super.onStarting();

        // create some entities to enter the rotating queue
        for (let i = 0; i < 6; i++) {
            this.activate(new RotatingEntity());
        }

        // create some entities to roam around
        this.generateEntities(RoamEntity, this.interArrival, 20);
    }
}

export class RotatingEntity extends Entity<AnimationOptions> {
    async script() {
        this.enterQueueImmediately(this.simulation.qRotate);
        await this.waitSignal(null); // wait forever
    }
}

export class RoamEntity extends Entity<AnimationOptions> {
    fast = false;

    constructor(options?: any) {
        super(null); // in case options includes 'fast'
        this.fast = this.serial % 2 == 0;
        setOptions(this, options);
    }

    async script() {
        let sim = this.simulation;
        for (; ;) {
            const moveDelay = this.fast
                ? sim.moveDelayShort // fast entity
                : sim.moveDelayLong; // slow entity
    
            await this.delay(moveDelay.sample(), {
                queues: [
                    sim.qCenter,
                    sim.q1, sim.q2, sim.q3, sim.q4, sim.q5,
                    sim.q11, sim.q10, sim.q9, sim.q8, sim.q7,
                    sim.qCenter
                    ],
                tension: sim.splineTension
            });
        }
    }
}
