import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Uniform } from '../simscript/random';
import { IPoint, Point } from '../simscript/util';
import { Event, EventArgs } from '../simscript/event';

const SCREEN_X = 1000;
const SCREEN_Y = 500;
const STEP_ANGLE = 10;
const STEP_SPEED = 2;
const MAX_SPEED = 20;
const MISSILE_SPEED = 30;
const ASTEROID_COUNT = 8;

/**
 * Sounds used in the game.
 */
enum Sounds {
    // https://www.mediacollege.com/downloads/sound-effects/explosion/
    thrust = './resources/thrust.mp3',
    missile = './resources/missile.mp3',
    explosion = './resources/explosion.mp3',
    won = './resources/won.mp3',
    lost = './resources/lost.mp3'
}

/**
 * Simple Asteroids Simulation.
 */
export class Asteroids extends Simulation {
    timeIncrement = 1;
    asteroidCount = ASTEROID_COUNT;
    asteroidInterval = new Uniform(0, 50);
    asteroidSpeed = new Uniform(MISSILE_SPEED * .25, MISSILE_SPEED * .5);
    keydown = this._keydown.bind(this);
    q = new Queue();
    ship: Ship;
    missilesFired: number;
    asteroidsDestroyed: number;
    sound = true;
    won = false;

    readonly missilesFiredChanged = new Event<Asteroids, EventArgs>();
    onMissilesFiredChanged(e?: EventArgs) {
        this.missilesFiredChanged.raise(this, e);
    }
    readonly asteroidsDestroyedChanged = new Event<Asteroids, EventArgs>();
    onAsteroidsDestroyedChanged(e?: EventArgs) {
        this.asteroidsDestroyedChanged.raise(this, e);
    }

    onStarting() {
        super.onStarting();

        // create ship
        this.ship = new Ship();
        this.activate(this.ship);
        this.missilesFired = 0;
        this.onMissilesFiredChanged();

        // create asteroids
        this.asteroidsDestroyed = 0;
        this.onAsteroidsDestroyedChanged();
        this.generateEntities(Asteroid, this.asteroidInterval, this.asteroidCount);

        // add event listener
        document.addEventListener('keydown', this.keydown);
    }
    onFinishing() {

        // remove event listener
        document.removeEventListener('keydown', this.keydown);
    }

    // game over!
    gameOver(won: boolean) {
        this.won = won;
        this.q.entities.forEach((e: Flyer) => e.done = true);
        setTimeout(() => {
            this.play(won ? Sounds.won : Sounds.lost);
        }, 800);
    }

    // handle keyboard commands
    _keydown(e: KeyboardEvent) {
        this.ship.keydown(e);
    }

    // play a sound
    play(sound: Sounds) {
        if (this.sound) {
            new Audio(sound).play();
        }
    }
}

/**
 * Base class for entities that have a position, and angle, and a speed.
 */
class Flyer extends Entity {
    radius = 0;
    pos: IPoint;
    spd: IPoint = new Point();
    done = false;
    _angle: number;
    _sin: number;
    _cos: number;

    // initializes a new instance of a Flyer.
    constructor(options?: any) {
        super(options);
        if (!options || options.angle == null) {
            this.angle = -90;
        }
    }

    // gets or sets the Flyer's current angle (and updates sin/cos).
    get angle(): number {
        return this._angle;
    }
    set angle(value: number) {
        this._angle = value;
        this._cos = Math.cos(value * Math.PI / 180);
        this._sin = Math.sin(value * Math.PI / 180);;
    }

    // gets the sine of the Flyer's current angle.
    get sin(): number {
        return this._sin;
    }

    // gets the co-sine of the Flyer's current angle.
    get cos(): number {
        return this._cos;
    }

    // increments the Flyer's speed
    incrementSpeed(step: number, maxSpeed?: number) {
        const spd = this.spd;
        spd.x += step * this.cos;
        spd.y += step * this.sin;
        if (maxSpeed != null) {
            const
                mod = Math.sqrt(spd.x * spd.x + spd.y * spd.y),
                ratio = maxSpeed / mod;
            if (mod != 0 && ratio < 1) {
                spd.x *= ratio;
                spd.y *= ratio;
            }
        }
    }

    // update the flyer's position, optionally wrapping around the screen
    // returns false if the flyer is out of bounds
    updatePosition(dt: number, wrap?: boolean): boolean {
        const
            pos = this.pos,
            spd = this.spd;
        pos.x += spd ? spd.x * dt : 0;
        pos.y += spd ? spd.y * dt : 0;
        if (wrap) {
            pos.x = (pos.x + SCREEN_X) % SCREEN_X;
            pos.y = (pos.y + SCREEN_Y) % SCREEN_Y;
        }
        return pos.x >= 0 && pos.x <= SCREEN_X && pos.y >= 0 && pos.y <= SCREEN_Y;
    }

    // checks whether this flyer has collided with another
    collidedWidth(f: Flyer) {
        return !this.done && !f.done && Point.distance(this.pos, f.pos) < this.radius + f.radius;
    }

