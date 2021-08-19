import { RandomInt, Uniform } from '../simscript/random';
import { ILink } from '../simscript/network';
import { assert, setOptions, Point } from '../simscript/util';

import { createNetwork } from './network-intro';
import { SteeringBehaviors, SteeringVehicle, SeekBehavior, AvoidBehavior } from './steering';

const SPEED_MIN = 2;
const SPEED_MAX = 100;
const SEGMENT_COUNT = 10;

// Simulation with a network and some Steering Vehicles
export class NetworkSteering extends SteeringBehaviors {
    network = createNetwork(3, 5, 200); // nodes are 100m apart
    rndNode = new RandomInt(this.network.nodes.length - 1);
    speed = new Uniform(SPEED_MAX / 5, SPEED_MAX);
    vehicles: NetworkSteeringVehicle[] = [];
    vehiclesDone = 0;

    onStarting() {
        super.onStarting();

        this.maxTimeStep = 0.05;
        this.vehicles = [];
        this.vehiclesDone = 0;

        // test head-on
        const nodes = this.network.nodes;
        if (false) {
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: this.network.shortestPath(nodes[0], nodes[4]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 1.5,
                path: this.network.shortestPath(nodes[4], nodes[0]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX * 1.5,
                path: this.network.shortestPath(nodes[4], nodes[0]),
            }));
        }

        // test passing
        if (false) {
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: this.network.shortestPath(nodes[5], nodes[9]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 2,
                path: this.network.shortestPath(nodes[6], nodes[9]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 3,
                path: this.network.shortestPath(nodes[7], nodes[9]),
            }));
        }

        // random paths
        if (true) {
            for (let i = 0; i < this.entityCount; i++) {
                this.vehicles.push(new NetworkSteeringVehicle(this));
            }
        }

        // activate all vehicles
        this.vehicles.forEach(v => this.activate(v));
    }
}

// Steering Vehicle that uses a SeekBehavior to travel on a network
export class NetworkSteeringVehicle extends SteeringVehicle<NetworkSteering> {
    path: ILink[] = [];

    constructor(simulation: NetworkSteering, options?: any) {
        super();

        const
            sim = simulation,
            network = sim.network,
            nodes = network.nodes,
            speed = sim.speed.sample();

        // initialize entity
        setOptions(this, {

            // simple properties
            color: 'orange',
            radius: 15,
            speedMin: SPEED_MIN,
            speedMax: speed,
            speed: speed,

            // behaviors
            behaviors: [
                new NetworkAvoidBehavior({
                    avoidColor: 'red',
                    obstacles: sim.vehicles,
                }),
                new NetworkSeekBehavior({
                    seekAngle: 5, // max turn per unit time
                    arrivalDistance: 5, // less than the vehicle radius
                    maxSpeedDistance: 10, // shorter than a link
                    arrive: () => {
                        this.done = true; // entity has reached its target
                        sim.vehiclesDone++;
                    }, 
                }),
            ]
        });

        // apply options
        setOptions(this, options);

        // create a random path if we don't have one
        if (!this.path || this.path.length == 0) {
            let from = sim.rndNode.sample();
            for (let i = 0; i < SEGMENT_COUNT; i++) {

                // select to nodes
                let to = (from + 20) % sim.network.nodes.length;

                // append to path
                this.path.push(...sim.network.shortestPath(nodes[from], nodes[to]));

                // start from current position
                from = to;
            }
        }
    }
}

/**
 * Behavior that causes entities to pass slower ones and swerve to
 * avoid collisions with other entities.
 */
export class NetworkAvoidBehavior extends AvoidBehavior {
    applyBehavior(e: NetworkSteeringVehicle, dt: number): boolean {
        this.entity = e;

        // find nearest obstacle
        const obstacle = this.getNearestObstacle(dt, e.radius * 2);
        if (obstacle instanceof NetworkSteeringVehicle) {
            const
                link = e.path[0],
                dist = Point.distance(e.position, link.to.position),
                angDelta = Math.abs(e.angle - obstacle.angle);
            if (dist > 3 * e.radius) { // don't turn if too close to nodes

                // passing another vehicle
                const pass = obstacle.speed < e.speed && angDelta < 45;

                // swerve to avoid head-on collision
                const avoid = angDelta > 135;

                // change angle pass or avoid, slow down while avoiding
                if (pass || avoid) {

                    // turn to pass and to avoid collisions
                    const
                        turnAngle = pass ? +30 : -30, // left to pass, right to avoid
                        targetAngle = Point.angle(link.from.position, link.to.position) + turnAngle;
                    e.angle = e.getTurnAngle(targetAngle, dt);

                    // adjust speed
                    if (!this.currentObstacle) {
                        if (avoid) { // slow down if avoiding
                            e.speed *= this.slowDown;
                        }
                    }

                    // remember current obstacle
                    this.currentObstacle = obstacle;
                    return this.preventOthersWhileAvoiding;
                }
            }
        }

        // not in avoiding mode
        this.currentObstacle = null;
        return false;
    }
}

/**
 * Behavior that makes an entity traverse a path formed by
 * a list of {@link ILink} objects.
 */
export class NetworkSeekBehavior extends SeekBehavior {
    _lastPath: ILink[];

    applyBehavior(e: NetworkSteeringVehicle, dt: number): boolean {
        if (e.path && e.path.length) {
           
            // update target
            const
                path = e.path,
                link = path[0];
            this.target = link.to.position;
            
            // initialize position
            if (path != this._lastPath) {
                this._lastPath = path;
                e.position = Point.clone(link.from.position);
                e.angle = Point.angle(link.from.position, link.to.position);
            }

            // adjust speed
            const
                dist = Point.distance(e.position, this.target),
                distMax = this.maxSpeedDistance || (e.simulation.bounds[1].x / 2),
                pct = dist / distMax;
            e.speed = e.speedMax * pct;

            // adjust angle
            let angTarget = Point.angle(e.position, this.target);
            e.angle = e.getTurnAngle(angTarget, dt, this.seekAngle);

            // raise event on arrival
            let arrivalDistance = this.arrivalDistance != null ? this.arrivalDistance : e.radius;
            if (dist < arrivalDistance) {
                path.shift();
                if (path.length == 0) {
                    this.onArrive();
                }
            }
        }
        return false;
    }
}