import { Simulation } from '../simscript/simulation';
import { Queue } from '../simscript/queue';
import { Entity, IAnimationPosition } from '../simscript/entity';
import { Network, INode, ILink } from '../simscript/network';
import { Uniform, Exponential, RandomInt } from '../simscript/random';
import { Point, IPoint } from '../simscript/util';
import { Event, EventArgs } from '../simscript/event';

interface ICar {
    speed: number;
    maxSpeed: number;
    accel: number;
    position: number;
}

export class CarFollowNetwork extends Simulation {
    timeIncrement = 1; // seconds
    totalCars = 1000; // number of cars to simulate
    carSpeeds = new Uniform(40 / 3.6, 100 / 3.6); // 40-100 km/h in m/s
    interArrival = new Exponential(30); // avg seconds between car arrivals
    network = createNetwork(5, 9, 100); // nodes are 100m apart    
    rndNode = new RandomInt(this.network.nodes.length - 1);
    stats = {
        totalDistance: 0,
        totalTime: 0,
        carsDone: 0
    };
    readonly carFinished = new Event<CarFollowNetwork, EventArgs>();

    onStarting(e) {
        this.stats.totalDistance = 0;
        this.stats.totalTime = 0;
        this.stats.carsDone = 0;
    
        super.onStarting(e);
        this.generateEntities(Car, this.interArrival, this.totalCars);
    }
    onCarFinished(e?: EventArgs) {
        this.carFinished.raise(this, e);
    }
}

export class Car extends Entity implements ICar {
    speed = 0; // starting speed
    accel = 10; // acceleration/deceleration
    position = 0; // current position
    maxSpeed = 0; // random value from simulation
    path: ILink[]; // current path

    async script() {
        const
            sim = this.simulation as CarFollowNetwork,
            network = sim.network,
            nodes = network.nodes,
            dt = sim.timeIncrement;
        
        // get this car's max speed
        this.maxSpeed = sim.carSpeeds.sample();

        // select from/to nodes
        let
            ndFrom = nodes[0],
            ndTo = nodes[nodes.length - 1],
            position = 0;

        // travel one link at a time, 
        // re-computing the path to avoid congestion
        while (ndFrom != ndTo) {
            const timeStarted = sim.timeNow;

            // find the path
            this.path = network.shortestPath(ndFrom, ndTo);

            // move along the link
            const link = this.path[0];
            const length = sim.network.getLinkDistance(link);

            // enter link
            this.position = position;
            this.enterQueueImmediately(link.queue);

            // move along the link
            while (this.position < length) {
                this.speed = this.getSpeed(dt);
                await this.delay(dt);
                this.position += this.speed * dt;
            }

            // leave link
            this.leaveQueue(link.queue);

            // ready for the next link
            ndFrom = link.to;
            position = Math.max(0, this.position - length);

            // update link simulation stats
            sim.stats.totalDistance += Point.distance(link.from.position, link.to.position);
            sim.stats.totalTime += sim.timeNow - timeStarted;
        }

        // update car count simulation stats
        sim.stats.carsDone++;
        sim.onCarFinished();
    }

    // gets the car's animation position and angle
    getAnimationPosition(q: Queue, start: IPoint, end: IPoint): IAnimationPosition {
        const
            sim = this.simulation as CarFollowNetwork,
            len = sim.network.getLinkDistance(this.path[0]),
            pt = Point.interpolate(start, end, this.position / len);
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
        const vAhead = this.getCarAhead() as ICar;
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
            sim = this.simulation as CarFollowNetwork,
            link = this.path[0],
            q = link.queue;

        // index 0 is the first car
        const index = q.entities.indexOf(this);
        if (index > 0) {
            return q.entities[index - 1] as Car;
        }

        // look at the first car in the next link
        if (this.path.length > 1) {
            const qAhead = this.path[1].queue;
            if (qAhead.pop) {
                const carAhead = qAhead.entities[0] as Car;
                return {
                    speed: carAhead.speed,
                    maxSpeed: carAhead.maxSpeed,
                    accel: carAhead.maxSpeed,
                    position: this.position + carAhead.position
                }
            } else {
                return null; // no cars in the next link
            }
        }

        // no vehicle ahead, stop at the end of the link
        return {
            speed: 0,
            maxSpeed: 0,
            accel: 0,
            position: sim.network.getLinkDistance(link)
        };
    }
}

