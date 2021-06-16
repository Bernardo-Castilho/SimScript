import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Uniform, Exponential } from '../simscript/random';

//// TODO: This sample is still a work in progress.

const STRIP_LENGTH = 10000;

interface ICarFollow {
    speed: number;
    maxSpeed: number;
    accel: number;
    position: number;
}

export class CarFollow extends Simulation {
    strip: Car[] = [];
    timeIncrement = 1;
    interArrival = new Exponential(100);
    carSpeeds = new Uniform(50, 100);
    onStarting(e) {
        super.onStarting(e);
        this.generateEntities(Car, this.interArrival, 100);
    }
}

export class Car extends Entity implements ICarFollow {
    speed = 0;
    accel = 10;
    position = 0;
    maxSpeed = 0;

    async script() {
        const sim = this.simulation as CarFollow;
        const dt = sim.timeIncrement;
        this.maxSpeed = sim.carSpeeds.sample();

        // enter the strip
        ////console.log(this.toString(), 'entering at', sim.timeNow, 'speed', this.speed);
        sim.strip.push(this);

        // loop until the end of the strip
        while (this.position < STRIP_LENGTH) {
            this.speed = this.getSpeed(dt);
            await this.delay(dt);
            this.position += this.speed * dt;
            ////console.log(this.toString(), 'moving, now at', this.position, 'speed', this.speed);
        }

        // exit the strip
        sim.strip.splice(sim.strip.indexOf(this), 1);
        ////console.log(this.toString(), 'left at', sim.timeNow, 'speed', this.speed);
    }

    // gets the vehicle speed taking into account the max safe speed
    getSpeed(dt: number): number {
        const targetSpeed = Math.min(this.getSafeSpeed(dt), this.maxSpeed);
        if (targetSpeed > this.speed) { // accelerate
            return Math.min(targetSpeed, this.speed + this.accel * dt);
        }
        if (targetSpeed < this.speed) { // decelerate
            return Math.max(targetSpeed, this.speed - this.accel * dt);
        }
        return this.speed; // no change
    }

    // gets the speed that would allow this vehicle to stop
    // before hitting the vehicle ahead if it were to stop.
    getSafeSpeed(dt: number): number {

        // assume max speed
        let speed = this.maxSpeed;
        
        // get vehicle ahead of us (or end of the road)
        const vAhead = this.getCarAhead() as ICarFollow;
        if (vAhead != null) {

            // calculate vehicle ahead's breaking distance
            const dAhead = vAhead.position - this.position;
            let breakingDistance = dAhead;
            if (vAhead.speed && vAhead.accel) {
                breakingDistance += (vAhead.speed * vAhead.speed) / (2 * vAhead.accel);
            }

            // calculate max speed that allows us to break
            const rad = dt * dt / 4 - (this.speed * dt - 2 * breakingDistance) / this.accel;
            speed = rad > 0
                ? +this.accel * (Math.sqrt(rad) - dt / 2)
                : -this.accel * dt / 2;
        }

        // done 
        return speed;
    }

    // gets the car that is ahead of this one
    getCarAhead(): ICarFollow {
        const sim = this.simulation as CarFollow;
        let index = sim.strip.indexOf(this);
        if (index > 0) {
            return sim.strip[index - 1];
        }

        // no vehicle ahead, return end of the strip
        return {
            speed: 0,
            maxSpeed: 0,
            accel: 0,
            position: STRIP_LENGTH
        };
    }
}
