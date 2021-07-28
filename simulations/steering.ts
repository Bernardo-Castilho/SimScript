import { Simulation } from '../simscript/simulation';
import { Entity, IAnimationPosition } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { EventArgs } from '../simscript/event';
import { Uniform } from '../simscript/random';
import { IPoint, Point, setOptions, clamp } from '../simscript/util';

/**
 * Simulation used to show various steering behaviors.
 */
export class Steering extends Simulation {
    q = new Queue();
    step = 1;
    bounds = [new Point(), new Point(1000, 500)];
    _eCnt = 8;

    /**
     * Initializes a new instance of the {@link Steering} class.
     * @param options Object with parameters used to initialize the {@link Steering} instance.
     */
    constructor(options?: any) {
        super();
        this.frameDelay = 20;
        this.maxTimeStep = 0.01;
        setOptions(this, options);
    }

    /**
     * Gets or sets the number of entities to generate.
     */
    get entityCount(): number {
        return this._eCnt;
    }
    set entityCount(value: number) {
        if (value != this._eCnt) {
            this._eCnt = value;
            this.start(true);
        }
    }
    /**
     * Gets a random position within the animation surface.
     */ 
     getRandomPosition(): IPoint {
        return new Point(
            Math.round(Math.random() * this.bounds[1].x),
            Math.round(Math.random() * this.bounds[1].y));
    }
}

/**
 * Entities with a position, angle, speed, and an
 * updatePosition method.
 */
export class SteeringVehicle extends Entity<Steering> {
    _angle = 0; // in degrees, clockwise
    _sin = 0;
    _cos = 1;
    _pos: IPoint = new Point();
    _speed = 0;
    _speedMin = 0;
    _speedMax = null;
    _accel = 0;
    _steerAngle = 0;
    _steerAngleMax = 90;
    _lastUpdate = 0;
    color = 'black';

    /**
     * Gets or sets the entity's current position.
     */
    get position(): IPoint {
        return this._pos;
    }
    set position(value: IPoint) {
        this._pos = value;
    }
    /**
     * Gets or sets the entity's current angle.
     * 
     * The angle determines the entity's orientation (on the X-Y plane)
     * and the direction it is moving in.
     * 
     * The angle is measured in degrees, in the clockwise direction.
     */
    get angle(): number {
        return this._angle;
    }
    set angle(value: number) {
        this._angle = value;
        this._updateAngle();
    }
    /**
     * Gets or sets a value that represents the change, in degrees,
     * of the {@link angle} property per unit time.
     * 
     * The default value for this property is **0**.
     * 
     * See also the {@link steerAngleMax} property.
     */
    get steerAngle(): number {
        return this._steerAngle;
    }
    set steerAngle(value: number) {
        this._steerAngle = clamp(value, -this.steerAngleMax, this.steerAngleMax);
    }
    /**
     * Gets or sets the maximum {@link steerAngle} value, in degrees.
     * 
     * The default value for this property is **90** degrees, which means
     * the {@link steerAngle} property is clamped to values between 
     * -90 and +90 degrees.
     */
    get steerAngleMax(): number {
        return this._steerAngleMax;
    }
    set steerAngleMax(value: number) {
        this._steerAngleMax = value;
        this.steerAngle = this._steerAngle;
    }
    /**
     * Gets or sets a value that represents the entity's current speed
     * (amount by which to increase the entity's {@link position} in 
     * the direction determined by the entity's {@link angle} per
     * unit time). 
     */
    get speed(): number {
        return this._speed;
    }
    set speed(value: number) {
        this._speed = clamp(value, this.speedMin, this.speedMax);
    }
    /**
     * Gets or sets the minimum {@link speed} value.
     * 
     * The default value for this property is **0**.
     */
    get speedMin(): number {
        return this._speedMin;
    }
    set speedMin(value: number) {
        this._speedMin = value;
        this.speed = this._speed;
    }
    /**
     * Gets or sets the maximum {@link speed} value.
     * 
     * The default value for this property is **null**, which 
     * means there is no maximum speed limit.
     */
    get speedMax(): number {
        return this._speedMax;
    }
    set speedMax(value: number) {
        this._speedMax = value;
        this.speed = this._speed;
    }
    /**
     * Gets or sets a value that represents the entity's current
     * acceleration (amount by which to increase the entity's 
     * {@link speed} per unit time).
     */
    get acceleration(): number {
        return this._accel;
    }
    set acceleration(value: number) {
        this._accel = value;
    }
    /**
     * Updates the entity's angle, speed, and position after a given
     * time interval.
     */
    updatePosition(dt: number) {

        // update angle
        this.angle += this.steerAngle * dt;

        // update speed
        this.speed += this.acceleration * dt;

        // update position
        const p = this.position;
        p.x += this.speed * this._cos * dt;
        p.y += this.speed * this._sin * dt;
    }
    /**
     * Gets the angle to turn to in order to match a target angle.
     * 
     * Use this method to make gradual turns instead of changing
     * the angle abruptly to a new value.
     * 
     * @param targetAngle The angle we are aiming for.
     * @param dt The time step.
     * @param da The maximum angle to turn per time step.
     * @returns The new angle needed to make a gradual turn from the
     * current angle to the **targetAngle**.
     */
    getTurnAngle(targetAngle: number, dt: number, da = 2): number {
        const step = Math.max(da, da * dt); // turn up to da degrees at a time
        let delta = targetAngle - this.angle;

        // normalize delta to [-180,+180]
        if (delta < -180) {
            delta += 360;
        } else if (delta > 180) {
            delta -= 360;
        }

        // close enough
        if (Math.abs(delta) < step) {
            return targetAngle;
        }

        // get closer
        return this.angle + step * Math.sign(delta);
    }

