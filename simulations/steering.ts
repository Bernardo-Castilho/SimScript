import { Simulation, SimulationState } from '../simscript/simulation';
import { Entity, IAnimationPosition } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Event, EventArgs } from '../simscript/event';
import { RandomVar, Uniform } from '../simscript/random';
import { IPoint, Point, setOptions, clamp } from '../simscript/util';

const
    FAST_MODE_FRAMEDELAY = 1,
    SLOW_MODE_FRAMEDELAY = 30;

/**
 * Simulation used to show various steering behaviors.
 * It defines properties that determine the animation **bounds**, 
 * a **slowMode**, and the **entityCount**. 
 * It also provides a **getRandomPosition** method for generating
 * random positions for entities.
 */
export class SteeringBehaviors extends Simulation {
    q = new Queue();
    step = 0.01; // simulated time step
    bounds = [new Point(), new Point(1000, 500)]; // simulation bounds
    _eCnt = 8; // start with 8 entities

    /**
     * Initializes a new instance of the {@link SteeringBehaviors} class.
     * @param options Object with parameters used to initialize the {@link SteeringBehaviors} instance.
     */
    constructor(options?: any) {
        super();
        this.slowMode = false;
        setOptions(this, options);
    }
    /**
     * Gets or sets a value that determines the simulation speed.
     */
    get slowMode(): boolean {
        return this.frameDelay == SLOW_MODE_FRAMEDELAY;
    }
    set slowMode(value: boolean) {
        this.frameDelay = value ? SLOW_MODE_FRAMEDELAY : FAST_MODE_FRAMEDELAY;
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
 * {@link updatePosition} method.
 */
export class SteeringVehicle extends Entity<SteeringBehaviors> {
    _speed = 0;
    _speedMin = 0;
    _speedMax = null;
    _accel = 0;
    _angle = 0; // in degrees, clockwise
    _sin = 0;
    _cos = 1;
    _pos: IPoint = new Point();
    _steerAngle = 0;
    _steerAngleMax = 90;
    _lastUpdate = 0;
    color = 'black';
    radius = 25; // to detect collisions
    behaviors: SteeringBehavior[] = []; // no behaviors by default
  
    /**
     * Initializes a new instance of the {@link SteeringVehicle} class.
     */
    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

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

        // normalize value
        while (value > 180) {
            value -= 360;
        }
        while (value < -180) {
            value += 360;
        }

        // save angle, sin, and cos
        this._angle = value;
        this._sin = Math.sin((value) * Math.PI / 180);
        this._cos = Math.cos((value) * Math.PI / 180);
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

        // apply all behaviors
        if (this.behaviors) {
            this.behaviors.forEach(b => b.applyBehavior(this, dt));
        }

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
    /**
     * Gets the entity's current animation position and angle.
     */
    getAnimationPosition(q: Queue, start: IPoint, end: IPoint): IAnimationPosition {
        const timeNow = this.simulation.timeNow;
        this.updatePosition(timeNow - this._lastUpdate);
        this._lastUpdate = timeNow;
        return this;
    }
    /**
     * Enter the single queue and wait.
     */
    async script() {
        const sim = this.simulation;
        this.enterQueueImmediately(sim.q);
        for (; ;) {
            await this.delay(sim.step);
        }
    }
}

//------------------------------------------------------------------------------------
// Steering Behaviors

/**
 * Base class for Steering Behaviors.
 */
export abstract class SteeringBehavior {
    entity: SteeringVehicle;

    constructor(options?: any) {
        setOptions(this, options);
    }

    applyBehavior(e: SteeringVehicle, dt: number): void {
        this.entity = e;
    }
}

/**
 * Interface implemented by objects that acts as obstacles.
 */
 export interface IObstacle {
    position: IPoint,
    radius: number
}

/**
 * WrapBehavior: Entity wraps around the simulation surface.
 */
export class WrapBehavior extends SteeringBehavior {
    applyBehavior(e: SteeringVehicle, dt: number) {
        super.applyBehavior(e, dt);
        const bounds = e.simulation.bounds;
        if (bounds) {
            const p = e.position;
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
 * WanderBehavior: Entity wanders around the simulation surface.
 */
export class WanderBehavior extends SteeringBehavior {
    changeInterval = 10;
    steerChange: RandomVar = null;
    speedChange: RandomVar = null;
    _timeLastChange = 0;
    
    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    applyBehavior(e: SteeringVehicle, dt: number) {
        super.applyBehavior(e, dt);
        const now = e.simulation.timeNow;
        if (now - this._timeLastChange >= this.changeInterval) {
            if (this.steerChange != null) {
                e.steerAngle += this.steerChange.sample();
            }
            if (this.speedChange != null) {
                e.speed += this.speedChange.sample();
            }
            this._timeLastChange = now;
        }
    }
}

/**
 * SeekBehavior: Entity moves toward a target.
 */
export class SeekBehavior extends SteeringBehavior {
    target: IPoint = null;
    maxTurnAngle = 2; // turn up to 2 degrees per time step
    readonly arrive = new Event();

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    applyBehavior(e: SteeringVehicle, dt: number) {
        super.applyBehavior(e, dt);
        if (this.target) {
            const sim = e.simulation;

            // adjust speed
            const
                dist = Point.distance(e.position, this.target),
                pct = dist / (sim.bounds[1].x / 2);
            e.speed = e.speedMax * pct;

            // adjust angle
            let angTarget = Point.angle(e.position, this.target);
            e.angle = e.getTurnAngle(angTarget, dt, this.maxTurnAngle);

            // re-start when close to center
            if (dist < e.radius) {
                this.onArrive();
            }
        }
    }
    onArrive(e?: EventArgs) {
        this.arrive.raise(this, e);
    }
}

/**
 * AvoidBehavior: Entity avoids obstacles.
 */
export class AvoidBehavior extends SteeringBehavior {
    obstacles: IObstacle[] = [];
    avoidColor = '';
    slowDown = 0.75;
    turnAngle = 2;
    _currentObstacle: IObstacle = null;
    _saveColor = '';

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    applyBehavior(e: SteeringVehicle, dt: number) {
        super.applyBehavior(e, dt);

        // find nearest obstacle
        const obstacle = this._getNearestObstacle();

        // change obstacle
        if (obstacle != this._currentObstacle) {
            if (this._currentObstacle == null && obstacle != null) { // start avoiding
                if (this.avoidColor) {
                    this._saveColor = e.color;
                    e.color = this.avoidColor;
                }
                e.speed *= this.slowDown;
            } else if (this._currentObstacle != null && obstacle == null) { // done avoiding
                if (this._saveColor) {
                    e.color = this._saveColor;
                }
                e.speed /= this.slowDown;
            }
            this._currentObstacle = obstacle;
        }
        
        // avoid obstacle
        if (obstacle != null) {
            const direction = this._getAvoidDirection(obstacle);
            e.angle = e.getTurnAngle(e.angle + this.turnAngle * direction, dt);
            e.steerAngle = 0; // don't turn while avoiding
        }
    }

    // gets the nearest obstacle to an entity
    _getNearestObstacle(): IObstacle {
        const
            e = this.entity as SteeringVehicle,
            pNow = e.position,
            pNext = {
                x: pNow.x + e._cos,
                y: pNow.y + e._sin
            };
        let obstacle = null,
            minDist = null;
        this.obstacles.forEach(o => {
            if (o != e) {
                const dist = Point.distance(pNow, o.position) - o.radius;
                if (minDist == null || dist < minDist) { // closer
                    if (dist < e.radius) { // and close enough...
                        if (Point.distance(pNext, o.position) - o.radius < dist) { // and getting closer...
                            minDist = dist;
                            obstacle = o;
                        }
                    }
                }
            }
        });
        return obstacle;
    }

    // checks an obstacle and returns -1 to turn left, +1 to turn right
    _getAvoidDirection(obstacle: IObstacle): number {
        const
            e = this.entity,
            p = e.position,
            d = Point.distance(p, obstacle.position),
            pStraight = {
                x: p.x + d * e._cos,
                y: p.y + d * e._sin,
            },
            pLeft = this._getBoundaryPoint(obstacle, -obstacle.radius),
            pRight = this._getBoundaryPoint(obstacle, +obstacle.radius);
        return Point.distance(pStraight, pLeft) < Point.distance(pStraight, pRight)
            ? -1 // turn left
            : +1; // turn right
    }
    
    // gets a point on an obstacle's boundary
    _getBoundaryPoint(obstacle: IObstacle, side: number): IPoint {
        const
            p = this.entity.position,
            d = Point.distance(p, obstacle.position),
            a = Point.angle(p, obstacle.position, true) + Math.atan2(side, d);
        return {
            x: p.x + d * Math.cos(a),
            y: p.y + d * Math.sin(a)
        };
    }
}    

//------------------------------------------------------------------------------------
// SteeringWander Simulation

export function getWanderProps(sim: SteeringBehaviors) {
    return {
        color: 'orange',
        speedMin: 10,
        speedMax: 50,
        speed: 10 + Math.random() * (50 - 10),
        steerAngleMax: 45,
        angle: Math.round(Math.random() * 360),
        position: sim.getRandomPosition(),
    }
};

/**
 * Steering simulation with entities that wander around the animation
 * (wrapping at the edges).
 */
export class SteeringWander extends SteeringBehaviors {
    onStarting(e?: EventArgs) {
        super.onStarting(e);

        for (let i = 0; i < this.entityCount; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new WanderBehavior({
                        steerChange: new Uniform(-20, +20),
                        speedChange: new Uniform(-20, +20)
                    }),
                    new WrapBehavior()
                ],
            });
            this.activate(e);
        }
    }
}

//------------------------------------------------------------------------------------
// SteeringSeek Simulation

/**
 * Steering simulation with entities that seek a target
 * (and re-start at a random position when they arrive).
 */
export class SteeringSeek extends SteeringBehaviors {
    onStarting(e?: EventArgs) {
        super.onStarting(e);

        for (let i = 0; i < this.entityCount; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new SeekBehavior({
                        target: { // move towards the center
                            x: this.bounds[1].x / 2,
                            y: this.bounds[1].y / 2
                        },
                        maxTurnAngle: 0.5, // turn up to 0.5 degrees/unit time
                        arrive: s => { // re-start at random position on arrival
                            s.entity.position = this.getRandomPosition();
                        }
                    }),
                ],
            });
            this.activate(e);
        }
    }
}

