import { Simulation } from '../simscript/simulation';
import { Entity, IAnimationPosition } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Event, EventArgs } from '../simscript/event';
import { RandomVar, Uniform } from '../simscript/random';
import { IPoint, Point, setOptions, clamp } from '../simscript/util';

const
    FAST_MODE_FRAMEDELAY = 0,
    SLOW_MODE_FRAMEDELAY = 20;

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
 * Entities with a {@link position}, {@link angle}, {@link speed},
 * {@link acceleration}, {@link steerAngle}, and an 
 * {@link updatePosition} method that updates the current position
 * and angle after a time interval.
 * 
 * This class also has a {@link behaviors} property that contains
 * an array of {@link SteeringBehavior} objects which are applied
 * in sequence to update the entity state after each time increment.
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
  
    /**
     * Initializes a new instance of the {@link SteeringVehicle} class.
     */
    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    /**
     * Gets or sets the entity's current color.
     * 
     * The default value for this property is **'black'**.
     */
    color = 'black';
    /**
     * Gets or sets the entity's radius (used to detect collisions).
     * 
     * The default value for this property is **25**.
     */
    radius = 25;
    /**
     * Gets or sets an array containing {@link SteeringBehavior} objects
     * that determine how the entity moves within the simulation.
     */
    behaviors: SteeringBehavior[] = []; // no behaviors by default
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
        this._sin = Math.sin(value * Math.PI / 180);
        this._cos = Math.cos(value * Math.PI / 180);
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
            //this.behaviors.forEach(b => b.applyBehavior(this, dt));
            for (let i = 0; i < this.behaviors.length; i++) {
                const b = this.behaviors[i];
                if (b.applyBehavior(this, dt)) {
                    break; // stop iterating if applyBehavior returned true
                }
            }
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

    /**
     * Initializes a new instance of the SteeringBehavior class.
     */
    constructor(options?: any) {
        setOptions(this, options);
    }

    /**
     * Applies the behavior to the entity, updating its speed and
     * angle to achieve the desired behavior.
     * @returns False to continue iterating through the remaining behaviors,
     * false to stop and not apply any remaining behaviors.
     */
    applyBehavior(e: SteeringVehicle, dt: number): boolean {
        this.entity = e;
        return false;
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
    applyBehavior(e: SteeringVehicle, dt: number): boolean {
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
        return false;
    }
}

/**
 * BounceBehavior: Entity bounces around the simulation surface.
 */
export class BounceBehavior extends SteeringBehavior {
    applyBehavior(e: SteeringVehicle, dt: number): boolean {
        super.applyBehavior(e, dt);
        const bounds = e.simulation.bounds;
        if (bounds) {
            const p = e.position;
            if (p.x < bounds[0].x || p.x > bounds[1].x) {
                e.angle = 180 - e.angle;
            } else if (p.y < bounds[0].y || p.y > bounds[1].y) {
                e.angle = -e.angle;
            }
        }
        return false;
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

    applyBehavior(e: SteeringVehicle, dt: number): boolean {
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
        return false;
    }
}

/**
 * SeekBehavior: Entity moves toward a target.
 */
export class SeekBehavior extends SteeringBehavior {
    target: IPoint = null;
    readonly arrive = new Event();

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    /**
     * Gets or sets a value that represents the maximum change in
     * angle per unit time while seeking the target.
     * 
     * The default value for this property is **0.5**, which
     * corresponds to a 0.5 degree change in direction per unit
     * time while seeking a target.
     */
    seekAngle = 0.5;

    applyBehavior(e: SteeringVehicle, dt: number): boolean {
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
            e.angle = e.getTurnAngle(angTarget, dt, this.seekAngle);

            // re-start when close to center
            if (dist < e.radius) {
                this.onArrive();
            }
        }
        return false;
    }
    onArrive(e?: EventArgs) {
        this.arrive.raise(this, e);
    }
}

/**
 * AvoidBehavior: Entity avoids obstacles.
 */
