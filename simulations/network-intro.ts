import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Exponential, Uniform, RandomInt } from '../simscript/random';
import { Network, INode, ILink } from '../simscript/network';
import { Event, EventArgs } from '../simscript/event';
import { assert, Point } from '../simscript/util';

// signals used in this Simulation
enum Signal {
    RequestArrived,
    RequestAssigned,
    ServiceArrived,
    ServiceFinished
};

// creates an entity-specific signal
function makeSignal(signal: Signal, e: Entity): string {
    return `${signal}.${e.serial}`;
}

/**
 * Simulates an area with some service vehicles.
 * 
 * Service requests are generated randomly and are
 * served by the service vehicles.
 * 
 * The simulation keeps track of vehicle utilization
 * and response times.
 */
export class NetworkIntro extends Simulation {
    serviceVehicles = 5;
    requests = 1000;
    requestsServed = 0;
    requestsMissed = 0;
    servers: ServiceVehicle[]; // all service vehicles
    qBusy = new Queue('busy', this.serviceVehicles); // server utilization (traveling + servicing)
    qWait = new Queue('wait'); // request wait before service starts
    qService = new Queue('service'); // service times
    interArrivalTime = new Exponential(60); // seconds
    serviceTime = new Exponential(120); // seconds
    serviceVehicleSpeed = new Uniform(3, 6); // m/s, about 10-20km/h
    network = createNetwork(5, 9, 100); // nodes are 100m apart
    rndNode = new RandomInt(this.network.nodes.length - 1);
    readonly requestFinished = new Event<NetworkIntro, EventArgs>();

    onStarting() {
        super.onStarting();
        this.servers = [];
        this.requestsServed = 0;
        this.requestsMissed = 0;
        this.generateEntities(ServiceRequest, this.interArrivalTime, this.requests);
        this.generateEntities(ServiceVehicle, new RandomInt(0), this.serviceVehicles); // three service vehicles
    }
    getRandomFreeNode(): INode {
        const nodes = this.network.nodes;
        let index = this.rndNode.sample();
        for (let offset = 0; offset < nodes.length; offset++) {
            let nd = nodes[(index + offset) % nodes.length];
            if (!nd.queue.pop) {
                return nd;
            }
        }
        return null; // no free node
    }
    onRequestFinished(e?: EventArgs) {
        this.requestFinished.raise(this, e);
    }
}

/**
 * Entity that represent service requests at specific
 * places on the network.
 */
export class ServiceRequest extends Entity<NetworkIntro> {
    node: INode; // service location
    assigned: number; // not assigned to any servers yet

    async script() {
        const sim = this.simulation;

        // select a free node
        this.node = sim.getRandomFreeNode();
        if (!this.node) {
            sim.requestsMissed++;
            console.log(`out of free nodes (${sim.requestsMissed} times)`);
            return;
        }
        
        // enter node and wait queues
        this.enterQueueImmediately(sim.qWait);
        this.enterQueueImmediately(this.node.queue);
        this.sendSignal(Signal.RequestArrived);

        // wait for service vehicle to take the request
        await this.waitSignal(makeSignal(Signal.RequestAssigned, this));

        // wait for service vehicle to arrive
        await this.waitSignal(makeSignal(Signal.ServiceArrived, this));

        // leave wait and node
        this.leaveQueue(sim.qWait);
        this.leaveQueue(this.node.queue);

        // undergo service and be done
        await this.waitSignal(makeSignal(Signal.ServiceFinished, this));
        sim.onRequestFinished();
    }
}

/**
 * Entity that represents service vehicles that scan the network
 * for requests, travel to them, and perform the service.
 */
export class ServiceVehicle extends Entity<NetworkIntro> {
    node: INode;
    request: ServiceRequest;
    busy = false;