//------------------------------------------------------------------------------------
// SteeringChase Simulation

/**
 * Steering simulation with entities that seek a wandering target
 * entity.
 */
 export class SteeringChase extends SteeringBehaviors {
    onStarting(e?: EventArgs) {
        super.onStarting(e);

        for (let i = 0; i < this.entityCount; i++) {

            // create wandering target entity
            const target = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new WanderBehavior({
                        steerChange: new Uniform(-20, +20),
                        speedChange: new Uniform(-50, +50)
                    }),
                    new WrapBehavior()
                ],
            });
            this.activate(target);

            // create chaser entity
            const e = new SteeringVehicle({
                color: 'red',
                speedMax: 100,
                position: this.getRandomPosition(),
                behaviors: [
                    new SeekBehavior({
                        target: target.position
                    }),
                ],
            });
            this.activate(e);
        }
    }
}

//------------------------------------------------------------------------------------
// SteeringAvoid Simulation

const staticObstacles: IObstacle[] = [
    { position: { x: 100, y: 400 }, radius: 50 },
    { position: { x: 150, y: 300 }, radius: 30 },
    { position: { x: 200, y: 150 }, radius: 80 },
    { position: { x: 500, y: 250 }, radius: 125 },
    { position: { x: 800, y: 200 }, radius: 50 },
    { position: { x: 800, y: 400 }, radius: 75 },
];