export class AvoidBehavior extends SteeringBehavior {
    _currentObstacle: IObstacle = null;
    _saveColor = ''; // original color
    _saveSpeed = 0; // original speed

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    /**
     * Gets or sets the list of obstacles, represented by
     * an array of {@link IObstacle} objects.
     */
    obstacles: IObstacle[] = [];
    /**
     * Gets or sets the color used to represent the entity
     * while it is avoiding other entities.
     * 
     * The default value for this property is an empty string,
     * which preserves the original entity color while it is
     * avoiding other entities.
     */
    avoidColor = '';
    /**
     * Gets or sets a value that represents the slow-down factor
     * used to reduce the entity's speed while it is avoiding other 
     * entities.
     * 
     * The default value for this property is **0.75**, which
     * corresponds to a 25% speed reduction while avoiding other
     * entities.
     */
    slowDown = 0.75; // slow down factor while avoiding
    /**
     * Gets or sets a value that represents the maximum change in
     * angle per unit time while the entity is avoiding other 
     * entities.
     * 
     * The default value for this property is **0.5**, which
     * corresponds to a 0.5 degree change in direction per unit
     * time while avoiding other entities.
     */
    avoidAngle = 0.5;
    /**
     * Gets or sets a value that determines whether the behavior
     * should prevent other behaviors from being applied while 
     * avoiding an obstacle.
     * 
     * The default value for this property is **true**.
     */
    preventOthersWhileAvoiding = true;

    applyBehavior(e: SteeringVehicle, dt: number): boolean {
        super.applyBehavior(e, dt);

        // find nearest obstacle
        const obstacle = this._getNearestObstacle(dt);

        // change obstacle
        if (obstacle != this._currentObstacle) {
            if (this._currentObstacle == null && obstacle != null) { // start avoiding, save properties
                if (this.avoidColor) {
                    this._saveColor = e.color;
                    e.color = this.avoidColor;
                }
                this._saveSpeed = e.speed;
                e.speed *= this.slowDown;
            } else if (this._currentObstacle != null && obstacle == null) { // done avoiding, restore properties
                    if (this._saveColor) {
                        e.color = this._saveColor;
                    }
                    e.speed = this._saveSpeed;
            }
            this._currentObstacle = obstacle;
        }

        // avoid obstacle
        if (obstacle != null) {
            e.angle = this._getAvoidAngle(obstacle, dt);
            e.steerAngle = 0; // don't turn while avoiding
        }

        // return true if we are in avoiding mode
        return obstacle != null && this.preventOthersWhileAvoiding;
    }