    async script() {
        const sim = this.simulation;

        // enter server list
        sim.servers.push(this);

        // select initial location, enter node queue
        this.node = sim.getRandomFreeNode();
        this.enterQueueImmediately(this.node.queue);

        // loop
        for (; ;) {

            // look for closest awaiting entity
            for (this.request = null; !this.request;) {
                this.request = this.getClosestRequest();
                if (!this.request) {
                    await this.waitSignal(Signal.RequestArrived);
                }
            }

            // send RequestAssigned signal
            assert(this.request.assigned == null, 'request should not be assigned');
            this.request.assigned = this.serial;
            this.sendSignal(makeSignal(Signal.RequestAssigned, this.request));

            // keep track of server utilization
            this.enterQueueImmediately(sim.qBusy);
            
            // leave node queue and travel to request
            this.leaveQueue(this.node.queue);
            const path = sim.network.shortestPath(this.node, this.request.node);
            assert(path.length > 0, 'cannot reach destination');

            if (true) { // single delay for the whole path
                const [queues, distance] = sim.network.mergePath(path);
                await this.delay(distance / sim.serviceVehicleSpeed.sample(), {
                    queues: queues,
                    tension: .8, // default is 1
                    //radius: 20, // default is zero
                });
            } else { // one delay per link
                for (let i = 0; i < path.length; i++) {
                    const
                        link = path[i],
                        distance = sim.network.getLinkDistance(link, i > 0 ? path[i - 1] : null),
                        speed = sim.serviceVehicleSpeed.sample();
                    await this.delay(distance / speed, {
                        queues: [link.from.queue, link.to.queue]
                    });
                }
            }

            // arrive service node
            this.busy = true;
            this.node = this.request.node;
            this.sendSignal(makeSignal(Signal.ServiceArrived, this.request));
            this.enterQueueImmediately(this.node.queue);

            // perform service
            this.enterQueueImmediately(sim.qService);
            await this.delay(sim.serviceTime.sample());
            this.leaveQueue(sim.qService);
            this.sendSignal(makeSignal(Signal.ServiceFinished, this.request));
            this.leaveQueue(this.node.queue);
            this.busy = false;
            sim.requestsServed++;
            this.enterQueueImmediately(this.node.queue);

            // keep track of server utilization
            this.leaveQueue(sim.qBusy);
        }
    }

    // gets the closest request to this server
    getClosestRequestQuick(): ServiceRequest {
        const sim = this.simulation;
        assert(!this.busy, 'should not be looking for service while busy');
        let
            closestRequest: ServiceRequest = null,
            minDist: number;
        sim.qWait.entities.forEach((e: ServiceRequest) => {
            if (e.assigned == null) { // request has not been assigned
                const dist = Point.distance(this.node.position, e.node.position);
                if (minDist == null || dist < minDist) { // keep closest request
                    closestRequest = e;
                    minDist = dist;
                }
            }
        });
        return closestRequest;
    }

    // gets the closest request to this server
    // taking into account the position of other idle service vehicles.
    getClosestRequest(): ServiceRequest {
        const sim = this.simulation;
        assert(!this.busy, 'should not be looking for service while busy');

        // get unassigned vehicles and requests
        const servers = sim.servers.filter(server => server.busy == false);
        const requests = (sim.qWait.entities as ServiceRequest[]).filter(request => request.assigned == null);

        // no requests...
        if (requests.length == 0) {
            return null;
        }

        // build distance matrix
        // distances[i] contains an array with the distances 
        // from the ith server to each request.
        const distances = [];
        servers.forEach(server => {
            let serverDist = [];
            distances.push(serverDist);
            requests.forEach(request => {
                const d = Point.distance(server.node.position, request.node.position);
                serverDist.push(d);
            });
        });

        // assign servers to requests
        const serverMap = new Map<any, any>();
        const requestMap = new Map<any, any>();
        while (serverMap.size < servers.length && requestMap.size < requests.length) {
            const min = {
                distance: null,
                vehicle: null,
                destination: null,
            };
        
            // scan unassigned servers
            for (let s = 0; s < distances.length; s++) {
                if (!serverMap.has(servers[s])) {
        
                    // scan unassigned requests
                    for (let d = 0; d < distances[s].length; d++) {
                        if (!requestMap.has(requests[d])) {
        
                            // keep shortest unassigned value
                            let distance = distances[s][d];
                            if (min.distance == null || distance < min.distance) {
                                min.vehicle = servers[s];
                                min.destination = requests[d];
                                min.distance = distance;
                            }
                        }
                    }
                }
            }
            serverMap.set(min.vehicle, min.destination);
            requestMap.set(min.destination, min.vehicle);
        }

        // done
        return serverMap.get(this);
    }
}