/**
 * Steering simulation with entities that avoid obstacles.
 */
export class SteeringAvoid extends SteeringBehaviors {
    obstacles = staticObstacles;
    avoidEntities = false;

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // array of obstacles used by the AvoidBehavior
        const obstacles = [...this.obstacles];

        // create wandering entities that avoid targets
        for (let i = 0; i < this.entityCount; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new AvoidBehavior({
                        obstacles: obstacles,
                        avoidColor: 'red'
                    }),
                    new WanderBehavior({
                        steerChange: new Uniform(-20, +20),
                        speedChange: new Uniform(-50, +50)
                    }),
                    new WrapBehavior()
                ],
            });
            e.position.y = 0; // start away from static obstacles
            this.activate(e);

            // add entity to obstacle array
            if (this.avoidEntities) {
                obstacles.push(e);
            }
        }
    }
}

//------------------------------------------------------------------------------------
// SteeringFollow Simulation

/**
 * Steering simulation with entities that follow a target
 * while avoiding other entities.
 */
export class SteeringFollow extends SteeringBehaviors {
    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // array with obstacles used by the AvoidBehavior
        const obstacles: SteeringVehicle[] = [];

        // create a wandering target entity
        const target = new SteeringVehicle({
            ...getWanderProps(this),
            behaviors: [
                new WanderBehavior({ // wander around
                    steerChange: new Uniform(-10, +10),
                    speedChange: new Uniform(-50, +50)
                }),
                new AvoidBehavior({ // avoid followers
                    obstacles: obstacles,
                    turnAngle: 60
                }),
                new WrapBehavior() // wrap around
            ],
        });
        target.color = 'green';
        target.steerAngleMax = 30; // avoid sharp turns
        this.activate(target);

        // create entities that follow the target and avoid other entities
        for (let i = 0; i < this.entityCount; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new SeekBehavior({ // seek target
                        target: target.position
                    }),
                    new AvoidBehavior({ // avoid other followers
                        obstacles: obstacles,
                        avoidColor: 'red',
                        turnAngle: 60
                    })
                ],
            });
            this.activate(e);

            // add entity to obstacle array
            if (obstacles) {
                obstacles.push(e);
            }
        }
    }
}
