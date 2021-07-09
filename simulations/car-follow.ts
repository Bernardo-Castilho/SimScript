import { Simulation } from '../simscript/simulation';
import { Queue } from '../simscript/queue';
import { Entity, IAnimationPosition } from '../simscript/entity';
import { Uniform, Exponential } from '../simscript/random';
import { Point, IPoint } from '../simscript/util';
import { Event, EventArgs } from '../simscript/event';

interface ICar {
    speed: number;
    maxSpeed: number;
    accel: number;
    position: number;
}

export class CarFollow extends Simulation {
    timeIncrement = 2; // seconds
    totalCars = 1000; // number of cars to simulate
    stripLength = 1000; // meters
    carSpeeds = new Uniform(40 / 3.6, 100 / 3.6); // 40-100 km/h in m/s
    interArrival = new Exponential(20); // avg seconds between car arrivals
    qStrip = new Queue('strip');
    readonly carFinished = new Event<CarFollow, EventArgs>();

    onStarting(e) {
        super.onStarting(e);
        this.maxTimeStep = this.timeIncrement;
        this.generateEntities(Car, this.interArrival, this.totalCars);
    }
    onCarFinished(e?: EventArgs) {
        this.carFinished.raise(this, e);
    }
}

export class Car extends Entity<CarFollow> implements ICar {
    speed = 0; // starting speed
    accel = 10; // acceleration/deceleration
    position = 0; // current position
    maxSpeed = 0; // random value from simulation

    async script() {
        const sim = this.simulation;
        const dt = sim.timeIncrement;
        this.maxSpeed = sim.carSpeeds.sample();

        // enter the strip
        this.enterQueueImmediately(sim.qStrip);

        // loop until the end of the strip
        while (this.position < sim.stripLength) {
            this.speed = this.getSpeed(dt);
            await this.delay(dt);
            this.position += this.speed * dt;
        }

        // exit the strip
        this.leaveQueue(sim.qStrip);
        sim.onCarFinished();
    }

    // gets the car's animation position
    getAnimationPosition(q: Queue, start: IPoint, end: IPoint): IAnimationPosition {
        const
            sim = this.simulation,
            pt = Point.interpolate(start, end, this.position / sim.stripLength);
        return {
            position: pt,
            angle: Point.angle(start, end, false)
        }
    }

    // gets the vehicle speed taking into account the max safe speed
    getSpeed(dt: number): number {
        const safeSpeed = Math.min(this.getSafeSpeed(dt), this.maxSpeed);
        if (safeSpeed > this.speed) { // accelerate
            return Math.min(safeSpeed, this.speed + this.accel * dt);
        }
        if (safeSpeed < this.speed) { // decelerate
            return Math.max(safeSpeed, this.speed - this.accel * dt);
        }
        return this.speed; // no change
    }

    // gets the speed that would allow this vehicle to stop
    // before hitting the vehicle ahead if it were to stop.
    getSafeSpeed(dt: number): number {

        // assume max speed
        let speed = this.maxSpeed;
        
        // get vehicle ahead of us (or end of the road)
        const vAhead = this.getCarAhead();
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
                : -this.accel * dt / 2; // no time to stop, negative speed...
        }

        // done 
        return Math.max(0, speed);
    }

    // gets the car that is ahead of this one
    getCarAhead(): ICar {
        const
            sim = this.simulation,
            strip = sim.qStrip.entities;

        // index 0 is the first car
        let index = strip.indexOf(this);
        if (index > 0) {
            return strip[index - 1] as Car;
        }

        // no vehicle ahead, stop at the end of the strip
        return {
            speed: 0,
            maxSpeed: 0,
            accel: 0,
            position: sim.stripLength
        };
    }
}