// create a grid-like network
export function createNetwork(rows: number, cols: number, spacing: number, sparse = true) {

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
            links.push({ from: nodes[i], to: nodes[i + 1] });
            links.push({ from: nodes[i + 1], to: nodes[i] });
        }
        if (row < rows - 1 && (!sparse || i % 2 != 0)) { // up/down, sparse
            links.push({ from: nodes[i], to: nodes[i + cols] });
            links.push({ from: nodes[i + cols], to: nodes[i] });
        }

        // diagonal links
        if (sparse) {
            if (row == 0 && col == 0) {
                links.push({ from: nodes[i + 1], to: nodes[i + cols] });
                links.push({ from: nodes[i + cols], to: nodes[i + 1] });
            }
            if (row == 0 && col == cols - 1) {
                links.push({ from: nodes[i - 1], to: nodes[i + cols] });
                links.push({ from: nodes[i + cols], to: nodes[i - 1] });
            }
            if (row == rows - 1 && col == 0) {
                links.push({ from: nodes[i + 1], to: nodes[i - cols] });
                links.push({ from: nodes[i - cols], to: nodes[i + 1] });
            }
            if (row == rows - 1 && col == cols - 1) {
                links.push({ from: nodes[i - 1], to: nodes[i - cols] });
                links.push({ from: nodes[i - cols], to: nodes[i - 1] });
            }
        }
    }

    // return the network
    return new Network({
        nodes: nodes,
        links: links,
    });
}

// renders a network into an SVG element
export function renderNetworkSVG(network: Network, svg: HTMLElement, nodes = true, links = true, distances = false) {
    const
        svgns = 'http://www.w3.org/2000/svg',
        setAttributes = (e, atts) => {
            for (let k in atts) {
                e.setAttribute(k, atts[k].toString());
            }
        };
        
    if (links) {
        network.links.forEach((l: ILink, index: number) => {
            if (index % 2 == 0) {
                const
                    line = document.createElementNS(svgns, 'line'),
                    from = l.from.position,
                    to = l.to.position;
                setAttributes(line, {
                    class: `ss-link ${l.id ? 'id' + l.id : ''}`,
                    x1: from.x,
                    y1: from.y,
                    x2: to.x,
                    y2: to.y
                });
                svg.appendChild(line);

                if (distances) {
                    const
                        circle = document.createElementNS(svgns, 'circle'),
                        cx = ((from.x + to.x) / 2),
                        cy = ((from.y + to.y) / 2);
                    setAttributes(circle, {
                        cx: cx,
                        cy: cy,
                        r: 1,
                        'stroke-width': 0,
                        fill: 'white'
                    });
                    svg.appendChild(circle);

                    const text = document.createElementNS(svgns, 'text');
                    setAttributes(text, {
                        x: cx,
                        y: cy,
                    });
                    text.innerHTML = this.getLinkDistance(l).toFixed(0);
                    svg.appendChild(text);
                }
            }
        });
    }

    if (nodes) {
        network.nodes.forEach((nd: INode) => {
            const
                circle = document.createElementNS(svgns, 'circle'),
                pt = nd.position;
            setAttributes(circle, {
                class: `ss-node ${nd.id ? 'id' + nd.id : ''}`,
                cx: pt.x,
                cy: pt.y,
                r: '2%'
            });
            svg.appendChild(circle);

            const text = document.createElementNS(svgns, 'text');
            setAttributes(text, {
                x: pt.x,
                y: pt.y,
                fill: 'black',
                strokeWidth: 0
            });
            text.innerHTML = nd.id;
            svg.appendChild(text);
        });
    }
}

// renders a network into an x3d element
export function renderNetworkX3D(network: Network, x3d: HTMLElement, nodes = true, links = true) {
    let html = '';
    if (nodes) {
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
    }
    if (links) {
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
    }
    const scene = x3d.querySelector('scene');
    scene.innerHTML += html;
}