    // gets the entity's current animation position and angle.
    getAnimationPosition(q: Queue, start: IPoint, end: IPoint): IAnimationPosition {
        const timeNow = this.simulation.timeNow;
        this.updatePosition(timeNow - this._lastUpdate);
        this._lastUpdate = timeNow;
        return this;
    }

    // normalizes the angle and updates the sin and cos values.
    private _updateAngle() {

        // normalize angle
        while (this._angle > 180) {
            this._angle -= 360;
        }
        while (this._angle < -180) {
            this._angle += 360;
        }

        // calculate sin and cos
        this._sin = Math.sin((this.angle) * Math.PI / 180);
        this._cos = Math.cos((this.angle) * Math.PI / 180);
    }
}

//------------------------------------------------------------------------------------
// SteeringArrive

/**
 * Steering simulation with Wander and Arrive entities.
 */
export class SteeringArrive extends Steering {
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.generateEntities(Wander, 0, this.entityCount);
        this.generateEntities(Arrive, 0, this.entityCount);
    }
}

/**
 * Entities that wander around the simulation surface, 
 * periodically updating their direction and speed.
 */
class Wander extends SteeringVehicle {
    steerChange = new Uniform(-20, +20);
    speedChange = new Uniform(-50, +50);

    async script() {
        const sim = this.simulation;

        // initialize entity properties
        this.color = 'orange';
        this.speedMin = 20;
        this.speedMax = 100;
        this.speed = this.speedMin + Math.random() * (this.speedMax - this.speedMin);
        this.steerAngleMax = 45;
        this.angle = Math.round(Math.random() * 360);
        this.position = sim.getRandomPosition();

        // start endless loop
        this.enterQueue(sim.q);
        for (let step = 0; ; step++) {

            // change speed and steering angle every 10 steps
            if (step % 10 == 0) {
                this.steerAngle += this.steerChange.sample();
                this.speed += this.speedChange.sample();
            }

            // move
            await this.delay(sim.step);
        }
    }

    // wrap position around the edges of the simulation
    updatePosition(dt: number) {

        // update speed/position/angle
        super.updatePosition(dt);

        // wrap position around simulation bounds
        const bounds = this.simulation.bounds;
        if (bounds) {
            const p = this.position;
            if (p.x < bounds[0].x) {
                p.x = bounds[1].x;
            } else if (p.x > bounds[1].x) {
                p.x = bounds[0].x;
            }
            if (p.y < bounds[0].y) {
                p.y = bounds[1].y;
            } else if (p.y > bounds[1].y) {
                p.y = bounds[0].y;
            }
        }
    }
}

/**
 * Entities that travel towards the center of the simulation surface,
 * arriving there with speed zero, and start a new trip when they arrive. 
 */
class Arrive extends SteeringVehicle {
    async script() {
        const sim = this.simulation;

        // initialize entity properties
        this.color = 'red';
        this.speed = 10;
        this.speedMax = 500;
        this.speedMin = 2;
        this.position = sim.getRandomPosition();
        this.angle = Math.random() * 360;
            
        // start endless loop
        this.enterQueue(sim.q);
        for (; ;) {
            await this.delay(sim.step);
        }
    }

    // update the position and angle to arrive at the target
    updatePosition(dt: number) {
        const
            sim = this.simulation,
            target = new Point(sim.bounds[1].x / 2, sim.bounds[1].y / 2);

        // update speed/position/angle
        super.updatePosition(dt);

        // adjust speed
        const
            dist = Point.distance(this.position, target),
            pct = dist / (sim.bounds[1].x / 4);
        this.speed = this.speedMax * pct;

        // adjust angle
        let angCenter = Point.angle(this.position, target);
        this.angle = this.getTurnAngle(angCenter, dt);

        // re-start when close to center
        if (dist < 10) {
            this.position = sim.getRandomPosition();
        }
    }
}

//------------------------------------------------------------------------------------
// SteeringChase