    // gets the nearest obstacle to an entity
    _getNearestObstacle(dt: number): IObstacle {
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
                const
                    offset = o.radius + e.radius + e.speed * dt,
                    dist = Point.distance(pNow, o.position) - offset;
                if (minDist == null || dist < minDist) { // closer
                    if (dist < e.radius) { // close enough...
                        if (Point.distance(pNext, o.position) - offset < dist) { // and getting closer...
                            minDist = dist;
                            obstacle = o;
                        }
                    }
                }
            }
        });
        return obstacle;
    }

    // gets the angle to use in order to avoid an obstacle
    _getAvoidAngle(obstacle: IObstacle, dt: number): number {
        const
            e = this.entity,
            p = e.position,
            d = Point.distance(p, obstacle.position);
        
        // too close? don't even try
        if (d < obstacle.radius) {
            return e.angle;
        }

        // chooose new angle
        const
            aDelta = 90 * obstacle.radius / d,
            d1 = this._getDeltaDistance(obstacle, +aDelta),
            d2 = this._getDeltaDistance(obstacle, -aDelta),
            avoidDelta = d1 > d2 ? +aDelta : -aDelta;
        return e.getTurnAngle(e.angle + avoidDelta, dt, this.avoidAngle);
    }

    // measure the distance between an obstacle and a future entity position
    _getDeltaDistance(obstacle: IObstacle, aDelta: number): number {
        const
            e = this.entity,
            a = (e.angle + aDelta) * Math.PI / 180,
            d = obstacle.radius,
            p = {
                x: e.position.x + d * Math.cos(a),
                y: e.position.y + d * Math.sin(a)
            };
        return Point.distance(obstacle.position, p);
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
 * (wrapping or bouncing at the edges).
 */
export class SteeringWander extends SteeringBehaviors {
    bounce = false;
    
    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

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
                    this.bounce // wrap or bounce at the edges
                        ? new BounceBehavior()
                        : new WrapBehavior()
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
                        seekAngle: 0.5, // turn up to 0.5 degrees/unit time
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
    avoidColor = 'red'; // slows down 3D animations

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
                    new AvoidBehavior({ // avoid obstacles
                        obstacles: obstacles,
                        avoidColor: this.avoidColor
                    }),
                    new WanderBehavior({ // wander (if not avoiding obstacles)
                        steerChange: new Uniform(-20, +20),
                        speedChange: new Uniform(-50, +50)
                    }),
                    new WrapBehavior() // wrap at the edges
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

const staticFollowObstacles: IObstacle[] = [
    { position: { x: 250, y: 250 }, radius: 100 },
    { position: { x: 750, y: 250 }, radius: 100 },
];

/**
 * Steering simulation with entities that follow a target
 * while avoiding other entities.
 */
export class SteeringFollow extends SteeringBehaviors {
    avoidColor = 'red'; // slows down 3D animations
    obstacles = staticFollowObstacles;

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // array with obstacles used by the AvoidBehavior
        const obstacles = this.obstacles.slice();

        // create a wandering target entity
        const target = new SteeringVehicle({
            ...getWanderProps(this),
            behaviors: [
                new WrapBehavior(), // wrap around
                new AvoidBehavior({ // avoid followers
                    obstacles: obstacles,
                }),
                new WanderBehavior({ // wander around (if not avoiding followers)
                    steerChange: new Uniform(-10, +10),
                    speedChange: new Uniform(-10, +50)
                }),
            ],
        });
        target.color = 'green';
        target.steerAngleMax = 20; // prevent tight loops
        this.activate(target);

        // add target to obstacle array 
        // (so other entities will follow it but avoid hitting it)
        if (obstacles) {
            obstacles.push(target);
        }

        // create entities that follow the target and avoid other entities
        for (let i = 0; i < this.entityCount; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new AvoidBehavior({ // avoid other followers
                        obstacles: obstacles,
                        slowDown: .5,
                        avoidColor: this.avoidColor,
                    }),
                    new SeekBehavior({ // seek target (if not avoiding other followers)
                        target: target.position,
                    }),
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

/**
 * Testing AvoidBehavior strategies.
 */
export class SteeringTest extends SteeringBehaviors {
    avoidColor = 'red'; // slows down 3D animations
    obstacles = [
        { position: { x: 500, y: 250 }, radius: 150 },
    ];

    constructor(options?: any) {
        super();
        setOptions(this, options);
    }

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // array with obstacles used by the AvoidBehavior
        const
            obstacles = this.obstacles.slice(),
            r = this.obstacles[0].radius,
            yPos = new Uniform(250 - r, 250 + r);

        // create some wandering entities
        for (let i = 0; i < 12; i++) {
            const e = new SteeringVehicle({
                ...getWanderProps(this),
                behaviors: [
                    new WrapBehavior(), // wrap around
                    new AvoidBehavior({ // avoid followers
                        obstacles: obstacles,
                        avoidColor: this.avoidColor,
                    }),
                    new WanderBehavior({ // wander around (if not avoiding followers)
                        steerChange: new Uniform(-0, +0),
                        speedChange: new Uniform(-20, +20)
                    }),
                ],
            });
            e.angle = 0;
            e.position = { x: 0, y: yPos.sample() };
            e.speed = 20;
            e.color = 'green';
            e.steerAngleMax = 20; // prevent tight loops
            this.activate(e);
        }
    }
}