// network with congestion cost
class CongestionNetwork extends Network {
    getLinkDistance(link: ILink, prevLink?: ILink): number {
        let dist = super.getLinkDistance(link, prevLink);
        dist += dist * link.queue.pop * 0.5; // add some congestion cost
        return dist;
    }
}

// create a grid-like network
function createNetwork(rows: number, cols: number, spacing: number) {

    // create nodes
    const nodes: INode[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            nodes.push({
                id: nodes.length.toString(),
                position: { x: c * spacing, y: r * spacing },
                queue: new Queue()
            });
        }
    }

    // create links
    const links: ILink[] = [];
    for (let i = 0; i < nodes.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;

        // grid links
        if (col < cols - 1) { // right/left
            links.push({ from: nodes[i], to: nodes[i + 1], queue: new Queue() });
            links.push({ from: nodes[i + 1], to: nodes[i], queue: new Queue() });
        }
        if (row < rows - 1 && (i % 2 != 0)) { // up/down, sparse
            links.push({ from: nodes[i], to: nodes[i + cols], queue: new Queue() });
            links.push({ from: nodes[i + cols], to: nodes[i], queue: new Queue() });
        }

        // diagonal links
        if (row == 0 && col == 0) {
            links.push({ from: nodes[i + 1], to: nodes[i + cols], queue: new Queue() });
            links.push({ from: nodes[i + cols], to: nodes[i + 1], queue: new Queue() });
        }
        if (row == 0 && col == cols - 1) {
            links.push({ from: nodes[i - 1], to: nodes[i + cols], queue: new Queue() });
            links.push({ from: nodes[i + cols], to: nodes[i - 1], queue: new Queue() });
        }
        if (row == rows - 1 && col == 0) {
            links.push({ from: nodes[i + 1], to: nodes[i - cols], queue: new Queue() });
            links.push({ from: nodes[i - cols], to: nodes[i + 1], queue: new Queue() });
        }
        if (row == rows - 1 && col == cols - 1) {
            links.push({ from: nodes[i - 1], to: nodes[i - cols], queue: new Queue() });
            links.push({ from: nodes[i - cols], to: nodes[i - 1], queue: new Queue() });
        }
    }

    // return the network
    return new CongestionNetwork({
        nodes: nodes,
        links: links,
    });
}

// renders a network into an x3d element
function renderNetworkX3D(network: Network, x3d: HTMLElement) {
    const scene = x3d.querySelector('scene');
    let html = '';
    network.nodes.forEach(nd => {
        const pos = nd.position;
        html += `
            <transform class='ss-queue q${nd.id}' translation='${pos.x} ${pos.y} 0'>
                <shape>
                    <appearance>
                        <material transparency='0.5' diffuseColor='1 1 0'/>
                    </appearance>
                    <box size='5 5 2'></box>
                </shape>
            </transform>`;
    });
    network.links.forEach((link: ILink, index: number) => {
        if (index % 2 == 0) {
            const from = link.from.position;
            const to = link.to.position;
            const len = Point.distance(from, to);
            html += `
            <transform translation='${from.x} ${from.y} 0' rotation='0 0 1 ${Point.angle(from, to, true)}'>
                <transform translation='${len / 2} 0 0'>
                    <shape>
                        <appearance>
                            <material transparency='0' diffuseColor='.1 .1 .1'/>
                        </appearance>
                        <box size='${len + 30} 40 1'></box>
                    </shape>
                </transform>
            </transform>`;
        }
    });
    scene.innerHTML += html;
}