/**
 * Steering simulation with Chase entities.
 */
 export class SteeringChase extends Steering {
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.generateEntities(Chase, 0, this.entityCount);
    }
}

class Chase extends SteeringVehicle {
    target = new Wander();
    async script() {
        const sim = this.simulation;

        // initialize entity properties
        this.color = 'red';
        this.position = sim.getRandomPosition();
        this.angle = Math.random() * 360;
        this.speedMax = 500;

        // activate target Wander entity
        this.target.priority = 1;
        sim.activate(this.target);

        // start endless loop
        this.enterQueue(sim.q);
        for (; ;) {
            await this.delay(sim.step);
        }
    }

    // update the position and angle to chase the target
    updatePosition(dt: number) {
        const sim = this.simulation;

        // update speed/position/angle
        super.updatePosition(dt);

        // adjust speed
        const
            dist = Point.distance(this.position, this.target.position),
            pct = dist / (sim.bounds[1].x / 4);
        this.speed = this.speedMax * pct;

        // adjust angle
        let angTarget = Point.angle(this.position, this.target.position);
        this.angle = this.getTurnAngle(angTarget, dt);
    }
}

//------------------------------------------------------------------------------------
// SteeringAvoid

interface IObstacle {
    x: number,
    y: number,
    radius: number
}

/**
 * Steering simulation with Avoid entities.
 */
export class SteeringAvoid extends Steering {
    obstacles: IObstacle[] = [
        { x: 100, y: 400, radius: 50 },
        { x: 150, y: 300, radius: 30 },
        { x: 200, y: 150, radius: 80 },
        { x: 500, y: 350, radius: 100 },
        { x: 800, y: 200, radius: 50 },
        { x: 800, y: 400, radius: 75 },
    ];
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.generateEntities(Avoid, 0, this.entityCount);
    }

    /**
     * Gets a random position within the animation surface,
     * away from any obstacles.
     */
    getRandomPosition(): IPoint {
        return Math.random() < 0.5
            ? new Point(Math.round(Math.random() * this.bounds[1].x), 0)
            : new Point(0, Math.round(Math.random() * this.bounds[1].y));
    }
}

/**
 * A steering entity that avoids obstacles.
 */
class Avoid extends Wander {
    obstacle = null;

    // avoid obstacles
    updatePosition(dt: number) {
        const
            slowDown = 0.75,
            turnAngle = 1;

        // update speed/position/angle
        this.steerAngle = 0;
        super.updatePosition(dt);

        // find nearest obstacle
        const obstacle = this.getNearestObstacle();

        // change obstacle
        if (obstacle != this.obstacle) {
            if (this.obstacle == null && obstacle != null) { // start avoiding
                this.color = 'red';
                this.speed *= slowDown;
            } else if (this.obstacle != null && obstacle == null) { // done avoiding
                this.color = 'orange';
                this.speed /= slowDown;
            }
            this.obstacle = obstacle;
        }
        
        // avoid obstacle
        if (obstacle != null) {
            const direction = this.getAvoidDirection(obstacle);
            this.angle = this.getTurnAngle(this.angle + turnAngle * direction, dt);
        }
    }

    // checks an obstacle and returns -1 to turn left, +1 to turn right
    getAvoidDirection(obstacle: IObstacle): number {
        const
            p = this.position,
            d = Point.distance(p, obstacle),
            pStraight = {
                x: p.x + d * this._cos,
                y: p.y + d * this._sin,
            },
            pLeft = this.getBoundaryPoint(obstacle, -obstacle.radius),
            pRight = this.getBoundaryPoint(obstacle, +obstacle.radius);
        return Point.distance(pStraight, pLeft) < Point.distance(pStraight, pRight)
            ? -1 // turn left
            : +1; // turn right
    }

    // gets a point on an obstacle's boundary
    getBoundaryPoint(obstacle: IObstacle, side: number): IPoint {
        const
            p = this.position,
            d = Point.distance(p, obstacle),
            a = Point.angle(p, obstacle, true) + Math.atan2(side, d);
        return {
            x: p.x + d * Math.cos(a),
            y: p.y + d * Math.sin(a)
        };
    }

    // gets the nearest obstacle to this entity
    getNearestObstacle(): IObstacle {
        const
            sim = this.simulation as SteeringAvoid,
            avoidDistance = 20,
            pNow = this.position,
            pNext = {
                x: pNow.x + this._cos,
                y: pNow.y + this._sin
            };
        let obstacle = null,
            minDist = null;
        sim.obstacles.forEach(o => {
            const dist = Point.distance(pNow, o) - o.radius;
            if (minDist == null || dist < minDist) { // closer
                if (dist < avoidDistance) { // and close enough...
                    if (Point.distance(pNext, o) - o.radius < dist) { // and getting closer...
                        minDist = dist;
                        obstacle = o;
                    }
                }
            }
        });
        return obstacle;
    }
}