    // position the flyer
    getAnimationPosition(q: Queue, start: IPoint, end: IPoint) {
        if (this.pos == null) {
            this.pos = start;
        }
       return {
            position: this.pos,
            angle: this.angle
        }    
    }
}

/**
 * Ship entity.
 * Users may control its direction and speed, and fire missiles to
 * destroy asteroids before they hit the ship.
 */
export class Ship extends Flyer {
    engineOn = 0;

    async script() {
        const
            sim = this.simulation as Asteroids,
            dt = sim.timeIncrement;

        // initialize ship radius
        this.radius = 45;

        // enter queue
        this.enterQueueImmediately(sim.q);

        // loop while playing the game
        for (; !this.done;) {
            await this.delay(dt);
            this.updatePosition(dt, true);
            if (sim.timeNow - this.engineOn > 5) {
                this.engineOn = 0;
            }
        }

        // game over...
        this.leaveQueue(sim.q);
    }

    // handle keyboard commands
    keydown(e: KeyboardEvent) {
        const sim = this.simulation as Asteroids;
        switch (e.key) {

            // left/right arrows turn the ship
            case 'ArrowLeft':
            case 'ArrowRight':
                {
                    const step = (e.key == 'ArrowLeft') ? -STEP_ANGLE : +STEP_ANGLE;
                    this.angle = (this.angle + step) % 360;
                }
                e.preventDefault();
                break;
            
            // up arrow accelerates the ship
            case 'ArrowUp':
                this.incrementSpeed(STEP_SPEED, MAX_SPEED);
                this.engineOn = sim.timeNow;
                sim.play(Sounds.thrust);
                e.preventDefault();
                break;

            // space fires a missile
            case ' ':
                const missile = new Missile(this);
                if (missile) {
                    sim.activate(missile);
                    sim.missilesFired++;
                    sim.onMissilesFiredChanged();
                }
                e.preventDefault();
                break;

            // S/s toggle sound
            case 'S':
            case 's':
                sim.sound = !sim.sound;
                e.preventDefault();
                break;
        }
    }
}

/**
 * Missile entity.
 * Fired from the ship, destroy asteroids when they collide.
 */
export class Missile extends Flyer {
    constructor(e: Ship) {
        super();

        // initialize missile radius
        this.radius = 10;

        // initialize missile position
        const
            pos = e.pos,
            offset = 80;
        this.pos = {
            x: pos.x + offset * e.cos,
            y: pos.y + offset * e.sin
        };

        // initialize missile angle
        this.angle = e.angle;

        // initialize missile speed
        this.spd = Point.clone(e.spd);
        this.incrementSpeed(MISSILE_SPEED);
    }

    async script() {
        const
            sim = this.simulation as Asteroids,
            dt = sim.timeIncrement;

        // play missile sound
        sim.play(Sounds.missile);

        // enter queue
        this.enterQueueImmediately(sim.q);
        
        // main loop
        for (; !this.done;) {
            await this.delay(dt);
            if (!this.updatePosition(dt, false)) {
                break;
            }
        }
        
        // leave queue and simulation
        this.leaveQueue(sim.q);
    }
}

/**
 * Asteroid class.
 * Asteroids roam around the screen.
 * When they collide with missiles, they are destroyed.
 * When they collide with the ship, the ship is destroyed.
 */
export class Asteroid extends Flyer {
    small = Math.random() < .4;

    async script() {
        const
            sim = this.simulation as Asteroids,
            ship = sim.ship,
            allEntities = sim.q.entities,
            dt = sim.timeIncrement,
            startSpeed = sim.asteroidSpeed.sample(),
            rotationStep = (Math.floor(Math.random() * 20) - 10) * (this.small ? 2 : 1);

        // initialize asteroid radius and rotation step
        this.radius = this.small ? 40 : 80;

        // initialize asteroid position, angle, and speed
        this.pos = new Point(ship.pos.x + SCREEN_X / 2, ship.pos.y + SCREEN_Y / 2);
        this.angle = Math.floor(Math.random() * 360);
        this.incrementSpeed(startSpeed);

        // enter queue
        this.enterQueueImmediately(sim.q);
        
        // main loop
        for (; !this.done && !ship.done;) {

            // check whether we've hit the ship (game over)
            if (this.collidedWidth(ship)) {
                sim.play(Sounds.explosion);
                sim.gameOver(false);
                break;
            }

            // check whether we've been hit by a missile
            for (let i = 0; i < allEntities.length; i++) {
                const missile = allEntities[i];
                if (missile instanceof Missile) {
                    if (this.collidedWidth(missile)) {
                        sim.play(Sounds.explosion);
                        missile.done = true;
                        this.done = true;
                        sim.asteroidsDestroyed++;
                        sim.onAsteroidsDestroyedChanged();

                        // all asteroids have been destroyed: game over
                        if (sim.asteroidsDestroyed == ASTEROID_COUNT) {
                            sim.gameOver(true);
                        }

                        // done
                        break;
                    }
                }
            }

            // wait and update position
            await this.delay(dt);
            this.updatePosition(dt, true);
            this.angle = (this.angle + rotationStep) % 360;
        }
         
        // leave queue and simulation
        this.leaveQueue(sim.q);
    }
}