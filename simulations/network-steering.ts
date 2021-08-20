import { RandomInt, Uniform } from '../simscript/random';
import { ILink } from '../simscript/network';
import { setOptions, Point } from '../simscript/util';

import { createNetwork } from './network-intro';
import { SteeringBehaviors, SteeringVehicle, SeekBehavior, AvoidBehavior } from './steering';

const SPEED_MIN = 5;
const SPEED_MAX = 100;
const SEGMENT_COUNT = 10;

// Simulation with a network and some Steering Vehicles
export class NetworkSteering extends SteeringBehaviors {
    network = createNetwork(3, 5, 200, false); // nodes are 200m apart
    rndNode = new RandomInt(this.network.nodes.length - 1);
    speed = new Uniform(SPEED_MIN, SPEED_MAX);
    vehicles: NetworkSteeringVehicle[] = [];
    vehiclesDone = 0;

    onStarting() {
        super.onStarting();

        this.maxTimeStep = 0.05;
        this.vehicles = [];
        this.vehiclesDone = 0;

        // testing
        if (false) {

            // head-on
            const
                network = this.network,
                nodes = network.nodes;
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: [
                    ...network.shortestPath(nodes[0], nodes[4]),
                    ...network.shortestPath(nodes[4], nodes[10])
                ]
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 1.5,
                path: network.shortestPath(nodes[4], nodes[0]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX * 1.5,
                path: network.shortestPath(nodes[4], nodes[0]),
            }));

            // passing
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: [
                    ...network.shortestPath(nodes[5], nodes[9]),
                    ...network.shortestPath(nodes[9], nodes[10])
                ]
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 2,
                path: network.shortestPath(nodes[6], nodes[9]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 3,
                path: network.shortestPath(nodes[7], nodes[9]),
            }));
        } else {

            // generate entities with random paths
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
                let to = sim.rndNode.sample();
                while (to == from) {
                    to = sim.rndNode.sample();
                }

                // append to path
                this.path.push(...sim.network.shortestPath(nodes[from], nodes[to]));

                // start from current position
                from = to;
            }
        }
    }
}

/**
 * Behavior that causes entities to turn in order to overtake slower ones
 * and swerve to avoid head-on collisions with other entities.
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
                        turnAngle = pass ? +10 : -30, // left to pass, right to avoid
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
 * Behavior that makes an entity traverse a path formed by a list
 * of {@link ILink} objects.
 */
export class NetworkSeekBehavior extends SeekBehavior {
    _lastPath: ILink[];

    constructor(options: any) {
        super();
        this.seekAngle = 5; // max turn per unit time
        setOptions(this, options);
    }

    applyBehavior(e: NetworkSteeringVehicle, dt: number): boolean {
        const path = e.path;
        if (path && path.length) {

            // save from position
            let link = path[0];
            const startPosition = Point.clone(link.from.position);

            // merge with next link if the angle is the same
            const angle = Point.angle(link.from.position, link.to.position);
            if (path.length > 1) {
                const nextLink = path[1];
                if (Point.angle(nextLink.from.position, nextLink.to.position) == angle) {
                    link = nextLink;
                    path.shift();
                }
            }

            // update target
            this.target = link.to.position;

            // initialize position
            if (path != this._lastPath) {
                this._lastPath = path;
                e.position = startPosition;
                e.angle = angle;
            }

            // adjust speed
            const
                dist = Point.distance(e.position, this.target),
                distMax = this.maxSpeedDistance || (e.simulation.bounds[1].x / 2),
                pct = dist / distMax;
            e.speed = e.speedMax * pct;

            // get arrival distance
            let arrivalDistance = this.arrivalDistance != null
                ? this.arrivalDistance
                : e.radius;

            // adjust angle
            let angTarget = Point.angle(e.position, this.target);
            e.angle = e.getTurnAngle(angTarget, dt, this.seekAngle);

            // raise event on arrival
            if (dist < arrivalDistance) {
                path.shift();
                if (path.length == 0) {
                    this.onArrive();
                }
            }
        }
 
        // done
        return false;
    }
}