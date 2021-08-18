import { RandomInt, Uniform } from '../simscript/random';
import { ILink } from '../simscript/network';
import { assert, setOptions, Point } from '../simscript/util';

import { createNetwork } from './network-intro';
import { SteeringBehaviors, SteeringVehicle, SeekBehavior, AvoidBehavior, IObstacle } from './steering';

const SPEED_MIN = 2;
const SPEED_MAX = 50;
const SEGMENT_COUNT = 10;

// Simulation with a network and some Steering Vehicles
export class NetworkSteering extends SteeringBehaviors {
    network = createNetwork(3, 5, 200); // nodes are 100m apart
    rndNode = new RandomInt(this.network.nodes.length - 1);
    speed = new Uniform(SPEED_MAX / 5, SPEED_MAX);
    vehicles: NetworkSteeringVehicle[] = [];

    onStarting() {
        super.onStarting();

        const nodes = this.network.nodes;
        this.maxTimeStep = 0.05;
        this.vehicles = [];

        // test head-on
        if (false) {
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 3,
                path: this.network.shortestPath(nodes[1], nodes[4]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 4,
                path: this.network.shortestPath(nodes[0], nodes[4]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: this.network.shortestPath(nodes[4], nodes[0]),
            }));
        }

        // test passing
        if (false) {
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 3,
                path: this.network.shortestPath(nodes[6], nodes[8]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX / 4,
                path: this.network.shortestPath(nodes[6], nodes[8]),
            }));
            this.vehicles.push(new NetworkSteeringVehicle(this, {
                speedMax: SPEED_MAX,
                path: this.network.shortestPath(nodes[5], nodes[9]),
            }));
        }

        // random
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
    seekBehavior: SeekBehavior;
    path: ILink[] = [];
    segment = 0;

    constructor(simulation: NetworkSteering, options?: any) {
        super();

        // build the full network path for this entity
        const
            sim = simulation,
            network = sim.network,
            nodes = network.nodes,
            speed = sim.speed.sample();
        
        let from = sim.rndNode.sample();
        for (let i = 0; i < SEGMENT_COUNT; i++) {

            // select to nodes
            let to = sim.rndNode.sample();
            while (to == from) {
                to = sim.rndNode.sample();
            }

            // append to path
            this.path.push(...sim.network.shortestPath(nodes[from], nodes[to]));
            this.path.push(null); // add a null link to mark the end of the segment

            // start from current position
            from = to;
        }

        // initialize entity
        this.seekBehavior = new SeekBehavior({
            seekAngle: 5, // max turn per unit time
            arrivalDistance: 1, // less than the vehicle radius
            maxSpeedDistance: 10, // shorter than a link
            arrive: () => this.done = true, // entity has reached its target
        });
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
                this.seekBehavior,
            ]
        });

        // apply options
        setOptions(this, options);
    }

    async script() {
        const sim = this.simulation;

        // enter animation queue
        this.enterQueueImmediately(sim.q);

        // initialize position and angle
        const link = this.path[0];
        this.position = Point.clone(link.from.position);
        this.angle = Point.angle(link.from.position, link.to.position);

        // travel through each link
        while (this.path.length > 0) {

            // get next node
            const link = this.path[0];

            // move to it
            if (link != null) {

                // seek next node
                this.seekBehavior.target = link.to.position;

                // travel to it (seekBehavior sets **done** to true on arrival)
                for (this.done = false; !this.done;) {
                    await this.delay(sim.step);
                }
                
            } else {
                this.segment++;
                //console.log(`entity ${this.serial} finished segment ${this.segment} / ${SEGMENT_COUNT}`);
            }

            // done with this link, remove it from the path
            this.path.shift();
        }

        // done
        this.leaveQueue(sim.q);
    }
}

export class NetworkAvoidBehavior extends AvoidBehavior {
    applyBehavior(e: NetworkSteeringVehicle, dt: number): boolean {
        this.entity = e;

        // find nearest obstacle
        const obstacle = this.getNearestObstacle(dt);
        if (obstacle instanceof NetworkSteeringVehicle && !obstacle.done) {
            const
                link = e.path[0],
                dist = Point.distance(e.position, link.to.position),
                angDelta = Math.abs(e.angle - obstacle.angle);
            if (dist > 4 * e.radius) { // dont turn if too close to nodes

                // passing another vehicle
                const passing = obstacle.speed < e.speed && angDelta < 45;

                // head-on collision
                const headOn = angDelta > 135;

                // turn to pass and to avoid collisions
                if (passing || headOn) {
                    const angle = Point.angle(link.from.position, link.to.position);
                    e.angle = e.getTurnAngle(angle - 45, dt);
                    if (headOn && !this.currentObstacle) {
                        e.speed *= this.slowDown;
                    }
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